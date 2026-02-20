import { app } from 'electron'
import fs from 'fs'
import os from 'os'
import path from 'path'

let cachedGo2RTCPath: string | null = null

/**
 * Get the path to the bundled go2rtc binary for the current platform
 * @returns {string} The full path to the go2rtc executable
 */
export const getGo2RTCPath = (): string => {
  if (cachedGo2RTCPath && fs.existsSync(cachedGo2RTCPath)) {
    return cachedGo2RTCPath
  }

  const platform = os.platform()
  const isDevelopment = !app.isPackaged

  let executableName: string

  switch (platform) {
    case 'win32':
      executableName = 'go2rtc.exe'
      break
    case 'darwin':
    case 'linux':
      executableName = 'go2rtc'
      break
    default:
      throw new Error(`Unsupported platform: ${platform}`)
  }

  let binaryPath: string

  if (isDevelopment) {
    binaryPath = path.join(process.cwd(), 'binaries', 'go2rtc', executableName)
  } else {
    binaryPath = path.join(process.resourcesPath, 'go2rtc', executableName)
  }

  if (!fs.existsSync(binaryPath)) {
    throw new Error(`go2rtc binary not found at: ${binaryPath}`)
  }

  if (platform !== 'win32') {
    try {
      fs.chmodSync(binaryPath, '755')
      cachedGo2RTCPath = binaryPath
      return binaryPath
    } catch (error) {
      console.warn(`Failed to set executable permissions for go2rtc: ${error}`)
      console.log('Attempting to copy go2rtc to a writable location (Flatpak workaround)...')

      try {
        const tempDir = path.join(app.getPath('temp'), 'cockpit-go2rtc')
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true })
        }

        const writablePath = path.join(tempDir, executableName)
        if (!fs.existsSync(writablePath)) {
          console.log(`Copying go2rtc to: ${writablePath}`)
          fs.copyFileSync(binaryPath, writablePath)
        }

        fs.chmodSync(writablePath, '755')
        cachedGo2RTCPath = writablePath
        return writablePath
      } catch (copyError) {
        console.error(`Failed to copy go2rtc to writable location: ${copyError}`)
        cachedGo2RTCPath = binaryPath
        return binaryPath
      }
    }
  }

  cachedGo2RTCPath = binaryPath
  return binaryPath
}
