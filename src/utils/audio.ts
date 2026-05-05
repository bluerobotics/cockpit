/**
 * Returns the filename for the metadata sidecar of an audio recording.
 * @param {string} audioFileName - The filename of the audio recording.
 * @returns {string} The filename for the metadata sidecar (.json).
 */
export const audioMetadataFilename = (audioFileName: string): string => {
  return audioFileName.replace(/\.[^.]+$/, '.json')
}

/**
 * Tells whether a given filename corresponds to an audio metadata sidecar produced by Cockpit.
 * @param {string} filename - The filename to check.
 * @returns {boolean} Whether the filename is an audio metadata sidecar.
 */
export const isAudioMetadataFilename = (filename: string): boolean => {
  return filename.endsWith('.json')
}
