import { format } from 'date-fns'

import { AudioExtensionContainer } from '@/types/audio'

/**
 * Returns the filename for an audio recording.
 * Mirrors {@link import('./video').videoFilename} so audio and video files share a recognizable layout.
 * @param {string} hash - The unique hash of the recording.
 * @param {Date} creationDate - The creation date of the recording.
 * @param {string} missionName - The name of the mission. Defaults to 'Cockpit'.
 * @param {AudioExtensionContainer} extension - The extension/container to use. Defaults to WebM.
 * @returns {string} The filename for the audio file.
 */
export const audioFilename = (
  hash: string,
  creationDate: Date,
  missionName = 'Cockpit',
  extension: AudioExtensionContainer = AudioExtensionContainer.WEBM
): string => {
  const timeString = format(creationDate, 'LLL dd, yyyy - HH꞉mm꞉ss O')
  return `${missionName} (${timeString}) #${hash}.${extension}`
}

/**
 * Returns the filename without the extension.
 * @param {string} audioFileName - The filename of the audio recording, with or without the extension.
 * @returns {string} The filename without the extension.
 */
export const audioFilenameWithoutExtension = (audioFileName: string): string => {
  return audioFileName.split('.').slice(0, -1).join('.')
}

/**
 * Returns the filename for the metadata sidecar of an audio recording.
 * @param {string} audioFileName - The filename of the audio recording, with or without the extension.
 * @returns {string} The filename for the metadata sidecar (.json).
 */
export const audioMetadataFilename = (audioFileName: string): string => {
  return `${audioFilenameWithoutExtension(audioFileName)}.json`
}

/**
 * Tells whether a given filename corresponds to a Cockpit audio recording.
 * @param {string} filename - The filename to check.
 * @returns {boolean} Whether the filename is an audio recording.
 */
export const isAudioFilename = (filename: string): boolean => {
  return Object.values(AudioExtensionContainer).some((ext) => filename.endsWith(`.${ext}`))
}

/**
 * Tells whether a given filename corresponds to an audio metadata sidecar produced by Cockpit.
 * @param {string} filename - The filename to check.
 * @returns {boolean} Whether the filename is an audio metadata sidecar.
 */
export const isAudioMetadataFilename = (filename: string): boolean => {
  return filename.endsWith('.json')
}
