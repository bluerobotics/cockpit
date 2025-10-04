import { ref } from 'vue'

import { LiveVideoProcessor } from '@/libs/live-video-processor'
import { formatBytes, isElectron } from '@/libs/utils'
import { useVideoStore } from '@/stores/video'
import { type FileDescriptor } from '@/types/video'

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
  formatDate: (date: Date) => string
  fetchChunkGroups: () => Promise<void>
  deleteChunkGroup: (group: ChunkGroup) => Promise<void>
  deleteAllChunks: () => Promise<void>
  downloadChunkGroup: (group: ChunkGroup) => Promise<void>
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
   * Format date for display
   * @param {Date} date
   * @returns {string} Formatted date string
   */
  const formatDate = (date: Date): string => {
    if (date.getTime() === 0) {
      return 'Unknown creation datetime'
    }
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date)
  }

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

      for (const key of allKeys) {
        if (key.includes('thumbnail_')) continue

        const parts = key.split('_')
        if (parts.length < 2) continue

        const hash = parts[0]
        const chunkNumber = parseInt(parts[parts.length - 1], 10)
        if (isNaN(chunkNumber)) continue

        try {
          const blob = (await videoStore.tempVideoStorage.getItem(key)) as Blob
          if (!blob || blob.size === 0) continue

          const chunkSize = blob.size
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
    if (isElectron()) return

    try {
      isProcessingChunks.value = true

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
        const zipFilename = batches.length === 1 ? `chunks_${group.hash}.zip` : `chunks_${group.hash}_part${i + 1}.zip`

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
            files.push({ file: { blob: assFile.blob, filename: assFile.filename }, lastModDate: files[0].lastModDate })
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
   * Process a ZIP file containing video chunks using the live streaming pipeline
   * @param {() => Promise<void>} onComplete
   * @returns {Promise<void>} Promise that resolves when processing is complete
   */
  const processVideoChunksZip = async (onComplete?: () => Promise<void>): Promise<void> => {
    if (isProcessingZip.value || !isElectron()) return

    try {
      const zipFilePath = await window.electronAPI?.getPathOfSelectedFile({
        title: 'Select Video ZIP File',
        filters: [{ name: 'ZIP Files', extensions: ['zip'] }],
      })

      if (!zipFilePath) return

      isProcessingZip.value = true
      zipProcessingComplete.value = false
      zipProcessingProgress.value = 0
      zipProcessingMessage.value = 'Starting ZIP processing...'

      // Use the new LiveVideoProcessor static method
      await LiveVideoProcessor.processZipFile(zipFilePath, (progress: number, message: string) => {
        zipProcessingProgress.value = progress
        zipProcessingMessage.value = message
      })

      const msg = 'ZIP file processed successfully! Video is now available in the Videos tab.'
      openSnackbar({ message: msg, variant: 'success' })

      if (onComplete) await onComplete()

      zipProcessingComplete.value = true
    } catch (error) {
      const msg = `Failed to process ZIP file: ${error instanceof Error ? error.message : 'Unknown error'}`
      openSnackbar({ message: msg, variant: 'error' })
    } finally {
      isProcessingZip.value = false
      zipProcessingProgress.value = 0
      zipProcessingMessage.value = ''
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
    formatDate,
    fetchChunkGroups,
    deleteChunkGroup,
    deleteAllChunks,
    downloadChunkGroup,
    openVideoChunksFolder,
    processVideoChunksZip,
    processAnotherZip,
  }
}
