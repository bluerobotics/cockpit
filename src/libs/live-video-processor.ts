import { isElectron } from '@/libs/utils'
import type { VideoChunkQueueItem, ZipExtractionResult } from '@/types/video'
import { videoSubtitlesFilename } from '@/utils/video'

/**
 * Error class for LiveVideoProcessor initialization errors
 */
export class LiveVideoProcessorInitializationError extends Error {
  /**
   * Creates a new LiveVideoProcessorInitializationError
   * @param {string} message - The error message
   */
  constructor(message: string) {
    super(message)
    this.name = 'LiveVideoProcessorInitializationError'
  }
}

/**
 * Error class for LiveVideoProcessor chunk appending errors
 */
export class LiveVideoProcessorChunkAppendingError extends Error {
  /**
   * Creates a new LiveVideoProcessorChunkAppendingError
   * @param {string} message - The error message
   */
  constructor(message: string) {
    super(message)
    this.name = 'LiveVideoProcessorChunkAppendingError'
  }
}

/**
 * Live video processor for real-time FFmpeg streaming during recording
 *
 * This service handles streaming of video chunks directly to FFmpeg as they are recorded.
 * Chunks are piped to FFmpeg stdin, which outputs a fragmented MP4 file that is always
 * playable, even if the process crashes mid-recording. This eliminates the need for
 * post-processing finalization.
 *
 * Key features:
 * - WebM chunks streamed directly to FFmpeg stdin
 * - Fragmented MP4 output for crash-safety
 * - No re-encoding (copy codec only)
 * - Optional chunk backup for recovery
 */
export class LiveVideoProcessor {
  private recordingHash: string
  private fileName: string
  private isProcessing = false
  private keepRawVideoChunksAsBackup = true
  private chunkQueue: VideoChunkQueueItem[] = []
  private lastProcessedChunk = -1
  private concatProcess: any = null

  /**
   * Initialize the live video processor
   * @param {string} recordingHash - Unique identifier for this recording session
   * @param {string} fileName - The name of the video file
   * @param {boolean} keepRawVideoChunksAsBackup - Whether to keep raw video chunks as backup
   */
  constructor(recordingHash: string, fileName: string, keepRawVideoChunksAsBackup?: boolean) {
    this.fileName = fileName
    this.keepRawVideoChunksAsBackup = keepRawVideoChunksAsBackup ?? this.keepRawVideoChunksAsBackup
    this.recordingHash = recordingHash
  }

  /**
   * Start the live processing session
   * @returns {Promise<void>} Promise that resolves when processing is initialized
   */
  async startProcessing(): Promise<void> {
    if (!isElectron()) {
      throw new Error('Live video processing is only available in Electron')
    }

    this.isProcessing = true
  }

  /**
   * Add a new video chunk for live processing
   * @param {Blob} chunkBlob - The video chunk blob
   * @param {number} chunkNumber - Sequential number of this chunk
   */
  async addChunk(chunkBlob: Blob, chunkNumber: number): Promise<void> {
    if (!this.isProcessing) {
      console.warn('Attempted to add chunk to inactive live processor')
      return
    }

    // Add chunk to processing queue
    this.chunkQueue.push({ blob: chunkBlob, chunkNumber })

    // Process chunks in order
    await this.processQueuedChunks()
  }

  /**
   * Process queued chunks in sequential order
   */
  private async processQueuedChunks(): Promise<void> {
    // Sort queue by chunk number to ensure correct order
    this.chunkQueue.sort((a, b) => a.chunkNumber - b.chunkNumber)

    // Process chunks that are next in sequence
    while (this.chunkQueue.length > 0) {
      const nextChunk = this.chunkQueue[0]

      // Only process if this is the next expected chunk
      if (nextChunk.chunkNumber === this.lastProcessedChunk + 1) {
        this.chunkQueue.shift() // Remove from queue
        await this.processChunk(nextChunk.blob, nextChunk.chunkNumber)
        this.lastProcessedChunk = nextChunk.chunkNumber
        if (!this.keepRawVideoChunksAsBackup) {
          await this.deleteChunk(nextChunk.chunkNumber)
        }
      } else {
        console.warn(`Expected chunk ${this.lastProcessedChunk + 1} but got ${nextChunk.chunkNumber}.`)

        if (this.chunkQueue.length > 5) {
          console.warn('Too many chunks in queue, skipping ahead to the next expected chunk.')
          this.lastProcessedChunk = this.lastProcessedChunk + 1
        }

        break
      }
    }
  }

  /**
   * Process a single video chunk
   * @param {Blob} chunkBlob - The video chunk to process
   * @param {number} chunkNumber - Sequential number of this chunk
   */
  private async processChunk(chunkBlob: Blob, chunkNumber: number): Promise<void> {
    if (chunkNumber === 0) {
      try {
        console.log('Initializing output file with the first chunk.')
        // First chunk - initialize the output file
        await this.initializeOutputFile(chunkBlob)
      } catch (error) {
        throw new LiveVideoProcessorInitializationError(`Failed to initialize output file: ${error}`)
      }
    } else {
      try {
        // Subsequent chunks - append to existing file
        await this.appendChunkToOutput(chunkBlob, chunkNumber)
      } catch (error) {
        throw new LiveVideoProcessorChunkAppendingError(`Failed to append chunk ${chunkNumber}: ${error}`)
      }
    }
  }

  /**
   * Delete a video chunk
   * @param {number} chunkNumber - The number of the video chunk to delete
   */
  private async deleteChunk(chunkNumber: number): Promise<void> {
    await window.electronAPI?.deleteChunk(this.recordingHash, chunkNumber)
  }

  /**
   * Initialize the FFmpeg streaming process with the first chunk
   * @param {Blob} firstChunk - The first video chunk
   */
  private async initializeOutputFile(firstChunk: Blob): Promise<void> {
    // Start FFmpeg streaming process with the first chunk
    // The main process spawns FFmpeg with stdin input and fragmented MP4 output
    this.concatProcess = await window.electronAPI?.startVideoRecording(
      firstChunk,
      this.recordingHash,
      this.fileName,
      this.keepRawVideoChunksAsBackup
    )

    console.log('FFmpeg streaming process initialized with first chunk')
  }

  /**
   * Stream a chunk to FFmpeg stdin
   * @param {Blob} chunkBlob - The video chunk to stream
   * @param {number} chunkNumber - Sequential number of this chunk
   */
  private async appendChunkToOutput(chunkBlob: Blob, chunkNumber: number): Promise<void> {
    // Send chunk directly to main process for streaming to FFmpeg stdin
    // The main process writes the chunk to FFmpeg's stdin pipe
    if (this.concatProcess) {
      await window.electronAPI?.appendChunkToVideoRecording(this.concatProcess.id, chunkBlob, chunkNumber)
    } else {
      throw new Error('Chunk concatenation process not initialized.')
    }
  }

  /**
   * Stop live processing and finalize the output video by closing FFmpeg stdin
   * @returns {Promise<void>} Promise that resolves when FFmpeg finishes processing
   */
  async stopProcessing(): Promise<void> {
    if (!this.isProcessing) {
      return
    }

    try {
      // Process any remaining chunks in queue
      await this.processQueuedChunks()

      // Close FFmpeg stdin to signal end of input
      // FFmpeg will finish writing the fragmented MP4 and exit cleanly
      if (this.concatProcess) {
        await window.electronAPI?.finalizeVideoRecording(this.concatProcess.id)
        this.concatProcess = null
      }
    } catch (error) {
      console.error('Error during live processing finalization:', error)
      throw error
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Process a ZIP file containing video chunks using the live streaming pipeline
   * @param {string} zipFilePath - Path to the ZIP file
   * @param {(progress: number, message: string) => void} onProgress - Optional progress callback
   * @returns {Promise<string>} Promise that resolves to the output video path
   */
  static async processZipFile(
    zipFilePath: string,
    onProgress?: (progress: number, message: string) => void
  ): Promise<string> {
    if (!isElectron() || !window.electronAPI) {
      throw new Error('ZIP processing is only available in Electron')
    }

    try {
      onProgress?.(10, 'Extracting ZIP file...')

      // Extract ZIP and get chunk information
      const extractionResult: ZipExtractionResult = await window.electronAPI.extractVideoChunksZip(zipFilePath)
      const { chunkPaths, assFilePath, hash, fileName, tempDir } = extractionResult

      console.log(`Extracted ${chunkPaths.length} chunks from ZIP file`)
      onProgress?.(30, 'Starting video processing...')

      // Read first chunk
      const firstChunkData = await window.electronAPI.readChunkFile(chunkPaths[0])
      const firstChunkBlob = new Blob([new Uint8Array(firstChunkData)], { type: 'video/webm' })

      // Start FFmpeg streaming process with first chunk (no backup needed since ZIP is the backup)
      const { id: processId, outputPath } = await window.electronAPI.startVideoRecording(
        firstChunkBlob,
        hash,
        fileName,
        false // Don't keep chunk backup - the ZIP is the backup
      )

      console.log(`Started streaming process ${processId}`)
      console.log(`Output path: ${outputPath}`)
      onProgress?.(40, 'Streaming video chunks to FFmpeg...')

      // Stream remaining chunks to FFmpeg
      for (let i = 1; i < chunkPaths.length; i++) {
        const chunkData = await window.electronAPI.readChunkFile(chunkPaths[i])
        const chunkBlob = new Blob([new Uint8Array(chunkData)], { type: 'video/webm' })

        await window.electronAPI.appendChunkToVideoRecording(processId, chunkBlob, i)

        // Update progress
        const progress = 40 + (i / chunkPaths.length) * 40
        onProgress?.(progress, `Processing chunk ${i + 1}/${chunkPaths.length}`)
      }

      console.log('All chunks streamed, finalizing...')
      onProgress?.(85, 'Finalizing video...')

      // Finalize the streaming process
      await window.electronAPI.finalizeVideoRecording(processId)

      // Copy telemetry file if it exists (using the full output path)
      if (assFilePath) {
        onProgress?.(95, 'Copying telemetry file...')
        await window.electronAPI.copyTelemetryFile(assFilePath, videoSubtitlesFilename(outputPath))
      }

      // Clean up temporary extraction directory
      onProgress?.(98, 'Cleaning up...')
      await window.electronAPI.cleanupTempDir(tempDir)

      onProgress?.(100, 'Processing complete!')
      console.log(`ZIP processing complete: ${outputPath}`)

      return outputPath
    } catch (error) {
      console.error('Error processing ZIP file:', error)
      throw error
    }
  }
}
