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
