import { format } from 'date-fns'

import { sanitizeFilenameComponent } from '../libs/utils'

/**
 * Returns the filename for the video file.
 * Can be used with complete paths or just the filename. It will just replace the extension with .mp4.
 * @param {string} hash - The hash of the video.
 * @param {Date} creationDate - The creation date of the video.
 * @param {string} missionName - The name of the mission.
 * @returns {string} The filename for the video file.
 */
export const videoFilename = (hash: string, creationDate: Date, missionName = 'Cockpit'): string => {
  // Sanitize because the `O` timezone token renders non-integer UTC offsets with a real colon (e.g. `GMT+5:30`),
  // which is illegal on Windows and gets parsed as an NTFS alternate data stream, yielding a 0KB output file.
  const timeString = sanitizeFilenameComponent(format(creationDate, 'LLL dd, yyyy - HH꞉mm꞉ss O'))
  return `${missionName} (${timeString}) #${hash}.mp4`
}

/**
 * Returns the filename without the extension.
 * @param {string} videoFileName - The filename of the video, with or without the extension.
 * @returns {string} The filename without the extension.
 */
export const videoFilenameWithoutExtension = (videoFileName: string): string => {
  return videoFileName.split('.').slice(0, -1).join('.')
}

/**
 * Returns the filename for the thumbnail of a video.
 * Can be used with complete paths or just the filename. It will just replace the extension with .jpeg.
 * @param {string} videoFileName - The filename of the video, with or without the extension.
 * @returns {string} The filename for the thumbnail of the video.
 */
export const videoThumbnailFilename = (videoFileName: string): string => {
  return `${videoFilenameWithoutExtension(videoFileName)}.jpeg`
}

/**
 * Returns the filename for the subtitles of a video.
 * Can be used with complete paths or just the filename. It will just replace the extension with .ass.
 * @param {string} videoFileName - The filename of the video, with or without the extension.
 * @returns {string} The filename for the subtitles of the video.
 */
export const videoSubtitlesFilename = (videoFileName: string): string => {
  return `${videoFilenameWithoutExtension(videoFileName)}.ass`
}

/**
 * Storage key for one raw recording chunk in temp video storage.
 * @param {string} hash - The recording session hash
 * @param {number} chunkNumber - Sequential number of the chunk
 * @returns {string} The temp-storage key
 */
export const videoChunkName = (hash: string, chunkNumber: number): string => {
  return `${hash}_${chunkNumber}`
}

// Segments live apart from the finished videos, as the library lists whatever sits in the videos folder itself.
const videoSegmentsFolderName = 'recording-segments'

/**
 * Returns the filename of one segment of a recording, the first being the recording's own file.
 * @param {string} videoFileName - The filename of the video, with or without the extension.
 * @param {number} segmentIndex - Position of the segment in the recording, starting at zero.
 * @returns {string} The filename for that segment.
 */
export const videoSegmentFilename = (videoFileName: string, segmentIndex: number): string => {
  if (segmentIndex === 0) return videoFileName
  return `${videoFilenameWithoutExtension(videoFileName)} - part${segmentIndex + 1}.mp4`
}

/**
 * Returns the folders a recording's segment is stored under, inside the Cockpit folder.
 * @param {number} segmentIndex - Position of the segment in the recording, starting at zero.
 * @returns {string[]} The subfolders holding that segment.
 */
export const videoSegmentSubFolders = (segmentIndex: number): string[] => {
  return segmentIndex === 0 ? ['videos'] : ['videos', videoSegmentsFolderName]
}

/**
 * Whether a recording chunk opens a WebM stream of its own, which a MediaRecorder's first chunk does and
 * the ones that follow it do not, so a recording that outlived its recorder is told apart chunk by chunk.
 * @param {Uint8Array} chunkData - The chunk's first bytes, or the whole chunk.
 * @returns {boolean} True when the chunk starts with the EBML header.
 */
export const isWebmStreamStart = (chunkData: Uint8Array): boolean => {
  return chunkData[0] === 0x1a && chunkData[1] === 0x45 && chunkData[2] === 0xdf && chunkData[3] === 0xa3
}
