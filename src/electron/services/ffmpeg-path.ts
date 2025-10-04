import { app } from 'electron'
import fs from 'fs'
import os from 'os'
import path from 'path'

/**
 * Get the path to the bundled FFmpeg binary for the current platform and architecture
 * @returns {string} The full path to the FFmpeg executable
 */
export const getFFmpegPath = (): string => {
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
    } catch (error) {
      console.warn(`Failed to set executable permissions for FFmpeg: ${error}`)
    }
  }

  return ffmpegPath
}
