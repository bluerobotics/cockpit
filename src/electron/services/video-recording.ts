import { type ChildProcess, spawn } from 'child_process'
import { ipcMain } from 'electron'
import { promises as fs } from 'fs'
import { createWriteStream } from 'fs'
import { constants as osConstants, setPriority, tmpdir } from 'os'
import { basename, dirname, isAbsolute, join } from 'path'
import { pipeline } from 'stream'
import { v4 as uuid } from 'uuid'
import * as yauzl from 'yauzl'
import * as yazl from 'yazl'

import type {
  LiveConcatProcessResult,
  LiveStreamProcess,
  SegmentStreamInfo,
  VideoRecordingFinalizationResult,
  ZipExtractionResult,
} from '@/types/video'

import { messageFromError } from '../../libs/utils'
import {
  isWebmStreamStart,
  videoFilename,
  videoSegmentFilename,
  videoSegmentSubFolders,
  videoThumbnailFilename,
} from '../../utils/video'
import { getFFmpegPath } from './ffmpeg-path'
import { filesystemStorage, getCockpitFolderPath } from './storage'

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
 * Spawn the FFmpeg process that muxes one segment of a recording
 * @param {string} processId - ID of the streaming process the segment belongs to
 * @param {string} segmentPath - Path the segment is written to
 * @returns {ChildProcess} The spawned FFmpeg process
 */
const spawnSegmentProcess = (processId: string, segmentPath: string): ChildProcess => {
  // Spawn FFmpeg with stdin input and fragmented MP4 output
  const ffmpegArgs = [
    '-probesize',
    '100M', // 100MB to find decoding info
    '-analyzeduration',
    '15M', // 15 seconds to find decoding info
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
    segmentPath,
  ]

  const ffmpegProcess = spawn(getFFmpegPath(), ffmpegArgs)

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
  })

  // Handle FFmpeg process exit
  ffmpegProcess.on('close', (code, signal) => {
    console.log(`FFmpeg process ${processId} closed with code ${code}, signal ${signal}`)
  })

  return ffmpegProcess
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
  const videosPath = join(getCockpitFolderPath(), 'videos')
  await fs.mkdir(videosPath, { recursive: true })

  // Output directly as MP4 with fragmented format
  const outputPath = join(videosPath, fileName)

  console.log(`Starting live FFmpeg streaming process ${processId}`)
  console.log(`Output path: ${outputPath}`)

  const ffmpegProcess = spawnSegmentProcess(processId, outputPath)

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
    fileName,
    segmentPaths: [outputPath],
    tempDir,
    isFinalized: false,
    chunkBackupEnabled: keepChunkBackup,
  }

  activeStreamProcesses.set(processId, streamProcess)

  return { id: processId, outputPath }
}

/**
 * Wait for the FFmpeg process of a segment to write it out and exit
 * @param {LiveStreamProcess} process - The streaming process whose current segment is ending
 * @returns {Promise<void>} Promise that resolves once the segment is on disk
 */
const waitForSegmentToFinish = (process: LiveStreamProcess): Promise<void> => {
  const { id: processId, ffmpegProcess } = process
  const segmentPath = process.segmentPaths[process.segmentPaths.length - 1]

  if (ffmpegProcess.stdin && !ffmpegProcess.stdin.destroyed) {
    ffmpegProcess.stdin.end()
    console.log(`Closed FFmpeg stdin for process ${processId}`)
  }

  // An FFmpeg that already died fires no further close event, so nothing would resolve the wait below
  if (ffmpegProcess.exitCode !== null || ffmpegProcess.signalCode !== null) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (ffmpegProcess.killed || ffmpegProcess.exitCode !== null) return

      console.error(`FFmpeg finalization timeout for process ${processId}`)
      try {
        ffmpegProcess.kill('SIGKILL')
      } catch {
        // Process already dead
      }
      reject(new Error('FFmpeg finalization timed out'))
    }, 60000)

    ffmpegProcess.on('close', async (code, signal) => {
      clearTimeout(timeout)

      if (code === 0) {
        console.log(`FFmpeg process ${processId} completed successfully`)
        resolve()
        return
      }

      console.error(`FFmpeg process ${processId} exited with code ${code}, signal ${signal}`)

      // Check if the file exists and is valid despite the error code
      try {
        const stats = await fs.stat(segmentPath)
        if (stats.size > 0) {
          console.log(`Output file exists (${stats.size} bytes), treating as partial success`)
          resolve()
        } else {
          reject(new Error(`FFmpeg failed with exit code ${code}`))
        }
      } catch {
        reject(new Error(`FFmpeg failed with exit code ${code}`))
      }
    })

    ffmpegProcess.on('error', (error) => {
      clearTimeout(timeout)
      console.error(`FFmpeg process error during finalization (${processId}):`, error)
      reject(error)
    })
  })
}

/**
 * Close the segment being written and start the next one, for a recording whose chunks restart the WebM
 * stream halfway through. A single FFmpeg cannot mux both: the new stream carries its own header and
 * restarts its cluster timecodes, so the segments are muxed apart and joined when the recording ends.
 * @param {LiveStreamProcess} process - The streaming process to rotate
 */
const startNextSegment = async (process: LiveStreamProcess): Promise<void> => {
  const finishedSegmentPath = process.segmentPaths[process.segmentPaths.length - 1]

  try {
    await waitForSegmentToFinish(process)
  } catch (error) {
    // Whatever that segment holds is all it will ever hold, and the recording still has to carry on
    console.error(`Segment '${finishedSegmentPath}' of process ${process.id} did not finish cleanly:`, error)
  }

  const segmentIndex = process.segmentPaths.length
  const segmentFolder = join(getCockpitFolderPath(), ...videoSegmentSubFolders(segmentIndex))
  await fs.mkdir(segmentFolder, { recursive: true })

  // The recording can be finalized while its segment is being flushed, and a segment spawned after that would
  // be written by an FFmpeg nothing can reach, into a file no join will ever read
  if (process.isFinalized) return

  const segmentPath = join(segmentFolder, videoSegmentFilename(process.fileName, segmentIndex))
  console.log(`Recording of process ${process.id} continues in segment '${segmentPath}'`)

  process.ffmpegProcess = spawnSegmentProcess(process.id, segmentPath)
  process.segmentPaths.push(segmentPath)
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

    const opensItsOwnStream = chunkNumber > 0 && isWebmStreamStart(chunkData)

    // A dead FFmpeg takes only its own segment down, so its chunks are dropped until one opens a new WebM stream
    const { exitCode, signalCode } = process.ffmpegProcess
    if ((exitCode !== null || signalCode !== null) && !opensItsOwnStream) {
      console.warn(`Dropping chunk ${chunkNumber} of process ${processId}: its segment is no longer being written.`)
      return
    }

    // A chunk opening a WebM stream of its own comes from a recorder that replaced the one before it
    if (opensItsOwnStream) {
      await startNextSegment(process)
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
 * Read the video stream a segment holds, so segments are only joined without re-encoding when they
 * actually match. FFmpeg reports it on stderr and exits non-zero for want of an output, which is why
 * the exit code is ignored here.
 * @param {string} segmentPath - Path to the segment to inspect
 * @returns {Promise<SegmentStreamInfo | null>} What the segment holds, or null when it cannot be read
 */
const probeSegment = (segmentPath: string): Promise<SegmentStreamInfo | null> => {
  return new Promise((resolve) => {
    const ffmpegProcess = spawn(getFFmpegPath(), ['-hide_banner', '-i', segmentPath])

    let report = ''
    ffmpegProcess.stderr.on('data', (data) => (report += data.toString()))

    // Only catches an FFmpeg hung on a half-written segment, which would hold the recording in 'still being saved'
    const timeout = setTimeout(() => ffmpegProcess.kill('SIGKILL'), 30 * 1000)

    ffmpegProcess.on('error', (error) => {
      clearTimeout(timeout)
      console.warn(`Could not inspect segment '${segmentPath}':`, error)
      resolve(null)
    })

    ffmpegProcess.on('close', () => {
      clearTimeout(timeout)
      // The dimensions are the only WxH on the video stream's line, as the codec tag next to them is hexadecimal
      const videoLine = report.split('\n').find((line) => line.includes('Video:'))
      const dimensions = videoLine?.match(/(\d{2,5})x(\d{2,5})/)
      const codec = videoLine?.match(/Video: (\w+)/)
      if (!dimensions || !codec) {
        console.warn(`Segment '${segmentPath}' reported no video stream.`)
        resolve(null)
        return
      }

      resolve({
        codec: codec[1],
        width: parseInt(dimensions[1], 10),
        height: parseInt(dimensions[2], 10),
        hasAudio: report.includes('Audio:'),
      })
    })
  })
}

/**
 * Run an FFmpeg join and wait for it, leaving every input untouched when it fails
 * @param {string[]} args - Arguments for the join
 * @param {string} joinedPath - Path the join writes to
 * @returns {Promise<void>} Promise that resolves once the joined file is written
 */
const runSegmentJoin = (args: string[], joinedPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const ffmpegProcess = spawn(getFFmpegPath(), args)

    // A join can re-encode the whole take while the pilot is still flying on the live video
    try {
      if (ffmpegProcess.pid !== undefined) setPriority(ffmpegProcess.pid, osConstants.priority.PRIORITY_LOW)
    } catch (error) {
      console.warn('Could not lower the priority of the segment join:', error)
    }

    // FFmpeg reports its progress on stderr as it goes, so only one that has gone quiet is taken as hung
    let hung = false
    let timeout: ReturnType<typeof setTimeout> | undefined
    const restartHangTimer = (): void => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        if (ffmpegProcess.exitCode !== null) return
        hung = true
        try {
          ffmpegProcess.kill('SIGKILL')
        } catch {
          // Process already dead
        }
      }, 5 * 60 * 1000)
    }
    restartHangTimer()

    let lastReport = ''
    ffmpegProcess.stderr.on('data', (data) => {
      lastReport = data.toString().trim()
      restartHangTimer()
    })

    ffmpegProcess.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })

    ffmpegProcess.on('close', async (code) => {
      clearTimeout(timeout)
      if (code === 0) {
        resolve()
        return
      }
      await fs.rm(joinedPath, { force: true })
      const cause = hung ? 'it stopped making progress' : `exit code ${code}: ${lastReport}`
      reject(new Error(`FFmpeg failed to join the recording's segments (${cause}).`))
    })
  })
}

/**
 * Build the FFmpeg arguments that re-encode a recording's segments into a single file, scaling each of them
 * to the recording's own frame so that segments the camera renegotiated still line up
 * @param {string[]} segmentPaths - Paths of the segments to join, in order
 * @param {SegmentStreamInfo} target - What the joined recording holds, taken from its first segment
 * @param {boolean} withAudio - Whether the joined recording carries audio
 * @param {string} joinedPath - Path to write the joined recording to
 * @returns {string[]} The arguments to run FFmpeg with
 */
const reencodingJoinArgs = (
  segmentPaths: string[],
  target: SegmentStreamInfo,
  withAudio: boolean,
  joinedPath: string
): string[] => {
  const { width, height } = target
  const scaled = segmentPaths
    .map((_, index) => {
      const fit = `scale=${width}:${height}:force_original_aspect_ratio=decrease`
      const pad = `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`
      const audio = withAudio ? `[${index}:a]aresample=async=1[a${index}];` : ''
      return `[${index}:v]${fit},${pad},setsar=1[v${index}];${audio}`
    })
    .join('')
  const joined = segmentPaths.map((_, index) => (withAudio ? `[v${index}][a${index}]` : `[v${index}]`)).join('')
  const concat = `concat=n=${segmentPaths.length}:v=1:a=${withAudio ? 1 : 0}`

  return [
    ...segmentPaths.flatMap((segmentPath) => ['-i', segmentPath]),
    '-filter_complex',
    `${scaled}${joined}${concat}${withAudio ? '[outv][outa]' : '[outv]'}`,
    '-map',
    '[outv]',
    ...(withAudio ? ['-map', '[outa]', '-c:a', 'aac'] : []),
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-y',
    joinedPath,
  ]
}

/**
 * Join the segments a recording was muxed into, leaving the recording as the single file it would have
 * been without the video outages that cut it. Segments that match are stream-copied; a segment the
 * camera renegotiated to another resolution or codec is re-encoded to match the first one, which no
 * copy could join. The joined segments are only deleted once the joined file is in place, and the
 * unreadable ones are kept for recovery.
 * @param {LiveStreamProcess} process - The streaming process whose segments are to be joined
 * @returns {Promise<VideoRecordingFinalizationResult>} How the recording was put together
 */
const joinSegments = async (process: LiveStreamProcess): Promise<VideoRecordingFinalizationResult> => {
  const { segmentPaths, outputPath } = process
  if (segmentPaths.length === 1) {
    return { segmentsJoined: 1, reencoded: false, audioDropped: false, segmentsLost: 0 }
  }

  // One at a time, as a link that kept flapping leaves a recording in as many segments as it had outages
  const streams: (SegmentStreamInfo | null)[] = []
  for (const segmentPath of segmentPaths) {
    streams.push(await probeSegment(segmentPath))
  }

  const [firstStream] = streams
  if (!firstStream) {
    throw new Error(`Could not read the recording's first segment, so its segments were left unjoined.`)
  }

  // An unreadable segment is left out rather than failing the join of the readable ones
  const joinable = segmentPaths.filter((_, index) => streams[index] !== null)
  const joinableStreams = streams.filter((stream): stream is SegmentStreamInfo => stream !== null)
  const segmentsLost = segmentPaths.length - joinable.length

  const sameVideo = (stream: SegmentStreamInfo): boolean =>
    stream.codec === firstStream.codec && stream.width === firstStream.width && stream.height === firstStream.height
  const sameAudio = (stream: SegmentStreamInfo): boolean => stream.hasAudio === firstStream.hasAudio

  // Segments that disagree cannot be stream-copied together, and the audio is dropped when it is what differs
  const audioDropped = !joinableStreams.every(sameAudio)
  const reencoded = audioDropped || !joinableStreams.every(sameVideo)
  const withAudio = firstStream.hasAudio && !audioDropped

  // Written beside the segments, so a join never leaves a half-written file where the library lists videos
  const segmentsFolder = dirname(segmentPaths[1])
  if (joinable.length === 1) {
    return { segmentsJoined: 1, reencoded: false, audioDropped: false, segmentsLost }
  }

  const joinedPath = join(segmentsFolder, `joining_${process.fileName}`)

  let joinArgs: string[]
  let listPath: string | undefined

  if (reencoded) {
    console.log(`Segments of process ${process.id} differ, so joining them re-encodes the recording.`)
    joinArgs = reencodingJoinArgs(joinable, firstStream, withAudio, joinedPath)
  } else {
    listPath = join(segmentsFolder, `joining_${process.fileName}.txt`)
    await fs.writeFile(listPath, joinable.map((path) => `file '${path.replace(/'/g, `'\\''`)}'`).join('\n'))
    joinArgs = ['-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', '-movflags', '+faststart', '-y', joinedPath]
  }

  try {
    await runSegmentJoin(joinArgs, joinedPath)
  } catch (error) {
    const reason = messageFromError(error)
    throw new Error(`${reason} The recording's ${joinable.length} parts were kept in '${segmentsFolder}'.`)
  } finally {
    if (listPath) await fs.rm(listPath, { force: true })
  }

  try {
    // The recording's own file is the first segment, so it is only replaced once the joined file exists
    await fs.rename(joinedPath, outputPath)
  } catch (error) {
    const reason = messageFromError(error)
    throw new Error(`${reason} The whole recording was written, and was left as '${joinedPath}'.`)
  }

  for (const segmentPath of joinable.slice(1)) {
    await fs.rm(segmentPath, { force: true })
  }

  console.log(`Joined ${joinable.length} segments into '${outputPath}'`)
  return { segmentsJoined: joinable.length, reencoded, audioDropped, segmentsLost }
}

/**
 * Finalize a live video streaming process by closing FFmpeg stdin and joining the segments it wrote
 * @param {string} processId - ID of the streaming process to finalize
 * @returns {Promise<VideoRecordingFinalizationResult>} How the recording was put together
 */
const finalizeVideoRecording = async (processId: string): Promise<VideoRecordingFinalizationResult> => {
  const process = activeStreamProcesses.get(processId)
  if (!process) {
    throw new Error(`Live stream process ${processId} not found`)
  }

  if (process.isFinalized) {
    // Already finalized, so how it was put together was reported to whoever finalized it
    return { segmentsJoined: 1, reencoded: false, audioDropped: false, segmentsLost: 0 }
  }

  process.isFinalized = true

  try {
    console.log(`Finalizing live stream process ${processId}`)

    await waitForSegmentToFinish(process)
    const result = await joinSegments(process)

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

    return result
  } catch (error) {
    console.error(`Error finalizing live stream process ${processId}:`, error)
    throw error
  } finally {
    activeStreamProcesses.delete(processId)
  }
}

/**
 * Extract a single ZIP file into the provided destination directory using yauzl.
 * @param {string} zipFilePath - Path to the ZIP file
 * @param {string} extractPath - Destination directory for the extracted files
 * @returns {Promise<string[]>} Promise resolving to absolute paths of all extracted files
 */
const extractZipToDir = async (zipFilePath: string, extractPath: string): Promise<string[]> => {
  const extractedFiles: string[] = []

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

  return extractedFiles
}

/**
 * Build a {@link ZipExtractionResult} from a flat list of extracted file paths.
 * Filters and sorts WebM/chunk files, picks the first valid `.ass` telemetry file,
 * and derives the recording hash from the first chunk's filename.
 * @param {string[]} extractedFiles - All file paths produced by the ZIP extractions
 * @param {string} tempDir - Temporary directory containing the extracted files (returned for cleanup)
 * @returns {Promise<ZipExtractionResult>} Information about the unified set of chunks
 */
const buildExtractionResult = async (extractedFiles: string[], tempDir: string): Promise<ZipExtractionResult> => {
  // Find video chunks (WebM files) and de-duplicate by basename so identical chunks across
  // sibling part-zips are only included once.
  const chunkFilesMap = new Map<string, string>()
  for (const file of extractedFiles) {
    const fileName = basename(file)
    const isChunkFile = fileName.endsWith('.webm') || /^[a-f0-9]+_\d+/.test(fileName) || /chunk_\d+/.test(fileName)
    if (!isChunkFile) continue
    if (!chunkFilesMap.has(fileName)) {
      chunkFilesMap.set(fileName, file)
    }
  }

  const chunkFiles = [...chunkFilesMap.values()].sort((a, b) => {
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
    throw new Error('No valid video chunks found in ZIP file(s)')
  }

  // Find .ass telemetry file (only the first batch carries it; pick whichever was extracted first)
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
 * Extract one or more ZIP files into a shared temporary directory and return
 * a unified description of all video chunks and telemetry.
 * @param {string[]} zipFilePaths - Absolute paths to the ZIP files
 * @returns {Promise<ZipExtractionResult>} Information about the merged set of chunks
 */
const extractVideoChunksZips = async (zipFilePaths: string[]): Promise<ZipExtractionResult> => {
  if (!zipFilePaths || zipFilePaths.length === 0) {
    throw new Error('No ZIP file paths provided')
  }

  console.debug(`Extracting ${zipFilePaths.length} ZIP file(s): ${zipFilePaths.join(', ')}`)

  const tempDir = await createTempDirectory('zip-extraction')
  const extractPath = join(tempDir, 'extracted')
  await fs.mkdir(extractPath, { recursive: true })

  const extractedFiles: string[] = []
  for (const zipFilePath of zipFilePaths) {
    const filesFromZip = await extractZipToDir(zipFilePath, extractPath)
    extractedFiles.push(...filesFromZip)
  }

  return buildExtractionResult(extractedFiles, tempDir)
}

/**
 * Find sibling chunk-group ZIP files in the same folder as the provided ZIP.
 * Recognizes the `chunks_<hash>_part<N>.zip` and `chunks_<hash>.zip` naming
 * convention produced by Cockpit Lite when downloading chunk groups,
 * and returns every ZIP that shares the same recording hash (including the
 * input file). When no hash can be inferred, only the input path is returned.
 * @param {string} zipFilePath - Absolute path to a chunk-group ZIP file
 * @returns {Promise<string[]>} Sorted list of sibling ZIP paths (input included)
 */
const findSiblingChunkZips = async (zipFilePath: string): Promise<string[]> => {
  if (!zipFilePath) return []

  const folder = dirname(zipFilePath)
  const inputName = basename(zipFilePath)

  const hashRegex = /^chunks_([a-f0-9]+)(?:_part\d+)?\.zip$/i
  const inputHashMatch = inputName.match(hashRegex)
  if (!inputHashMatch) {
    return [zipFilePath]
  }

  const hash = inputHashMatch[1].toLowerCase()
  let folderEntries: string[] = []
  try {
    folderEntries = await fs.readdir(folder)
  } catch (error) {
    console.warn(`Failed to scan folder for sibling chunk ZIPs: ${error}`)
    return [zipFilePath]
  }

  const siblings = folderEntries
    .filter((name) => {
      const match = name.match(hashRegex)
      return !!match && match[1].toLowerCase() === hash
    })
    .map((name) => join(folder, name))
    .sort((a, b) => {
      // Order by part number (single-zip without `_partN` is treated as part 0).
      const partRegex = /_part(\d+)\.zip$/i
      const aPart = parseInt(basename(a).match(partRegex)?.[1] ?? '0', 10)
      const bPart = parseInt(basename(b).match(partRegex)?.[1] ?? '0', 10)
      return aPart - bPart
    })

  return siblings.length > 0 ? siblings : [zipFilePath]
}

/**
 * Copy telemetry file to video output directory.
 * If originAssFilePath is not absolute, it is resolved relative to the videos directory.
 * @param {string} originAssFilePath - Absolute path or filename of the .ass file
 * @param {string} destAssFilePath - Path where to put the ass file
 */
const copyTelemetryFile = async (originAssFilePath: string, destAssFilePath: string): Promise<void> => {
  try {
    const resolvedOrigin = isAbsolute(originAssFilePath)
      ? originAssFilePath
      : join(getCockpitFolderPath(), 'videos', originAssFilePath)
    await fs.copyFile(resolvedOrigin, destAssFilePath)
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
  const tempChunksPath = join(getCockpitFolderPath(), 'videos', 'temporary-video-chunks')

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
  const tempChunksFolderPath = join(getCockpitFolderPath(), 'videos', 'temporary-video-chunks')
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
      const assFilePath = join(getCockpitFolderPath(), 'videos', assFileName)

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
      return await finalizeVideoRecording(processId)
    } catch (error) {
      console.error('Error finalizing live video stream:', error)
      throw error
    }
  })

  /**
   * Extract video chunks from one or more ZIP files into a single temp directory
   */
  ipcMain.handle('extract-video-chunks-zips', async (_, zipFilePaths: string[]) => {
    try {
      return await extractVideoChunksZips(zipFilePaths)
    } catch (error) {
      console.error('Error extracting video chunks from ZIPs:', error)
      throw error
    }
  })

  /**
   * Find sibling chunk-group ZIP files in the same folder as the provided ZIP
   */
  ipcMain.handle('find-sibling-chunk-zips', async (_, zipFilePath: string) => {
    try {
      return await findSiblingChunkZips(zipFilePath)
    } catch (error) {
      console.error('Error finding sibling chunk ZIPs:', error)
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
