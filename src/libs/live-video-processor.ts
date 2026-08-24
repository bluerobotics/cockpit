import { isElectron } from '@/libs/utils'
import { joinRecordingHead, maxRecordingHeadChunks, minimumRecordingHeadBytes } from '@/libs/video-recording-codec'
import { tempVideoStorage } from '@/libs/videoStorage'
import type { VideoChunkQueueItem, ZipExtractionResult } from '@/types/video'
import { videoChunkName, videoSubtitlesFilename } from '@/utils/video'

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
  private pendingHead: VideoChunkQueueItem[] = []

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
      throw new Error('Live video processing is only available in Cockpit standalone')
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
        const handedOver = await this.processChunk(nextChunk.blob, nextChunk.chunkNumber)
        this.lastProcessedChunk = nextChunk.chunkNumber
        // Only what FFmpeg has been given is safe to drop: a chunk still held back as part of the head is the
        // recording's only copy until the output file is started with it.
        for (const chunkNumber of handedOver) await this.deleteChunk(chunkNumber)
      } else {
        console.warn(`Expected chunk ${this.lastProcessedChunk + 1} but got ${nextChunk.chunkNumber}.`)

        if (this.chunkQueue.length > 5) {
          console.warn('Too many chunks in queue, skipping ahead to the next expected chunk.')
          this.lastProcessedChunk = this.lastProcessedChunk + 1
          await this.deleteChunk(this.lastProcessedChunk)
        }

        break
      }
    }
  }

  /**
   * Process a single video chunk
   * @param {Blob} chunkBlob - The video chunk to process
   * @param {number} chunkNumber - Sequential number of this chunk
   * @returns {Promise<number[]>} The chunks FFmpeg now holds, which are the ones safe to drop
   */
  private async processChunk(chunkBlob: Blob, chunkNumber: number): Promise<number[]> {
    if (this.concatProcess === null) {
      this.pendingHead.push({ blob: chunkBlob, chunkNumber })
      // The main process reads the recording's codec out of the Matroska header, and MediaRecorder can emit a
      // first chunk far too small to carry it — one of a single byte, splitting even the EBML magic — so the
      // start waits until enough of the head is in hand to be read.
      const headSize = this.pendingHead.reduce((total, item) => total + item.blob.size, 0)
      if (headSize < minimumRecordingHeadBytes && this.pendingHead.length < maxRecordingHeadChunks) return []

      return await this.startOutputFileWithHead()
    }

    try {
      // Subsequent chunks - append to existing file
      await this.appendChunkToOutput(chunkBlob, chunkNumber)
    } catch (error) {
      throw new LiveVideoProcessorChunkAppendingError(`Failed to append chunk ${chunkNumber}: ${error}`)
    }
    return [chunkNumber]
  }

  /**
   * Start the output file with the head gathered so far
   * @returns {Promise<number[]>} The chunks the head was made of, now in FFmpeg's hands
   */
  private async startOutputFileWithHead(): Promise<number[]> {
    const head = this.pendingHead
    try {
      console.log(`Initializing output file with the first ${head.length} chunk(s).`)
      await this.initializeOutputFile(new Blob(head.map((item) => item.blob)))
    } catch (error) {
      throw new LiveVideoProcessorInitializationError(`Failed to initialize output file: ${error}`)
    }
    // Cleared only once FFmpeg has the head, so a failed start leaves the chunks both buffered and stored
    this.pendingHead = []
    return head.map((item) => item.chunkNumber)
  }

  /**
   * Delete a video chunk
   * @param {number} chunkNumber - The number of the video chunk to delete
   */
  private async deleteChunk(chunkNumber: number): Promise<void> {
    if (this.keepRawVideoChunksAsBackup) return
    try {
      await tempVideoStorage.removeItem(videoChunkName(this.recordingHash, chunkNumber))
    } catch (error) {
      // The processed file is already written; failing to drop the raw chunk must not abort recording.
      console.warn(`Failed to delete raw chunk ${chunkNumber} after processing:`, error)
    }
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

      // A recording stopped before the head reached its threshold still has to be written out
      if (this.concatProcess === null && this.pendingHead.length > 0) {
        for (const chunkNumber of await this.startOutputFileWithHead()) await this.deleteChunk(chunkNumber)
      }

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
   * Process one or more ZIP files containing video chunks using the live streaming pipeline.
   * When multiple ZIPs are provided (e.g. the multi-part archives produced by the browser
   * version) they are extracted into a single temporary directory and all chunks are
   * processed together in chunk-number order, producing a single output video.
   * @param {string[]} zipFilePaths - Paths to the ZIP file(s); a single-element array is fine
   * @param {(progress: number, message: string) => void} onProgress - Optional progress callback
   * @returns {Promise<string>} Promise that resolves to the output video path
   */
  static async processZipFiles(
    zipFilePaths: string[],
    onProgress?: (progress: number, message: string) => void
  ): Promise<string> {
    if (!isElectron() || !window.electronAPI) {
      throw new Error('ZIP processing is only available in Cockpit standalone')
    }

    if (!zipFilePaths || zipFilePaths.length === 0) {
      throw new Error('No ZIP file paths provided')
    }

    try {
      onProgress?.(
        10,
        zipFilePaths.length > 1 ? `Extracting ${zipFilePaths.length} ZIP files...` : 'Extracting ZIP file...'
      )

      // Extract ZIP(s) and get chunk information
      const extractionResult: ZipExtractionResult = await window.electronAPI.extractVideoChunksZips(zipFilePaths)
      const { chunkPaths, assFilePath, hash, fileName, tempDir } = extractionResult

      console.log(`Extracted ${chunkPaths.length} chunks from ${zipFilePaths.length} ZIP file(s)`)
      onProgress?.(30, 'Starting video processing...')

      // Read the head, which is as many leading chunks as it takes to carry the Matroska header
      const { head: firstChunkBlob, consumed: headChunks } = await joinRecordingHead(async (index) => {
        if (index >= chunkPaths.length) return undefined
        return new Blob([new Uint8Array(await window.electronAPI!.readChunkFile(chunkPaths[index]))], {
          type: 'video/webm',
        })
      })

      // Start FFmpeg streaming process with that head (no backup needed since ZIP is the backup)
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
      for (let i = headChunks; i < chunkPaths.length; i++) {
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
