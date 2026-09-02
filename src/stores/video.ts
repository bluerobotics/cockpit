import { useStorage, useThrottleFn } from '@vueuse/core'
import { BlobReader, BlobWriter, ZipWriter } from '@zip.js/zip.js'
import { differenceInSeconds } from 'date-fns'
import { saveAs } from 'file-saver'
import { defineStore } from 'pinia'
import { v4 as uuid } from 'uuid'
import { computed, markRaw, ref, watch } from 'vue'
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
import { isElectron, isEqual, sanitizeFilenameComponent, sleep } from '@/libs/utils'
import {
  codecNameFromStats,
  isHevcCodec,
  negotiatedVideoCodecNames,
  recordingMimeType,
  recordingVideoBitsPerSecond,
  videoTrackSettingsWithSize,
} from '@/libs/video-recording-codec'
import { tempVideoStorage, videoStorage } from '@/libs/videoStorage'
import type { Stream } from '@/libs/webrtc/signalling_protocol'
import { readableVideoCodecName } from '@/libs/webrtc/video-codec-support'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import { Alert, AlertLevel } from '@/types/alert'
import { SubMenuComponentName } from '@/types/general'
import {
  type DownloadProgressCallback,
  type Go2RTCStreamInfo,
  type StreamData,
  type StreamPeerConnectionInfo,
  type UnprocessedVideoInfo,
  type VideoStreamProtocol,
  FilesToZip,
  VideoExtensionContainer,
  VideoStreamCorrespondency,
} from '@/types/video'
import { videoFilename, videoSubtitlesFilename, videoThumbnailFilename } from '@/utils/video'

import { useAlertStore } from './alert'
const { openSnackbar } = useSnackbar()

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
      const streamsInfo = await window.electronAPI.go2rtcGetStreamsInfo()
      // go2rtc reads the frame size out of the source's stream description, which only carries it for H.264, so
      // H.265 sources take theirs from the track the renderer decodes. Filled here so every consumer of this
      // payload sees it, rather than at each place that displays a resolution.
      Object.entries(streamsInfo).forEach(([externalId, info]) => {
        if (info.width !== undefined) return
        const trackSettings = activeStreams.value[externalId]?.mediaStream?.getVideoTracks()[0]?.getSettings()
        info.width = trackSettings?.width
        info.height = trackSettings?.height
      })
      go2rtcStreamInfo.value = streamsInfo
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
        if (isRecording(streamName)) {
          showDialog({ message: `Stream '${streamName}' has changed. Stopping recording...`, variant: 'error' })
          stopRecording(streamName)
        }

        console.log(`Stream '${streamName}' has changed. Stopping its WebRTC session...`)
        oldStreamData.webRtcManager.endAllSessions()
      }

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
          externalStreamData.webRtcManager.session?.peerConnection.close()
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
   * Tear down an external stream if it has no remaining consumers and no recording in flight (i.e. neither
   * starting, recording, nor finalizing a just-stopped recording)
   * @param {string} externalId - External stream identifier
   */
  const deactivateStreamIfUnused = (externalId: string): void => {
    const consumers = streamConsumers.get(externalId)
    if (consumers && consumers.size > 0) return

    streamConsumers.delete(externalId)

    // Never tear down a stream while a recording is in flight, even if no widget references it: timeRecordingStart
    // is stamped from the press onwards, mediaRecorder stays set through recording and the async stop() finalizer
    // (telemetry/processing), and onstop clears it when done.
    const streamData = activeStreams.value[externalId]
    if (streamData?.mediaRecorder !== undefined || streamData?.timeRecordingStart !== undefined) return

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

      const telemetryLog = await datalogger.generateLog(recordingData.dateStart!, recordingData.dateFinish!)

      if (telemetryLog !== undefined) {
        const assLog = datalogger.toAssOverlay(
          telemetryLog,
          recordingData.vWidth!,
          recordingData.vHeight!,
          recordingData.dateStart!.getTime()
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
    return getStreamData(streamName)?.mediaRecorder?.state === 'recording'
  }

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
   * Stop recording the stream
   * @param {string} streamName - Name of the stream
   */
  const stopRecording = (streamName: string): void => {
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

    streamData.mediaRecorder.stop()

    alertStore.pushAlert(new Alert(AlertLevel.Success, `Stopped recording stream ${streamName}.`))
  }

  const getVideoThumbnail = async (videoFileNameOrHash: string, isProcessed: boolean): Promise<Blob | null> => {
    const db = isProcessed ? videoStorage : tempVideoStorage
    const thumbnail = await db.getItem(videoThumbnailFilename(videoFileNameOrHash))
    return thumbnail || null
  }

  /**
   * Codec being received for a stream, as reported by the peer connection feeding it
   * @param {string} streamName - Name of the stream
   * @returns {Promise<string | undefined>} The codec name, e.g. 'H264', or undefined if it cannot be told
   */
  const receivedVideoCodec = async (streamName: string): Promise<string | undefined> => {
    const peerConnection = getStreamPeerConnection(streamName)?.peerConnection
    if (!peerConnection) return undefined

    try {
      const codecInUse = codecNameFromStats(await peerConnection.getStats())
      if (codecInUse) return codecInUse
    } catch (error) {
      const streamLabel = internalStreamNameFromExternal(streamName) ?? streamName
      console.error(`Could not read the statistics of stream '${streamLabel}': ${error}`)
    }

    // Recording can start before the first packet is processed, and until then the statistics name no codec at
    // all. Whatever was negotiated is what may arrive, so the riskiest of those is what we have to record for.
    const negotiatedCodecs = negotiatedVideoCodecNames(peerConnection)
    return negotiatedCodecs.find(isHevcCodec) ?? negotiatedCodecs[0]
  }

  /**
   * Start recording the stream
   * @param {string} streamName - Name of the stream
   */
  const startRecording = async (streamName: string): Promise<void> => {
    // The internal name, since the external id of an RTSP stream is its URL, credentials included, and these messages
    // are both shown to the user and written to the logs they share with us.
    const streamLabel = internalStreamNameFromExternal(streamName) ?? streamName

    // timeRecordingStart is stamped before the awaits that precede the recorder, so it is what marks a start
    // already in flight, which mediaRecorder (and thus isRecording) only does once those awaits are through.
    if (activeStreams.value[streamName]?.timeRecordingStart !== undefined) {
      console.warn(`Recording of stream '${streamLabel}' is already starting or running. Ignoring the request.`)
      return
    }

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
    if (!streamData.mediaStream.active) {
      showDialog({ message: 'Media stream not yet active. Wait a second and try again.', variant: 'error' })
      return
    }

    await sleep(100)

    streamData.timeRecordingStart = new Date()

    let recordingHash = ''
    let fileName = ''
    let mimeType: string | undefined
    let videoTrack: MediaStreamTrack | undefined
    try {
      // Generate a unique recording hash
      let refreshHash = true
      const namesCurrentChunksOnDB = await tempVideoStorage.keys()
      while (refreshHash) {
        recordingHash = uuid().slice(0, 8)
        const hashOnDB = namesCurrentChunksOnDB.some((chunkName) => chunkName.includes(recordingHash))
        const hashOnRegistry = unprocessedVideos.value[recordingHash] !== undefined
        refreshHash = hashOnDB || hashOnRegistry
      }

      const safeMissionName = sanitizeFilenameComponent(missionStore.missionName) || 'Cockpit'
      fileName = videoFilename(recordingHash, streamData.timeRecordingStart!, safeMissionName)
      videoTrack = streamData.mediaStream!.getVideoTracks()[0]
      mimeType = recordingMimeType(await receivedVideoCodec(streamName))
      // Only the re-encoding path needs a bitrate; copied frames already carry the camera's own.
      const recorderOptions: MediaRecorderOptions = mimeType
        ? { mimeType, videoBitsPerSecond: recordingVideoBitsPerSecond(await videoTrackSettingsWithSize(videoTrack)) }
        : {}
      // Only the construction belongs in this try, as its catch blames the codec for whatever comes out of it.
      let newRecorder: MediaRecorder
      try {
        newRecorder = new MediaRecorder(streamData.mediaStream!, recorderOptions)
      } catch (error) {
        console.error(`Could not create a recorder for stream '${streamLabel}': ${error}`)
        const alternative = isElectron()
          ? 'Set the camera to H.264 and try again.'
          : 'Set the camera to H.264, or use the Cockpit desktop app, which records formats browsers cannot.'
        const msg = `This computer cannot record the video format of stream '${streamLabel}'. ${alternative}`
        showDialog({ message: msg, variant: 'error' })
        alertStore.pushAlert(new Alert(AlertLevel.Error, msg))
        return
      }

      const currentData = activeStreams.value[streamName]
      if (currentData === undefined) {
        console.warn(`Stream '${streamLabel}' was torn down while its recorder was being set up. Not recording it.`)
        return
      }
      currentData.mediaRecorder = newRecorder
    } finally {
      // Nothing above is guaranteed to reach the recorder, and while timeRecordingStart is set it blocks both a
      // retry and the stream's teardown, so it is released whenever no recorder came out of this attempt.
      const currentData = activeStreams.value[streamName]
      if (currentData !== undefined && currentData.mediaRecorder === undefined) {
        currentData.timeRecordingStart = undefined
        // The last consumer may have left while the recorder was being set up, in which case the guard above kept
        // the stream alive for a recording that never started.
        deactivateStreamIfUnused(streamName)
      }
    }

    const recorder = activeStreams.value[streamName]!.mediaRecorder!
    const recorderIsStillAttached = (): boolean => activeStreams.value[streamName]?.mediaRecorder === recorder

    // Registered before starting, as a recorder can fail on the very first frame it is handed
    activeStreams.value[streamName]!.mediaRecorder!.onerror = (event) => {
      const error: DOMException | undefined = (event as ErrorEvent).error
      console.error(`Recorder of stream '${streamName}' failed: ${error?.message ?? 'unknown error'}`)
      const msg =
        `Recording of stream '${streamName}' stopped unexpectedly. The video recorded until then was kept and is` +
        ' available in the Video Library.'
      showDialog({ message: msg, variant: 'error' })
      alertStore.pushAlert(new Alert(AlertLevel.Error, msg))

      // The recorder stops itself on error, so the monitor would otherwise nag about a file that stopped growing
      clearInterval(recordingMonitors[streamName])
      delete recordingMonitors[streamName]

      // Vue does not proxy a MediaRecorder, so its state flipping to 'inactive' dirties nothing: detaching it here is
      // what drops the interface out of the recording state, instead of it waiting on the finalization in 'onstop'.
      activeStreams.value[streamName]!.timeRecordingStart = undefined
      activeStreams.value[streamName]!.mediaRecorder = undefined
    }

    const vWidth = videoTrack?.getSettings().width || 1920
    const vHeight = videoTrack?.getSettings().height || 1080

    // Register the video as unprocessed so we can recover latter if needed
    const videoInfo: UnprocessedVideoInfo = {
      dateStart: streamData.timeRecordingStart!,
      dateLastRecordingUpdate: streamData.timeRecordingStart!,
      dateFinish: undefined,
      dateLastProcessingUpdate: undefined,
      fileName,
      vWidth,
      vHeight,
      lastKnownFileSize: 0,
      lastKnownNumberOfChunks: 0,
    }
    unprocessedVideos.value = { ...unprocessedVideos.value, ...{ [recordingHash]: videoInfo } }

    // On Electron, we can get the size of the video output file in real time
    // This is useful to detect if the output file is growing, which is an indication that the recording is still ongoing.
    // On Web, we can only know if the number of chunks is growing, which is an indication that the recording is still ongoing.
    // We also need to clear the interval if it already exists, to avoid multiple intervals running at the same time.
    clearInterval(recordingMonitors[streamName])
    delete recordingMonitors[streamName]
    if (window.electronAPI) {
      console.info(`Starting electron recording monitor for stream '${streamName}'.`)
      recordingMonitors[streamName] = setInterval(async () => {
        // Check if the stream is still recording before proceeding with checks
        if (!activeStreams.value[streamName] || !activeStreams.value[streamName]!.mediaRecorder) {
          const msg = `Recording for stream '${streamName}' has stopped. Stopping health monitor for this stream.`
          showDialog({ message: msg, variant: 'warning' })
          clearInterval(recordingMonitors[streamName])
          delete recordingMonitors[streamName]
          return
        }
        const fileStats = await window.electronAPI?.getFileStats(fileName, ['videos'])
        if (!fileStats || !fileStats.exists) {
          showRecordingHealthDialog(
            `Cockpit cannot find the file for the recording of stream '${streamLabel}', which means the recording may be lost. We recommend stopping it and starting a new one.`,
            true
          )
          return
        }
        const lastKnownFileSize = unprocessedVideos.value[recordingHash].lastKnownFileSize
        if (fileStats.size! <= lastKnownFileSize!) {
          showRecordingHealthDialog(
            `The video output file for stream '${streamLabel}' is not growing. This can indicate a problem with the recording.`
          )
          return
        }
        unprocessedVideos.value[recordingHash].lastKnownFileSize = fileStats.size
        console.debug(`Size of video output file for stream '${streamName}' growed to ${fileStats.size} bytes.`)
      }, 15000)
    } else {
      console.info(`Starting web recording monitor for stream '${streamName}'.`)
      recordingMonitors[streamName] = setInterval(async () => {
        // Check if the stream is still recording before proceeding with checks
        if (!activeStreams.value[streamName] || !activeStreams.value[streamName]!.mediaRecorder) {
          const msg = `Recording for stream '${streamName}' has stopped. Stopping health monitor for this stream.`
          showDialog({ message: msg, variant: 'warning' })
          clearInterval(recordingMonitors[streamName])
          delete recordingMonitors[streamName]
          return
        }
        // @ts-ignore: localForage is not defined on the StorageDB interface
        const numberOfChunks = await tempVideoStorage.localForage.length()
        const lastKnownNumberOfChunks = unprocessedVideos.value[recordingHash].lastKnownNumberOfChunks
        if (numberOfChunks <= lastKnownNumberOfChunks!) {
          showRecordingHealthDialog(
            `The number of video chunks for stream '${streamLabel}' is not growing. This can indicate a problem with the recording.`
          )
          return
        }
        unprocessedVideos.value[recordingHash].lastKnownNumberOfChunks = numberOfChunks
        console.debug(`Number of video chunks for stream '${streamName}' growed to ${numberOfChunks}.`)
      }, 15000)
    }

    activeStreams.value[streamName]!.mediaRecorder!.start(1000)

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
    let losingChunksWarningIssued = false
    const unsavedChunkAlerts: { [key in string]: ReturnType<typeof setTimeout> } = {}

    const warnAboutChunkLoss = (): void => {
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

      sequentialLostChunks++
      totalLostChunks++

      // Check for 5 or more sequential lost chunks
      if (sequentialLostChunks >= 5 && losingChunksWarningIssued === false) {
        showDialog({
          message: sequentialChunksLossMessage,
          variant: 'error',
        })
        sequentialLostChunks = 0
        losingChunksWarningIssued = true
      }

      // Check if more than 5% of total video chunks are lost
      const lostChunkPercentage = (totalLostChunks / totalChunks) * 100
      if (totalChunks > 10 && lostChunkPercentage > 5 && losingChunksWarningIssued === false) {
        showDialog({
          message: fivePercentChunksLossMessage,
          variant: 'error',
        })
        losingChunksWarningIssued = true
      }
    }

    Object.keys(unsavedChunkAlerts).forEach((key) => {
      clearTimeout(unsavedChunkAlerts[key])
      delete unsavedChunkAlerts[key]
    })

    let sequentialLostChunks = 0
    let totalChunks = 0
    let totalLostChunks = 0

    let chunksCount = -1
    activeStreams.value[streamName]!.mediaRecorder!.ondataavailable = async (e) => {
      chunksCount++
      totalChunks++
      const chunkName = `${recordingHash}_${chunksCount}`

      try {
        await tempVideoStorage.setItem(chunkName, e.data)
        sequentialLostChunks = 0

        // Send chunk to live processor if active
        const processor = liveProcessors.value[recordingHash]
        if (processor && e.data.size > 0) {
          try {
            await processor.addChunk(e.data, chunksCount)
          } catch (error) {
            if (error instanceof LiveVideoProcessorChunkAppendingError) {
              if (!isRecording(streamName)) {
                // eslint-disable-next-line
                console.warn(`Failed to add chunk ${chunksCount} to live video processor but stream ${streamName} was already not recording. This usually happens when stopping the recording, so it's expected and should not be a problem.`)
                return
              }
              const msg = `Failed to add chunk ${chunksCount} to live processor: ${error.message}`
              openSnackbar({ message: msg, variant: 'error' })
            } else if (error instanceof LiveVideoProcessorInitializationError) {
              const msg = `Failed to initialize live processor for stream ${streamName}: ${error.message}`
              showDialog({ message: msg, variant: 'error' })
              alertStore.pushAlert(new Alert(AlertLevel.Error, msg))
              if (recorderIsStillAttached()) stopRecording(streamName)
            } else throw error
          }
        }
      } catch {
        if (chunksCount === 0) {
          const msg = 'Failed to initiate recording. First chunk was lost. Try again.'
          showDialog({ message: msg, variant: 'error' })
          alertStore.pushAlert(new Alert(AlertLevel.Error, msg))
          if (recorderIsStillAttached()) stopRecording(streamName)
        }

        sequentialLostChunks++
        totalLostChunks++

        warnAboutChunkLoss()
        return
      }

      const updatedInfo = unprocessedVideos.value[recordingHash]
      updatedInfo.dateLastRecordingUpdate = new Date()
      unprocessedVideos.value = { ...unprocessedVideos.value, ...{ [recordingHash]: updatedInfo } }

      // If the chunk was saved, remove it from the unsaved list
      clearTimeout(unsavedChunkAlerts[chunkName])
      delete unsavedChunkAlerts[chunkName]
    }

    activeStreams.value[streamName]!.mediaRecorder!.onstop = async () => {
      // Every way a recording ends reaches onstop (Stop button, stream teardown, dropped link), so mirror the stop
      // here rather than in stopRecording, otherwise the vehicle keeps recording and mirroring stays wedged off.
      broadcastRecordingStop(streamName)

      const info = unprocessedVideos.value[recordingHash]
      if (!info) {
        const errorMessage = `Failed to generate telemetry overlay: recording metadata for '${recordingHash}' not found.`
        openSnackbar({ message: errorMessage, variant: 'error' })
        delete liveProcessors.value[recordingHash]
        if (recorderIsStillAttached()) {
          activeStreams.value[streamName]!.mediaRecorder = undefined
        }
        return
      }

      // Register that the recording finished
      info.dateFinish = new Date()
      unprocessedVideos.value = { ...unprocessedVideos.value, ...{ [recordingHash]: info } }

      // Finalize live processing if active (Electron only)
      const processor = liveProcessors.value[recordingHash]
      if (processor) {
        try {
          await processor.stopProcessing()
          openSnackbar({
            message: 'Video processing completed.',
            duration: 2000,
            variant: 'success',
            closeButton: false,
          })
        } catch (error) {
          console.error('Failed to process video:', error)
          alertStore.pushAlert(new Alert(AlertLevel.Error, `Failed to process video for stream ${streamName}.`))
        } finally {
          delete liveProcessors.value[recordingHash]
        }
      }

      // Generate telemetry overlay after video processing is complete
      try {
        await generateTelemetryOverlay(recordingHash)
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

    // Mirror only after the recorder and its handlers are fully set up, so a start that throws (e.g. live-processing
    // init failing) never leaves the stream marked as mirrored.
    broadcastRecordingStart(streamName)

    alertStore.pushAlert(new Alert(AlertLevel.Success, `Started recording stream ${streamName}.`))

    if (mimeType) {
      const savedFormat = mimeType.includes('hvc1') ? 'H.265' : 'H.264'
      openSnackbar({
        message:
          `Recording of stream '${streamLabel}' is being re-encoded to ${savedFormat} as it runs, which costs` +
          ' extra processing and some image quality. Set the camera to H.264 to record without re-encoding.',
        variant: 'info',
        duration: 8000,
      })
    }
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
