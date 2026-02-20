#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable no-undef */

const https = require('https')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execSync } = require('child_process')

/**
 * Download go2rtc binary for the current platform
 */

const GO2RTC_VERSION = '1.9.14'

const PLATFORM_CONFIG = {
  win32: {
    x64: {
      url: `https://github.com/AlexxIT/go2rtc/releases/download/v${GO2RTC_VERSION}/go2rtc_win64.zip`,
      archivePath: 'go2rtc.exe',
      targetFile: 'go2rtc.exe',
    },
  },
  darwin: {
    x64: {
      url: `https://github.com/AlexxIT/go2rtc/releases/download/v${GO2RTC_VERSION}/go2rtc_mac_amd64.zip`,
      archivePath: 'go2rtc',
      targetFile: 'go2rtc',
    },
    arm64: {
      url: `https://github.com/AlexxIT/go2rtc/releases/download/v${GO2RTC_VERSION}/go2rtc_mac_arm64.zip`,
      archivePath: 'go2rtc',
      targetFile: 'go2rtc',
    },
  },
  linux: {
    x64: {
      url: `https://github.com/AlexxIT/go2rtc/releases/download/v${GO2RTC_VERSION}/go2rtc_linux_amd64`,
      archivePath: null,
      targetFile: 'go2rtc',
    },
    arm64: {
      url: `https://github.com/AlexxIT/go2rtc/releases/download/v${GO2RTC_VERSION}/go2rtc_linux_arm64`,
      archivePath: null,
      targetFile: 'go2rtc',
    },
  },
}

/**
 * Download a file from a URL
 * @param {string} url
 * @param {string} outputPath
 */
function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading go2rtc from: ${url}`)

    const file = fs.createWriteStream(outputPath)

    https
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          return downloadFile(response.headers.location, outputPath).then(resolve).catch(reject)
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode}`))
          return
        }

        const totalSize = parseInt(response.headers['content-length'] || '0', 10)
        let downloadedSize = 0

        response.on('data', (chunk) => {
          downloadedSize += chunk.length
          if (totalSize > 0) {
            const percent = ((downloadedSize / totalSize) * 100).toFixed(1)
            process.stdout.write(`\rDownloading... ${percent}%`)
          }
        })

        response.pipe(file)

        file.on('finish', () => {
          file.close()
          console.log('\nDownload completed!')
          resolve()
        })
      })
      .on('error', (err) => {
        fs.unlink(outputPath, () => {
          // Clean up partial download
        })
        reject(err)
      })
  })
}

/**
 * Extract archive and move binary
 * @param {string} archivePath
 * @param {object} config
 * @param {string} targetDir
 */
function extractAndMove(archivePath, config, targetDir) {
  const tempDir = path.join(__dirname, '..', 'temp-go2rtc')

  try {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    console.log('Extracting archive...')
    try {
      execSync(`unzip -q "${archivePath}" -d "${tempDir}"`)
    } catch (error) {
      throw new Error('unzip command not available. Please install unzip.')
    }

    const sourceFile = path.join(tempDir, config.archivePath)
    const targetFile = path.join(targetDir, config.targetFile)

    if (!fs.existsSync(sourceFile)) {
      throw new Error(`go2rtc binary not found in archive at: ${config.archivePath}`)
    }

    console.log(`Moving go2rtc binary to: ${targetFile}`)
    fs.copyFileSync(sourceFile, targetFile)

    if (process.platform !== 'win32') {
      fs.chmodSync(targetFile, '755')
    }

    fs.rmSync(tempDir, { recursive: true, force: true })
    fs.unlinkSync(archivePath)

    console.log('✅ go2rtc binary installed successfully!')
  } catch (error) {
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
 */
async function installGo2RTC() {
  const platform = os.platform()
  const arch = os.arch()

  console.log(`Installing go2rtc ${GO2RTC_VERSION} for ${platform}-${arch}...`)

  const platformConfig = PLATFORM_CONFIG[platform]
  if (!platformConfig) {
    console.log(`Skipping go2rtc download: unsupported platform ${platform}`)
    return
  }

  const archConfig = platformConfig[arch]
  if (!archConfig) {
    console.log(`Skipping go2rtc download: unsupported architecture ${arch} on ${platform}`)
    return
  }

  const targetDir = path.join(__dirname, '..', 'binaries', 'go2rtc')
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }

  const targetFile = path.join(targetDir, archConfig.targetFile)
  if (fs.existsSync(targetFile)) {
    console.log('go2rtc binary already exists. Skipping download.')
    return
  }

  try {
    if (archConfig.archivePath === null) {
      await downloadFile(archConfig.url, targetFile)
      if (process.platform !== 'win32') {
        fs.chmodSync(targetFile, '755')
      }
      console.log('✅ go2rtc binary installed successfully!')
    } else {
      const ext = archConfig.url.includes('.zip') ? 'zip' : 'tar.xz'
      const archiveFile = path.join(targetDir, `go2rtc-${platform}-${arch}.${ext}`)
      await downloadFile(archConfig.url, archiveFile)
      await extractAndMove(archiveFile, archConfig, targetDir)
    }
  } catch (error) {
    console.error('❌ Failed to install go2rtc:', error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  installGo2RTC().catch((error) => {
    console.error('❌ Installation failed:', error.message)
    process.exit(1)
  })
}

module.exports = { installGo2RTC }
