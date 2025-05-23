import { differenceInSeconds, format } from 'date-fns'
import { v4 as uuid } from 'uuid'
import { type ComputedRef, type Ref, computed, ref, watch } from 'vue'
import adapter from 'webrtc-adapter'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { useSnackbar } from '@/composables/snackbar'
import { WebRTCManager } from '@/composables/webRTC'
import eventTracker from '@/libs/external-telemetry/event-tracking'
import { datalogger } from '@/libs/sensors-logging'
import { isEqual, sleep } from '@/libs/utils'
import { tempVideoStorage, videoStorage } from '@/libs/videoStorage'
import { useAlertStore } from '@/stores/alert'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import { Alert, AlertLevel } from '@/types/alert'
import { type StreamData, type UnprocessedVideoInfo, type VideoStreamCorrespondency } from '@/types/video'

export type VideoStreamsEngine = ReturnType<typeof createEngine>

let engine: VideoStreamsEngine | null = null

export const getVideoStreamsEngine = (): VideoStreamsEngine => {
  if (!engine) engine = createEngine() // ensure Pinia is already installed
  return engine
}

/* eslint-disable jsdoc/require-jsdoc */
type CreateEngineDeps = {
  activeStreams: Ref<Record<string, StreamData | undefined>>
  streamsCorrespondency: ReturnType<typeof useBlueOsStorage<VideoStreamCorrespondency[]>>
  availableIceIps: Ref<string[]>
  allowedIceIps: ReturnType<typeof useBlueOsStorage<string[]>>
  enableAutoIceIpFetch: ReturnType<typeof useBlueOsStorage<boolean>>
  allowedIceProtocols: ReturnType<typeof useBlueOsStorage<string[]>>
  jitterBufferTarget: ReturnType<typeof useBlueOsStorage<number | null>>
  lastRenamedStreamName: Ref<string>
  mainWebRTCManager: WebRTCManager
  namesAvailableStreams: ComputedRef<string[]>
  namessAvailableAbstractedStreams: ComputedRef<string[]>
  externalStreamId: (internalName: string) => string | undefined
  activateStream: (name: string) => void
  getStreamData: (name: string) => StreamData | undefined
  getMediaStream: (name: string) => MediaStream | undefined
  isRecording: (name: string) => boolean
  startRecording: (name: string) => Promise<void>
  stopRecording: (name: string) => void
  startRecordingAllStreams: () => void
  stopRecordingAllStreams: () => void
  renameStreamInternalNameById: (id: string, newName: string) => void
  extractThumbnailFromVideo: (firstChunk: Blob) => Promise<Blob>
}
function createEngine(): CreateEngineDeps {
  const { showDialog } = useInteractionDialog()
  const { openSnackbar } = useSnackbar()
  const missionStore = useMissionStore()
  const alertStore = useAlertStore()
  const { rtcConfiguration, webRTCSignallingURI } = useMainVehicleStore()

  console.debug('[WebRTC] Using webrtc-adapter for', adapter.browserDetails)
  const streamsCorrespondency = useBlueOsStorage<VideoStreamCorrespondency[]>('cockpit-streams-correspondency', [])
  const allowedIceIps = useBlueOsStorage<string[]>('cockpit-allowed-stream-ips', [])
  const enableAutoIceIpFetch = useBlueOsStorage('cockpit-enable-auto-ice-ip-fetch', true)
  const allowedIceProtocols = useBlueOsStorage<string[]>('cockpit-allowed-stream-protocols', [])
  const jitterBufferTarget = useBlueOsStorage<number | null>('cockpit-jitter-buffer-target', 0)

  const activeStreams = ref<Record<string, StreamData | undefined>>({})
  const mainWebRTCManager = new WebRTCManager(webRTCSignallingURI, rtcConfiguration)
  const availableIceIps = ref<string[]>([])
  const lastRenamedStreamName = ref('')

  const unprocessedVideos = useBlueOsStorage<Record<string, UnprocessedVideoInfo>>('cockpit-unprocessed-video-info', {})
  const autoProcessVideos = useBlueOsStorage('cockpit-auto-process-videos', true)

  const namesAvailableStreams: ComputedRef<string[]> = computed(() =>
    mainWebRTCManager.availableStreams.value.map((s) => s.name)
  )

  const namessAvailableAbstractedStreams: ComputedRef<string[]> = computed(() =>
    streamsCorrespondency.value.map((s) => s.name)
  )

  const externalStreamId = (internalName: string): string | undefined => {
    const corr = streamsCorrespondency.value.find((stream) => stream.name === internalName)
    return corr ? corr.externalId : undefined
  }

  const videoThumbnailFilename = (videoFileName: string): string => {
    return `thumbnail_${videoFileName}.jpeg`
  }

  /**
   * Extracts a thumbnail from the first frame of a video.
   * @param {Blob} firstChunkBlob
   * @returns {Promise<string>} A promise that resolves with the base64-encoded image data of the thumbnail.
   */
  const extractThumbnailFromVideo = async (firstChunkBlob: Blob): Promise<Blob> => {
    return new Promise<Blob>((resolve, reject) => {
      const videoObjectUrl = URL.createObjectURL(firstChunkBlob)
      const video = document.createElement('video')

      let seekResolve: (() => void) | null = null
      video.addEventListener('seeked', function () {
        if (seekResolve) seekResolve()
      })

      video.addEventListener('error', () => {
        URL.revokeObjectURL(videoObjectUrl)
        reject('Error loading video')
      })

      video.src = videoObjectUrl

      video.addEventListener('loadedmetadata', () => {
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        if (!context) {
          URL.revokeObjectURL(videoObjectUrl)
          reject('2D context not available.')
          return
        }

        const [width, height] = [660, 370]
        canvas.width = width
        canvas.height = height

        video.currentTime = 0
        seekResolve = () => {
          context.drawImage(video, 0, 0, width, height)
          const blobCallback = (blob: Blob | null): void => {
            if (!blob) {
              reject('Failed to create blob')
              return
            }
            resolve(blob)
            URL.revokeObjectURL(videoObjectUrl)
          }
          canvas.toBlob(blobCallback, 'image/jpeg', 0.6)
        }
      })
    })
  }

  const initializeStreamsCorrespondency = (): void => {
    if (streamsCorrespondency.value.length >= namesAvailableStreams.value.length) return

    // If there are more external streams available than the ones in the correspondency, add the extra ones
    const newCorrespondency: VideoStreamCorrespondency[] = []
    let i = 1
    namesAvailableStreams.value.forEach((streamName) => {
      newCorrespondency.push({
        name: `Stream ${i}`,
        externalId: streamName,
      })
      i++
    })
    streamsCorrespondency.value = newCorrespondency
  }

  watch(namesAvailableStreams, () => {
    initializeStreamsCorrespondency()
  })

  watch([allowedIceIps, allowedIceProtocols], () => {
    Object.keys(activeStreams.value).forEach((n) => (activeStreams.value[n] = undefined))
  })

  /**
   * Activates a stream by starting it and storing it's variables inside a common object.
   * This way multiple consumers will always access the same resource, so we don't consume unnecessary
   * bandwith or stress the stream provider more than we need to.
   * @param {string} streamName - Unique name for the stream, common between the multiple consumers
   */
  const activateStream = (streamName: string): void => {
    const stream = ref()
    const webRtcManager = new WebRTCManager(webRTCSignallingURI, rtcConfiguration)
    const { mediaStream, connected } = webRtcManager.startStream(
      stream,
      allowedIceIps,
      allowedIceProtocols,
      jitterBufferTarget
    )
    activeStreams.value[streamName] = {
      // @ts-ignore: This is actually not reactive
      stream: stream,
      webRtcManager: webRtcManager,
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
   * Get the MediaStream object related to a given stream, if available
   * @param {string} streamName - Name of the stream
   * @returns {MediaStream | undefined} MediaStream that is running, if available
   */
  const getMediaStream = (streamName: string): MediaStream | undefined => {
    if (activeStreams.value[streamName] === undefined) {
      activateStream(streamName)
    }
    return activeStreams.value[streamName]!.mediaStream
  }

  /**
   * Wether or not the stream is currently being recorded
   * @param {string} streamName - Name of the stream
   * @returns {boolean}
   */
  const isRecording = (streamName: string): boolean => {
    if (activeStreams.value[streamName] === undefined) activateStream(streamName)

    return (
      activeStreams.value[streamName]!.mediaRecorder !== undefined &&
      activeStreams.value[streamName]!.mediaRecorder!.state === 'recording'
    )
  }

  /**
   * Start recording the stream
   * @param {string} streamName - Name of the stream
   */
  const startRecording = async (streamName: string): Promise<void> => {
    eventTracker.capture('Video recording start', { streamName: streamName })
    if (activeStreams.value[streamName] === undefined) activateStream(streamName)

    if (namesAvailableStreams.value.isEmpty()) {
      showDialog({ message: 'No streams available.', variant: 'error' })
      return
    }

    if (activeStreams.value[streamName]!.mediaStream === undefined) {
      showDialog({ message: 'Media stream not defined.', variant: 'error' })
      return
    }
    if (!activeStreams.value[streamName]!.mediaStream!.active) {
      showDialog({ message: 'Media stream not yet active. Wait a second and try again.', variant: 'error' })
      return
    }

    datalogger.startLogging(streamName)
    await sleep(100)

    activeStreams.value[streamName]!.timeRecordingStart = new Date()
    const streamData = activeStreams.value[streamName] as StreamData

    let recordingHash = ''
    let refreshHash = true
    const namesCurrentChunksOnDB = await tempVideoStorage.keys()
    while (refreshHash) {
      recordingHash = uuid().slice(0, 8)
      refreshHash = namesCurrentChunksOnDB.some((chunkName) => chunkName.includes(recordingHash))
    }

    const timeRecordingStartString = format(streamData.timeRecordingStart!, 'LLL dd, yyyy - HH꞉mm꞉ss O')
    const fileName = `${missionStore.missionName || 'Cockpit'} (${timeRecordingStartString}) #${recordingHash}`
    activeStreams.value[streamName]!.mediaRecorder = new MediaRecorder(streamData.mediaStream!)

    const videoTrack = streamData.mediaStream!.getVideoTracks()[0]
    const vWidth = videoTrack.getSettings().width || 1920
    const vHeight = videoTrack.getSettings().height || 1080

    // Register the video as unprocessed so we can recover latter if needed
    const videoInfo: UnprocessedVideoInfo = {
      dateStart: streamData.timeRecordingStart!,
      dateLastRecordingUpdate: streamData.timeRecordingStart!,
      dateFinish: undefined,
      dateLastProcessingUpdate: undefined,
      fileName,
      vWidth,
      vHeight,
    }
    unprocessedVideos.value = { ...unprocessedVideos.value, ...{ [recordingHash]: videoInfo } }

    activeStreams.value[streamName]!.mediaRecorder!.start(1000)

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
      } catch {
        sequentialLostChunks++
        totalLostChunks++

        warnAboutChunkLoss()
        return
      }

      const updatedInfo = unprocessedVideos.value[recordingHash]
      updatedInfo.dateLastRecordingUpdate = new Date()
      unprocessedVideos.value = { ...unprocessedVideos.value, ...{ [recordingHash]: updatedInfo } }

      // Gets the thumbnail from the first chunk
      if (chunksCount === 0) {
        try {
          const videoChunk = await tempVideoStorage.getItem(chunkName)
          if (videoChunk) {
            const firstChunkBlob = new Blob([videoChunk as Blob])
            const thumbnail = await extractThumbnailFromVideo(firstChunkBlob)
            // Save thumbnail in the storage
            await tempVideoStorage.setItem(videoThumbnailFilename(recordingHash), thumbnail)
            unprocessedVideos.value = { ...unprocessedVideos.value, ...{ [recordingHash]: updatedInfo } }
          }
        } catch (error) {
          console.error('Failed to extract thumbnail:', error)
        }
      }

      // If the chunk was saved, remove it from the unsaved list
      clearTimeout(unsavedChunkAlerts[chunkName])
      delete unsavedChunkAlerts[chunkName]
    }

    activeStreams.value[streamName]!.mediaRecorder!.onstop = async () => {
      const info = unprocessedVideos.value[recordingHash]

      // Register that the recording finished and it's ready to be processed
      info.dateFinish = new Date()
      unprocessedVideos.value = { ...unprocessedVideos.value, ...{ [recordingHash]: info } }

      if (autoProcessVideos.value) {
        try {
          // lazy import avoids circular-dep issues
          const processingService = await import('@/libs/video/video-processing')
          await processingService
            .createVideoProcessingService({
              unprocessedVideos,
              videoProcessingDetails: ref({}),
              totalFilesToProcess: ref(0),
              tempVideoStorage,
              videoStorage,
              zipMultipleFiles: ref(false),
              datalogger,
              showDialog,
              openSnackbar,
              extractThumbnailFromVideo,
            })
            .processVideoChunksAndTelemetry([recordingHash])
        } catch (error) {
          console.error('Failed to process video:', error)
          alertStore.pushAlert(new Alert(AlertLevel.Error, `Failed to process video for stream ${streamName}.`))
        }
      }

      activeStreams.value[streamName]!.mediaRecorder = undefined
    }

    alertStore.pushAlert(new Alert(AlertLevel.Success, `Started recording stream ${streamName}.`))
  }

  /**
   * Stop recording the stream
   * @param {string} streamName - Name of the stream
   */
  const stopRecording = (streamName: string): void => {
    if (activeStreams.value[streamName] === undefined) activateStream(streamName)

    const timeRecordingStart = activeStreams.value[streamName]?.timeRecordingStart
    const durationInSeconds = timeRecordingStart ? differenceInSeconds(new Date(), timeRecordingStart) : undefined
    eventTracker.capture('Video recording stop', { streamName, durationInSeconds })

    activeStreams.value[streamName]!.timeRecordingStart = undefined

    activeStreams.value[streamName]!.mediaRecorder!.stop()

    datalogger.stopLogging(streamName)
    alertStore.pushAlert(new Alert(AlertLevel.Success, `Stopped recording stream ${streamName}.`))
  }

  // Video recording actions
  const startRecordingAllStreams = (): void => {
    const streamsThatStarted: string[] = []

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
    alertStore.pushAlert(new Alert(AlertLevel.Success, `Started recording streams: ${streamsThatStarted.join(', ')}.`))
  }

  const stopRecordingAllStreams = (): void => {
    const streamsThatStopped: string[] = []

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
    alertStore.pushAlert(new Alert(AlertLevel.Success, `Stopped recording streams: ${streamsThatStopped.join(', ')}.`))
  }

  const renameStreamInternalNameById = (streamID: string, newInternalName: string): void => {
    const streamCorr = streamsCorrespondency.value.find((stream) => stream.externalId === streamID)

    if (streamCorr) {
      const oldInternalName = streamCorr.name
      streamCorr.name = newInternalName

      const streamData = activeStreams.value[oldInternalName]
      if (streamData) {
        activeStreams.value = {
          ...activeStreams.value,
          [newInternalName]: streamData,
        }
        delete activeStreams.value[oldInternalName]
      }
      lastRenamedStreamName.value = newInternalName
      console.log(`Stream internal name updated from '${oldInternalName}' to '${newInternalName}'.`)
    } else {
      console.warn(`Stream with ID '${streamID}' not found.`)
      openSnackbar({
        variant: 'error',
        message: `Stream with ID '${streamID}' not found.`,
        duration: 3000,
      })
    }
  }

  // Streams update routine. Responsible for starting and updating the streams.
  setInterval(() => {
    Object.keys(activeStreams.value).forEach((streamName) => {
      if (activeStreams.value[streamName] === undefined) return
      // Update the list of available remote ICE Ips with those available for each stream
      // @ts-ignore: availableICEIPs is not reactive here, for some yet to know reason
      const newIps = activeStreams.value[streamName].webRtcManager.availableICEIPs.filter(
        (ip: string) => !availableIceIps.value.includes(ip)
      )
      availableIceIps.value = [...availableIceIps.value, ...newIps]

      const updatedStream = mainWebRTCManager.availableStreams.value.find((s) => s.name === streamName)
      if (isEqual(updatedStream, activeStreams.value[streamName]!.stream)) return

      // Whenever the stream is to be updated we first reset it's variables (activateStream method), so
      // consumers can be updated as well.
      console.log(`New stream for '${streamName}':`)
      console.log(JSON.stringify(updatedStream, null, 2))
      activateStream(streamName)
      activeStreams.value[streamName]!.stream = updatedStream
    })
  }, 300)

  return {
    activeStreams,
    streamsCorrespondency,
    availableIceIps,
    allowedIceIps,
    enableAutoIceIpFetch,
    allowedIceProtocols,
    jitterBufferTarget,
    lastRenamedStreamName,
    mainWebRTCManager,
    namesAvailableStreams,
    namessAvailableAbstractedStreams,
    externalStreamId,
    activateStream,
    getStreamData,
    getMediaStream,
    isRecording,
    startRecording,
    stopRecording,
    startRecordingAllStreams,
    stopRecordingAllStreams,
    renameStreamInternalNameById,
    extractThumbnailFromVideo,
  }
}
