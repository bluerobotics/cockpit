import { spawn } from 'child_process'
import { ipcMain } from 'electron'
import { promises as fs } from 'fs'
import { createWriteStream } from 'fs'
import { tmpdir } from 'os'
import { basename, dirname, join } from 'path'
import { pipeline } from 'stream'
import { v4 as uuid } from 'uuid'
import * as yauzl from 'yauzl'
import * as yazl from 'yazl'

import type { LiveConcatProcessResult, LiveStreamProcess, ZipExtractionResult } from '@/types/video'

import { videoFilename, videoThumbnailFilename } from '../../utils/video'
import { getFFmpegPath } from './ffmpeg-path'
import { cockpitFolderPath, filesystemStorage } from './storage'

/**
 * Live video streaming service for Electron
 *
 * This service provides real-time video processing by streaming WebM chunks directly into FFmpeg
 * during recording. FFmpeg outputs a fragmented MP4 file that is always playable, even if the
 * process crashes mid-recording. This eliminates the need for post-processing finalization.
 *
 * Key features:
 * - Chunks are piped to FFmpeg stdin as they arrive
 * - Fragmented MP4 output (frag_keyframe + empty_moov) for crash-safety
 * - No re-encoding (copy codec only)
 * - File is playable at any point during recording
 */

const activeStreamProcesses = new Map<string, LiveStreamProcess>()

/**
 * Create a temporary directory for live video processing
 * @param {string} prefix - Prefix for the directory name
 * @returns {Promise<string>} Promise that resolves to the directory path
 */
const createTempDirectory = async (prefix: string): Promise<string> => {
  const tempDir = join(tmpdir(), `${prefix}_${uuid().slice(0, 8)}`)
  await fs.mkdir(tempDir, { recursive: true })
  return tempDir
}

/**
 * Write a blob to a file (via array buffer)
 * @param {Uint8Array} blobData - The blob data as Uint8Array
 * @param {string} filePath - Path where to write the file
 */
const writeBlobToFile = async (blobData: Uint8Array, filePath: string): Promise<void> => {
  await fs.mkdir(dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, blobData)
}

/**
 * Start a live video streaming process with FFmpeg
 * @param {Uint8Array} firstChunkData - The first video chunk data
 * @param {string} recordingHash - Unique identifier for this recording
 * @param {string} fileName - The name of the video file
 * @param {boolean} keepChunkBackup - Whether to keep raw chunks as backup (default: true)
 * @returns {Promise<LiveConcatProcessResult>} Promise that resolves to the process information
 */
const startVideoRecording = async (
  firstChunkData: Uint8Array,
  recordingHash: string,
  fileName: string,
  keepChunkBackup = true
): Promise<LiveConcatProcessResult> => {
  const processId = uuid()

  // Create temporary directory for chunk backups (if enabled)
  const tempDir = await createTempDirectory(`cockpit_video_recording_${recordingHash}`)

  // Get video folder path and construct output path
  const videosPath = join(cockpitFolderPath, 'videos')
  await fs.mkdir(videosPath, { recursive: true })

  // Output directly as MP4 with fragmented format
  const outputPath = join(videosPath, fileName)

  console.log(`Starting live FFmpeg streaming process ${processId}`)
  console.log(`Output path: ${outputPath}`)

  // Spawn FFmpeg with stdin input and fragmented MP4 output
  const ffmpegArgs = [
    '-f',
    'webm', // Input format is WebM
    '-i',
    'pipe:0', // Read from stdin
    '-c:v',
    'copy', // Copy video codec (no re-encoding)
    '-c:a',
    'copy', // Copy audio codec (no re-encoding)
    '-movflags',
    'frag_keyframe+empty_moov+default_base_moof', // Fragmented MP4 for crash-safety
    '-fflags',
    '+genpts', // Generate presentation timestamps
    '-f',
    'mp4', // Force MP4 output format
    '-y', // Overwrite output file if exists
    outputPath,
  ]

  const ffmpegPath = getFFmpegPath()
  const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs)

  // Handle FFmpeg stderr output (for debugging)
  ffmpegProcess.stderr?.on('data', (data) => {
    const output = data.toString().trim()
    // Filter out common/expected warnings to reduce log noise
    if (
      !output.includes('frame=') &&
      !output.includes('size=') &&
      !output.includes('time=') &&
      !output.includes('bitrate=')
    ) {
      console.log(`FFmpeg (${processId}):`, output)
    }
  })

  // Handle FFmpeg process errors
  ffmpegProcess.on('error', (error) => {
    console.error(`FFmpeg process error (${processId}):`, error)
    activeStreamProcesses.delete(processId)
  })

  // Handle FFmpeg process exit
  ffmpegProcess.on('close', (code, signal) => {
    console.log(`FFmpeg process ${processId} closed with code ${code}, signal ${signal}`)
    activeStreamProcesses.delete(processId)
  })

  // Save first chunk as backup if enabled
  if (keepChunkBackup) {
    const firstChunkPath = join(tempDir, 'chunk_0000.webm')
    await writeBlobToFile(firstChunkData, firstChunkPath)
  }

  // Write first chunk to FFmpeg stdin
  if (ffmpegProcess.stdin) {
    ffmpegProcess.stdin.write(Buffer.from(firstChunkData), (err) => {
      if (err) {
        console.error(`Failed to write first chunk to FFmpeg stdin (${processId}):`, err)
      }
    })
  } else {
    throw new Error(`FFmpeg stdin not available for process ${processId}`)
  }

  // Store process information
  const streamProcess: LiveStreamProcess = {
    id: processId,
    ffmpegProcess,
    outputPath,
    tempDir,
    isFinalized: false,
    chunkBackupEnabled: keepChunkBackup,
  }

  activeStreamProcesses.set(processId, streamProcess)

  return { id: processId, outputPath }
}

/**
 * Append a chunk to an active live streaming process
 * @param {string} processId - ID of the active streaming process
 * @param {Uint8Array} chunkData - The chunk data to append
 * @param {number} chunkNumber - Sequential number of this chunk
 */
const appendChunkToVideoRecording = async (
  processId: string,
  chunkData: Uint8Array,
  chunkNumber: number
): Promise<void> => {
  const process = activeStreamProcesses.get(processId)
  if (!process || process.isFinalized) {
    throw new Error(`Live stream process ${processId} not found or already finalized`)
  }

  try {
    // Save chunk as backup if enabled
    if (process.chunkBackupEnabled) {
      const chunkPath = join(process.tempDir, `chunk_${chunkNumber.toString().padStart(4, '0')}.webm`)
      await writeBlobToFile(chunkData, chunkPath)
    }

    // Write chunk directly to FFmpeg stdin
    if (process.ffmpegProcess.stdin && !process.ffmpegProcess.stdin.destroyed) {
      return new Promise((resolve, reject) => {
        process.ffmpegProcess.stdin!.write(Buffer.from(chunkData), (err) => {
          if (err) {
            // Check if error is EPIPE (FFmpeg exited)
            if (err.message.includes('EPIPE')) {
              console.error(`FFmpeg process ${processId} has exited, cannot write chunk ${chunkNumber}`)
              reject(new Error(`FFmpeg process exited unexpectedly`))
            } else {
              console.error(`Failed to write chunk ${chunkNumber} to FFmpeg stdin (${processId}):`, err)
              reject(err)
            }
          } else {
            resolve()
          }
        })
      })
    } else {
      throw new Error(`FFmpeg stdin not available or destroyed for process ${processId}`)
    }
  } catch (error) {
    console.error(`Failed to append chunk to live stream process ${processId}:`, error)
    throw error
  }
}

/**
 * Finalize a live video streaming process by closing FFmpeg stdin
 * @param {string} processId - ID of the streaming process to finalize
 */
const finalizeVideoRecording = async (processId: string): Promise<void> => {
  const process = activeStreamProcesses.get(processId)
  if (!process) {
    throw new Error(`Live stream process ${processId} not found`)
  }

  if (process.isFinalized) {
    return // Already finalized
  }

  process.isFinalized = true

  try {
    console.log(`Finalizing live stream process ${processId}`)

    // Close FFmpeg stdin to signal end of input
    if (process.ffmpegProcess.stdin && !process.ffmpegProcess.stdin.destroyed) {
      process.ffmpegProcess.stdin.end()
      console.log(`Closed FFmpeg stdin for process ${processId}`)
    }

    // Wait for FFmpeg to finish processing
    return new Promise((resolve, reject) => {
      const timeoutMs = 60000 // 1 minute timeout for finalization

      const timeout = setTimeout(() => {
        if (process.ffmpegProcess.killed || process.ffmpegProcess.exitCode !== null) return

        console.error(`FFmpeg finalization timeout for process ${processId}`)
        try {
          process.ffmpegProcess.kill('SIGKILL')
        } catch {
          // Process already dead
        }
        activeStreamProcesses.delete(processId)
        reject(new Error('FFmpeg finalization timed out'))
      }, timeoutMs)

      process.ffmpegProcess.on('close', async (code, signal) => {
        clearTimeout(timeout)

        if (code === 0) {
          console.log(`FFmpeg process ${processId} completed successfully`)

          // Generate thumbnail from the final MP4 file
          try {
            const videoFileName = basename(process.outputPath)
            const thumbnailFileName = videoThumbnailFilename(videoFileName)
            const tempThumbnailPath = join(dirname(process.outputPath), `temp_${thumbnailFileName}`)

            console.log(`Generating thumbnail for ${videoFileName}...`)
            await generateThumbnailFromMP4(process.outputPath, tempThumbnailPath, 1)

            // Read the generated thumbnail and store it in the database
            const thumbnailBuffer = await fs.readFile(tempThumbnailPath)

            // Store thumbnail in the video storage database
            await filesystemStorage.setItem(thumbnailFileName, thumbnailBuffer as any, ['videos'])

            // Clean up temporary thumbnail file
            await fs.unlink(tempThumbnailPath)

            console.log(`Thumbnail generated and stored: ${thumbnailFileName}`)
          } catch (thumbnailError) {
            console.warn(`Failed to generate thumbnail for ${processId}:`, thumbnailError)
            // Don't fail the entire process if thumbnail generation fails
          }

          activeStreamProcesses.delete(processId)
          resolve()
        } else {
          console.error(`FFmpeg process ${processId} exited with code ${code}, signal ${signal}`)
          activeStreamProcesses.delete(processId)

          // Check if the file exists and is valid despite the error code
          try {
            const stats = await fs.stat(process.outputPath)
            if (stats.size > 0) {
              console.log(`Output file exists (${stats.size} bytes), treating as partial success`)
              resolve()
            } else {
              reject(new Error(`FFmpeg failed with exit code ${code}`))
            }
          } catch {
            reject(new Error(`FFmpeg failed with exit code ${code}`))
          }
        }
      })

      process.ffmpegProcess.on('error', (error) => {
        clearTimeout(timeout)
        console.error(`FFmpeg process error during finalization (${processId}):`, error)
        activeStreamProcesses.delete(processId)
        reject(error)
      })
    })
  } catch (error) {
    console.error(`Error finalizing live stream process ${processId}:`, error)
    activeStreamProcesses.delete(processId)
    throw error
  }
}

/**
 * Extract ZIP file and return information about video chunks and telemetry
 * @param {string} zipFilePath - Path to the ZIP file
 * @returns {Promise<ZipExtractionResult>} Information about extracted chunks
 */
const extractVideoChunksZip = async (zipFilePath: string): Promise<ZipExtractionResult> => {
  console.debug(`Extracting ZIP file '${zipFilePath}'`)

  if (!zipFilePath) {
    throw new Error('zipFilePath is undefined or empty')
  }

  // Create temporary directory for extraction
  const tempDir = await createTempDirectory('zip-extraction')
  const extractPath = join(tempDir, 'extracted')
  await fs.mkdir(extractPath, { recursive: true })

  const extractedFiles: string[] = []

  // Extract ZIP file using yauzl
  await new Promise<void>((resolve, reject) => {
    yauzl.open(zipFilePath, { lazyEntries: true }, (openErr, zipfile) => {
      if (openErr || !zipfile) {
        reject(openErr || new Error('Failed to open ZIP file'))
        return
      }

      zipfile.readEntry()
      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) {
          // Directory entry - skip
          zipfile.readEntry()
          return
        }

        zipfile.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr || !readStream) {
            reject(streamErr || new Error('Failed to open read stream'))
            return
          }

          const outputPath = join(extractPath, entry.fileName)

          fs.mkdir(dirname(outputPath), { recursive: true })
            .then(() => {
              const writeStream = createWriteStream(outputPath)

              pipeline(readStream, writeStream, (pipeErr) => {
                if (pipeErr) {
                  reject(pipeErr)
                  return
                }

                // Preserve timestamps
                if (entry.getLastModDate) {
                  const lastModDate = entry.getLastModDate()
                  fs.utimes(outputPath, lastModDate, lastModDate).catch(() => {
                    // Ignore timestamp errors
                  })
                }

                extractedFiles.push(outputPath)
                zipfile.readEntry()
              })
            })
            .catch(reject)
        })
      })

      zipfile.on('end', () => resolve())
      zipfile.on('error', reject)
    })
  })

  // Find video chunks (WebM files)
  const chunkFiles = extractedFiles
    .filter((file) => {
      const fileName = basename(file)
      return fileName.endsWith('.webm') || /^[a-f0-9]+_\d+/.test(fileName) || /chunk_\d+/.test(fileName)
    })
    .sort((a, b) => {
      const aFileName = basename(a)
      const bFileName = basename(b)

      // Extract chunk numbers from filenames like "hash_0", "hash_1", etc.
      const aMatch = aFileName.match(/_(\d+)/)
      const bMatch = bFileName.match(/_(\d+)/)

      if (aMatch && bMatch) {
        return parseInt(aMatch[1], 10) - parseInt(bMatch[1], 10)
      }

      return aFileName.localeCompare(bFileName)
    })

  // Filter valid chunks (non-empty files)
  const validChunks: string[] = []
  for (const file of chunkFiles) {
    try {
      const stats = await fs.stat(file)
      if (stats.size > 0) {
        validChunks.push(file)
      }
    } catch {
      // Skip missing files
    }
  }

  if (validChunks.length === 0) {
    throw new Error('No valid video chunks found in ZIP file')
  }

  // Find .ass telemetry file
  const assFile = extractedFiles.find((file) => basename(file).endsWith('.ass'))

  // Extract metadata from first chunk
  const firstChunkBaseName = basename(validChunks[0])
  const hashMatch = firstChunkBaseName.match(/^([a-f0-9]+)_/)
  const hash = hashMatch ? hashMatch[1] : uuid().slice(0, 8)

  // Get creation date
  let creationDate: Date
  try {
    const stats = await fs.stat(validChunks[0])
    creationDate = stats.birthtime || stats.mtime
  } catch {
    creationDate = new Date()
  }

  // Generate filename
  const fileName = videoFilename(hash, creationDate)

  return {
    chunkPaths: validChunks,
    assFilePath: assFile,
    hash,
    fileName,
    tempDir,
  }
}

/**
 * Copy telemetry file to video output directory
 * @param {string} originAssFilePath - Path to the .ass file
 * @param {string} destAssFilePath - Path where to put the ass file
 */
const copyTelemetryFile = async (originAssFilePath: string, destAssFilePath: string): Promise<void> => {
  try {
    await fs.copyFile(originAssFilePath, destAssFilePath)
    console.log(`Copied telemetry file to '${destAssFilePath}'.`)
  } catch (error) {
    console.warn(`Failed to copy telemetry file:`, error)
  }
}

/**
 * Generate a thumbnail from an MP4 video file using FFmpeg
 * @param {string} videoPath - Path to the MP4 video file
 * @param {string} outputPath - Path where the thumbnail should be saved
 * @param {number} timeOffset - Time offset in seconds for thumbnail extraction (default: 1 second)
 */
const generateThumbnailFromMP4 = async (videoPath: string, outputPath: string, timeOffset = 1): Promise<void> => {
  return new Promise((resolve, reject) => {
    const ffmpegArgs = [
      '-i',
      videoPath,
      '-ss',
      timeOffset.toString(), // Seek to specified time
      '-vframes',
      '1', // Extract only 1 frame
      '-vf',
      'scale=660:370', // Scale to thumbnail size (matches extractThumbnailFromVideo)
      '-q:v',
      '2', // High quality
      '-y', // Overwrite output file
      outputPath,
    ]

    const ffmpegPath = getFFmpegPath()
    const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs)

    ffmpegProcess.stderr.on('data', (data) => {
      const output = data.toString().trim()
      // Only log significant errors, filter out common warnings
      if (output.includes('error') || output.includes('Error') || output.includes('failed')) {
        console.warn(`FFmpeg thumbnail warning: ${output}`)
      }
    })

    ffmpegProcess.on('error', (error) => {
      console.error(`FFmpeg thumbnail generation error:`, error)
      reject(new Error(`Failed to generate thumbnail: ${error.message}`))
    })

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`Thumbnail generated successfully: ${outputPath}`)
        resolve()
      } else {
        console.error(`FFmpeg failed to generate thumbnail (exit code: ${code})`)
        reject(new Error(`FFmpeg thumbnail generation failed (exit code: ${code})`))
      }
    })

    // Set timeout for thumbnail generation
    setTimeout(() => {
      if (ffmpegProcess.killed || ffmpegProcess.exitCode !== null) return

      try {
        ffmpegProcess.kill(0) // SIGKILL
      } catch {
        return
      }

      // If we got here, it means the process is still running
      console.error(`Thumbnail generation timeout for ${videoPath}`)
      reject(new Error('Thumbnail generation timeout'))
    }, 300000) // 5 minutes timeout for thumbnail generation
  })
}

/**
 * Create a ZIP file containing video chunks and telemetry file
 * @param {string} hash - The hash identifier for the chunk group
 * @returns {Promise<string>} Path to the created ZIP file
 */
const createVideoChunksZip = async (hash: string): Promise<string> => {
  console.debug(`Creating ZIP file for chunk group ${hash}`)

  // Find all chunk files for this hash
  const tempChunksPath = join(cockpitFolderPath, 'videos', 'temporary-video-chunks')

  let chunkFiles: string[] = []
  try {
    const allFiles = await fs.readdir(tempChunksPath)
    chunkFiles = allFiles
      .filter((file) => file.includes(hash))
      .sort((a, b) => {
        // Extract chunk numbers from filenames like "hash_0", "hash_1", etc.
        const aMatch = a.match(/_(\d+)/)
        const bMatch = b.match(/_(\d+)/)

        if (aMatch && bMatch) {
          return parseInt(aMatch[1], 10) - parseInt(bMatch[1], 10)
        }

        return a.localeCompare(b)
      })
  } catch (error) {
    console.error(`Failed to read temporary chunks directory:`, error)
    throw new Error('Failed to access temporary chunks directory')
  }

  if (chunkFiles.length === 0) {
    throw new Error(`No chunks found for hash ${hash}`)
  }

  console.debug(`Found ${chunkFiles.length} chunks for hash ${hash}`)

  // Find .ass telemetry file
  let assFileName: string | null = null
  try {
    const videoKeys = await filesystemStorage.keys(['videos'])
    assFileName = videoKeys.find((key) => key.includes(hash) && key.endsWith('.ass')) || null
  } catch (error) {
    console.warn(`Failed to find .ass file for hash ${hash}:`, error)
  }

  // Generate default filename based on creation date
  let defaultFileName = `chunks_${hash}`
  try {
    const firstChunkPath = join(tempChunksPath, chunkFiles[0])
    const stats = await fs.stat(firstChunkPath)
    const creationDate = stats.birthtime || stats.mtime
    defaultFileName = videoFilename(hash, creationDate)
  } catch (error) {
    console.warn(`Failed to get creation date, using default filename:`, error)
  }

  // Generate ZIP filename
  const tempChunksFolderPath = join(cockpitFolderPath, 'videos', 'temporary-video-chunks')
  const zipFilename = `${defaultFileName}.zip`
  const zipFilePath = join(tempChunksFolderPath, zipFilename)

  return new Promise((resolve, reject) => {
    const zipfile = new yazl.ZipFile()

    // Set up the output stream
    const outputStream = createWriteStream(zipFilePath)

    zipfile.outputStream.pipe(outputStream)

    let completedChunks = 0
    let assFileProcessed = false
    const totalChunks = chunkFiles.length

    // Function to check if all processing is complete
    const checkComplete = (): void => {
      const allChunksProcessed = completedChunks >= totalChunks
      const assFileDone = !assFileName || assFileProcessed

      if (allChunksProcessed && assFileDone) {
        zipfile.end()
      }
    }

    // Add video chunks to ZIP
    chunkFiles.forEach((chunkFile) => {
      const chunkPath = join(tempChunksPath, chunkFile)

      // Check if chunk file exists and get its stats
      fs.access(chunkPath)
        .then(() => fs.stat(chunkPath))
        .then((stats) => {
          zipfile.addFile(chunkPath, chunkFile, {
            mtime: stats.mtime,
          })
          console.debug(`Added chunk ${chunkFile} to ZIP`)
        })
        .catch((error) => {
          console.error(`Failed to add chunk ${chunkFile} to ZIP:`, error)
        })
        .finally(() => {
          completedChunks++
          checkComplete()
        })
    })

    // Add .ass telemetry file if found - ALWAYS process this regardless of chunk failures
    if (assFileName) {
      const assFilePath = join(cockpitFolderPath, 'videos', assFileName)

      fs.access(assFilePath)
        .then(() => fs.stat(assFilePath))
        .then((stats) => {
          zipfile.addFile(assFilePath, assFileName, {
            mtime: stats.mtime,
          })
          console.debug(`Added .ass file ${assFileName} to ZIP`)
        })
        .catch((error) => {
          console.warn(`Failed to add .ass file ${assFileName} to ZIP:`, error)
        })
        .finally(() => {
          assFileProcessed = true
          checkComplete()
        })
    } else {
      // No .ass file to process, mark as done
      assFileProcessed = true
      checkComplete()
    }

    // Handle ZIP completion
    outputStream.on('close', () => {
      console.debug(`ZIP file created successfully: ${zipFilePath}`)
      resolve(zipFilePath)
    })

    outputStream.on('error', (error) => {
      console.error('Error creating ZIP file:', error)
      reject(error)
    })

    zipfile.on('error', (error: Error) => {
      console.error('ZIP file error:', error)
      reject(error)
    })
  })
}

/**
 * Setup live video IPC handlers for Electron main process
 */
export const setupVideoRecordingService = (): void => {
  /**
   * Start live video streaming with FFmpeg
   */
  ipcMain.handle(
    'start-video-recording',
    async (_, firstChunkData: Uint8Array, recordingHash: string, fileName: string, keepChunkBackup?: boolean) => {
      try {
        const result = await startVideoRecording(firstChunkData, recordingHash, fileName, keepChunkBackup)
        return result
      } catch (error) {
        console.error('Error starting live video streaming:', error)
        throw error
      }
    }
  )

  /**
   * Append chunk to live video stream (pipes to FFmpeg stdin)
   */
  ipcMain.handle(
    'append-chunk-to-video-recording',
    async (_, processId: string, chunkData: Uint8Array, chunkNumber: number) => {
      try {
        await appendChunkToVideoRecording(processId, chunkData, chunkNumber)
      } catch (error) {
        console.error('Error appending chunk to live video stream:', error)
        throw error
      }
    }
  )

  /**
   * Finalize live video streaming by closing FFmpeg stdin
   */
  ipcMain.handle('finalize-video-recording', async (_, processId: string) => {
    try {
      await finalizeVideoRecording(processId)
    } catch (error) {
      console.error('Error finalizing live video stream:', error)
      throw error
    }
  })

  /**
   * Extract video chunks from ZIP file
   */
  ipcMain.handle('extract-video-chunks-zip', async (_, zipFilePath: string) => {
    try {
      return await extractVideoChunksZip(zipFilePath)
    } catch (error) {
      console.error('Error extracting video chunks from ZIP:', error)
      throw error
    }
  })

  /**
   * Read chunk file and return as Uint8Array
   */
  ipcMain.handle('read-chunk-file', async (_, chunkPath: string) => {
    try {
      const data = await fs.readFile(chunkPath)
      return new Uint8Array(data)
    } catch (error) {
      console.error('Error reading chunk file:', error)
      throw error
    }
  })

  /**
   * Copy telemetry file to video directory
   */
  ipcMain.handle('copy-telemetry-file', async (_, assFilePath: string, outputVideoPath: string) => {
    try {
      await copyTelemetryFile(assFilePath, outputVideoPath)
    } catch (error) {
      console.error('Error copying telemetry file:', error)
      throw error
    }
  })

  /**
   * Clean up temporary directory
   */
  ipcMain.handle('cleanup-temp-dir', async (_, tempDir: string) => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
      console.log(`Cleaned up temp directory: ${tempDir}`)
    } catch (error) {
      console.warn('Error cleaning up temp directory:', error)
    }
  })

  /**
   * Create a ZIP file containing video chunks and telemetry
   */
  ipcMain.handle('create-video-chunks-zip', async (_, hash: string) => {
    try {
      const zipFilePath = await createVideoChunksZip(hash)
      return zipFilePath
    } catch (error) {
      console.error('Error creating video chunks ZIP:', error)
      throw error
    }
  })
}
