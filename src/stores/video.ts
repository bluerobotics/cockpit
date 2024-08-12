import { useDebounceFn, useStorage, useThrottleFn, useTimestamp } from '@vueuse/core'
import { BlobReader, BlobWriter, ZipWriter } from '@zip.js/zip.js'
import { differenceInSeconds, format } from 'date-fns'
import { saveAs } from 'file-saver'
import localforage from 'localforage'
import { defineStore } from 'pinia'
import { v4 as uuid } from 'uuid'
import { computed, ref, watch } from 'vue'
import fixWebmDuration from 'webm-duration-fix'
import adapter from 'webrtc-adapter'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { useSnackbar } from '@/composables/snackbar'
import { WebRTCManager } from '@/composables/webRTC'
import { getIpsInformationFromVehicle } from '@/libs/blueos'
import { availableCockpitActions, registerActionCallback } from '@/libs/joystick/protocols/cockpit-actions'
import { datalogger } from '@/libs/sensors-logging'
import { isEqual } from '@/libs/utils'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import { Alert, AlertLevel } from '@/types/alert'
import {
  type DownloadProgressCallback,
  type FileDescriptor,
  type StorageDB,
  type StreamData,
  type UnprocessedVideoInfo,
  type VideoProcessingDetails,
  getBlobExtensionContainer,
  VideoExtensionContainer,
} from '@/types/video'

import { useAlertStore } from './alert'
const { showSnackbar } = useSnackbar()

export const useVideoStore = defineStore('video', () => {
  const missionStore = useMissionStore()
  const alertStore = useAlertStore()
  const { showDialog } = useInteractionDialog()

  const { globalAddress, rtcConfiguration, webRTCSignallingURI } = useMainVehicleStore()
  console.debug('[WebRTC] Using webrtc-adapter for', adapter.browserDetails)

  const allowedIceIps = useBlueOsStorage<string[]>('cockpit-allowed-stream-ips', [])
  const enableAutoIceIpFetch = useBlueOsStorage('cockpit-enable-auto-ice-ip-fetch', true)
  const allowedIceProtocols = useBlueOsStorage<string[]>('cockpit-allowed-stream-protocols', [])
  const jitterBufferTarget = useBlueOsStorage<number | null>('cockpit-jitter-buffer-target', 0)
  const zipMultipleFiles = useBlueOsStorage('cockpit-zip-multiple-video-files', false)
  const activeStreams = ref<{ [key in string]: StreamData | undefined }>({})
  const mainWebRTCManager = new WebRTCManager(webRTCSignallingURI, rtcConfiguration)
  const availableIceIps = ref<string[]>([])
  const unprocessedVideos = useStorage<{ [key in string]: UnprocessedVideoInfo }>('cockpit-unprocessed-video-info', {})
  const timeNow = useTimestamp({ interval: 500 })
  const autoProcessVideos = useBlueOsStorage('cockpit-auto-process-videos', true)

  const namesAvailableStreams = computed(() => mainWebRTCManager.availableStreams.value.map((stream) => stream.name))

  // If the allowed ICE IPs are updated, all the streams should be reconnected
  watch([allowedIceIps, allowedIceProtocols], () => {
    Object.keys(activeStreams.value).forEach((streamName) => (activeStreams.value[streamName] = undefined))
  })

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
   * Stop recording the stream
   * @param {string} streamName - Name of the stream
   */
  const stopRecording = (streamName: string): void => {
    if (activeStreams.value[streamName] === undefined) activateStream(streamName)

    activeStreams.value[streamName]!.timeRecordingStart = undefined

    activeStreams.value[streamName]!.mediaRecorder!.stop()
    alertStore.pushAlert(new Alert(AlertLevel.Success, `Stopped recording stream ${streamName}.`))
  }

  /**
   * Extracts a thumbnail from the first frame of a video.
   * @param {Blob} firstChunkBlob
   * @returns {Promise<string>} A promise that resolves with the base64-encoded image data of the thumbnail.
   */
  const extractThumbnailFromVideo = async (firstChunkBlob: Blob): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
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
          const base64ImageData = canvas.toDataURL('image/jpeg', 0.6)
          resolve(base64ImageData)
          URL.revokeObjectURL(videoObjectUrl)
        }
      })
    })
  }

  /**
   * Start recording the stream
   * @param {string} streamName - Name of the stream
   */
  const startRecording = async (streamName: string): Promise<void> => {
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

    if (!datalogger.logging()) {
      datalogger.startLogging()
    }

    activeStreams.value[streamName]!.timeRecordingStart = new Date()
    const streamData = activeStreams.value[streamName] as StreamData

    let recordingHash = ''
    let refreshHash = true
    const namesCurrentChunksOnDB = await tempVideoChunksDB.keys()
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
      thumbnail: '',
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

      showSnackbar({
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
        // Intentional logic to lose every 5th chunk
        if (chunksCount > 5 && chunksCount < 12) {
          console.error(`Intentional chunk loss -> ${chunksCount}.`)
          throw new Error(`Intentional chunk loss -> ${chunksCount}.`)
        }
        await tempVideoChunksDB.setItem(chunkName, e.data)
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
          const videoChunk = await tempVideoChunksDB.getItem(chunkName)
          if (videoChunk) {
            const firstChunkBlob = new Blob([videoChunk as Blob])
            const thumbnail = await extractThumbnailFromVideo(firstChunkBlob)
            updatedInfo.thumbnail = thumbnail
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
          await processVideoChunksAndTelemetry([recordingHash])
          showSnackbar({
            message: 'Video processing completed.',
            duration: 2000,
            variant: 'success',
            closeButton: false,
          })
        } catch (error) {
          console.error('Failed to process video:', error)
          alertStore.pushAlert(new Alert(AlertLevel.Error, `Failed to process video for stream ${streamName}.`))
        }
      }

      activeStreams.value[streamName]!.mediaRecorder = undefined
    }

    alertStore.pushAlert(new Alert(AlertLevel.Success, `Started recording stream ${streamName}.`))
  }

  // Used to discard a file from the video recovery database
  const discardProcessedFilesFromVideoDB = async (fileNames: string[]): Promise<void> => {
    console.debug(`Discarding files from the video recovery database: ${fileNames.join(', ')}`)
    for (const filename of fileNames) {
      await videoStoringDB.removeItem(filename)
    }
  }

  const discardUnprocessedFilesFromVideoDB = async (hashes: string[]): Promise<void> => {
    for (const hash of hashes) {
      await tempVideoChunksDB.removeItem(hash)
      delete unprocessedVideos.value[hash]
    }
  }

  const createZipAndDownload = async (
    files: FileDescriptor[],
    zipFilename: string,
    progressCallback?: DownloadProgressCallback
  ): Promise<void> => {
    const zipWriter = new ZipWriter(new BlobWriter('application/zip'), { level: 0 })
    const zipAddingPromises = files.map(({ filename, blob }) => {
      zipWriter.add(filename, new BlobReader(blob), { onprogress: progressCallback })
    })
    Promise.all(zipAddingPromises)
    const blob = await zipWriter.close()
    saveAs(blob, zipFilename)
  }

  const downloadFiles = async (
    db: StorageDB,
    keys: string[],
    shouldZip = false,
    zipFilenamePrefix = 'Cockpit-Video-Files',
    progressCallback?: DownloadProgressCallback
  ): Promise<void> => {
    const maybeFiles = await Promise.all(
      keys.map(async (key) => ({
        blob: await db.getItem(key),
        filename: key,
      }))
    )
    /* eslint-disable jsdoc/require-jsdoc  */
    const files = maybeFiles.filter((file): file is { blob: Blob; filename: string } => file.blob !== undefined)

    if (files.length === 0) {
      showDialog({ message: 'No files found.', variant: 'error' })
      return
    }

    if (shouldZip) {
      await createZipAndDownload(files, `${zipFilenamePrefix}.zip`, progressCallback)
    } else {
      files.forEach(({ blob, filename }) => saveAs(blob, filename))
    }
  }

  const downloadFilesFromVideoDB = async (
    fileNames: string[],
    progressCallback?: DownloadProgressCallback
  ): Promise<void> => {
    console.debug(`Downloading files from the video recovery database: ${fileNames.join(', ')}`)
    if (zipMultipleFiles.value) {
      const ZipFilename = fileNames.length > 1 ? 'Cockpit-Video-Recordings' : 'Cockpit-Video-Recording'
      await downloadFiles(videoStoringDB, fileNames, true, ZipFilename, progressCallback)
    } else {
      await downloadFiles(videoStoringDB, fileNames)
    }
  }

  const downloadTempVideo = async (hashes: string[], progressCallback?: DownloadProgressCallback): Promise<void> => {
    console.debug(`Downloading ${hashes.length} video chunks from the temporary database.`)

    for (const hash of hashes) {
      const fileNames = (await tempVideoChunksDB.keys()).filter((filename) => filename.includes(hash))
      const zipFilenamePrefix = `Cockpit-Unprocessed-Video-Chunks-${hash}`
      await downloadFiles(tempVideoChunksDB, fileNames, true, zipFilenamePrefix, progressCallback)
    }
  }

  // Used to clear the temporary video database
  const clearTemporaryVideoDB = async (): Promise<void> => {
    await tempVideoChunksDB.clear()
  }

  const temporaryVideoDBSize = async (): Promise<number> => {
    let totalSizeBytes = 0
    await tempVideoChunksDB.iterate((chunk) => {
      totalSizeBytes += (chunk as Blob).size
    })
    return totalSizeBytes
  }

  const videoStorageFileSize = async (filename: string): Promise<number | undefined> => {
    const file = await videoStoringDB.getItem(filename)
    return file ? (file as Blob).size : undefined
  }

  // Used to store chunks of an ongoing recording, that will be merged into a video file when the recording is stopped
  const tempVideoChunksDB = localforage.createInstance({
    driver: localforage.INDEXEDDB,
    name: 'Cockpit - Temporary Video',
    storeName: 'cockpit-temp-video-db',
    version: 1.0,
    description: 'Database for storing the chunks of an ongoing recording, to be merged afterwards.',
  })

  // Offer download of backuped videos
  const videoStoringDB = localforage.createInstance({
    driver: localforage.INDEXEDDB,
    name: 'Cockpit - Video Recovery',
    storeName: 'cockpit-video-recovery-db',
    version: 1.0,
    description: 'Local backups of Cockpit video recordings to be retrieved in case of failure.',
  })

  const updateLastProcessingUpdate = (recordingHash: string): void => {
    const info = unprocessedVideos.value[recordingHash]
    info.dateLastProcessingUpdate = new Date()
    unprocessedVideos.value = { ...unprocessedVideos.value, ...{ [recordingHash]: info } }
  }

  // Progress tracking for video processing
  const videoProcessingDetails = ref<VideoProcessingDetails>({})
  const totalFilesToProcess = ref(0)

  const updateFileProgress = (filename: string, progress: number, message: string): void => {
    videoProcessingDetails.value[filename] = { filename, progress, message }
  }

  const currentFileProgress = computed(() => {
    return Object.values(videoProcessingDetails.value).map((detail) => ({
      fileName: detail.filename,
      progress: detail.progress,
      message: detail.message,
    }))
  })

  const overallProgress = computed(() => {
    const entries = Object.values(videoProcessingDetails.value)
    const totalProgress = entries.reduce((acc, curr) => acc + curr.progress, 0)
    return (totalProgress / (totalFilesToProcess.value * 100)) * 100
  })

  const debouncedUpdateFileProgress = useDebounceFn((filename: string, progress: number, message: string) => {
    updateFileProgress(filename, progress, message)
  }, 100)

  const processVideoChunksAndTelemetry = async (hashes: string[]): Promise<void> => {
    totalFilesToProcess.value = hashes.length
    videoProcessingDetails.value = {}

    const tasks = hashes.map(async (hash) => {
      const info = unprocessedVideos.value[hash]
      if (!info) return

      /* eslint-disable jsdoc/require-jsdoc  */
      const chunks: { blob: Blob; name: string }[] = []
      if (info.dateFinish === undefined) {
        info.dateFinish = info.dateLastRecordingUpdate
      }
      debouncedUpdateFileProgress(info.fileName, 1, 'Processing video.')

      const dateStart = new Date(info.dateStart!)
      const dateFinish = new Date(info.dateFinish!)

      debouncedUpdateFileProgress(info.fileName, 30, 'Grouping video chunks.')
      await tempVideoChunksDB.iterate((videoChunk, chunkName) => {
        if (chunkName.includes(hash)) {
          chunks.push({ blob: videoChunk as Blob, name: chunkName })
        }
      })

      // As we advance through the processing, we update the last processing update date, so consumers know this is ongoing
      updateLastProcessingUpdate(hash)

      if (chunks.length === 0) {
        throw new Error(`No video chunks found for video ${hash}.`)
      }

      debouncedUpdateFileProgress(info.fileName, 30, 'Sorting video chunks.')
      // Make sure the chunks are sorted in the order they were created, not the order they are stored
      chunks.sort((a, b) => {
        const splitA = a.name.split('_')
        const splitB = b.name.split('_')
        return Number(splitA[splitA.length - 1]) - Number(splitB[splitB.length - 1])
      })

      updateLastProcessingUpdate(hash)

      const chunkBlobs = chunks.map((chunk) => chunk.blob)
      const extensionContainer = getBlobExtensionContainer(chunkBlobs[0])
      debouncedUpdateFileProgress(info.fileName, 50, 'Processing video chunks.')

      const mergedBlob = new Blob([...chunkBlobs])

      let durFixedBlob: Blob | undefined = undefined
      try {
        durFixedBlob = await fixWebmDuration(mergedBlob)
      } catch {
        const errorMsg = 'Failed to fix video duration. The processed video may present issues or be unplayable.'
        showDialog({ title: 'Video Processing Issue', message: errorMsg, variant: 'error' })
      }

      updateLastProcessingUpdate(hash)

      debouncedUpdateFileProgress(info.fileName, 75, `Saving video file.`)
      await videoStoringDB.setItem(`${info.fileName}.${extensionContainer || '.webm'}`, durFixedBlob ?? mergedBlob)

      updateLastProcessingUpdate(hash)

      debouncedUpdateFileProgress(info.fileName, 80, `Generating telemetry file.`)
      const telemetryLog = await datalogger.findLogByInitialTime(dateStart)
      if (!telemetryLog) {
        throw new Error(`No telemetry log found for the video ${info.fileName}:`)
      }

      debouncedUpdateFileProgress(info.fileName, 95, `Saving telemetry file.`)
      const videoTelemetryLog = datalogger.getSlice(telemetryLog, dateStart, dateFinish)
      const assLog = datalogger.toAssOverlay(videoTelemetryLog, info.vWidth!, info.vHeight!, dateStart.getTime())
      const logBlob = new Blob([assLog], { type: 'text/plain' })
      videoStoringDB.setItem(`${info.fileName}.ass`, logBlob)

      updateLastProcessingUpdate(hash)

      debouncedUpdateFileProgress(info.fileName, 100, 'Processing completed')
      updateFileProgress(info.fileName, 100, 'Processing completed')
      await cleanupProcessedData(hash)
    })
    await Promise.all(tasks)
  }

  // Remove temp chunks and video metadata from the database
  const cleanupProcessedData = async (recordingHash: string): Promise<void> => {
    await tempVideoChunksDB.removeItem(recordingHash)
    delete unprocessedVideos.value[recordingHash]
  }

  const keysAllUnprocessedVideos = computed(() => Object.keys(unprocessedVideos.value))

  const keysFailedUnprocessedVideos = computed(() => {
    const dateNow = new Date(timeNow.value)

    return keysAllUnprocessedVideos.value.filter((recordingHash) => {
      const info = unprocessedVideos.value[recordingHash]

      const secondsSinceLastRecordingUpdate = differenceInSeconds(dateNow, new Date(info.dateLastRecordingUpdate!))
      const recording = info.dateFinish === undefined && secondsSinceLastRecordingUpdate < 10

      const dateLastProcessingUpdate = new Date(info.dateLastProcessingUpdate ?? 0)
      const secondsSinceLastProcessingUpdate = differenceInSeconds(dateNow, dateLastProcessingUpdate)
      const processing = info.dateFinish !== undefined && secondsSinceLastProcessingUpdate < 10

      return !recording && !processing
    })
  })

  const areThereVideosProcessing = computed(() => {
    const dateNow = new Date(timeNow.value)

    return keysAllUnprocessedVideos.value.some((recordingHash) => {
      const info = unprocessedVideos.value[recordingHash]
      const dateLastProcessingUpdate = new Date(info.dateLastProcessingUpdate ?? 0)
      const secondsSinceLastProcessingUpdate = differenceInSeconds(dateNow, dateLastProcessingUpdate)
      return info.dateFinish !== undefined && secondsSinceLastProcessingUpdate < 10
    })
  })

  // Process videos that were being recorded when the app was closed
  const processAllUnprocessedVideos = async (): Promise<void> => {
    if (keysFailedUnprocessedVideos.value.isEmpty()) return
    console.log(`Processing unprocessed videos: ${keysFailedUnprocessedVideos.value.join(', ')}`)

    const chunks = await tempVideoChunksDB.keys()
    if (chunks.length === 0) {
      discardUnprocessedVideos()
      throw new Error('No video recording data found. Discarding leftover info.')
    }

    const processingErrors: string[] = []
    for (const recordingHash of keysFailedUnprocessedVideos.value) {
      const info = unprocessedVideos.value[recordingHash]
      console.log(`Processing unprocessed video: ${info.fileName}`)
      try {
        await processVideoChunksAndTelemetry([recordingHash])
      } catch (error) {
        processingErrors.push(`Could not process video ${recordingHash}. ${error} Discarding leftover info.`)
      }
      delete unprocessedVideos.value[recordingHash]
    }

    if (processingErrors.isEmpty()) return
    throw new Error(processingErrors.join('\n'))
  }

  // Discard all data related to videos that were not processed
  const discardUnprocessedVideos = async (includeNotFailed = false): Promise<void> => {
    console.log('Discarding unprocessed videos.')

    const keysUnprocessedVideos = includeNotFailed ? keysAllUnprocessedVideos.value : keysFailedUnprocessedVideos.value
    const currentChunks = await tempVideoChunksDB.keys()
    const chunksUnprocessedVideos = currentChunks.filter((chunkName) => {
      return keysUnprocessedVideos.some((key) => chunkName.includes(key))
    })

    unprocessedVideos.value = {}
    for (const chunk of chunksUnprocessedVideos) {
      tempVideoChunksDB.removeItem(chunk)
    }
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
        try {
          const ipsInfo = await getIpsInformationFromVehicle(globalAddress)
          const newAllowedIps: string[] = []
          ipsInfo.forEach((ipInfo) => {
            const isIceIp = availableIceIps.value.includes(ipInfo.ipv4Address)
            const alreadyAllowedIp = [...allowedIceIps.value, ...newAllowedIps].includes(ipInfo.ipv4Address)
            const theteredInterfaceTypes = ['WIRED', 'USB']
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
        if (allowedIceIps.value.isEmpty() && !noIpSelectedWarningIssued) {
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

  registerActionCallback(
    availableCockpitActions.start_recording_all_streams,
    useThrottleFn(startRecordingAllStreams, 3000)
  )
  registerActionCallback(
    availableCockpitActions.stop_recording_all_streams,
    useThrottleFn(stopRecordingAllStreams, 3000)
  )

  return {
    autoProcessVideos,
    availableIceIps,
    allowedIceIps,
    enableAutoIceIpFetch,
    allowedIceProtocols,
    jitterBufferTarget,
    zipMultipleFiles,
    namesAvailableStreams,
    videoStoringDB,
    tempVideoChunksDB,
    discardProcessedFilesFromVideoDB,
    discardUnprocessedFilesFromVideoDB,
    downloadFilesFromVideoDB,
    clearTemporaryVideoDB,
    keysAllUnprocessedVideos,
    keysFailedUnprocessedVideos,
    areThereVideosProcessing,
    processAllUnprocessedVideos,
    discardUnprocessedVideos,
    temporaryVideoDBSize,
    videoStorageFileSize,
    getMediaStream,
    getStreamData,
    isRecording,
    stopRecording,
    startRecording,
    unprocessedVideos,
    downloadTempVideo,
    currentFileProgress,
    overallProgress,
    processVideoChunksAndTelemetry,
    isVideoFilename,
    activeStreams,
  }
})
