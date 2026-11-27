#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable no-undef */

const fs = require('fs')
const path = require('path')
const os = require('os')
const { execSync } = require('child_process')

const { downloadFile } = require('./lib/download')
const { buildFFmpeg } = require('./build-ffmpeg-macos')

/**
 * Download FFmpeg 7.1 binary for the current platform
 */

const FFMPEG_VERSION = '7.1'

// Platform-specific download URLs and file info
const PLATFORM_CONFIG = {
  win32: {
    x64: {
      url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2025-02-28-13-02/ffmpeg-n7.1-214-g71889a8437-win64-gpl-7.1.zip',
      archivePath: 'ffmpeg-n7.1-214-g71889a8437-win64-gpl-7.1/bin/ffmpeg.exe',
      targetFile: 'ffmpeg.exe',
    },
    arm64: {
      url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2025-02-28-13-02/ffmpeg-n7.1-214-g71889a8437-winarm64-gpl-7.1.zip',
      archivePath: 'ffmpeg-n7.1-214-g71889a8437-winarm64-gpl-7.1/bin/ffmpeg.exe',
      targetFile: 'ffmpeg.exe',
    },
  },
  linux: {
    x64: {
      url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2025-02-28-13-02/ffmpeg-n7.1-214-g71889a8437-linux64-gpl-7.1.tar.xz',
      archivePath: 'ffmpeg-n7.1-214-g71889a8437-linux64-gpl-7.1/bin/ffmpeg',
      targetFile: 'ffmpeg',
    },
    arm64: {
      url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2025-02-28-13-02/ffmpeg-n7.1-214-g71889a8437-linuxarm64-gpl-7.1.tar.xz',
      archivePath: 'ffmpeg-n7.1-214-g71889a8437-linuxarm64-gpl-7.1/bin/ffmpeg',
      targetFile: 'ffmpeg',
    },
  },
}

/**
 * Extract archive and move FFmpeg binary
 * @param {string} archivePath
 * @param {object} config
 * @param {string} targetDir
 */
function extractAndMove(archivePath, config, targetDir) {
  const tempDir = path.join(__dirname, '..', 'temp-ffmpeg')

  try {
    // Create temp directory
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    console.log('Extracting archive...')

    // Extract based on file type
    if (archivePath.endsWith('.zip')) {
      // Use unzip command or node implementation
      try {
        execSync(`unzip -q "${archivePath}" -d "${tempDir}"`)
      } catch (error) {
        // Fallback: try using node's built-in extraction if available
        throw new Error('unzip command not available. Please install unzip or implement node-based extraction.')
      }
    } else if (archivePath.endsWith('.tar.xz')) {
      try {
        execSync(`tar -xf "${archivePath}" -C "${tempDir}"`)
      } catch (error) {
        throw new Error('tar command not available. Please install tar.')
      }
    }

    // Move the FFmpeg binary to target location
    const sourceFile = path.join(tempDir, config.archivePath)
    const targetFile = path.join(targetDir, config.targetFile)

    if (!fs.existsSync(sourceFile)) {
      throw new Error(`FFmpeg binary not found in archive at: ${config.archivePath}`)
    }

    console.log(`Moving FFmpeg binary to: ${targetFile}`)
    fs.copyFileSync(sourceFile, targetFile)

    // Make executable on Unix-like systems
    if (process.platform !== 'win32') {
      fs.chmodSync(targetFile, '755')
    }

    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true })
    fs.unlinkSync(archivePath)

    console.log('✅ FFmpeg binary installed successfully!')
  } catch (error) {
    // Clean up on error
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
      fs.unlinkSync(archivePath)
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    throw error
  }
}

/**
 * Main installation function
 * @returns {Promise<void>} Resolves once the FFmpeg binary is in place
 */
async function installFFmpeg() {
  const platform = os.platform()
  const arch = os.arch()

  // macOS has no versioned prebuilt binary to pin, so it is compiled from source instead.
  if (platform === 'darwin') return buildFFmpeg()

  console.log(`Installing FFmpeg ${FFMPEG_VERSION} for ${platform}-${arch}...`)

  // Get platform configuration
  const platformConfig = PLATFORM_CONFIG[platform]
  if (!platformConfig) {
    throw new Error(`Unsupported platform: ${platform}`)
  }

  const archConfig = platformConfig[arch]
  if (!archConfig) {
    throw new Error(`Unsupported architecture: ${arch} on ${platform}`)
  }

  // Create target directory
  const targetDir = path.join(__dirname, '..', 'binaries', 'ffmpeg')
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }

  // Check if FFmpeg already exists
  const targetFile = path.join(targetDir, archConfig.targetFile)
  if (fs.existsSync(targetFile)) {
    console.log('FFmpeg binary already exists. Skipping download.')
    return
  }

  // Download archive
  const archiveFile = path.join(
    targetDir,
    `ffmpeg-${platform}-${arch}.${archConfig.url.includes('.zip') ? 'zip' : 'tar.xz'}`
  )

  try {
    await downloadFile(archConfig.url, archiveFile)
    await extractAndMove(archiveFile, archConfig, targetDir)
  } catch (error) {
    console.error('❌ Failed to install FFmpeg:', error.message)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  installFFmpeg().catch((error) => {
    console.error('❌ Installation failed:', error.message)
    process.exit(1)
  })
}

module.exports = { installFFmpeg }
