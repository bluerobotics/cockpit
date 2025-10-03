import { app } from 'electron'
import fs from 'fs'
import os from 'os'
import path from 'path'

// Cache the FFmpeg path to avoid copying it multiple times
let cachedFFmpegPath: string | null = null

/**
 * Get the path to the bundled FFmpeg binary for the current platform and architecture
 * @returns {string} The full path to the FFmpeg executable
 */
export const getFFmpegPath = (): string => {
  // Return cached path if available
  if (cachedFFmpegPath && fs.existsSync(cachedFFmpegPath)) {
    return cachedFFmpegPath
  }

  const platform = os.platform()
  const isDevelopment = !app.isPackaged

  let executableName: string

  // Determine the executable name based on platform
  switch (platform) {
    case 'win32':
      executableName = 'ffmpeg.exe'
      break
    case 'darwin':
    case 'linux':
      executableName = 'ffmpeg'
      break
    default:
      throw new Error(`Unsupported platform: ${platform}`)
  }

  let ffmpegPath: string

  if (isDevelopment) {
    // In development mode, use the binaries from binaries/ffmpeg/
    ffmpegPath = path.join(process.cwd(), 'binaries', 'ffmpeg', executableName)
  } else {
    // In production, use the bundled binaries from resources/ffmpeg/
    ffmpegPath = path.join(process.resourcesPath, 'ffmpeg', executableName)
  }

  // Verify that the FFmpeg binary exists
  if (!fs.existsSync(ffmpegPath)) {
    throw new Error(`FFmpeg binary not found at: ${ffmpegPath}`)
  }

  // Ensure the binary is executable on Unix-like systems
  if (platform !== 'win32') {
    try {
      fs.chmodSync(ffmpegPath, '755')
      // Successfully set permissions, use the original path
      cachedFFmpegPath = ffmpegPath
      return ffmpegPath
    } catch (error) {
      console.warn(`Failed to set executable permissions for FFmpeg: ${error}`)
      console.log('Attempting to copy FFmpeg to a writable location (Flatpak workaround)...')

      try {
        // Copy FFmpeg to a writable temp location (needed for Flatpak and other read-only environments)
        const tempDir = path.join(app.getPath('temp'), 'cockpit-ffmpeg')

        // Create temp directory if it doesn't exist
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true })
        }

        const writableFfmpegPath = path.join(tempDir, executableName)

        // Only copy if it doesn't exist or is different
        if (!fs.existsSync(writableFfmpegPath)) {
          console.log(`Copying FFmpeg to: ${writableFfmpegPath}`)
          fs.copyFileSync(ffmpegPath, writableFfmpegPath)
        }

        // Set executable permissions on the copied binary
        fs.chmodSync(writableFfmpegPath, '755')
        console.log('✅ FFmpeg copied successfully and made executable')

        cachedFFmpegPath = writableFfmpegPath
        return writableFfmpegPath
      } catch (copyError) {
        console.error(`Failed to copy FFmpeg to writable location: ${copyError}`)
        // Fall back to original path and hope it works
        cachedFFmpegPath = ffmpegPath
        return ffmpegPath
      }
    }
  }

  cachedFFmpegPath = ffmpegPath
  return ffmpegPath
}
