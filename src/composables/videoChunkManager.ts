import { ref } from 'vue'

import { LiveVideoProcessor } from '@/libs/live-video-processor'
import { datalogger } from '@/libs/sensors-logging'
import { formatBytes, isElectron } from '@/libs/utils'
import { useVideoStore } from '@/stores/video'
import { type FileDescriptor } from '@/types/video'
import { videoFilename, videoSubtitlesFilename } from '@/utils/video'

import { useInteractionDialog } from './interactionDialog'
import { useSnackbar } from './snackbar'

/* eslint-disable jsdoc/require-jsdoc */
export interface ChunkGroup {
  hash: string
  fileName?: string
  chunkCount: number
  totalSize: number
  estimatedDuration: number
  firstChunkDate: Date
  chunks: Array<{ key: string; size: number; timestamp: Date }>
}
/* eslint-enable jsdoc/require-jsdoc */

/* eslint-disable jsdoc/require-jsdoc */
/**
 * Composable for managing video chunks
 * @returns {object} Video chunk manager state and methods
 */
export const useVideoChunkManager = (): {
  chunkGroups: any
  totalChunkSize: any
  isProcessingChunks: any
  loadingData: any
  isProcessingZip: any
  zipProcessingComplete: any
  zipProcessingProgress: any
  zipProcessingMessage: any
  fetchChunkGroups: () => Promise<void>
  deleteChunkGroup: (group: ChunkGroup) => Promise<void>
  deleteAllChunks: () => Promise<void>
  downloadChunkGroup: (group: ChunkGroup) => Promise<void>
  processChunkGroup: (group: ChunkGroup) => Promise<void>
  openVideoChunksFolder: () => Promise<void>
  processVideoChunksZip: (onComplete?: () => Promise<void>) => Promise<void>
  processAnotherZip: () => void
} => {
  /* eslint-enable jsdoc/require-jsdoc */
  const videoStore = useVideoStore()
  const { showDialog, closeDialog } = useInteractionDialog()
  const { openSnackbar } = useSnackbar()

  const chunkGroups = ref<ChunkGroup[]>([])
  const totalChunkSize = ref(0)
  const isProcessingChunks = ref(false)
  const loadingData = ref(true)

  // ZIP Processing
  const isProcessingZip = ref(false)
  const zipProcessingComplete = ref(false)
  const zipProcessingProgress = ref(0)
  const zipProcessingMessage = ref('')

  /**
   * Get timestamp for a chunk
   * @param {string} key
   * @returns {Promise<Date>} Promise resolving to chunk timestamp
   */
  const getChunkTimestamp = async (key: string): Promise<Date> => {
    if (isElectron()) {
      try {
        if (window.electronAPI?.getFileStats) {
          const subFolders = ['videos', 'temporary-video-chunks']
          const fileStats = await window.electronAPI.getFileStats(key, subFolders)
          if (fileStats?.exists && fileStats.mtime) {
            return new Date(fileStats.mtime)
          }
        }
      } catch (error) {
        console.warn(`Error getting file stats for ${key}:`, error)
      }
    } else {
      const hash = key.split('_')[0]
      const chunkNumber = parseInt(key.split('_')[1], 10)
      const recordingMetadata = videoStore.unprocessedVideos[hash]
      if (recordingMetadata) {
        const chunkOffset = chunkNumber * 1000
        return new Date(new Date(recordingMetadata.dateStart!).getTime() + chunkOffset)
      }
    }
    return new Date(0)
  }

  /**
   * Update first chunk date with proper logic
   * @param {ChunkGroup} group
   * @param {number} chunkNumber
   * @param {Date} chunkTimestamp
   */
  const updateFirstChunkDate = (group: ChunkGroup, chunkNumber: number, chunkTimestamp: Date): void => {
    if (chunkNumber === 0) {
      group.firstChunkDate = chunkTimestamp
    } else if (group.chunks.length === 1) {
      group.firstChunkDate = chunkTimestamp
    } else if (chunkTimestamp.getTime() !== 0 && group.firstChunkDate.getTime() === 0) {
      group.firstChunkDate = chunkTimestamp
    } else if (chunkTimestamp.getTime() !== 0 && chunkTimestamp.getTime() < group.firstChunkDate.getTime()) {
      group.firstChunkDate = chunkTimestamp
    }
  }

  /**
   * Fetch and group chunks
   * @returns {Promise<void>} Promise that resolves when chunks are fetched
   */
  const fetchChunkGroups = async (): Promise<void> => {
    try {
      loadingData.value = true
      const allKeys = await videoStore.tempVideoStorage.keys()

      const groups: { [hash: string]: ChunkGroup } = {}
      let totalSize = 0

      // Filter valid keys first
      const validKeys = allKeys.filter((key) => {
        if (key.includes('thumbnail_')) return false
        const parts = key.split('_')
        if (parts.length < 2) return false
        const chunkNumber = parseInt(parts[parts.length - 1], 10)
        return !isNaN(chunkNumber)
      })

      // Process chunks in parallel batches for much faster loading
      const BATCH_SIZE = 20 // Process 20 chunks at a time
      for (let i = 0; i < validKeys.length; i += BATCH_SIZE) {
        const batch = validKeys.slice(i, i + BATCH_SIZE)

        await Promise.all(
          batch.map(async (key) => {
            const parts = key.split('_')
            const hash = parts[0]
            const chunkNumber = parseInt(parts[parts.length - 1], 10)

            try {
              let chunkSize = 0
              if (isElectron() && window.electronAPI) {
                const fileStats = await window.electronAPI.getFileStats(key, ['videos', 'temporary-video-chunks'])
                if (!fileStats?.exists) return
                chunkSize = fileStats?.size || 0
              } else {
                const blob = (await videoStore.tempVideoStorage.getItem(key)) as Blob
                if (!blob || blob.size === 0) return
                chunkSize = blob.size
              }

              totalSize += chunkSize
              if (!groups[hash]) {
                groups[hash] = {
                  hash,
                  chunkCount: 0,
                  totalSize: 0,
                  estimatedDuration: 0,
                  firstChunkDate: new Date(0),
                  chunks: [],
                }
              }

              const chunkTimestamp = await getChunkTimestamp(key)

              groups[hash].chunks.push({ key, size: chunkSize, timestamp: chunkTimestamp })
              groups[hash].chunkCount++
              groups[hash].totalSize += chunkSize
              groups[hash].estimatedDuration = groups[hash].chunkCount

              updateFirstChunkDate(groups[hash], chunkNumber, chunkTimestamp)
            } catch (error) {
              console.warn(`Failed to load chunk ${key}:`, error)
            }
          })
        )
      }

      // Sort chunks within each group
      Object.values(groups).forEach((group) => {
        group.chunks.sort((a, b) => {
          const aNum = parseInt(a.key.split('_').pop() || '0', 10)
          const bNum = parseInt(b.key.split('_').pop() || '0', 10)
          return aNum - bNum
        })
      })

      chunkGroups.value = Object.values(groups).sort((a, b) => b.firstChunkDate.getTime() - a.firstChunkDate.getTime())
      totalChunkSize.value = totalSize
    } catch (error) {
      openSnackbar({ message: 'Failed to load temporary chunks', variant: 'error' })
    } finally {
      loadingData.value = false
    }
  }

  /**
   * Delete a chunk group
   * @param {ChunkGroup} group
   * @returns {Promise<void>} Promise that resolves when group is deleted
   */
  const deleteChunkGroup = async (group: ChunkGroup): Promise<void> => {
    const size = formatBytes(group.totalSize)
    showDialog({
      title: 'Delete Chunk Group',
      message: `Delete ${group.chunkCount} chunks for ${group.hash}? This will free up ${size} of storage space.`,
      variant: 'warning',
      actions: [
        { text: 'Cancel', action: () => closeDialog() },
        {
          text: 'Delete',
          action: async () => {
            closeDialog()
            try {
              isProcessingChunks.value = true

              for (const chunk of group.chunks) {
                await videoStore.tempVideoStorage.removeItem(chunk.key)
              }

              openSnackbar({ message: `Deleted ${group.chunkCount} chunks for ${group.hash}`, variant: 'success' })

              await fetchChunkGroups()
            } catch (error) {
              openSnackbar({ message: 'Failed to delete chunks', variant: 'error' })
            } finally {
              isProcessingChunks.value = false
            }
          },
        },
      ],
    })
  }

  /**
   * Delete all chunks
   * @returns {Promise<void>} Promise that resolves when all chunks are deleted
   */
  const deleteAllChunks = async (): Promise<void> => {
    if (chunkGroups.value.length === 0) return

    const count = chunkGroups.value.length
    const size = formatBytes(totalChunkSize.value)
    showDialog({
      title: 'Delete All Temporary Chunks',
      message: `Are you sure you want to delete all ${count} chunk groups? This will free up ${size} of storage space.`,
      variant: 'warning',
      actions: [
        { text: 'Cancel', action: () => closeDialog() },
        {
          text: 'Delete All',
          action: async () => {
            closeDialog()
            try {
              isProcessingChunks.value = true

              for (const group of chunkGroups.value) {
                for (const chunk of group.chunks) {
                  await videoStore.tempVideoStorage.removeItem(chunk.key)
                }
              }

              openSnackbar({ message: `Deleted all temporary chunks (${size} freed)`, variant: 'success' })

              await fetchChunkGroups()
            } catch (error) {
              openSnackbar({ message: 'Failed to delete all chunks', variant: 'error' })
            } finally {
              isProcessingChunks.value = false
            }
          },
        },
      ],
    })
  }

  /**
   * Find .ass telemetry file for a chunk group
   * @param {string} hash
   * @returns {Promise<FileDescriptor | null>} Promise resolving to telemetry file info or null
   */
  const findAssTelemetryFile = async (hash: string): Promise<FileDescriptor | null> => {
    // Try to find existing .ass file
    const videoStorageItems = await videoStore.videoStorage.keys()
    const assFile = videoStorageItems.find((filename) => filename.includes(hash) && filename.endsWith('.ass'))

    if (assFile) {
      return { blob: (await videoStore.videoStorage.getItem(assFile)) as Blob, filename: assFile }
    }
    return null
  }

  /**
   * Download chunk group as ZIP
   * @param {ChunkGroup} group
   * @returns {Promise<void>} Promise that resolves when download is complete
   */
  const downloadChunkGroup = async (group: ChunkGroup): Promise<void> => {
    try {
      isProcessingChunks.value = true

      if (isElectron()) {
        // Electron version: Create ZIP using filesystem (no memory limits)
        const zipFilePath = await window.electronAPI?.createVideoChunksZip(group.hash)

        if (zipFilePath) {
          const count = group.chunkCount
          const msg = `ZIP file created successfully with ${count} chunks at: ${zipFilePath}`
          openSnackbar({ message: msg, variant: 'success' })
        } else {
          throw new Error('Failed to create ZIP file')
        }
      } else {
        // Web version: Create ZIP in memory (with 1GB limit)
        const MAX_BATCH_SIZE = 1024 * 1024 * 1024 // 1GB
        const batches: Array<{
          /**
           * The chunks to add to the ZIP
           */
          chunks: typeof group.chunks
          /**
           * The size of the current batch
           */
          size: number
        }> = []
        let currentBatch: typeof group.chunks = []
        let currentBatchSize = 0

        for (const chunk of group.chunks) {
          if (currentBatchSize + chunk.size > MAX_BATCH_SIZE && currentBatch.length > 0) {
            batches.push({ chunks: [...currentBatch], size: currentBatchSize })
            currentBatch = []
            currentBatchSize = 0
          }
          currentBatch.push(chunk)
          currentBatchSize += chunk.size
        }

        if (currentBatch.length > 0) {
          batches.push({ chunks: currentBatch, size: currentBatchSize })
        }

        // Download each batch
        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i]
          const zipFilename =
            batches.length === 1 ? `chunks_${group.hash}.zip` : `chunks_${group.hash}_part${i + 1}.zip`

          // Add chunks to ZIP
          const files = await Promise.all(
            batch.chunks.map(async (chunk) => {
              const chunkDate = await getChunkTimestamp(chunk.key)
              const blob = (await videoStore.tempVideoStorage.getItem(chunk.key)) as Blob
              return { file: { blob, filename: chunk.key }, lastModDate: chunkDate }
            })
          )

          // Add .ass telemetry file (only in first batch)
          if (i === 0) {
            const assFile = await findAssTelemetryFile(group.hash)
            if (assFile) {
              files.push({
                file: { blob: assFile.blob, filename: assFile.filename },
                lastModDate: files[0].lastModDate,
              })
            } else {
              openSnackbar({ message: 'Failed to find .ass telemetry file for the recording.', variant: 'error' })
            }
          }

          await videoStore.createZipAndDownload(files, zipFilename)

          if (batches.length > 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000))
          }
        }

        const count = group.chunkCount
        openSnackbar({ message: `Downloaded ${count} chunks in ${batches.length} archive(s)`, variant: 'success' })
      }
    } catch (error) {
      openSnackbar({ message: 'Failed to download chunks', variant: 'error' })
    } finally {
      isProcessingChunks.value = false
    }
  }

  /**
   * Open video chunks folder
   * @returns {Promise<void>} Promise that resolves when folder is opened
   */
  const openVideoChunksFolder = async (): Promise<void> => {
    try {
      if (window.electronAPI?.openVideoChunksFolder) {
        await window.electronAPI.openVideoChunksFolder()
      }
    } catch (error) {
      openSnackbar({ message: 'Failed to open temporary chunks folder', variant: 'error' })
    }
  }

  /**
   * Resolve the final list of ZIPs to process from the user's selection.
   * When the user picks a single part-zip we look for sibling part-zips with the same
   * recording hash in the same folder and include them automatically; otherwise the
   * user's selection is used as-is.
   * @param {string[]} selectedPaths - Paths returned by the file dialog
   * @returns {Promise<string[]>} Final list of ZIP paths to process
   */
  const resolveZipPathsToProcess = async (selectedPaths: string[]): Promise<string[]> => {
    if (selectedPaths.length !== 1 || !window.electronAPI?.findSiblingChunkZips) {
      return selectedPaths
    }

    try {
      const siblings = await window.electronAPI.findSiblingChunkZips(selectedPaths[0])
      if (siblings && siblings.length > 1) {
        const siblingCount = siblings.length - 1
        openSnackbar({
          message: `Detected ${siblingCount} sibling part-zip(s) for this recording — they will be processed together.`,
          variant: 'info',
        })
        return siblings
      }
    } catch (error) {
      console.warn('Failed to look up sibling chunk ZIPs, proceeding with the selected file only:', error)
    }
    return selectedPaths
  }

  /**
   * Process one or more ZIP files containing video chunks using the live streaming pipeline.
   * Allows the user to select multiple ZIPs (e.g. the multi-part archives produced by
   * Cockpit Lite when chunk groups exceed 1GB). When the user picks a single part-zip
   * we automatically include any sibling part-zips with the same recording hash that live
   * in the same folder, so all chunks of a recording are processed together.
   * @param {() => Promise<void>} onComplete - Optional callback invoked after a successful run
   * @returns {Promise<void>} Promise that resolves when processing is complete
   */
  const processVideoChunksZip = async (onComplete?: () => Promise<void>): Promise<void> => {
    if (isProcessingZip.value || !isElectron()) return

    try {
      const selectedPaths = await window.electronAPI?.getPathsOfSelectedFiles({
        title: 'Select Video ZIP File(s)',
        filters: [{ name: 'ZIP Files', extensions: ['zip'] }],
      })

      if (!selectedPaths || selectedPaths.length === 0) return

      const zipPathsToProcess = await resolveZipPathsToProcess(selectedPaths)

      isProcessingZip.value = true
      zipProcessingComplete.value = false
      zipProcessingProgress.value = 0
      zipProcessingMessage.value =
        zipPathsToProcess.length > 1
          ? `Starting processing of ${zipPathsToProcess.length} ZIP files...`
          : 'Starting ZIP processing...'

      await LiveVideoProcessor.processZipFiles(zipPathsToProcess, (progress: number, message: string) => {
        zipProcessingProgress.value = progress
        zipProcessingMessage.value = message
      })

      const successMessage =
        zipPathsToProcess.length > 1
          ? `${zipPathsToProcess.length} ZIP files processed successfully! Video is now available in the Videos tab.`
          : 'ZIP file processed successfully! Video is now available in the Videos tab.'
      openSnackbar({ message: successMessage, variant: 'success' })

      if (onComplete) await onComplete()

      zipProcessingComplete.value = true
    } catch (error) {
      const msg = `Failed to process ZIP file(s): ${error instanceof Error ? error.message : 'Unknown error'}`
      openSnackbar({ message: msg, variant: 'error' })
    } finally {
      isProcessingZip.value = false
      zipProcessingProgress.value = 0
      zipProcessingMessage.value = ''
    }
  }

  /**
   * Generate an .ass telemetry blob from a datalogger log, save it to video storage, and copy it
   * to the output path on the filesystem.
   * @param {Awaited<ReturnType<typeof datalogger.generateLog>>} telemetryLog - The generated log
   * @param {number} videoWidth - Video width in pixels
   * @param {number} videoHeight - Video height in pixels
   * @param {number} startEpoch - Video start epoch in milliseconds
   * @param {string} subtitlesFileName - The filename (key) under which to store the .ass file
   * @param {string} outputPath - Full filesystem path of the processed video
   * @returns {Promise<void>}
   */
  const saveAndCopyTelemetry = async (
    telemetryLog: Awaited<ReturnType<typeof datalogger.generateLog>>,
    videoWidth: number,
    videoHeight: number,
    startEpoch: number,
    subtitlesFileName: string,
    outputPath: string
  ): Promise<void> => {
    const assContent = datalogger.toAssOverlay(telemetryLog, videoWidth, videoHeight, startEpoch)
    const logBlob = new Blob([assContent], { type: 'text/plain' })
    await videoStore.videoStorage.setItem(subtitlesFileName, logBlob)
    await window.electronAPI!.copyTelemetryFile(subtitlesFileName, videoSubtitlesFilename(outputPath))
  }

  /**
   * Attempts to resolve telemetry for a processed chunk group using a 3-tier fallback:
   *   1. Copy an existing .ass file from video storage
   *   2. Generate from unprocessedVideos metadata (dateStart/dateFinish/resolution)
   *   3. Reconstruct the time range from chunk timestamps
   * Throws if all tiers fail.
   * @param {ChunkGroup} group - The chunk group being processed
   * @param {string} outputPath - Full filesystem path of the processed video
   * @returns {Promise<void>}
   */
  const copyOrGenerateTelemetryOverlayFile = async (group: ChunkGroup, outputPath: string): Promise<void> => {
    const subtitlesFileName = videoSubtitlesFilename(group.fileName || videoFilename(group.hash, group.firstChunkDate))

    // Tier 1: Try to find and copy an existing .ass file
    try {
      const videoKeys = await videoStore.videoStorage.keys()
      const existingAssFile = videoKeys.find((key) => key.includes(group.hash) && key.endsWith('.ass'))
      if (existingAssFile) {
        await window.electronAPI!.copyTelemetryFile(existingAssFile, videoSubtitlesFilename(outputPath))
        console.info(`Tier 1: Copied existing telemetry file for ${group.hash}.`)
        return
      }
      console.info(`Tier 1: No existing .ass file found for ${group.hash}. Trying metadata generation...`)
    } catch (error) {
      console.warn(`Tier 1: Failed to copy existing telemetry for ${group.hash}:`, error)
    }

    // Tier 2: Try to generate from unprocessedVideos metadata
    try {
      const recordingData = videoStore.unprocessedVideos[group.hash]
      if (recordingData?.dateStart && recordingData?.dateFinish) {
        const dateStart = new Date(recordingData.dateStart)
        const dateFinish = new Date(recordingData.dateFinish)
        console.info(`Tier 2: Generating telemetry from recording metadata for ${group.hash}...`)

        const telemetryLog = await datalogger.generateLog(dateStart, dateFinish)
        const vWidth = recordingData.vWidth ?? 1920
        const vHeight = recordingData.vHeight ?? 1080
        await saveAndCopyTelemetry(telemetryLog, vWidth, vHeight, dateStart.getTime(), subtitlesFileName, outputPath)
        console.info(`Tier 2: Telemetry generated from metadata for ${group.hash}.`)
        return
      }
      console.info(`Tier 2: No recording metadata found for ${group.hash}. Trying timestamp reconstruction...`)
    } catch (error) {
      console.warn(`Tier 2: Failed to generate telemetry from metadata for ${group.hash}:`, error)
    }

    // Tier 3: Reconstruct time range from chunk timestamps
    const validChunks = group.chunks.filter((c) => c.timestamp.getTime() > 0)
    if (validChunks.length === 0) {
      throw new Error(`No valid chunk timestamps available for ${group.hash}`)
    }

    const sortedByTime = [...validChunks].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    const estimatedStart = sortedByTime[0].timestamp
    const estimatedEnd = new Date(sortedByTime[sortedByTime.length - 1].timestamp.getTime() + 1000)
    console.info(`Tier 3: Reconstructing telemetry from chunk timestamps for ${group.hash}...`)

    const telemetryLog = await datalogger.generateLog(estimatedStart, estimatedEnd)
    await saveAndCopyTelemetry(telemetryLog, 1920, 1080, estimatedStart.getTime(), subtitlesFileName, outputPath)
    console.info(`Tier 3: Telemetry reconstructed from chunk timestamps for ${group.hash}.`)
  }

  /**
   * Process a chunk group using the live video processor
   * @param {ChunkGroup} group
   * @returns {Promise<void>} Promise that resolves when processing is complete
   */
  const processChunkGroup = async (group: ChunkGroup): Promise<void> => {
    if (!isElectron() || !window.electronAPI) {
      openSnackbar({ message: 'Manual processing is only available in Electron', variant: 'error' })
      return
    }

    try {
      isProcessingChunks.value = true

      // Generate filename based on the chunk group
      const fileName = group.fileName || videoFilename(group.hash, group.firstChunkDate)

      // Get the chunk file paths from the group's chunks array, sorted by chunk number
      const sortedChunks = group.chunks.sort((a, b) => {
        const aNum = parseInt(a.key.split('_').pop() || '0', 10)
        const bNum = parseInt(b.key.split('_').pop() || '0', 10)
        return aNum - bNum
      })

      if (sortedChunks.length === 0) {
        throw new Error('No chunk files found for processing')
      }

      // Read first chunk using the electron storage API to get the blob
      const firstChunkBlob = (await videoStore.tempVideoStorage.getItem(sortedChunks[0].key)) as Blob
      if (!firstChunkBlob) {
        throw new Error('Failed to read first chunk')
      }

      // Start FFmpeg streaming process with first chunk
      const { id: processId, outputPath } = await window.electronAPI.startVideoRecording(
        firstChunkBlob,
        group.hash,
        fileName,
        false // Don't keep chunk backup since we're processing existing chunks
      )

      // Stream remaining chunks to FFmpeg in order
      for (let i = 1; i < sortedChunks.length; i++) {
        const chunkBlob = (await videoStore.tempVideoStorage.getItem(sortedChunks[i].key)) as Blob
        if (!chunkBlob) {
          console.warn(`Failed to read chunk ${i}, skipping`)
          continue
        }

        await window.electronAPI.appendChunkToVideoRecording(processId, chunkBlob, i)
      }

      // Finalize the streaming process
      await window.electronAPI.finalizeVideoRecording(processId)

      // Find and copy (if it exists) or generate (if it doesn't) telemetry overlay file
      try {
        await copyOrGenerateTelemetryOverlayFile(group, outputPath)
      } catch (telemetryError) {
        const errorMessage = `Could not generate telemetry overlay for the processed video: ${telemetryError}`
        openSnackbar({ message: errorMessage, variant: 'error' })
      }

      openSnackbar({
        message: `Video processed successfully! Output: ${outputPath}`,
        variant: 'success',
      })
    } catch (error) {
      const msg = `Failed to process video chunks: ${error instanceof Error ? error.message : 'Unknown error'}`
      openSnackbar({ message: msg, variant: 'error' })
    } finally {
      isProcessingChunks.value = false
    }
  }

  /**
   * Reset ZIP processing state
   */
  const processAnotherZip = (): void => {
    zipProcessingComplete.value = false
    zipProcessingProgress.value = 0
    zipProcessingMessage.value = ''
  }

  return {
    // State
    chunkGroups,
    totalChunkSize,
    isProcessingChunks,
    loadingData,
    isProcessingZip,
    zipProcessingComplete,
    zipProcessingProgress,
    zipProcessingMessage,

    // Methods
    fetchChunkGroups,
    deleteChunkGroup,
    deleteAllChunks,
    downloadChunkGroup,
    processChunkGroup,
    openVideoChunksFolder,
    processVideoChunksZip,
    processAnotherZip,
  }
}
