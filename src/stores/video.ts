import { useTimestamp } from '@vueuse/core'
import { differenceInSeconds } from 'date-fns'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { useSnackbar } from '@/composables/snackbar'
import { useVideoStreams } from '@/composables/videoStreams'
import { datalogger } from '@/libs/sensors-logging'
import { createVideoProcessingService } from '@/libs/video/video-processing'
import { tempVideoStorage, videoStorage } from '@/libs/videoStorage'
import { type DownloadProgressCallback, type UnprocessedVideoInfo, type VideoProcessingDetails } from '@/types/video'

export const useVideoStore = defineStore('video', () => {
  const autoProcessVideos = useBlueOsStorage('cockpit-auto-process-videos', true)
  const zipMultipleFiles = useBlueOsStorage('cockpit-zip-multiple-video-files', false)

  const videoProcessingDetails = ref<VideoProcessingDetails>({})
  const totalFilesToProcess = ref(0)
  const unprocessedVideos = useBlueOsStorage<Record<string, UnprocessedVideoInfo>>('cockpit-unprocessed-video-info', {})

  const { showDialog } = useInteractionDialog()
  const { openSnackbar } = useSnackbar()

  const streams = useVideoStreams()
  const timeNow = useTimestamp({ interval: 500 })

  const keysAllUnprocessedVideos = computed(() => Object.keys(unprocessedVideos.value))

  const keysFailedUnprocessedVideos = computed(() => {
    const now = Date.now()
    return keysAllUnprocessedVideos.value.filter((hash) => {
      const info = unprocessedVideos.value[hash]
      const recLag = now - new Date(info.dateLastRecordingUpdate ?? 0).getTime()
      const procLag = now - new Date(info.dateLastProcessingUpdate ?? 0).getTime()
      const recording = info.dateFinish === undefined && recLag < 10_000
      const processing = info.dateFinish !== undefined && procLag < 10_000
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

  const currentFileProgress = computed(() =>
    Object.values(videoProcessingDetails.value).map(({ filename, progress, message }) => ({
      fileName: filename,
      progress,
      message,
    }))
  )

  const overallProgress = computed(() => {
    const entries = Object.values(videoProcessingDetails.value)
    if (!entries.length) return 0
    const total = entries.reduce((acc, cur) => acc + cur.progress, 0)
    return (total / (entries.length * 100)) * 100
  })

  const commonDeps = {
    unprocessedVideos,
    videoProcessingDetails,
    totalFilesToProcess,
    tempVideoStorage,
    videoStorage,
    zipMultipleFiles,
    datalogger,
    showDialog,
    openSnackbar,
    extractThumbnailFromVideo: streams.extractThumbnailFromVideo,
  }

  // Factory function to create a connection between the store and the video processing service
  // This is here to keep all dependencies on the store and keep all components serving from it
  const svc = createVideoProcessingService(commonDeps)

  const {
    processVideoChunksAndTelemetry,
    downloadFilesFromVideoDB,
    downloadFiles,
    temporaryVideoDBSize,
    videoStorageFileSize,
    isVideoFilename,
    videoThumbnailFilename,
    getVideoThumbnail,
    discardProcessedFilesFromVideoDB,
    discardUnprocessedFilesFromVideoDB,
    clearTemporaryVideoDB,
    downloadTempVideo,
    processAllUnprocessedVideos,
    discardUnprocessedVideos,
  } = svc

  return {
    ...streams,
    autoProcessVideos,
    zipMultipleFiles,
    videoProcessingDetails,
    totalFilesToProcess,
    unprocessedVideos,
    keysAllUnprocessedVideos,
    keysFailedUnprocessedVideos,
    areThereVideosProcessing,
    currentFileProgress,
    overallProgress,
    processVideoChunksAndTelemetry,
    downloadFilesFromVideoDB,
    downloadFiles,
    videoStorage,
    tempVideoStorage,
    temporaryVideoDBSize,
    videoStorageFileSize,
    isVideoFilename,
    videoThumbnailFilename,
    getVideoThumbnail,
    discardProcessedFilesFromVideoDB,
    discardUnprocessedFilesFromVideoDB,
    clearTemporaryVideoDB,
    downloadTempVideo,
    processAllUnprocessedVideos,
    discardUnprocessedVideos,
  }
})
