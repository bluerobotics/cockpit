import { useStorage, useThrottleFn } from '@vueuse/core'
import { BlobReader, BlobWriter, ZipWriter } from '@zip.js/zip.js'
import { differenceInSeconds } from 'date-fns'
import { saveAs } from 'file-saver'
import { defineStore } from 'pinia'
import { v4 as uuid } from 'uuid'
import { computed, markRaw, reactive, ref, watch } from 'vue'
import adapter from 'webrtc-adapter'

import { Go2RTCManager } from '@/composables/go2rtc'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { goToMenuPage } from '@/composables/menuRouting'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { useSnackbar } from '@/composables/snackbar'
import { WebRTCManager } from '@/composables/webRTC'
import {
  type ProcessedStreamInfo,
  getIpsInformationFromVehicle,
  getStreamInformationFromVehicle,
  isTetheredInterfaceType,
} from '@/libs/blueos'
import eventTracker from '@/libs/external-telemetry/event-tracking'
import { availableCockpitActions, registerActionCallback } from '@/libs/joystick/protocols/cockpit-actions'
import {
  LiveVideoProcessor,
  LiveVideoProcessorChunkAppendingError,
  LiveVideoProcessorInitializationError,
} from '@/libs/live-video-processor'
import { datalogger } from '@/libs/sensors-logging'
import { StreamActivationBackoff } from '@/libs/stream-activation-backoff'
import { isElectron, isEqual, messageFromError, sanitizeFilenameComponent, sleep } from '@/libs/utils'
import { createGapFillerStream } from '@/libs/video-gap-filler'
import { telemetryOverlayWindowCandidates } from '@/libs/video-telemetry'
import { tempVideoStorage, videoStorage } from '@/libs/videoStorage'
import type { Stream } from '@/libs/webrtc/signalling_protocol'
import { trackVideoArrival } from '@/libs/webrtc/stats'
import { readableVideoCodecName } from '@/libs/webrtc/video-codec-support'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import { Alert, AlertLevel } from '@/types/alert'
import { SubMenuComponentName } from '@/types/general'
import {
  type DownloadProgressCallback,
  type Go2RTCStreamInfo,
  type RecordingSession,
  type StreamData,
  type StreamPeerConnectionInfo,
  type UnprocessedVideoInfo,
  type VideoRecordingFinalizationResult,
  type VideoStreamProtocol,
  FilesToZip,
  VideoExtensionContainer,
  VideoStreamCorrespondency,
} from '@/types/video'
import {
  videoChunkName,
  videoFilename,
  videoSegmentFilename,
  videoSegmentSubFolders,
  videoSubtitlesFilename,
  videoThumbnailFilename,
} from '@/utils/video'

import { useAlertStore } from './alert'
const { openSnackbar, closeSnackbar } = useSnackbar()

// How long a recording cut by a video outage waits for its stream before the stop is reported as final
const secondsToWaitForStreamToResumeRecording = 60
// How long a recording the outage outlasted waits for the stream to start a new one on it
const minutesToWaitForStreamToRestartRecording = 10
// Each try at a session the camera offers in a recordable form costs the pilot a reconnect of the live video
const maxUnrecordableSessionRenewals = 10
const secondsToPlayUnrecordableSessionBeforeRenewing = 3
// Outages a recording is carried across before a link that keeps flapping is taken as beyond saving
const maxOutagesInARecording = 20
// The only codec a recording's segments are muxed into MP4 from without re-encoding them
const recordingMimeType = 'video/x-matroska;codecs=avc1'
// Shorter than the session's own video watchdog, so the recording covers the outage from the moment it starts
const secondsWithoutVideoToStallRecording = 3

export const useVideoStore = defineStore('video', () => {
  const missionStore = useMissionStore()
  const alertStore = useAlertStore()
  const { showDialog, closeDialog } = useInteractionDialog()

  const mainVehicleStore = useMainVehicleStore()
  const {
    globalAddress,
    rtcConfiguration,
    webRTCSignallingURI,
    sendStartVideoCaptureCommand,
    sendStopVideoCaptureCommand,
    sendStartImageCaptureCommand,
  } = mainVehicleStore
  console.debug('[WebRTC] Using webrtc-adapter for', adapter.browserDetails)

  const streamsCorrespondency = useBlueOsStorage<VideoStreamCorrespondency[]>('cockpit-streams-correspondency', [])
  const persistedIgnoredStreamExternalIds = useBlueOsStorage<string[]>('cockpit-ignored-stream-external-ids', [])
  const allowedIceIps = useBlueOsStorage<string[]>('cockpit-allowed-stream-ips', [])
  const enableAutoIceIpFetch = useBlueOsStorage('cockpit-enable-auto-ice-ip-fetch', true)
  const allowedIceProtocols = useBlueOsStorage<string[]>('cockpit-allowed-stream-protocols', [])
  const jitterBufferTarget = useBlueOsStorage<number>('cockpit-jitter-buffer-target', 0)
  const activeStreams = ref<{ [key in string]: StreamData | undefined }>({})
  // Tracks which consumers (widgets, snapshot captures, etc.) currently need each external stream active, so it
  // can be torn down once nothing references it anymore. Intentionally not reactive/persisted, it's just bookkeeping.
  const streamConsumers = new Map<string, Set<string>>()
  const mainWebRTCManager = new WebRTCManager(webRTCSignallingURI, rtcConfiguration)
  const availableIceIps = ref<string[]>([])
  const unprocessedVideos = useStorage<{ [key in string]: UnprocessedVideoInfo }>('cockpit-unprocessed-video-info', {})
  const lastRenamedStreamName = ref('')
  const isRecordingAllStreams = ref(false)
  const liveProcessors = ref<{ [key: string]: LiveVideoProcessor }>({})
  const enableLiveProcessing = useBlueOsStorage('cockpit-enable-live-processing', true)
  const keepRawVideoChunksAsBackup = useBlueOsStorage('cockpit-keep-raw-video-chunks-as-backup', true)
  const userRestoredStreamIds = useBlueOsStorage<string[]>('cockpit-user-restored-stream-ids', [])
  // The ignored list mixes the streams the user chose to hide with the ones an automatic rule hid for them, so this
  // records which of those ids the user asked for, letting a client the rule does not apply to disregard the rest.
  const userIgnoredStreamIds = useBlueOsStorage<string[]>('cockpit-user-ignored-stream-ids', [])
  const recordingMonitors: { [key: string]: ReturnType<typeof setInterval> | undefined } = {}
  // Streams whose recording a video outage cut, each holding the teardown of its wait for the stream to come back
  const pendingRecordingResumes: { [key: string]: () => void } = {}
  // Streams whose recording an outage outlasted, each holding the teardown of its wait to start a new one
  const pendingRecordingRestarts: { [key: string]: () => void } = {}
  // Streams being recorded whose video stopped arriving without their stream ending, and the teardown of what follows it
  const streamsWithStalledVideo = reactive<{ [key: string]: boolean }>({})
  const videoFlowWatchers: { [key: string]: () => void } = {}
  const broadcastCameraActionsOverMavlink = useBlueOsStorage('cockpit-broadcast-camera-actions-over-mavlink', false)
  // Streams whose recording start we mirrored over MAVLink. The broadcast fires only on the 0->1 and 1->0
  // transitions, so recording several streams at once does not repeat the same commands.
  const mirroredRecordingStreams = new Set<string>()
  // Keyed by the warning message, so silencing one recording health warning doesn't silence the others.
  const suppressedRecordingHealthMessages = new Set<string>()
  type RecordingHealthWarning = {
    /**
     * Text of the warning, shown in the dialog and used as the key of the session opt-out.
     */
    message: string
    /**
     * Whether the warning means the recording may already be lost, which lets it take the surface from a milder one.
     */
    meansDataLoss: boolean
  }
  // Shared by the monitors of all recording streams, since they all warn through the same single dialog surface.
  let openRecordingHealthWarning: RecordingHealthWarning | undefined

  const releaseRecordingHealthDialog = (warning: RecordingHealthWarning): void => {
    // Compared by identity, not by text: closing the dialog leaves its promise pending, so the release can run a
    // tick later, once a warning with the very same wording has claimed the surface again.
    if (openRecordingHealthWarning === warning) openRecordingHealthWarning = undefined
  }
  const suppressRecordingHealthDialog = (warning: RecordingHealthWarning): void => {
    logUserAction(`Silenced the recording health warning "${warning.message}" for this session`)
    suppressedRecordingHealthMessages.add(warning.message)
    releaseRecordingHealthDialog(warning)
    closeDialog()
  }
  const closeRecordingHealthDialog = (warning: RecordingHealthWarning): void => {
    logUserAction(`Closed the recording health warning "${warning.message}"`)
    releaseRecordingHealthDialog(warning)
    closeDialog()
  }
  const showRecordingHealthDialog = (message: string, meansDataLoss = false): void => {
    if (suppressedRecordingHealthMessages.has(message)) return
    // The warning on screen owns the single dialog surface until it is settled, be it by the actions below or by an
    // unrelated dialog replacing it. Nothing but the user settles it, so a warning about a recording that may
    // already be lost takes the surface from a milder one instead of waiting behind it forever.
    // ponytail: warnings that mean the same for the recording queue behind whichever showed first, so a second
    // unhealthy stream can wait as long as the user leaves the first dialog up. Queue the surface if that bites.
    if (openRecordingHealthWarning && (openRecordingHealthWarning.meansDataLoss || !meansDataLoss)) return
    const warning = { message, meansDataLoss }
    openRecordingHealthWarning = warning
    const release = (): void => releaseRecordingHealthDialog(warning)
    showDialog({
      message,
      variant: 'error',
      // Persistent so it can only be closed via the actions below. The monitor re-checks every 15 seconds, so the
      // opt-out action is the only way for the user to stop being told about a problem they already know about.
      persistent: true,
      actions: [
        {
          text: "Don't show again during this session",
          size: 'small',
          action: () => suppressRecordingHealthDialog(warning),
        },
        { text: 'Close', size: 'small', action: () => closeRecordingHealthDialog(warning) },
      ],
    }).then(release, release)
  }

  const streamInformation = ref<ProcessedStreamInfo[]>([])
  const go2rtcStreamInfo = ref<Record<string, Go2RTCStreamInfo>>({})

  const fetchStreamInformation = async (): Promise<void> => {
    if (!globalAddress) return
    try {
      streamInformation.value = await getStreamInformationFromVehicle(globalAddress)
    } catch (error) {
      console.error('Failed to fetch stream information:', error)
    }
  }

  const fetchGo2rtcStreamInfo = async (): Promise<void> => {
    if (!window.electronAPI) return
    try {
      go2rtcStreamInfo.value = await window.electronAPI.go2rtcGetStreamsInfo()
    } catch (error) {
      console.error('Failed to fetch go2rtc stream info:', error)
    }
  }

  setInterval(() => {
    fetchStreamInformation()
    fetchGo2rtcStreamInfo()
  }, 5000)
  fetchStreamInformation()
  fetchGo2rtcStreamInfo()

  const namesAvailableWebRTCStreams = computed(() =>
    mainWebRTCManager.availableStreams.value.map((stream) => stream.name)
  )

  const namesAvailableStreams = computed(() => {
    const rtspStreams = streamsCorrespondency.value
      .filter((stream) => (stream.protocol ?? 'webrtc') === 'rtsp')
      .map((stream) => stream.externalId)
    return [...new Set([...namesAvailableWebRTCStreams.value, ...rtspStreams])]
  })

  const namessAvailableAbstractedStreams = computed(() => {
    return streamsCorrespondency.value.map((stream) => stream.name)
  })

  const externalStreamId = (internalName: string): string | undefined => {
    const corr = streamsCorrespondency.value.find((stream) => stream.name === internalName)
    return corr ? corr.externalId : undefined
  }

  const internalStreamNameFromExternal = (externalId: string): string | undefined => {
    const corr = streamsCorrespondency.value.find((stream) => stream.externalId === externalId)
    return corr ? corr.name : undefined
  }

  const getStreamCorrespondency = (externalId: string): VideoStreamCorrespondency | undefined => {
    return streamsCorrespondency.value.find((stream) => stream.externalId === externalId)
  }

  const getStreamProtocol = (externalId: string): VideoStreamProtocol => {
    return getStreamCorrespondency(externalId)?.protocol ?? 'webrtc'
  }

  const getRtspUrl = (externalId: string): string | undefined => {
    if (getStreamProtocol(externalId) !== 'rtsp') return undefined
    return getStreamCorrespondency(externalId)?.rtspUrl
  }

  /**
   * Get display information for a stream (source, resolution, fps, protocol label)
   * @param {string} externalId - External stream identifier
   * @returns {{ source: string, resolution: string, fps: string, protocolLabel: string }}
   */
  const getStreamDisplayInfo = (
    externalId: string
  ): {
    /** Video source description (e.g. "RTSP (H264)" or camera source name) */
    source: string
    /** Resolution string (e.g. "1920x1080") */
    resolution: string
    /** FPS string (e.g. "30fps") or empty if unknown */
    fps: string
    /** Protocol type label ("WebRTC" or "RTSP") */
    protocolLabel: string
  } => {
    if (getStreamProtocol(externalId) === 'rtsp') {
      const mcmInfo = streamInformation.value.find((i) => i.rtspSourceUrl === externalId)
      const go2rtcInfo = go2rtcStreamInfo.value[externalId]

      const encode = go2rtcInfo?.codec || mcmInfo?.encode
      const width = go2rtcInfo?.width || mcmInfo?.width
      const height = go2rtcInfo?.height || mcmInfo?.height
      const fps = go2rtcInfo?.fps || (mcmInfo?.fps ? `${mcmInfo.fps}` : undefined)

      return {
        source: mcmInfo?.sourceName ?? (encode ? `RTSP (${encode})` : 'RTSP (...)'),
        resolution: width ? `${width}x${height}` : '...',
        fps: fps ? `${fps}fps` : '',
        protocolLabel: 'RTSP',
      }
    }

    const info = streamInformation.value.find((i) => i.name === externalId)
    return {
      source: info?.sourceName ?? 'Unknown',
      resolution: info ? `${info.width}x${info.height}` : 'Unknown',
      fps: info?.fps ? `${info.fps}fps` : '',
      protocolLabel: 'WebRTC',
    }
  }

  const uniqueInternalName = (baseName: string, takenNames: string[]): string => {
    let name = baseName
    let suffix = 2
    while (takenNames.includes(name)) {
      name = `${baseName} [${suffix}]`
      suffix++
    }
    return name
  }

  // A bare RTSP URL tells the user nothing, so name the stream after the host serving it. Dropping
  // the credentials keeps them out of the name, and out of the filenames and stored options derived
  // from it. Not URL(): cameras are not consistent about the '//', and a scheme without it parses
  // as an opaque path, leaving the hostname empty and the stream named after nothing.
  const rtspBaseName = (rtspUrl: string): string => {
    const [authority, ...pathSegments] = rtspUrl
      .trim()
      .replace(/^rtsps?:\/{0,2}/i, '')
      .split('/')
    const host = (authority.split('@').pop() ?? '').replace(/:\d+$/, '')

    // The path is what tells two feeds of the same camera apart, like an ONVIF main and sub profile
    // ponytail: feeds differing only in the URL query still fall back to '[2]'; keep the query here if one shows up
    const feed = pathSegments.filter(Boolean).pop()?.split('?')[0] ?? ''

    // Blue Robotics 4K Cams announce themselves over ONVIF as "UnderwaterCam", which MCM hands us as the source name
    const sourceName = streamInformation.value.find((info) => info.rtspSourceUrl === rtspUrl)?.sourceName ?? ''
    const prefix = sourceName.toLowerCase().includes('underwatercam') ? 'BR 4K Cam RTSP' : 'RTSP'

    return [prefix, host, feed].filter(Boolean).join(' ')
  }

  // The Blue Robotics 4K Cam's manager extension names its streams '<brand> <host>/<feed>', with 'Blue Robotics 4K Cam' as the brand
  const isBlueRobotics4kCamStreamName = (name: string): boolean => /^4k cam /.test(name.trim().toLowerCase())

  // Dropping the WebRTC feed only makes sense where the camera's direct RTSP one can take its place, and RTSP is
  // Standalone-only, so on Lite the very same rule leaves the user with no stream at all.
  const shouldAutoIgnore4kCamStream = (externalId: string): boolean =>
    isElectron() && isBlueRobotics4kCamStreamName(externalId) && !userRestoredStreamIds.value.includes(externalId)

  // The ignored list is vehicle-synced, so the rule's decision reaches Lite anyway, written by an earlier version or
  // by a Standalone client of the same vehicle. Honouring it there would leave the camera with no stream at all, so
  // Lite keeps only what the user asked to ignore.
  const isDisregarded4kCamIgnore = (id: string): boolean =>
    isBlueRobotics4kCamStreamName(id) && !userIgnoredStreamIds.value.includes(id)

  const ignoredStreamExternalIds = computed(() =>
    isElectron()
      ? persistedIgnoredStreamExternalIds.value
      : persistedIgnoredStreamExternalIds.value.filter((id) => !isDisregarded4kCamIgnore(id))
  )

  // The one case where the camera comes back on its own: Lite is disregarding an ignore it cannot attribute to the user
  const hasDisregarded4kCamIgnore = computed(
    () => !isElectron() && persistedIgnoredStreamExternalIds.value.some(isDisregarded4kCamIgnore)
  )

  const initializeStreamsCorrespondency = (): void => {
    // Move already-mapped Blue Robotics 4K Cam WebRTC streams to the ignored list
    // TODO: This whole logic around auto-ignoring Blue Robotics 4K Cam WebRTC streams should be removed once the MCM stutter problem is fixed
    const fourKCamMapped = streamsCorrespondency.value.filter(
      (corr) => (corr.protocol ?? 'webrtc') === 'webrtc' && shouldAutoIgnore4kCamStream(corr.externalId)
    )
    if (fourKCamMapped.length > 0) {
      const idsToMove = fourKCamMapped.map((corr) => corr.externalId)
      streamsCorrespondency.value = streamsCorrespondency.value.filter((corr) => !idsToMove.includes(corr.externalId))
      const newIgnored = idsToMove.filter((id) => !persistedIgnoredStreamExternalIds.value.includes(id))
      if (newIgnored.length > 0) {
        persistedIgnoredStreamExternalIds.value = [...persistedIgnoredStreamExternalIds.value, ...newIgnored]
      }
    }

    // Get list of external streams that are already mapped
    const alreadyMappedExternalIds = streamsCorrespondency.value.map((corr) => corr.externalId)

    const fourKCamToIgnore: string[] = []
    const unmappedExternalStreams = namesAvailableWebRTCStreams.value.filter((streamName) => {
      if (alreadyMappedExternalIds.includes(streamName)) return false
      if (ignoredStreamExternalIds.value.includes(streamName)) return false
      if (shouldAutoIgnore4kCamStream(streamName)) {
        fourKCamToIgnore.push(streamName)
        return false
      }
      return true
    })

    if (fourKCamToIgnore.length > 0) {
      persistedIgnoredStreamExternalIds.value = [...persistedIgnoredStreamExternalIds.value, ...fourKCamToIgnore]
    }

    if (unmappedExternalStreams.length === 0) return

    // Generate internal names for new streams, making sure they don't conflict with existing ones
    const existingInternalNames = streamsCorrespondency.value.map((corr) => corr.name)
    const newCorrespondencies: VideoStreamCorrespondency[] = []

    unmappedExternalStreams.forEach((streamName) => {
      const internalName = uniqueInternalName(streamName.trim() || 'Stream', existingInternalNames)

      newCorrespondencies.push({
        name: internalName,
        externalId: streamName,
      })
      existingInternalNames.push(internalName) // Track this name to avoid duplicates
    })

    // Add new correspondences to the existing ones instead of replacing them
    streamsCorrespondency.value = [...streamsCorrespondency.value, ...newCorrespondencies]
  }

  const initializeRtspStreamsCorrespondency = (): void => {
    if (!isElectron()) return

    const allRtspSourceUrls: string[] = []
    for (const stream of streamInformation.value) {
      if (stream.rtspSourceUrl) {
        allRtspSourceUrls.push(stream.rtspSourceUrl)
      }
    }

    const alreadyMappedRtspUrls = streamsCorrespondency.value
      .filter((corr) => corr.protocol === 'rtsp')
      .map((corr) => corr.rtspUrl)

    const unmappedRtspUrls = allRtspSourceUrls.filter((url) => {
      return !alreadyMappedRtspUrls.includes(url) && !ignoredStreamExternalIds.value.includes(url)
    })

    if (unmappedRtspUrls.length === 0) return

    const existingInternalNames = streamsCorrespondency.value.map((corr) => corr.name)
    const newCorrespondencies: VideoStreamCorrespondency[] = []

    for (const rtspUrl of unmappedRtspUrls) {
      const internalName = uniqueInternalName(rtspBaseName(rtspUrl), existingInternalNames)

      newCorrespondencies.push({
        name: internalName,
        externalId: rtspUrl,
        protocol: 'rtsp',
        rtspUrl,
        autoDiscovered: true,
      })
      existingInternalNames.push(internalName)
    }

    streamsCorrespondency.value = [...streamsCorrespondency.value, ...newCorrespondencies]
  }

  watch(namesAvailableStreams, () => {
    initializeStreamsCorrespondency()
  })

  watch(streamInformation, () => {
    initializeRtspStreamsCorrespondency()
  })

  // If the allowed ICE IPs are updated, all WebRTC streams should be reconnected (not RTSP/go2rtc)
  watch([allowedIceIps, allowedIceProtocols], () => {
    Object.keys(activeStreams.value).forEach((streamName) => {
      if (getStreamProtocol(streamName) !== 'webrtc') return
      // The entry is dropped below without going through teardown, so a wait would outlive the stream it waits on
      // and resume onto its replacement
      cancelRecordingResume(streamName)
      activeStreams.value[streamName]?.webRtcManager?.close('Allowed ICE IPs or protocols changed')
      activeStreams.value[streamName] = undefined
    })
  })

  /**
   * Check if a stream's configuration has meaningfully changed
   * Ignores the stream ID and timestamps which change on server restart
   * @param {Stream | undefined} oldStream - The old stream configuration
   * @param {Stream | undefined} newStream - The new stream configuration
   * @returns {boolean} True if the stream configuration has changed, false otherwise
   */
  const hasStreamConfigChanged = (oldStream: Stream | undefined, newStream: Stream | undefined): boolean => {
    // If both are undefined/null, no change
    if (!oldStream && !newStream) return false

    // If only one exists, it's a change only if the new one appeared (not if it disappeared temporarily)
    if (!oldStream && newStream) return true

    // If the stream is temporarily unavailable, don't consider it a change till a new one appears
    if (oldStream && !newStream) return false

    // Compare only the meaningful properties
    return (
      oldStream!.name !== newStream!.name ||
      oldStream!.encode !== newStream!.encode ||
      oldStream!.height !== newStream!.height ||
      oldStream!.width !== newStream!.width ||
      oldStream!.source !== newStream!.source ||
      oldStream!.interval !== newStream!.interval
    )
  }

  // Streams update routine. Responsible for starting and updating the streams.
  setInterval(() => {
    Object.keys(activeStreams.value).forEach((streamName) => {
      if (activeStreams.value[streamName] === undefined) return

      // If the stream is an RTSP stream, skip the update
      if (getStreamProtocol(streamName) === 'rtsp') return
      if (!activeStreams.value[streamName]?.webRtcManager) return

      // Update the list of available remote ICE Ips with those available for each stream
      const newIps = activeStreams.value[streamName]!.webRtcManager!.availableICEIPs.value.filter(
        (ip: string) => !availableIceIps.value.includes(ip)
      )
      availableIceIps.value = [...availableIceIps.value, ...newIps]

      const oldStream = activeStreams.value[streamName]!.stream
      const updatedStream = mainWebRTCManager.availableStreams.value.find((s) => s.name === streamName)

      // If the stream configuration has not changed, skip the update
      if (!hasStreamConfigChanged(oldStream, updatedStream)) return

      // If the stream configuration has actually changed, we need to recreate the manager
      const oldStreamData = activeStreams.value[streamName]
      if (oldStreamData && oldStreamData.webRtcManager) {
        // A wait for the old stream counts as recording here, or it would resume onto the replacement, under the
        // settings the user has just changed and without the warning this branch gives a recording user
        if (isRecording(streamName) || isWaitingToResumeRecording(streamName)) {
          showDialog({ message: `Stream '${streamName}' has changed. Stopping recording...`, variant: 'error' })
          stopRecording(streamName)
        }

        console.log(`Stream '${streamName}' has changed. Stopping its WebRTC session...`)
        // Closed rather than merely ended, as the manager is replaced on the next lines and an open one would keep
        // its signaller, its streams poll and its own reconnections running with nothing rendering them
        oldStreamData.webRtcManager.close(`Stream '${streamName}' has changed`)
      }

      // The stop above may have released a stream no consumer wanted, taking its entry with it. The next consumer
      // to register builds it again with the new configuration.
      if (activeStreams.value[streamName] === undefined) return

      if (isEqual(updatedStream, activeStreams.value[streamName]!.stream)) return

      // Whenever the stream is to be updated we first reset it's variables (activateStream method), so
      // consumers can be updated as well.
      console.log(`New stream for '${streamName}':`)
      console.log(JSON.stringify(updatedStream, null, 2))
      activateStream(streamName)
      activeStreams.value[streamName]!.stream = updatedStream
    })
  }, 300)

  const rtspActivating = new Set<string>()
  const rtspActivationBackoff = new StreamActivationBackoff()
  let rtspUnsupportedWarned = false
  const unreceivableVideoWarned = new Set<string>()
  let unreceivableVideoDialogOpened = false

  /**
   * Activates a stream by starting it and storing it's variables inside a common object.
   * This way multiple consumers will always access the same resource, so we don't consume unnecessary
   * bandwith or stress the stream provider more than we need to.
   * @param {string} streamName - Unique name for the stream, common between the multiple consumers
   */
  const activateStream = (streamName: string): void => {
    if (getStreamProtocol(streamName) === 'rtsp') {
      if (rtspActivating.has(streamName)) return
      if (activeStreams.value[streamName]?.go2rtcManager) return
      if (rtspActivationBackoff.isBackingOff(streamName)) return

      // The external id of an RTSP stream is its URL, credentials included, so never show it to the user
      const displayName = internalStreamNameFromExternal(streamName) ?? streamName

      const rtspUrl = getRtspUrl(streamName)
      if (!rtspUrl) {
        if (rtspActivationBackoff.registerFailure(streamName)) {
          const msg =
            `Video stream '${displayName}' has no address configured.` +
            ' Delete it and add it again in the video configuration page.'
          showDialog({ message: msg, variant: 'error' })
        }
        return
      }
      if (!window.electronAPI) {
        // Activation is attempted repeatedly (e.g. via VideoPlayer's 1s polling), so guard the dialog
        // to a single notification per session to avoid spamming the user during boot.
        if (!rtspUnsupportedWarned) {
          rtspUnsupportedWarned = true
          showDialog({
            message:
              'It looks like some of your video-related widgets (e.g.: video player, mini video recorder, snapshot tool)' +
              ' are connected to RTSP streams, which are not supported in Cockpit Lite. To make sure those widgets work,' +
              ' re-configure them to only use WebRTC, or upgrade to Cockpit standalone, which supports both WebRTC and RTSP streams.',
            variant: 'error',
          })
        }
        return
      }

      rtspActivating.add(streamName)

      void (async () => {
        try {
          const port = await window.electronAPI!.go2rtcGetPort()
          await window.electronAPI!.go2rtcAddStream(streamName, rtspUrl)

          const manager = new Go2RTCManager(port, streamName, jitterBufferTarget.value)
          const { mediaStream, connected } = manager.start()

          activeStreams.value[streamName] = {
            stream: undefined,
            // A reactive-proxied manager gets its internal refs unwrapped, breaking its own '.value' writes.
            go2rtcManager: markRaw(manager),
            // @ts-ignore: This is actually not reactive
            mediaStream: mediaStream,
            // @ts-ignore: This is actually not reactive
            connected: connected,
            mediaRecorder: undefined,
            timeRecordingStart: undefined,
          }
          rtspActivationBackoff.forget(streamName)
          watchVideoFlowOfStream(streamName)
          console.debug(`Activated RTSP stream '${streamName}' via go2rtc.`)
        } catch (error) {
          console.error(`Failed to activate RTSP stream '${streamName}':`, error)
          if (rtspActivationBackoff.registerFailure(streamName)) {
            // Nothing in the try above reaches the camera, so a failure here is always local to Cockpit
            const msg =
              `Could not start video stream '${displayName}'. Cockpit's video service is not responding.` +
              ' Restart Cockpit and try again.'
            showDialog({ message: msg, variant: 'error' })
          }
        } finally {
          rtspActivating.delete(streamName)
        }
      })()
      return
    }

    const stream = ref()
    const webRtcManager = new WebRTCManager(webRTCSignallingURI, rtcConfiguration)

    webRtcManager.onUnreceivableVideo = (codecs: string[]): void => {
      // The camera keeps offering the same codec on every reconnection, so warn once per stream.
      if (unreceivableVideoWarned.has(streamName)) return
      unreceivableVideoWarned.add(streamName)

      const codecNames = codecs.map(readableVideoCodecName).join(' or ')
      const message =
        `Stream '${streamName}' sends video as ${codecNames}, which Cockpit cannot play.` +
        ' Set the camera to H.264 to watch it.'
      alertStore.pushAlert(new Alert(AlertLevel.Error, message))

      // A second camera would replace the dialog of the first, leaving only one of the two ever read, so only
      // the first one opens it. The alerts above keep an entry per stream either way.
      if (unreceivableVideoDialogOpened) return
      unreceivableVideoDialogOpened = true
      showDialog({ message, variant: 'error' })
    }

    const { mediaStream, connected } = webRtcManager.startStream(
      stream,
      allowedIceIps,
      allowedIceProtocols,
      jitterBufferTarget
    )
    activeStreams.value[streamName] = {
      // @ts-ignore: This is actually not reactive
      stream: stream,
      webRtcManager: markRaw(webRtcManager),
      // @ts-ignore: This is actually not reactive
      mediaStream: mediaStream,
      // @ts-ignore: This is actually not reactive
      connected: connected,
      mediaRecorder: undefined,
      timeRecordingStart: undefined,
    }
    watchVideoFlowOfStream(streamName)
    console.debug(`Activated stream '${streamName}'.`)
  }

  /**
   * Tear down all resources tied to an active stream (WebRTC/go2rtc connections, media tracks, recorder), and
   * remove it from the active streams map.
   * @param {string} externalId - External stream identifier
   * @param {string} reason - Human-readable reason, forwarded to the underlying stream managers on close
   */
  const teardownStreamResources = (externalId: string, reason: string): void => {
    const externalStreamData = activeStreams.value[externalId]
    if (!externalStreamData) return

    // The stream is going away, so nothing should be left waiting for it to come back or following its video
    cancelRecordingResume(externalId)
    stopWatchingVideoFlowOfStream(externalId)

    // A stream left in the map after a failed teardown is unrecoverable: its manager is already
    // half-closed, and registerStreamConsumer skips activation for a key that exists.
    try {
      // Stop recording if it's active
      if (externalStreamData.mediaRecorder?.state === 'recording') {
        externalStreamData.mediaRecorder.stop()
      }

      // Stop all tracks in the media stream
      if (externalStreamData.mediaStream) {
        externalStreamData.mediaStream.getTracks().forEach((track) => {
          track.stop()
          console.log(`Stopped track: ${track.kind} for external stream '${externalId}'`)
        })
      }

      // Close WebRTC connection
      if (externalStreamData.webRtcManager) {
        try {
          externalStreamData.webRtcManager.close(reason)
          console.log(`Stopped WebRTC manager for external stream '${externalId}'`)
        } catch (error) {
          console.warn(`Error stopping WebRTC manager for external stream '${externalId}':`, error)
        }
      }

      if (externalStreamData.go2rtcManager) {
        try {
          externalStreamData.go2rtcManager.close(reason)
        } catch (error) {
          console.warn(`Error stopping go2rtc manager for external stream '${externalId}':`, error)
        }
        if (window.electronAPI) {
          void window.electronAPI.go2rtcRemoveStream(externalId).catch((error) => {
            console.warn(`Error removing go2rtc stream '${externalId}':`, error)
          })
        }
      }
    } finally {
      delete activeStreams.value[externalId]
      console.log(`Cleaned up all resources for external stream '${externalId}'`)
    }
  }

  /**
   * Tear down an external stream if it has no remaining consumers and no recorder attached to it (i.e. neither
   * recording nor finalizing a just-stopped recording)
   * @param {string} externalId - External stream identifier
   */
  const deactivateStreamIfUnused = (externalId: string): void => {
    const consumers = streamConsumers.get(externalId)
    if (consumers && consumers.size > 0) return

    streamConsumers.delete(externalId)

    // A recording waiting out a video outage still needs the stream, and tearing it down here would keep it from
    // ever coming back
    if (isWaitingToResumeRecording(externalId)) return

    // Never tear down a stream while a recorder is attached, even if no widget references it: mediaRecorder stays
    // set through recording and the async stop() finalizer (telemetry/processing), and onstop clears it when done.
    if (activeStreams.value[externalId]?.mediaRecorder !== undefined) return

    teardownStreamResources(externalId, `External stream '${externalId}' is no longer used by any consumer`)
  }

  /**
   * Register a consumer (e.g. a widget) as actively needing an external stream, activating it if needed
   * @param {string} externalId - External stream identifier
   * @param {string} consumerId - Unique identifier for the consumer (e.g. widget hash)
   */
  const registerStreamConsumer = (externalId: string, consumerId: string): void => {
    if (!streamConsumers.has(externalId)) {
      streamConsumers.set(externalId, new Set())
    }
    streamConsumers.get(externalId)!.add(consumerId)

    if (activeStreams.value[externalId] === undefined) {
      activateStream(externalId)
    }
  }

  /**
   * Release a consumer's reference to an external stream, tearing it down if it becomes unused
   * @param {string} externalId - External stream identifier
   * @param {string} consumerId - Unique identifier for the consumer (e.g. widget hash)
   */
  const unregisterStreamConsumer = (externalId: string, consumerId: string): void => {
    streamConsumers.get(externalId)?.delete(consumerId)
    deactivateStreamIfUnused(externalId)
  }

  /**
   * Get all data related to a given stream, if available
   * @param {string} streamName - Name of the stream
   * @returns {StreamData | undefined} The StreamData object, if available
   */
  const getStreamData = (streamName: string): StreamData | undefined => {
    if (activeStreams.value[streamName] === undefined) {
      activateStream(streamName)
    }
    return activeStreams.value[streamName]
  }

  /**
   * Get the signaller/connection status string for a stream, abstracting over manager type
   * @param {string} streamName - Name of the stream
   * @returns {string} Human-readable signaller status
   */
  const getSignallerStatus = (streamName: string): string => {
    const data = getStreamData(streamName)
    return data?.go2rtcManager?.signallerStatus.value ?? data?.webRtcManager?.signallerStatus.value ?? 'Unknown.'
  }

  /**
   * Get the stream status string for a stream, abstracting over manager type
   * @param {string} streamName - Name of the stream
   * @returns {string} Human-readable stream status
   */
  const getStreamStatus = (streamName: string): string => {
    const data = getStreamData(streamName)
    if (data?.go2rtcManager) return data.go2rtcManager.streamStatus.value ?? 'Unknown.'
    return data?.webRtcManager?.streamStatus.value ?? 'Unknown.'
  }

  /**
   * Get the RTCPeerConnection for stats monitoring, if available
   * @param {string} streamName - Name of the stream
   * @returns {StreamPeerConnectionInfo | undefined}
   */
  const getStreamPeerConnection = (streamName: string): StreamPeerConnectionInfo | undefined => {
    const data = activeStreams.value[streamName]
    const session = data?.webRtcManager?.session
    if (session?.peerConnection) {
      return { peerConnection: session.peerConnection, peerId: session.consumerId, sessionId: session.id }
    }

    const go2rtcManager = data?.go2rtcManager
    if (go2rtcManager?.peerConnection) {
      // Fresh id per connection, so a reconnect registers the new peer connection and drops the monitor of the old one.
      const { peerConnection, connectionId } = go2rtcManager
      return { peerConnection, peerId: connectionId, sessionId: connectionId }
    }

    return undefined
  }

  /**
   * Generate .ass telemetry overlay file for a video recording
   * @param {string} recordingHash - The hash of the recording
   */
  const generateTelemetryOverlay = async (recordingHash: string): Promise<void> => {
    try {
      const recordingData = unprocessedVideos.value[recordingHash]
      if (!recordingData) {
        throw new Error(`Recording '${recordingHash}' not found.`)
      }

      console.info(`Generating telemetry overlay for recording '${recordingHash}'...`)

      const [overlayWindow] = telemetryOverlayWindowCandidates(recordingData)
      if (!overlayWindow) {
        throw new Error(`Recording '${recordingHash}' has no known start and finish times.`)
      }

      const telemetryLog = await datalogger.generateLog(overlayWindow.start, overlayWindow.end)

      if (telemetryLog !== undefined) {
        const assLog = datalogger.toAssOverlay(
          telemetryLog,
          overlayWindow.width,
          overlayWindow.height,
          overlayWindow.start.getTime()
        )
        const logBlob = new Blob([assLog], { type: 'text/plain' })

        const subtitlesFileName = videoSubtitlesFilename(recordingData.fileName)
        await videoStorage.setItem(subtitlesFileName, logBlob)
        console.info(`Telemetry overlay saved as '${subtitlesFileName}' (${logBlob.size} bytes).`)
      }
    } catch (error) {
      throw new Error(`Failed to generate telemetry for recording '${recordingHash}': ${error}`)
    }
  }

  /**
   * Get the MediaStream object related to a given stream, if available
   * @param {string} streamName - Name of the stream
   * @returns {MediaStream | undefined} MediaStream that is running, if available
   */
  const getMediaStream = (streamName: string): MediaStream | undefined => {
    return getStreamData(streamName)?.mediaStream
  }

  /**
   * Wether or not the stream is currently being recorded
   * @param {string} streamName - Name of the stream
   * @returns {boolean}
   */
  const isRecording = (streamName: string): boolean => {
    // Not 'mediaRecorder.state': Vue does not proxy a MediaRecorder, so its flip to 'inactive' dirties nothing
    return getStreamData(streamName)?.timeRecordingStart !== undefined
  }

  /**
   * Whether the stream has a recording waiting out a video outage, recording a filler in its place meanwhile
   * @param {string} streamName - Name of the stream
   * @returns {boolean} True while a recording of the stream waits for it to come back
   */
  const isWaitingToResumeRecording = (streamName: string): boolean => {
    return pendingRecordingResumes[streamName] !== undefined
  }

  /**
   * Whether the stream is back for a recording to start on it, which an active media stream alone does not mean, as it
   * exists from the moment a session adds its track, before that session has connected or may be replaced
   * @param {string} streamName - Name of the stream
   * @returns {boolean} True when the stream is listed, its media stream is active and delivering, its peer is
   * connected and its session can be recorded
   */
  const isStreamReadyToRecord = (streamName: string): boolean => {
    const streamData = getStreamData(streamName)
    const isListed = namesAvailableStreams.value.includes(streamName)
    const isLive = streamData?.mediaStream?.active === true && streamData.connected
    const isDelivering = streamsWithStalledVideo[streamName] !== true
    return isListed && isLive && isDelivering && isSessionRecordable(streamName)
  }

  /**
   * Whether a recorder on the stream's current session receives its video, which only a WebRTC session can deny
   * @param {string} streamName - Name of the stream
   * @returns {boolean} False when the camera offered the current session in a form that cannot be recorded
   */
  const isSessionRecordable = (streamName: string): boolean => {
    return getStreamData(streamName)?.webRtcManager?.recordable.value !== false
  }

  /**
   * Whether or not the stream's last recording has stopped but is still being written and processed
   * @param {string} streamName - Name of the stream
   * @returns {boolean}
   */
  const isFinalizingRecording = (streamName: string): boolean => {
    const streamData = getStreamData(streamName)
    return streamData?.mediaRecorder !== undefined && streamData.timeRecordingStart === undefined
  }

  // Recording outlives the recorder widget, so the close warning has to live here rather than on it.
  watch(
    () => {
      // Read the map directly: getStreamData would activate blanked streams.
      const streams = Object.values(activeStreams.value)
      if (streams.some((s) => s?.timeRecordingStart !== undefined)) return 'recording'
      // Closing while the last chunk is still being written loses the file just the same.
      if (streams.some((s) => s?.mediaRecorder !== undefined)) return 'finalizing'
      return 'idle'
    },
    (state) => {
      if (state === 'idle') {
        window.onbeforeunload = null
        return
      }
      const alertMsg =
        state === 'recording'
          ? `
      You have a video recording ongoing.
      Remember to stop it before closing Cockpit, or the record will be lost.
    `
          : `
      Your last video recording is still being saved.
      Wait for it to finish before closing Cockpit, or the record will be lost.
    `
      window.onbeforeunload = () => {
        showDialog({ message: alertMsg, variant: 'warning' })
        return 'I hope the user does not click on the leave button.'
      }
    }
  )

  // Best-effort MAVLink broadcast of recording actions, so systems like BlueOS can mirror the recording state.
  const broadcastRecordingStart = (streamName: string): void => {
    if (!broadcastCameraActionsOverMavlink.value) return
    const alreadyMirroring = mirroredRecordingStreams.size > 0
    mirroredRecordingStreams.add(streamName)
    // Recording several streams still means one vehicle-side recording, so broadcast only on the first one.
    if (alreadyMirroring) return
    sendStartVideoCaptureCommand()
  }

  const broadcastRecordingStop = (streamName: string): void => {
    // Only close a broadcast we actually opened; the toggle gates new broadcasts, not outstanding stops.
    if (!mirroredRecordingStreams.delete(streamName)) return
    if (mirroredRecordingStreams.size > 0) return
    sendStopVideoCaptureCommand()
  }

  // Best-effort MAVLink broadcast of a snapshot capture, sharing the recording path's broadcast rules.
  const broadcastSnapshotCapture = (): void => {
    if (!broadcastCameraActionsOverMavlink.value) return
    sendStartImageCaptureCommand()
  }

  /**
   * Follows whether a stream's video is arriving for as long as the stream is up, handing a recording of it
   * over to a filler when it stops, as a camera can stall without ending its stream or muting its track
   * @param {string} streamName - Name of the stream to follow
   */
  const watchVideoFlowOfStream = (streamName: string): void => {
    videoFlowWatchers[streamName]?.()

    const secondsWithoutVideo = trackVideoArrival(streamName, 'a recording will not cover a stream that stops arriving')

    const readVideoFlow = (isStalled: boolean): void => {
      if (isStalled === streamsWithStalledVideo[streamName]) return
      console.debug(`Video of stream '${streamName}' ${isStalled ? 'stopped arriving' : 'is arriving'}.`)
      streamsWithStalledVideo[streamName] = isStalled
    }

    const poll = window.setInterval(() => {
      const seconds = secondsWithoutVideo()
      if (seconds !== undefined) readVideoFlow(seconds >= secondsWithoutVideoToStallRecording)
    }, 1000)

    const stopOnStall = watch(
      () => streamsWithStalledVideo[streamName] === true,
      (stalled) => {
        // Stopping the recorder is what starts the filler, and during an outage the recorder already is one
        if (stalled && !isWaitingToResumeRecording(streamName)) stopRecorderOfStream(streamName)
      }
    )

    videoFlowWatchers[streamName] = () => {
      window.clearInterval(poll)
      stopOnStall()
      delete streamsWithStalledVideo[streamName]
    }
  }

  /**
   * Stops following a stream's video, once the stream itself is gone
   * @param {string} streamName - Name of the stream
   */
  const stopWatchingVideoFlowOfStream = (streamName: string): void => {
    videoFlowWatchers[streamName]?.()
    delete videoFlowWatchers[streamName]
  }

  /**
   * Whether a stream's picture is frozen, its video having stopped arriving while the stream itself is still up
   * @param {string} streamName - Name of the stream
   * @returns {boolean} True once the video has been missing for a few seconds, until it comes back
   */
  const isStreamVideoStalled = (streamName: string): boolean => {
    return streamsWithStalledVideo[streamName] === true
  }

  /**
   * Stops a recording's wait for its video stream to come back, or to start a new one on it, if one was waiting
   * @param {string} streamName - Name of the stream
   */
  const cancelRecordingResume = (streamName: string): void => {
    pendingRecordingResumes[streamName]?.()
    delete pendingRecordingResumes[streamName]
    pendingRecordingRestarts[streamName]?.()
    delete pendingRecordingRestarts[streamName]
  }

  /**
   * What to tell the user about a recording that was just assembled, which is worth a word of its own when
   * video outages cut it into parts that had to be joined
   * @param {number} segmentsJoined - How many parts the recording was written in
   * @param {boolean} reencoded - Whether joining them meant re-encoding the recording
   * @returns {string} The message to show
   */
  const joinedRecordingMessage = (segmentsJoined: number, reencoded: boolean): string => {
    if (segmentsJoined <= 1) return 'Video processing completed.'
    const outages = `${segmentsJoined - 1} video ${segmentsJoined > 2 ? 'outages' : 'outage'}`
    if (reencoded) return `Video processing completed. The recording was rebuilt around ${outages}.`
    return `Video processing completed. The recording was joined across ${outages}.`
  }

  /**
   * Warns the user about what joining a recording's parts could not keep, be it its audio or a part that could
   * not be read
   * @param {string} recordingLabel - Name of the recording, or of the stream it recorded, as shown to the user
   * @param {VideoRecordingFinalizationResult | undefined} joined - How the recording was assembled
   */
  const warnAboutLostRecordingParts = (
    recordingLabel: string,
    joined: VideoRecordingFinalizationResult | undefined
  ): void => {
    if (joined?.audioDropped === true) {
      const audioLost = `The audio of '${recordingLabel}' could not be kept while joining the recording.`
      openSnackbar({ message: audioLost, variant: 'warning' })
    }

    const lost = joined?.segmentsLost ?? 0
    if (lost === 0) return
    const parts = `${lost} ${lost > 1 ? 'parts' : 'part'}`
    const partsLost =
      `${parts} of the recording of '${recordingLabel}' could not be read, and are missing from it. ` +
      `They were kept in the '${videoSegmentSubFolders(1).join('/')}' folder of Cockpit.`
    alertStore.pushAlert(new Alert(AlertLevel.Warning, partsLost))
    openSnackbar({ message: partsLost, variant: 'warning' })
  }

  /**
   * Tells the user how a recording was put together, which is worth more than the usual word when video outages
   * cut it into parts that had to be joined
   * @param {string} streamLabel - Name of the recorded stream, as it is shown to the user
   * @param {VideoRecordingFinalizationResult | undefined} joined - How the recording was assembled
   */
  const reportJoinedRecording = (streamLabel: string, joined: VideoRecordingFinalizationResult | undefined): void => {
    openSnackbar({
      message: joinedRecordingMessage(joined?.segmentsJoined ?? 1, joined?.reencoded === true),
      duration: 2000,
      variant: 'success',
      closeButton: false,
    })
    warnAboutLostRecordingParts(streamLabel, joined)
  }

  /**
   * Tells the user that a recording stopped without anyone asking
   * @param {string} streamName - Name of the stream being recorded
   * @param {string} streamLabel - Name of the stream as it is shown to the user
   * @param {boolean} interruptWithDialog - Whether the report is worth a dialog on top of the alert
   */
  const reportUnexpectedRecordingStop = (streamName: string, streamLabel: string, interruptWithDialog = true): void => {
    const footageKept = 'The video recorded until then was kept and is available in the Video Library.'
    alertStore.pushAlert(
      new Alert(AlertLevel.Error, `Recording of stream '${streamLabel}' stopped unexpectedly. ${footageKept}`)
    )

    // One lost link stops every recording it was serving, and a dialog naming a stream would replace the dialog of
    // the stream before it, so the streams are named in the alerts above and the dialog stays the same for all
    if (interruptWithDialog) {
      showDialog({ message: `A recording stopped unexpectedly. ${footageKept}`, variant: 'error' })
    }

    // The recording is over, so nothing should still be waiting for the stream on its behalf, and the monitor
    // would otherwise nag about a file that stopped growing
    cancelRecordingResume(streamName)
    clearInterval(recordingMonitors[streamName])
    delete recordingMonitors[streamName]
  }

  /**
   * Stops the recorder writing a stream's recording, if one is still running
   * @param {string} streamName - Name of the stream
   */
  const stopRecorderOfStream = (streamName: string): void => {
    const recorder = activeStreams.value[streamName]?.mediaRecorder
    if (recorder === undefined || recorder.state === 'inactive') return
    recorder.stop()
  }

  /**
   * Starts a new recording of a stream once it is back, for a recording its outage outlasted, so a pilot who was
   * recording does not come back from a long outage to a stream nobody is recording
   * @param {string} streamName - Name of the stream whose recording ended
   * @param {string} streamLabel - Name of the stream as it is shown to the user
   */
  const restartRecordingWhenStreamReturns = (streamName: string, streamLabel: string): void => {
    const stopWatching = watch(
      () => isStreamReadyToRecord(streamName),
      (isReady) => {
        if (!isReady) return
        startRecording(streamName)
          .then(() => {
            if (!isRecording(streamName)) return
            const restarted = `Video stream '${streamLabel}' is back, so Cockpit started a new recording of it.`
            openSnackbar({ message: restarted, duration: 4000, variant: 'success' })
          })
          .catch((error) => {
            const failed = `Could not start a new recording of '${streamLabel}': ${messageFromError(error)}`
            openSnackbar({ message: failed, variant: 'error' })
          })
      }
    )

    // Bounded, as nothing on screen shows that a new recording is still pending
    const giveUp = setTimeout(() => cancelRecordingResume(streamName), minutesToWaitForStreamToRestartRecording * 60000)

    pendingRecordingRestarts[streamName] = () => {
      stopWatching()
      clearTimeout(giveUp)
    }
  }

  /**
   * Waits for a stream that dropped mid-recording to come back in a form that can be recorded, ending the
   * recording it belongs to once it is clear that it will not
   * @param {string} streamName - Name of the stream whose recording is waiting for it
   * @param {RecordingSession} session - The recording that lost its stream
   */
  const waitForStreamToResumeRecording = (streamName: string, session: RecordingSession): void => {
    // The deadline belongs to the outage rather than to whichever recorder is filling it, so a wait already
    // under way is left alone instead of being given a fresh minute
    if (pendingRecordingResumes[streamName] !== undefined) return

    let cameOnlyUnrecordable = false
    let renewals = 0
    let renewal: ReturnType<typeof setTimeout> | undefined

    const endRecordingWithoutTheStream = (): void => {
      const waited = `${secondsToWaitForStreamToResumeRecording} seconds`
      const restartWindow = `${minutesToWaitForStreamToRestartRecording} minutes`
      // Says what the generic report below cannot: the recording that ended is the one the drop message promised
      const stoppedWaiting = cameOnlyUnrecordable
        ? `Video stream '${session.streamLabel}' came back, but the camera did not offer it in a form Cockpit can ` +
          'record, so Cockpit ended the recording.'
        : `Video stream '${session.streamLabel}' did not come back within ${waited}, so Cockpit ended the recording. ` +
          `A new one starts if the stream returns within ${restartWindow}.`
      alertStore.pushAlert(new Alert(AlertLevel.Warning, stoppedWaiting))

      // Nothing on screen, as the outage was already announced when it started
      reportUnexpectedRecordingStop(streamName, session.streamLabel, false)

      // Clearing the start time is what makes the filler's stop final, the same way the Stop button does it
      const streamData = activeStreams.value[streamName]
      if (streamData) streamData.timeRecordingStart = undefined
      stopRecorderOfStream(streamName)

      restartRecordingWhenStreamReturns(streamName, session.streamLabel)
    }

    const stopWaiting = watch(
      () => isStreamReadyToRecord(streamName),
      (isReady) => {
        // Stopping the filler is what hands the recording over to the stream that came back, as every
        // recorder that stops on its own is offered the stream of the moment
        if (isReady) stopRecorderOfStream(streamName)
      }
    )

    // Renews only a session that is already playing, and only after a while, so the pilot has a picture between tries
    const stopRenewing = watch(
      () => !isSessionRecordable(streamName) && getStreamData(streamName)?.connected === true,
      (playsUnrecordable) => {
        clearTimeout(renewal)
        if (!playsUnrecordable) return
        cameOnlyUnrecordable = true
        renewal = setTimeout(() => {
          if (renewals >= maxUnrecordableSessionRenewals) return endRecordingWithoutTheStream()
          renewals++
          getStreamData(streamName)?.webRtcManager?.renewUnrecordableSession()
        }, secondsToPlayUnrecordableSessionBeforeRenewing * 1000)
      },
      { immediate: true }
    )

    const giveUp = setTimeout(endRecordingWithoutTheStream, secondsToWaitForStreamToResumeRecording * 1000)

    pendingRecordingResumes[streamName] = () => {
      stopWaiting()
      stopRenewing()
      clearTimeout(renewal)
      clearTimeout(giveUp)
    }
  }

  /**
   * Keeps a recording whose recorder stopped on its own going, by handing it to the stream that is there
   * now or, while there is none, to a filler recorded in its place, as a MediaRecorder is bound to the
   * MediaStream it was built with and a renewed session delivers a new one
   * @param {string} streamName - Name of the stream whose recorder stopped
   * @param {RecordingSession} session - The recording that lost its recorder
   * @returns {boolean} Whether the recording carries on, false meaning it has to be wrapped up
   */
  const continueRecordingAfterStreamDrop = (streamName: string, session: RecordingSession): boolean => {
    const mediaStream = activeStreams.value[streamName]?.mediaStream
    // A recorder can also stop while its stream is still live, which no later write to the stream would report,
    // so the recording is offered the stream of the moment before any wait is armed for it
    const streamIsBack = mediaStream !== undefined && isStreamReadyToRecord(streamName)
    const wasFillingGap = session.gapFiller !== undefined
    const outageStarts = !streamIsBack && !wasFillingGap

    // A link that keeps flapping would otherwise be carried forever, at a segment to mux and join per outage,
    // into a take that is mostly the notice saying the video is gone
    if (outageStarts && session.outagesSurvived >= maxOutagesInARecording) {
      const tooMany =
        `Video stream '${session.streamLabel}' dropped ${maxOutagesInARecording} times during one recording, so ` +
        'Cockpit ended it rather than carry it across another outage.'
      alertStore.pushAlert(new Alert(AlertLevel.Warning, tooMany))
      return false
    }

    session.gapFiller?.stop()
    session.gapFiller = undefined

    try {
      if (streamIsBack) {
        cancelRecordingResume(streamName)
        attachRecorderToSession(streamName, session, mediaStream)
      } else {
        session.gapFiller = createGapFillerStream(session.vWidth, session.vHeight, session.hasAudio)
        attachRecorderToSession(streamName, session, session.gapFiller.stream)
        waitForStreamToResumeRecording(streamName, session)
        if (!wasFillingGap) session.outagesSurvived++
      }
    } catch (error) {
      // Nothing is recording the session any more, so it is wrapped up rather than left looking like a take in
      // progress that can never end
      console.error(`Could not keep the recording of stream '${streamName}' going:`, error)
      session.gapFiller?.stop()
      session.gapFiller = undefined
      return false
    }

    if (streamIsBack && wasFillingGap) {
      if (session.stallNoticeId !== undefined) closeSnackbar(session.stallNoticeId)
      session.stallNoticeId = undefined
      openSnackbar({
        message: `Video stream '${session.streamLabel}' is back. The recording continues in the same file.`,
        duration: 4000,
        variant: 'success',
      })
    }

    if (outageStarts) {
      // The alert outlives the snackbar, telling the operator later why a take of theirs goes black in the middle
      const stalled =
        `Video stream '${session.streamLabel}' stalled. The recording and its telemetry carry on and mark the outage ` +
        `in it. If the stream is not back within ${secondsToWaitForStreamToResumeRecording} seconds, the recording ` +
        `ends, and a new one starts if it returns within ${minutesToWaitForStreamToRestartRecording} minutes.`
      alertStore.pushAlert(new Alert(AlertLevel.Info, stalled))
      session.stallNoticeId = openSnackbar({ message: stalled, duration: 20000, variant: 'info' })
    }

    return true
  }

  /**
   * Stop recording the stream
   * @param {string} streamName - Name of the stream
   */
  const stopRecording = (streamName: string): void => {
    // A stop the user asked for during an outage must not be undone by the resume that outage armed
    cancelRecordingResume(streamName)

    // Stop the recording monitor so there's no risk of receiving alerts after the recording is stopped.
    console.info(`Stopping recording monitor for stream '${streamName}'.`)
    clearInterval(recordingMonitors[streamName])
    delete recordingMonitors[streamName]

    const streamData = getStreamData(streamName)

    // A failed recorder detaches itself, so a chunk arriving after that reaches here with nothing left to stop, and
    // reporting a successful stop would contradict the failure the user was just told about.
    if (streamData?.mediaRecorder === undefined) {
      console.debug(`No recorder attached to stream '${streamName}'. Nothing to stop.`)
      return
    }

    const timeRecordingStart = streamData.timeRecordingStart
    const durationInSeconds = timeRecordingStart ? differenceInSeconds(new Date(), timeRecordingStart) : undefined
    eventTracker.capture('Video recording stop', { streamName, durationInSeconds })

    streamData.timeRecordingStart = undefined

    // A recorder that already stopped itself, on a dropped stream or a failed chunk, throws on a second stop, and
    // nothing here stopped the recording it is finishing, so no success is reported for it either.
    if (streamData.mediaRecorder.state === 'inactive') {
      console.debug(`Recorder of stream '${streamName}' had already stopped on its own. Nothing to stop.`)
      return
    }

    streamData.mediaRecorder.stop()

    alertStore.pushAlert(new Alert(AlertLevel.Success, `Stopped recording stream ${streamName}.`))
  }

  const getVideoThumbnail = async (videoFileNameOrHash: string, isProcessed: boolean): Promise<Blob | null> => {
    const db = isProcessed ? videoStorage : tempVideoStorage
    const thumbnail = await db.getItem(videoThumbnailFilename(videoFileNameOrHash))
    return thumbnail || null
  }

  /**
   * Watches a recording as it is written, warning the user when it stops growing
   * @param {string} streamName - Name of the stream being recorded
   * @param {RecordingSession} session - The recording to watch
   */
  const startRecordingHealthMonitor = (streamName: string, session: RecordingSession): void => {
    // On Electron, we can get the size of the video output file in real time
    // This is useful to detect if the output file is growing, which is an indication that the recording is still ongoing.
    // On Web, we can only know if the number of chunks is growing, which is an indication that the recording is still ongoing.
    // We also need to clear the interval if it already exists, to avoid multiple intervals running at the same time.
    clearInterval(recordingMonitors[streamName])
    delete recordingMonitors[streamName]

    const { streamLabel } = session

    const recordingIsOver = (): boolean => {
      // Check if the stream is still recording before proceeding with checks
      if (activeStreams.value[streamName]?.mediaRecorder !== undefined) return false
      const msg = `Recording for stream '${streamName}' has stopped. Stopping health monitor for this stream.`
      showDialog({ message: msg, variant: 'warning' })
      clearInterval(recordingMonitors[streamName])
      delete recordingMonitors[streamName]
      return true
    }

    if (window.electronAPI) {
      console.info(`Starting electron recording monitor for stream '${streamName}'.`)
      recordingMonitors[streamName] = setInterval(async () => {
        if (recordingIsOver()) return
        // A segment that has just started has nothing on disk yet, and none of the size the one before it reached
        if (session.skipNextHealthCheck) {
          session.skipNextHealthCheck = false
          return
        }
        const segmentSubFolders = videoSegmentSubFolders(session.segmentIndex)
        const segmentName = videoSegmentFilename(session.fileName, session.segmentIndex)
        const fileStats = await window.electronAPI?.getFileStats(segmentName, segmentSubFolders)
        if (!fileStats || !fileStats.exists) {
          showRecordingHealthDialog(
            `Cockpit cannot find the file for the recording of stream '${streamLabel}', which means the recording may be lost. We recommend stopping it and starting a new one.`,
            true
          )
          return
        }
        const lastKnownFileSize = unprocessedVideos.value[session.hash].lastKnownFileSize
        if (fileStats.size! <= lastKnownFileSize!) {
          showRecordingHealthDialog(
            `The video output file for stream '${streamLabel}' is not growing. This can indicate a problem with the recording.`
          )
          return
        }
        unprocessedVideos.value[session.hash].lastKnownFileSize = fileStats.size
        console.debug(`Size of video output file for stream '${streamName}' growed to ${fileStats.size} bytes.`)
      }, 15000)
      return
    }

    console.info(`Starting web recording monitor for stream '${streamName}'.`)
    recordingMonitors[streamName] = setInterval(async () => {
      if (recordingIsOver()) return
      // @ts-ignore: localForage is not defined on the StorageDB interface
      const numberOfChunks = await tempVideoStorage.localForage.length()
      const lastKnownNumberOfChunks = unprocessedVideos.value[session.hash].lastKnownNumberOfChunks
      if (numberOfChunks <= lastKnownNumberOfChunks!) {
        showRecordingHealthDialog(
          `The number of video chunks for stream '${streamLabel}' is not growing. This can indicate a problem with the recording.`
        )
        return
      }
      unprocessedVideos.value[session.hash].lastKnownNumberOfChunks = numberOfChunks
      console.debug(`Number of video chunks for stream '${streamName}' growed to ${numberOfChunks}.`)
    }, 15000)
  }

  /**
   * Builds the recorder of a stream, asking for the codec the recording is muxed from rather than letting the
   * browser pick one, as its pick follows the source: a camera gives H.264 where a canvas gives VP8
   * @param {MediaStream} mediaStream - The stream to record
   * @returns {MediaRecorder} The recorder, which is not started yet
   */
  const buildRecorderFor = (mediaStream: MediaStream): MediaRecorder => {
    if (MediaRecorder.isTypeSupported(recordingMimeType)) {
      return new MediaRecorder(mediaStream, { mimeType: recordingMimeType })
    }
    console.warn(`Cannot record as '${recordingMimeType}', falling back to whatever the browser records as.`)
    return new MediaRecorder(mediaStream)
  }

  /**
   * Tells the user that part of a recording could not be saved
   * @param {RecordingSession} session - The recording losing chunks
   */
  const warnAboutChunkLoss = (session: RecordingSession): void => {
    const chunkLossWarningMsg = `A part of your video recording could not be saved.
        This usually happens when the device's storage is full or the performance is low.
        We recommend stopping the recording and trying again, as the video may be incomplete or corrupted
        on several parts.`
    const sequentialChunksLossMessage = `Warning: Several video chunks could not be saved. The video recording may be impacted.`
    const fivePercentChunksLossMessage = `Warning: More than 5% of the video chunks could not be saved. The video recording may be impacted.`

    console.error(chunkLossWarningMsg)

    openSnackbar({
      message: 'Oops, looks like a video chunk could not be saved. Retrying...',
      duration: 2000,
      variant: 'info',
      closeButton: false,
    })

    session.sequentialLostChunks++
    session.totalLostChunks++

    // Check for 5 or more sequential lost chunks
    if (session.sequentialLostChunks >= 5 && session.losingChunksWarningIssued === false) {
      showDialog({
        message: sequentialChunksLossMessage,
        variant: 'error',
      })
      session.sequentialLostChunks = 0
      session.losingChunksWarningIssued = true
    }

    // Check if more than 5% of total video chunks are lost
    const lostChunkPercentage = (session.totalLostChunks / session.totalChunks) * 100
    if (session.totalChunks > 10 && lostChunkPercentage > 5 && session.losingChunksWarningIssued === false) {
      showDialog({
        message: fivePercentChunksLossMessage,
        variant: 'error',
      })
      session.losingChunksWarningIssued = true
    }
  }

  /**
   * Wraps up a recording that has stopped for good, assembling the video and its telemetry overlay
   * @param {string} streamName - Name of the stream that was recorded
   * @param {RecordingSession} session - The recording that ended
   * @param {() => boolean} recorderIsStillAttached - Whether the recorder that stopped is still the stream's
   */
  const finishRecording = async (
    streamName: string,
    session: RecordingSession,
    recorderIsStillAttached: () => boolean
  ): Promise<void> => {
    session.gapFiller?.stop()

    const info = unprocessedVideos.value[session.hash]
    if (!info) {
      const errorMessage = `Failed to generate telemetry overlay: recording metadata for '${session.hash}' not found.`
      openSnackbar({ message: errorMessage, variant: 'error' })
      delete liveProcessors.value[session.hash]
      if (recorderIsStillAttached()) {
        activeStreams.value[streamName]!.mediaRecorder = undefined
      }
      return
    }

    // Register that the recording finished
    info.dateFinish = new Date()
    unprocessedVideos.value = { ...unprocessedVideos.value, ...{ [session.hash]: info } }

    // Finalize live processing if active (Electron only)
    const processor = liveProcessors.value[session.hash]
    if (processor) {
      try {
        reportJoinedRecording(session.streamLabel, await processor.stopProcessing())
      } catch (error) {
        console.error('Failed to process video:', error)
        // Carries the reason, as a recording that was cut by an outage says in it where its parts were left
        const reason = messageFromError(error)
        alertStore.pushAlert(new Alert(AlertLevel.Error, `Failed to process video for stream ${streamName}. ${reason}`))
      } finally {
        delete liveProcessors.value[session.hash]
      }
    }

    // Generate telemetry overlay after video processing is complete
    try {
      await generateTelemetryOverlay(session.hash)
    } catch (telemetryError) {
      openSnackbar({ message: `Failed to generate telemetry overlay: ${telemetryError}`, variant: 'error' })
    }

    if (activeStreams.value[streamName]) {
      // The error handler detaches a failed recorder right away, so by now the slot can already hold a newer
      // recorder that is still running. Only the recorder that stopped may clear it.
      if (recorderIsStillAttached()) {
        activeStreams.value[streamName]!.mediaRecorder = undefined
      }
      // The recording guard may have kept this stream alive after its last consumer left (e.g. the recorder
      // widget was unmounted mid-recording); now that recording is done, release it if nothing needs it.
      deactivateStreamIfUnused(streamName)
    } else {
      console.warn(`Stream '${streamName}' was removed during video processing finalization.`)
    }
  }

  /**
   * Hands a recording to a recorder over the given stream, which continues it where the one before it left
   * off, writing the same file with the same chunk numbering
   * @param {string} streamName - Name of the stream being recorded
   * @param {RecordingSession} session - The recording to write
   * @param {MediaStream} mediaStream - The stream to record
   */
  const attachRecorderToSession = (streamName: string, session: RecordingSession, mediaStream: MediaStream): void => {
    const recorder = buildRecorderFor(mediaStream)
    const recorderIsStillAttached = (): boolean => activeStreams.value[streamName]?.mediaRecorder === recorder

    // A recorder taking over from another one opens a WebM stream of its own, which is muxed as a segment of
    // its own and joined to the ones before it when the recording ends
    let segmentToOpen = session.chunksCount >= 0
    const openSegmentIfPending = (): void => {
      if (!segmentToOpen) return
      segmentToOpen = false
      session.segmentIndex++
      session.skipNextHealthCheck = true
      const startedInfo = unprocessedVideos.value[session.hash]
      if (startedInfo) startedInfo.lastKnownFileSize = 0
    }

    // Registered before starting, as a recorder can fail on the very first frame it is handed
    recorder.onerror = (event) => {
      const error: DOMException | undefined = (event as ErrorEvent).error
      console.error(`Recorder of stream '${streamName}' failed: ${error?.message ?? 'unknown error'}`)
      reportUnexpectedRecordingStop(streamName, session.streamLabel)

      // Vue does not proxy a MediaRecorder, so clearing the start time here is what drops the interface out of the
      // recording state, and detaching the recorder is what drops it out of the finalizing one.
      activeStreams.value[streamName]!.timeRecordingStart = undefined
      activeStreams.value[streamName]!.mediaRecorder = undefined
    }

    recorder.ondataavailable = async (e) => {
      // A recorder losing its stream signs off with an empty blob, and a chunk number spent on nothing would
      // leave the live processor waiting for a chunk that never comes, stranding the ones after it
      if (e.data.size === 0) return

      session.chunksCount++
      session.totalChunks++
      const chunkNumber = session.chunksCount
      const chunkName = videoChunkName(session.hash, chunkNumber)

      try {
        await tempVideoStorage.setItem(chunkName, e.data)
        session.sequentialLostChunks = 0
      } catch {
        if (chunkNumber === 0) {
          const msg = 'Failed to initiate recording. First chunk was lost. Try again.'
          showDialog({ message: msg, variant: 'error' })
          alertStore.pushAlert(new Alert(AlertLevel.Error, msg))
          if (recorderIsStillAttached()) stopRecording(streamName)
        }

        session.sequentialLostChunks++
        session.totalLostChunks++

        warnAboutChunkLoss(session)
        return
      }
      // The main process only opens a segment for a chunk it is handed
      openSegmentIfPending()

      // Send chunk to live processor if active
      const processor = liveProcessors.value[session.hash]
      if (processor) {
        try {
          await processor.addChunk(e.data, chunkNumber)
        } catch (error) {
          if (error instanceof LiveVideoProcessorChunkAppendingError) {
            if (!isRecording(streamName)) {
              // eslint-disable-next-line
              console.warn(`Failed to add chunk ${chunkNumber} to live video processor but stream ${streamName} was already not recording. This usually happens when stopping the recording, so it's expected and should not be a problem.`)
              return
            }
            const msg = `Failed to add chunk ${chunkNumber} to live processor: ${error.message}`
            openSnackbar({ message: msg, variant: 'error' })
          } else if (error instanceof LiveVideoProcessorInitializationError) {
            const msg = `Failed to initialize live processor for stream ${streamName}: ${error.message}`
            showDialog({ message: msg, variant: 'error' })
            alertStore.pushAlert(new Alert(AlertLevel.Error, msg))
            if (recorderIsStillAttached()) stopRecording(streamName)
          } else {
            console.warn(`Unexpected live-processor error on chunk ${chunkNumber} for stream ${streamName}:`, error)
            if (!session.unexpectedProcessorErrorWarned) {
              session.unexpectedProcessorErrorWarned = true
              openSnackbar({
                message:
                  'Something went wrong while assembling the recorded video. Recording is still running; the saved file may be incomplete.',
                variant: 'error',
              })
            }
          }
        }
      }

      const updatedInfo = unprocessedVideos.value[session.hash]
      updatedInfo.dateLastRecordingUpdate = new Date()
      unprocessedVideos.value = { ...unprocessedVideos.value, ...{ [session.hash]: updatedInfo } }
    }

    recorder.onstop = async () => {
      // Only a stop nobody asked for still has its start time set, as both the Stop button and the error handler
      // clear it before the recorder gets here
      const stoppedOnItsOwn =
        recorderIsStillAttached() && activeStreams.value[streamName]!.timeRecordingStart !== undefined
      if (stoppedOnItsOwn && continueRecordingAfterStreamDrop(streamName, session)) return

      // Every way a recording ends reaches onstop (Stop button, stream teardown, dropped link), so mirror the stop
      // here rather than in stopRecording, otherwise the vehicle keeps recording and mirroring stays wedged off.
      broadcastRecordingStop(streamName)

      if (stoppedOnItsOwn) reportUnexpectedRecordingStop(streamName, session.streamLabel)

      // A recording that ended on its own leaves the recording state here, so no consumer waits on the finalization
      // below, which takes as long as the video processing and the telemetry overlay need.
      if (recorderIsStillAttached()) activeStreams.value[streamName]!.timeRecordingStart = undefined

      await finishRecording(streamName, session, recorderIsStillAttached)
    }

    recorder.start(1000)

    // The stream becomes busy at this single point, with a recorder already running, so nothing that throws on the way
    // here can leave it marked as recording or as still being saved.
    activeStreams.value[streamName]!.mediaRecorder = recorder
    activeStreams.value[streamName]!.timeRecordingStart = session.timeRecordingStart
  }

  /**
   * Start recording the stream
   * @param {string} streamName - Name of the stream
   */
  const startRecording = async (streamName: string): Promise<void> => {
    eventTracker.capture('Video recording start', { streamName: streamName })
    const streamData = getStreamData(streamName)

    if (namesAvailableStreams.value.isEmpty()) {
      showDialog({ message: 'No streams available.', variant: 'error' })
      return
    }

    if (streamData?.mediaStream === undefined) {
      showDialog({ message: 'Media stream not defined.', variant: 'error' })
      return
    }
    if (!isSessionRecordable(streamName)) {
      streamData.webRtcManager?.renewUnrecordableSession()
      const streamLabel = internalStreamNameFromExternal(streamName) ?? streamName
      const message = `The camera sent stream '${streamLabel}' in a form that cannot be recorded. Try again in a few seconds.`
      showDialog({ message, variant: 'error' })
      return
    }
    // The media stream is active from the moment its track is added, before the session has connected
    if (!streamData.mediaStream.active || !streamData.connected) {
      showDialog({ message: 'Media stream not yet active. Wait a second and try again.', variant: 'error' })
      return
    }

    // Below the guards above, so that only a start that goes on to attach a recorder takes over a wait for the
    // stream, rather than one that is about to bail leaving nothing recording
    cancelRecordingResume(streamName)

    await sleep(100)

    // Generate a unique recording hash
    let recordingHash = ''
    let refreshHash = true
    const namesCurrentChunksOnDB = await tempVideoStorage.keys()
    while (refreshHash) {
      recordingHash = uuid().slice(0, 8)
      const hashOnDB = namesCurrentChunksOnDB.some((chunkName) => chunkName.includes(recordingHash))
      const hashOnRegistry = unprocessedVideos.value[recordingHash] !== undefined
      refreshHash = hashOnDB || hashOnRegistry
    }

    const safeMissionName = sanitizeFilenameComponent(missionStore.missionName) || 'Cockpit'
    const timeRecordingStart = new Date()
    const fileName = videoFilename(recordingHash, timeRecordingStart, safeMissionName)

    const videoTrack = streamData.mediaStream.getVideoTracks()[0]
    const vWidth = videoTrack.getSettings().width || 1920
    const vHeight = videoTrack.getSettings().height || 1080

    // Register the video as unprocessed so we can recover latter if needed
    const videoInfo: UnprocessedVideoInfo = {
      dateStart: timeRecordingStart,
      dateLastRecordingUpdate: timeRecordingStart,
      dateFinish: undefined,
      dateLastProcessingUpdate: undefined,
      fileName,
      vWidth,
      vHeight,
      lastKnownFileSize: 0,
      lastKnownNumberOfChunks: 0,
    }
    unprocessedVideos.value = { ...unprocessedVideos.value, ...{ [recordingHash]: videoInfo } }

    const session: RecordingSession = {
      hash: recordingHash,
      fileName,
      // The internal name, since the external id of an RTSP stream is its URL, credentials included, and these
      // warnings are both shown to the user and written to the logs they share with us.
      streamLabel: internalStreamNameFromExternal(streamName) ?? streamName,
      timeRecordingStart,
      chunksCount: -1,
      segmentIndex: 0,
      skipNextHealthCheck: false,
      vWidth,
      vHeight,
      hasAudio: streamData.mediaStream.getAudioTracks().length > 0,
      gapFiller: undefined,
      stallNoticeId: undefined,
      outagesSurvived: 0,
      totalChunks: 0,
      totalLostChunks: 0,
      sequentialLostChunks: 0,
      losingChunksWarningIssued: false,
      unexpectedProcessorErrorWarned: false,
    }

    // Initialize live processor if enabled and on Electron
    if (enableLiveProcessing.value && window.electronAPI) {
      try {
        const liveProcessor = new LiveVideoProcessor(recordingHash, fileName, keepRawVideoChunksAsBackup.value)
        await liveProcessor.startProcessing()
        liveProcessors.value[recordingHash] = liveProcessor

        console.debug(`Live processing started for ${recordingHash}`)
      } catch (error) {
        // Stop recording and release all resources tied to the stream (WebRTC/go2rtc, tracks, recorder)
        teardownStreamResources(streamName, `Live processing failed to start for external stream '${streamName}'`)

        // Stop live processing if it's running
        if (liveProcessors.value[recordingHash]) {
          delete liveProcessors.value[recordingHash]
        }

        throw new Error(`Failed to start live processing for recording '${recordingHash}': ${error}`)
      }
    }

    attachRecorderToSession(streamName, session, streamData.mediaStream)
    startRecordingHealthMonitor(streamName, session)

    // Mirror only after the recorder and its handlers are fully set up, so a start that throws (e.g. live-processing
    // init failing) never leaves the stream marked as mirrored.
    broadcastRecordingStart(streamName)

    alertStore.pushAlert(new Alert(AlertLevel.Success, `Started recording stream ${streamName}.`))
  }

  // Used to discard a file from the video recovery database
  const discardProcessedFilesFromVideoDB = async (fileNames: string[]): Promise<void> => {
    console.debug(`Discarding files from the video recovery database: ${fileNames.join(', ')}`)
    for (const filename of fileNames) {
      await videoStorage.removeItem(filename)
    }
  }

  const createZipAndDownload = async (
    files: FilesToZip[],
    zipFilename: string,
    progressCallback?: DownloadProgressCallback
  ): Promise<void> => {
    const zipWriter = new ZipWriter(new BlobWriter('application/zip'), { level: 0 })
    const zipAddingPromises = files.map(({ file, lastModDate }) => {
      zipWriter.add(file.filename, new BlobReader(file.blob), {
        lastModDate: lastModDate,
        onprogress: progressCallback,
      })
    })
    Promise.all(zipAddingPromises)
    const blob = await zipWriter.close()
    saveAs(blob, zipFilename)
  }

  const isVideoFilename = (filename: string): boolean => {
    for (const ext of Object.values(VideoExtensionContainer)) {
      if (filename.endsWith(ext)) return true
    }
    return false
  }

  const openVideoSettings = (): void => {
    logUserAction('Opened the video settings from a video streaming warning')
    closeDialog()
    goToMenuPage(SubMenuComponentName.SettingsVideo)
  }

  const dismissVideoStreamingWarning = (): void => {
    logUserAction('Dismissed a video streaming warning')
    closeDialog()
  }

  // The settings the warnings are about are what they exist to offer, so that action carries the committing fill both
  // of them use.
  const videoStreamingWarningActions = [
    { text: 'Close', action: dismissVideoStreamingWarning },
    { text: 'Open video settings', class: 'bg-[#FFFFFF33] text-white', action: openVideoSettings },
  ]

  const issueSelectedIpNotAvailableWarning = (): void => {
    showDialog({
      maxWidth: 600,
      title: 'All available video stream IPs are being blocked',
      message: [
        `Cockpit detected that none of the IPs that are streaming video from your server are in the allowed list. This
        will lead to no video being streamed.`,
        'This can happen if you changed your network or the IP of your vehicle.',
        `To solve this problem, please open the video settings and clear the selected IPs. Then, select an available
        IP from the list.`,
      ],
      variant: 'warning',
      actions: videoStreamingWarningActions,
    })
  }

  const issueNoIpSelectedWarning = (): void => {
    showDialog({
      maxWidth: 600,
      title: 'Video being routed from multiple IPs',
      message: [
        `Cockpit detected that the video streams are being routed from multiple IPs. This often leads to video
        stuttering, especially if one of the IPs is from a non-wired connection.`,
        `To prevent issues and achieve an optimal streaming experience, please open the video settings and select the
        IP address that should be used for the video streaming.`,
      ],
      variant: 'warning',
      actions: videoStreamingWarningActions,
    })
  }

  if (enableAutoIceIpFetch.value) {
    // Routine to make sure the user has chosen the allowed ICE candidate IPs, so the stream works as expected
    let noIpSelectedWarningIssued = false
    let selectedIpNotAvailableWarningIssued = false
    const iceIpCheckInterval = setInterval(async (): Promise<void> => {
      // Pass if there are no available IPs yet
      if (availableIceIps.value.isEmpty()) return

      if (!allowedIceIps.value.isEmpty()) {
        // If the user has selected IPs, but none of them are available, warn about it, since no video will be streamed.
        // Otherwise, if IPs are selected and available, clear the check routine.
        const availableSelectedIps = availableIceIps.value.filter((ip) => allowedIceIps.value.includes(ip))
        if (availableSelectedIps.isEmpty() && !selectedIpNotAvailableWarningIssued) {
          console.warn('Selected ICE IPs are not available. Warning user.')
          issueSelectedIpNotAvailableWarning()
          selectedIpNotAvailableWarningIssued = true
        }
        clearInterval(iceIpCheckInterval)
      }

      // If the user has not selected any IPs and there's more than one IP candidate available, try getting information
      // about them from BlueOS. If that fails, send a warning an clear the check routine.
      if (allowedIceIps.value.isEmpty() && availableIceIps.value.length >= 1) {
        // Try to select the IP automatically if it's a wired connection (based on BlueOS data).
        let currentlyOnWirelessConnection = false
        try {
          const ipsInfo = await getIpsInformationFromVehicle(globalAddress)
          const newAllowedIps: string[] = []
          ipsInfo.forEach((ipInfo) => {
            const isIceIp = availableIceIps.value.includes(ipInfo.ipv4Address)
            const alreadyAllowedIp = [...allowedIceIps.value, ...newAllowedIps].includes(ipInfo.ipv4Address)
            const isTethered = isTetheredInterfaceType(ipInfo.interfaceType)
            if (globalAddress === ipInfo.ipv4Address && !isTethered) {
              currentlyOnWirelessConnection = true
            }
            if (!isTethered || alreadyAllowedIp || !isIceIp) return
            console.info(`Adding the wired address '${ipInfo.ipv4Address}' to the list of allowed ICE IPs.`)
            newAllowedIps.push(ipInfo.ipv4Address)
          })
          allowedIceIps.value = newAllowedIps
          if (!allowedIceIps.value.isEmpty()) {
            showDialog({
              message: 'Preferred video stream routes fetched from BlueOS.',
              variant: 'success',
              timer: 5000,
            })
          }
        } catch (error) {
          console.error('Failed to get IP information from the vehicle:', error)
        }

        // If the system was still not able to populate the allowed IPs list yet, warn the user.
        // Otherwise, clear the check routine.
        if (allowedIceIps.value.isEmpty() && !noIpSelectedWarningIssued && !currentlyOnWirelessConnection) {
          console.info('No ICE IPs selected for the allowed list. Warning user.')
          issueNoIpSelectedWarning()
          noIpSelectedWarningIssued = true
        }
        clearInterval(iceIpCheckInterval)
      }
    }, 5000)
  }

  // Video recording actions
  const startRecordingAllStreams = (): void => {
    const streamsThatStarted: string[] = []
    isRecordingAllStreams.value = true

    namesAvailableStreams.value.forEach((streamName) => {
      if (!isRecording(streamName)) {
        startRecording(streamName)
        streamsThatStarted.push(streamName)
      }
    })

    if (streamsThatStarted.isEmpty()) {
      alertStore.pushAlert(new Alert(AlertLevel.Error, 'No streams available to be recorded.'))
      return
    }
    const msg = `Started recording all ${streamsThatStarted.length} streams: ${streamsThatStarted.join(', ')}.`
    alertStore.pushAlert(new Alert(AlertLevel.Success, msg))
  }

  const stopRecordingAllStreams = (): void => {
    const streamsThatStopped: string[] = []
    isRecordingAllStreams.value = false

    namesAvailableStreams.value.forEach((streamName) => {
      if (isRecording(streamName)) {
        stopRecording(streamName)
        streamsThatStopped.push(streamName)
      }
    })

    if (streamsThatStopped.isEmpty()) {
      alertStore.pushAlert(new Alert(AlertLevel.Error, 'No streams were being recorded.'))
      return
    }
    const msg = `Stopped recording all ${streamsThatStopped.length} streams: ${streamsThatStopped.join(', ')}.`
    alertStore.pushAlert(new Alert(AlertLevel.Success, msg))
  }

  const toggleRecordingAllStreams = (): void => {
    if (isRecordingAllStreams.value) {
      stopRecordingAllStreams()
    } else {
      startRecordingAllStreams()
    }
  }

  const renameStreamInternalNameById = (streamID: string, newInternalName: string): void => {
    // Check if the new internal name is already taken
    const isNameTaken = streamsCorrespondency.value.some((stream) => stream.name === newInternalName)
    if (isNameTaken) {
      throw new Error(`The internal name '${newInternalName}' is already taken.`)
    }

    const streamCorr = streamsCorrespondency.value.find((stream) => stream.externalId === streamID)

    if (streamCorr) {
      streamCorr.name = newInternalName
      lastRenamedStreamName.value = newInternalName
    } else {
      throw new Error(`Stream with ID '${streamID}' not found.`)
    }
  }

  const deleteStreamCorrespondency = (externalId: string): void => {
    const streamIndex = streamsCorrespondency.value.findIndex((stream) => stream.externalId === externalId)

    if (streamIndex !== -1) {
      const stream = streamsCorrespondency.value[streamIndex]

      // Add to ignored list and clear user-restored status so auto-ignore can re-apply
      if (!persistedIgnoredStreamExternalIds.value.includes(externalId)) {
        persistedIgnoredStreamExternalIds.value = [...persistedIgnoredStreamExternalIds.value, externalId]
      }
      if (!userIgnoredStreamIds.value.includes(externalId)) {
        userIgnoredStreamIds.value = [...userIgnoredStreamIds.value, externalId]
      }
      userRestoredStreamIds.value = userRestoredStreamIds.value.filter((id) => id !== externalId)

      // Remove from correspondency list
      streamsCorrespondency.value.splice(streamIndex, 1)

      // Clean up all resources for the stream, and any consumer bookkeeping tied to it
      streamConsumers.delete(externalId)
      rtspActivationBackoff.forget(externalId)
      if (activeStreams.value[externalId]) {
        teardownStreamResources(externalId, `External stream '${externalId}' was ignored by user`)
      }

      openSnackbar({ variant: 'success', message: `Stream '${stream.name}' deleted and added to ignored list.` })
    } else {
      openSnackbar({ variant: 'warning', message: `Stream with external ID '${externalId}' not found.` })
    }
  }

  const restoreIgnoredStream = (externalId: string): void => {
    const ignoredIndex = persistedIgnoredStreamExternalIds.value.indexOf(externalId)

    if (ignoredIndex !== -1) {
      // Remove from ignored list
      persistedIgnoredStreamExternalIds.value.splice(ignoredIndex, 1)
      userIgnoredStreamIds.value = userIgnoredStreamIds.value.filter((id) => id !== externalId)

      // Track that the user explicitly restored this stream so auto-ignore won't re-ignore it
      if (!userRestoredStreamIds.value.includes(externalId)) {
        userRestoredStreamIds.value = [...userRestoredStreamIds.value, externalId]
      }

      const isRtsp = externalId.startsWith('rtsp://') || externalId.startsWith('rtsps://')
      if (isRtsp) {
        initializeRtspStreamsCorrespondency()
      } else if (namesAvailableStreams.value.includes(externalId)) {
        initializeStreamsCorrespondency()
      } else {
        openSnackbar({ variant: 'warning', message: `Stream '${externalId}' not available anymore.` })
      }

      openSnackbar({ variant: 'success', message: `Stream '${externalId}' restored from ignored list.` })
    } else {
      openSnackbar({ variant: 'warning', message: `Stream with external ID '${externalId}' not on ignored list.` })
    }
  }

  /**
   * Add a new RTSP stream to the correspondency list (Electron/standalone only)
   * @param {string} rtspUrl - Full RTSP URL
   * @returns {VideoStreamCorrespondency} The created correspondency entry
   */
  const addRtspStreamCorrespondency = (rtspUrl: string): VideoStreamCorrespondency => {
    if (!window.electronAPI) {
      throw new Error('RTSP streams are only available in Cockpit standalone.')
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(rtspUrl)
    } catch {
      throw new Error('Invalid RTSP URL.')
    }

    if (!['rtsp:', 'rtsps:'].includes(parsedUrl.protocol)) {
      throw new Error('RTSP URL must start with rtsp:// or rtsps://')
    }

    const normalizedRtspUrl = rtspUrl.trim()
    const duplicate = streamsCorrespondency.value.find((stream) => stream.rtspUrl === normalizedRtspUrl)
    if (duplicate) {
      throw new Error('This RTSP URL is already added.')
    }

    const existingInternalNames = streamsCorrespondency.value.map((corr) => corr.name)
    const internalName = uniqueInternalName(rtspBaseName(normalizedRtspUrl), existingInternalNames)

    const newCorrespondency: VideoStreamCorrespondency = {
      name: internalName,
      externalId: normalizedRtspUrl,
      protocol: 'rtsp',
      rtspUrl: normalizedRtspUrl,
    }
    streamsCorrespondency.value = [...streamsCorrespondency.value, newCorrespondency]
    return newCorrespondency
  }

  registerActionCallback(
    availableCockpitActions.start_recording_all_streams,
    useThrottleFn(startRecordingAllStreams, 3000)
  )
  registerActionCallback(
    availableCockpitActions.stop_recording_all_streams,
    useThrottleFn(stopRecordingAllStreams, 3000)
  )
  registerActionCallback(
    availableCockpitActions.toggle_recording_all_streams,
    useThrottleFn(toggleRecordingAllStreams, 3000)
  )

  return {
    availableIceIps,
    allowedIceIps,
    enableAutoIceIpFetch,
    allowedIceProtocols,
    jitterBufferTarget,
    namesAvailableStreams,
    namesAvailableWebRTCStreams,
    videoStorage,
    tempVideoStorage,
    streamsCorrespondency,
    ignoredStreamExternalIds,
    hasDisregarded4kCamIgnore,
    isBlueRobotics4kCamStreamName,
    namessAvailableAbstractedStreams,
    externalStreamId,
    internalStreamNameFromExternal,
    getStreamProtocol,
    getStreamDisplayInfo,
    getRtspUrl,
    streamInformation,
    go2rtcStreamInfo,
    discardProcessedFilesFromVideoDB,
    getMediaStream,
    getStreamData,
    registerStreamConsumer,
    unregisterStreamConsumer,
    getSignallerStatus,
    getStreamStatus,
    getStreamPeerConnection,
    isRecording,
    isFinalizingRecording,
    isStreamVideoStalled,
    warnAboutLostRecordingParts,
    stopRecording,
    startRecording,
    unprocessedVideos,
    createZipAndDownload,
    isVideoFilename,
    getVideoThumbnail,
    activeStreams,
    renameStreamInternalNameById,
    lastRenamedStreamName,
    deleteStreamCorrespondency,
    restoreIgnoredStream,
    addRtspStreamCorrespondency,
    enableLiveProcessing,
    keepRawVideoChunksAsBackup,
    broadcastCameraActionsOverMavlink,
    broadcastSnapshotCapture,
  }
})
