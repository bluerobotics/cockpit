import { useDebounceFn } from '@vueuse/core'
import { BlobReader, BlobWriter, ZipWriter } from '@zip.js/zip.js'
import { differenceInSeconds } from 'date-fns'
import { saveAs } from 'file-saver'
import fixWebmDuration from 'webm-duration-fix'

import { CockpitStandardLog } from '@/libs/sensors-logging'
import type { StorageDB } from '@/types/general'
import type {
  DownloadProgressCallback,
  FileDescriptor,
  UnprocessedVideoInfo,
  VideoProcessingDetails,
} from '@/types/video'
import { getBlobExtensionContainer, VideoExtensionContainer } from '@/types/video'

/* eslint-disable jsdoc/require-jsdoc */
type Deps = {
  unprocessedVideos: {
    value: Record<string, UnprocessedVideoInfo>
  }
  videoProcessingDetails: {
    value: VideoProcessingDetails
  }

  totalFilesToProcess: {
    value: number
  }
  tempVideoStorage: StorageDB | LocalForage
  videoStorage: StorageDB | LocalForage
  zipMultipleFiles: {
    value: boolean
  }
  datalogger: typeof import('@/libs/sensors-logging').datalogger
  showDialog: (opts: any) => void
  openSnackbar: (opts: any) => void
  extractThumbnailFromVideo: (blob: Blob) => Promise<Blob>
}

/* eslint-disable jsdoc/require-jsdoc */
export interface VideoProcessingService {
  processVideoChunksAndTelemetry(hashes: string[]): Promise<void>
  downloadFilesFromVideoDB(fileNames: string[], cb?: DownloadProgressCallback): Promise<void>
  downloadFiles(
    db: StorageDB | LocalForage,
    keys: string[],
    shouldZip?: boolean,
    prefix?: string,
    cb?: DownloadProgressCallback
  ): Promise<void>
  temporaryVideoDBSize(): Promise<number>
  videoStorageFileSize(filename: string): Promise<number | undefined>
  isVideoFilename(name: string): boolean
  videoThumbnailFilename(name: string): string
  getVideoThumbnail(idOrName: string, processed: boolean): Promise<Blob | null>
  discardProcessedFilesFromVideoDB(names: string[]): Promise<void>
  discardUnprocessedFilesFromVideoDB(hashes: string[]): Promise<void>
  clearTemporaryVideoDB(): Promise<void>
  downloadTempVideo(hashes: string[], cb?: DownloadProgressCallback): Promise<void>
  processAllUnprocessedVideos(): Promise<void>
  discardUnprocessedVideos(includeNotFailed?: boolean): Promise<void>
}

export const createVideoProcessingService = (deps: Deps): VideoProcessingService => {
  const videoThumbnailFilename = (name: string): string => `thumbnail_${name}.jpeg`

  const updateFileProgress = (filename: string, progress: number, message: string): void => {
    deps.videoProcessingDetails.value[filename] = { filename, progress, message }
  }

  const debouncedUpdateFileProgress = useDebounceFn((filename: string, progress: number, message: string) => {
    updateFileProgress(filename, progress, message)
  }, 100)

  const updateLastProcessingUpdate = (recordingHash: string): void => {
    const info = deps.unprocessedVideos.value[recordingHash]
    info.dateLastProcessingUpdate = new Date()
    deps.unprocessedVideos.value = { ...deps.unprocessedVideos.value, ...{ [recordingHash]: info } }
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
    db: StorageDB | LocalForage,
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
      deps.showDialog({ message: 'No files found.', variant: 'error' })
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
    if (deps.zipMultipleFiles.value) {
      const ZipFilename = fileNames.length > 1 ? 'Cockpit-Video-Recordings' : 'Cockpit-Video-Recording'
      await downloadFiles(deps.videoStorage, fileNames, true, ZipFilename, progressCallback)
    } else {
      await downloadFiles(deps.videoStorage, fileNames)
    }
  }

  const processVideoChunksAndTelemetry = async (hashes: string[]): Promise<void> => {
    deps.totalFilesToProcess.value = hashes.length
    deps.videoProcessingDetails.value = {}

    const tasks = hashes.map(async (hash) => {
      const info = deps.unprocessedVideos.value[hash]
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
      const keys = await deps.tempVideoStorage.keys()
      const filteredKeys = keys.filter((key) => key.includes(hash) && key !== videoThumbnailFilename(hash))
      for (const key of filteredKeys) {
        const blob = await deps.tempVideoStorage.getItem(key)
        if (blob instanceof Blob) {
          chunks.push({ blob, name: key })
        }
      }

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
        deps.showDialog({ title: 'Video Processing Issue', message: errorMsg, variant: 'error' })
      }

      updateLastProcessingUpdate(hash)

      debouncedUpdateFileProgress(info.fileName, 75, `Saving video file.`)
      const finalFileName = `${info.fileName}.${extensionContainer || 'webm'}`
      await deps.videoStorage.setItem(finalFileName, durFixedBlob ?? mergedBlob)

      // Save thumbnail in the storage
      const thumbnail = await deps.extractThumbnailFromVideo(chunkBlobs[0])
      await deps.videoStorage.setItem(videoThumbnailFilename(finalFileName), thumbnail)

      updateLastProcessingUpdate(hash)

      debouncedUpdateFileProgress(info.fileName, 80, `Generating telemetry file.`)
      let telemetryLog: CockpitStandardLog | undefined = undefined
      try {
        telemetryLog = await deps.datalogger.generateLog(dateStart, dateFinish)
      } catch (error) {
        deps.openSnackbar({ message: `Failed to generate telemetry file. ${error}`, variant: 'error', duration: 5000 })
      }

      if (telemetryLog !== undefined) {
        debouncedUpdateFileProgress(info.fileName, 95, `Converting telemetry file.`)
        const assLog = deps.datalogger.toAssOverlay(telemetryLog, info.vWidth!, info.vHeight!, dateStart.getTime())
        const logBlob = new Blob([assLog], { type: 'text/plain' })
        deps.videoStorage.setItem(`${info.fileName}.ass`, logBlob)
      }

      updateLastProcessingUpdate(hash)

      debouncedUpdateFileProgress(info.fileName, 100, 'Processing completed')
      updateFileProgress(info.fileName, 100, 'Processing completed')
      await cleanupProcessedData(hash)
    })
    await Promise.all(tasks)
  }

  const temporaryVideoDBSize = async (): Promise<number> => {
    let bytes = 0
    for (const k of await deps.tempVideoStorage.keys()) {
      const b = await deps.tempVideoStorage.getItem(k)
      if (b instanceof Blob) bytes += b.size
    }
    return bytes
  }

  const videoStorageFileSize = async (filename: string): Promise<number | undefined> => {
    const f = await deps.videoStorage.getItem(filename)
    return f instanceof Blob ? f.size : undefined
  }

  const isVideoFilename = (filename: string): boolean => {
    for (const ext of Object.values(VideoExtensionContainer)) {
      if (filename.endsWith(ext)) return true
    }
    return false
  }

  const getVideoThumbnail = async (idOrName: string, processed: boolean): Promise<Blob | null> => {
    const db = processed ? deps.videoStorage : deps.tempVideoStorage
    const pic = await db.getItem(videoThumbnailFilename(idOrName))
    return (pic as Blob) ?? null
  }

  const discardProcessedFilesFromVideoDB = async (names: string[]): Promise<void> => {
    await Promise.all(names.map((n) => deps.videoStorage.removeItem(n)))
  }

  const discardUnprocessedFilesFromVideoDB = async (hashes: string[]): Promise<void> => {
    const keys = await deps.tempVideoStorage.keys()
    await Promise.all(
      hashes.flatMap((h) => keys.filter((k) => k.includes(h))).map((k) => deps.tempVideoStorage.removeItem(k))
    )
    hashes.forEach((h) => delete deps.unprocessedVideos.value[h])
  }

  const clearTemporaryVideoDB = (): Promise<void> => deps.tempVideoStorage.clear()

  const downloadTempVideo = async (hashes: string[], progressCallback?: DownloadProgressCallback): Promise<void> => {
    console.debug(`Downloading ${hashes.length} video chunks from the temporary database.`)

    for (const hash of hashes) {
      const fileNames = (await deps.tempVideoStorage.keys()).filter((filename) => filename.includes(hash))
      const zipFilenamePrefix = `Cockpit-Unprocessed-Video-Chunks-${hash}`
      await downloadFiles(deps.tempVideoStorage, fileNames, true, zipFilenamePrefix, progressCallback)
    }
  }

  // Remove temp chunks and video metadata from the database
  const cleanupProcessedData = async (recordingHash: string): Promise<void> => {
    const keys = await deps.tempVideoStorage.keys()
    const filteredKeys = keys.filter((key) => key.includes(recordingHash) && key.includes('_'))
    for (const key of filteredKeys) {
      await deps.tempVideoStorage.removeItem(key)
    }
    delete deps.unprocessedVideos.value[recordingHash]
  }

  const keysAllUnprocessedVideos = (): string[] => Object.keys(deps.unprocessedVideos.value)

  const keysFailedUnprocessedVideos = (): string[] => {
    const now = new Date()

    return keysAllUnprocessedVideos().filter((hash) => {
      const info = deps.unprocessedVideos.value[hash]

      const secsSinceLastRec = differenceInSeconds(now, new Date(info.dateLastRecordingUpdate!))
      const stillRecording = info.dateFinish === undefined && secsSinceLastRec < 10

      const lastProc = new Date(info.dateLastProcessingUpdate ?? 0)
      const secsSinceLastProc = differenceInSeconds(now, lastProc)
      const stillProcessing = info.dateFinish !== undefined && secsSinceLastProc < 10

      return !stillRecording && !stillProcessing
    })
  }

  // Process videos that were being recorded when the app was closed
  const processAllUnprocessedVideos = async (): Promise<void> => {
    if (keysFailedUnprocessedVideos().length === 0) return

    console.log(`Processing unprocessed videos: ${keysFailedUnprocessedVideos().join(', ')}`)

    const chunks = await deps.tempVideoStorage.keys()
    if (chunks.length === 0) {
      await discardUnprocessedVideos()
      throw new Error('No video recording data found. Discarding leftover info.')
    }

    const processingErrors: string[] = []
    for (const recordingHash of keysFailedUnprocessedVideos()) {
      const info = deps.unprocessedVideos.value[recordingHash]
      console.log(`Processing unprocessed video: ${info.fileName}`)
      try {
        await processVideoChunksAndTelemetry([recordingHash])
      } catch (e) {
        processingErrors.push(`Could not process video ${recordingHash}. ${e} Discarding leftover info.`)
      }
      delete deps.unprocessedVideos.value[recordingHash]
    }

    if (processingErrors.isEmpty()) return
    throw new Error(processingErrors.join('\n'))
  }

  // Discard all data related to videos that were not processed
  const discardUnprocessedVideos = async (includeNotFailed = false): Promise<void> => {
    console.log('Discarding unprocessed videos.')

    const keysUnprocessedVideos = includeNotFailed ? keysAllUnprocessedVideos() : keysFailedUnprocessedVideos()
    const currentChunks = await deps.tempVideoStorage.keys()
    const chunksUnprocessedVideos = currentChunks.filter((chunkName) => {
      return keysUnprocessedVideos.some((key) => chunkName.includes(key))
    })

    deps.unprocessedVideos.value = {}
    for (const chunk of chunksUnprocessedVideos) {
      deps.tempVideoStorage.removeItem(chunk)
    }
  }

  return {
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
  }
}
