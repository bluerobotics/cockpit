/**
 * Returns the filename for the thumbnail of a video.
 * Can be used with complete paths or just the filename. It will just replace the extension with .jpeg.
 * @param {string} videoFileName - The filename of the video, with or without the extension.
 * @returns {string} The filename for the thumbnail of the video.
 */
export const videoThumbnailFilename = (videoFileName: string): string => {
  // Separated the filename and the extension and joined them back together
  const videoFileNameWithoutExt = videoFileName.split('.').slice(0, -1).join('.')
  return `${videoFileNameWithoutExt}.jpeg`
}
