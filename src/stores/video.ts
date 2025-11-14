import { useStorage, useThrottleFn } from '@vueuse/core'
import { BlobReader, BlobWriter, ZipWriter } from '@zip.js/zip.js'
import { differenceInSeconds } from 'date-fns'
import { saveAs } from 'file-saver'
import { defineStore } from 'pinia'
import { v4 as uuid } from 'uuid'
import { computed, ref, watch } from 'vue'
import adapter from 'webrtc-adapter'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { useSnackbar } from '@/composables/snackbar'
import { WebRTCManager } from '@/composables/webRTC'
import { getIpsInformationFromVehicle } from '@/libs/blueos'
import eventTracker from '@/libs/external-telemetry/event-tracking'
import { availableCockpitActions, registerActionCallback } from '@/libs/joystick/protocols/cockpit-actions'
import {
  LiveVideoProcessor,
  LiveVideoProcessorChunkAppendingError,
  LiveVideoProcessorInitializationError,
} from '@/libs/live-video-processor'
import { datalogger } from '@/libs/sensors-logging'
import { isEqual, sleep } from '@/libs/utils'
import { tempVideoStorage, videoStorage } from '@/libs/videoStorage'
import type { Stream } from '@/libs/webrtc/signalling_protocol'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import { Alert, AlertLevel } from '@/types/alert'
import {
  type DownloadProgressCallback,
  type StreamData,
  type UnprocessedVideoInfo,
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
  const { showDialog } = useInteractionDialog()

  const { globalAddress, rtcConfiguration, webRTCSignallingURI } = useMainVehicleStore()
  console.debug('[WebRTC] Using webrtc-adapter for', adapter.browserDetails)

  const streamsCorrespondency = useBlueOsStorage<VideoStreamCorrespondency[]>('cockpit-streams-correspondency', [])
  const ignoredStreamExternalIds = useBlueOsStorage<string[]>('cockpit-ignored-stream-external-ids', [])
  const allowedIceIps = useBlueOsStorage<string[]>('cockpit-allowed-stream-ips', [])
  const enableAutoIceIpFetch = useBlueOsStorage('cockpit-enable-auto-ice-ip-fetch', true)
  const allowedIceProtocols = useBlueOsStorage<string[]>('cockpit-allowed-stream-protocols', [])
  const jitterBufferTarget = useBlueOsStorage<number | null>('cockpit-jitter-buffer-target', 0)
  const activeStreams = ref<{ [key in string]: StreamData | undefined }>({})
  const mainWebRTCManager = new WebRTCManager(webRTCSignallingURI, rtcConfiguration)
  const availableIceIps = ref<string[]>([])
  const unprocessedVideos = useStorage<{ [key in string]: UnprocessedVideoInfo }>('cockpit-unprocessed-video-info', {})
  const lastRenamedStreamName = ref('')
  const isRecordingAllStreams = ref(false)
  const liveProcessors = ref<{ [key: string]: LiveVideoProcessor }>({})
  const enableLiveProcessing = useBlueOsStorage('cockpit-enable-live-processing', true)
  const keepRawVideoChunksAsBackup = useBlueOsStorage('cockpit-keep-raw-video-chunks-as-backup', true)
  const recordingMonitors: { [key: string]: ReturnType<typeof setInterval> | undefined } = {}

  const namesAvailableStreams = computed(() => mainWebRTCManager.availableStreams.value.map((stream) => stream.name))

  const namessAvailableAbstractedStreams = computed(() => {
    return streamsCorrespondency.value.map((stream) => stream.name)
  })

  const externalStreamId = (internalName: string): string | undefined => {
    const corr = streamsCorrespondency.value.find((stream) => stream.name === internalName)
    return corr ? corr.externalId : undefined
  }

  const initializeStreamsCorrespondency = (): void => {
    // Get list of external streams that are already mapped
    const alreadyMappedExternalIds = streamsCorrespondency.value.map((corr) => corr.externalId)

    // Find external streams that don't have a mapping yet and are not ignored
    const unmappedExternalStreams = namesAvailableStreams.value.filter((streamName) => {
      return !alreadyMappedExternalIds.includes(streamName) && !ignoredStreamExternalIds.value.includes(streamName)
    })

    // If there are no unmapped streams, no need to add any new correspondences
    if (unmappedExternalStreams.length === 0) return

    // Generate internal names for new streams, making sure they don't conflict with existing ones
    const existingInternalNames = streamsCorrespondency.value.map((corr) => corr.name)
    const newCorrespondencies: VideoStreamCorrespondency[] = []

    let i = 1
    unmappedExternalStreams.forEach((streamName) => {
      // Find the next available internal name (Stream 1, Stream 2, etc.)
      let internalName = `Stream ${i}`
      while (existingInternalNames.includes(internalName)) {
        i++
        internalName = `Stream ${i}`
      }

      newCorrespondencies.push({
        name: internalName,
        externalId: streamName,
      })
      existingInternalNames.push(internalName) // Track this name to avoid duplicates
      i++
    })

    // Add new correspondences to the existing ones instead of replacing them
    streamsCorrespondency.value = [...streamsCorrespondency.value, ...newCorrespondencies]
  }

  watch(namesAvailableStreams, () => {
    initializeStreamsCorrespondency()
  })

  // If the allowed ICE IPs are updated, all the streams should be reconnected
  watch([allowedIceIps, allowedIceProtocols], () => {
    Object.keys(activeStreams.value).forEach((streamName) => (activeStreams.value[streamName] = undefined))
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
      // Update the list of available remote ICE Ips with those available for each stream
      // @ts-ignore: availableICEIPs is not reactive here, for some yet to know reason
      const newIps = activeStreams.value[streamName].webRtcManager.availableICEIPs.filter(
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
   * Generate .ass telemetry overlay file for a video recording
   * @param {string} recordingHash - The hash of the recording
   */
  const generateTelemetryOverlay = async (recordingHash: string): Promise<void> => {
    try {
      const recordingData = unprocessedVideos.value[recordingHash]
      if (!recordingData) {
        throw new Error(`Recording '${recordingHash}' not found.`)
      }

      // Generate telemetry log
      const telemetryLog = await datalogger.generateLog(recordingData.dateStart!, recordingData.dateFinish!)

      if (telemetryLog !== undefined) {
        const assLog = datalogger.toAssOverlay(
          telemetryLog,
          recordingData.vWidth!,
          recordingData.vHeight!,
          recordingData.dateStart!.getTime()
        )
        const logBlob = new Blob([assLog], { type: 'text/plain' })

        // Save the .ass file
        await videoStorage.setItem(videoSubtitlesFilename(recordingData.fileName), logBlob)
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
   * Stop recording the stream
   * @param {string} streamName - Name of the stream
   */
  const stopRecording = (streamName: string): void => {
    // Stop the recording monitor so there's no risk of receiving alerts after the recording is stopped.
    console.info(`Stopping recording monitor for stream '${streamName}'.`)
    clearInterval(recordingMonitors[streamName])
    delete recordingMonitors[streamName]

    if (activeStreams.value[streamName] === undefined) activateStream(streamName)

    const timeRecordingStart = activeStreams.value[streamName]?.timeRecordingStart
    const durationInSeconds = timeRecordingStart ? differenceInSeconds(new Date(), timeRecordingStart) : undefined
    eventTracker.capture('Video recording stop', { streamName, durationInSeconds })

    activeStreams.value[streamName]!.timeRecordingStart = undefined

    activeStreams.value[streamName]!.mediaRecorder!.stop()

    alertStore.pushAlert(new Alert(AlertLevel.Success, `Stopped recording stream ${streamName}.`))
  }

  const getVideoThumbnail = async (videoFileNameOrHash: string, isProcessed: boolean): Promise<Blob | null> => {
    const db = isProcessed ? videoStorage : tempVideoStorage
    const thumbnail = await db.getItem(videoThumbnailFilename(videoFileNameOrHash))
    return thumbnail || null
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

    await sleep(100)

    activeStreams.value[streamName]!.timeRecordingStart = new Date()
    const streamData = activeStreams.value[streamName] as StreamData

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

    const fileName = videoFilename(recordingHash, streamData.timeRecordingStart!, missionStore.missionName || 'Cockpit')
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
          // eslint-disable-next-line
          const msg = 'Cannot get size of the video output file. Please check if the file exists. This can indicate a problem with the recording.'
          showDialog({ message: msg, variant: 'error' })
          return
        }
        const lastKnownFileSize = unprocessedVideos.value[recordingHash].lastKnownFileSize
        if (fileStats.size! <= lastKnownFileSize!) {
          const msg = 'The video output file is not growing. This can indicate a problem with the recording.'
          showDialog({ message: msg, variant: 'error' })
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
          const msg = 'The number of video chunks is not growing. This can indicate a problem with the recording.'
          showDialog({ message: msg, variant: 'error' })
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
        // Stop recording and reset the stream data
        activeStreams.value[streamName]!.mediaRecorder!.stop()
        activeStreams.value[streamName]!.mediaRecorder = undefined
        delete activeStreams.value[streamName]

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
              stopRecording(streamName)
            } else throw error
          }
        }
      } catch {
        if (chunksCount === 0) {
          const msg = 'Failed to initiate recording. First chunk was lost. Try again.'
          showDialog({ message: msg, variant: 'error' })
          alertStore.pushAlert(new Alert(AlertLevel.Error, msg))
          stopRecording(streamName)
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
      const info = unprocessedVideos.value[recordingHash]

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

          activeStreams.value[streamName]!.mediaRecorder = undefined
        }
      }

      // Generate telemetry overlay after video processing is complete
      try {
        await generateTelemetryOverlay(recordingHash)
      } catch (telemetryError) {
        openSnackbar({ message: 'Failed to generate telemetry overlay.', variant: 'error' })
      }

      activeStreams.value[streamName]!.mediaRecorder = undefined
    }

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

  const issueSelectedIpNotAvailableWarning = (): void => {
    showDialog({
      maxWidth: 600,
      title: 'All available video stream IPs are being blocked',
      message: [
        `Cockpit detected that none of the IPs that are streaming video from your server are in the allowed list. This
        will lead to no video being streamed.`,
        'This can happen if you changed your network or the IP of your vehicle.',
        `To solve this problem, please open the video configuration page (Main-menu > Settings > Video) and clear
        the selected IPs. Then, select an available IP from the list.`,
      ],
      variant: 'warning',
    })
  }

  const issueNoIpSelectedWarning = (): void => {
    showDialog({
      maxWidth: 600,
      title: 'Video being routed from multiple IPs',
      message: [
        `Cockpit detected that the video streams are being routed from multiple IPs. This often leads to video
        stuttering, especially if one of the IPs is from a non-wired connection.`,
        `To prevent issues and achieve an optimal streaming experience, please open the video configuration page
        (Main-menu > Settings > Video) and select the IP address that should be used for the video streaming.`,
      ],
      variant: 'warning',
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
            const theteredInterfaceTypes = ['WIRED', 'USB']
            if (globalAddress === ipInfo.ipv4Address && !theteredInterfaceTypes.includes(ipInfo.interfaceType)) {
              currentlyOnWirelessConnection = true
            }
            if (!theteredInterfaceTypes.includes(ipInfo.interfaceType) || alreadyAllowedIp || !isIceIp) return
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
    } else {
      throw new Error(`Stream with ID '${streamID}' not found.`)
    }
  }

  const deleteStreamCorrespondency = (externalId: string): void => {
    const streamIndex = streamsCorrespondency.value.findIndex((stream) => stream.externalId === externalId)

    if (streamIndex !== -1) {
      const stream = streamsCorrespondency.value[streamIndex]

      // Add to ignored list
      if (!ignoredStreamExternalIds.value.includes(externalId)) {
        ignoredStreamExternalIds.value = [...ignoredStreamExternalIds.value, externalId]
      }

      // Remove from correspondency list
      streamsCorrespondency.value.splice(streamIndex, 1)

      // Clean up all resources for the stream
      if (activeStreams.value[externalId]) {
        const externalStreamData = activeStreams.value[externalId]

        // Stop recording if it's active
        if (externalStreamData?.mediaRecorder && externalStreamData.mediaRecorder.state === 'recording') {
          externalStreamData.mediaRecorder.stop()
        }

        // Stop all tracks in the media stream
        if (externalStreamData?.mediaStream) {
          externalStreamData.mediaStream.getTracks().forEach((track) => {
            track.stop()
            console.log(`Stopped track: ${track.kind} for external stream '${externalId}'`)
          })
        }

        // Close WebRTC connection
        if (externalStreamData?.webRtcManager) {
          try {
            externalStreamData.webRtcManager.close(`External stream '${externalId}' was ignored by user`)
            console.log(`Stopped WebRTC manager for external stream '${externalId}'`)
          } catch (error) {
            console.warn(`Error stopping WebRTC manager for external stream '${externalId}':`, error)
          }
        }

        delete activeStreams.value[externalId]
        console.log(`Cleaned up all resources for external stream '${externalId}'`)
      }

      openSnackbar({ variant: 'success', message: `Stream '${stream.name}' deleted and added to ignored list.` })
    } else {
      openSnackbar({ variant: 'warning', message: `Stream with external ID '${externalId}' not found.` })
    }
  }

  const restoreIgnoredStream = (externalId: string): void => {
    const ignoredIndex = ignoredStreamExternalIds.value.indexOf(externalId)

    if (ignoredIndex !== -1) {
      // Remove from ignored list
      ignoredStreamExternalIds.value.splice(ignoredIndex, 1)

      if (namesAvailableStreams.value.includes(externalId)) {
        // Trigger re-initialization to add it back to correspondency if it's still available
        initializeStreamsCorrespondency()
      } else {
        openSnackbar({ variant: 'warning', message: `Stream '${externalId}' not available anymore.` })
      }

      openSnackbar({ variant: 'success', message: `Stream '${externalId}' restored from ignored list.` })
    } else {
      openSnackbar({ variant: 'warning', message: `Stream with external ID '${externalId}' not on ignored list.` })
    }
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
    videoStorage,
    tempVideoStorage,
    streamsCorrespondency,
    ignoredStreamExternalIds,
    namessAvailableAbstractedStreams,
    externalStreamId,
    discardProcessedFilesFromVideoDB,
    getMediaStream,
    getStreamData,
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
    enableLiveProcessing,
    keepRawVideoChunksAsBackup,
  }
})
