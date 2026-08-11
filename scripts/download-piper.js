#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable no-undef */

const fs = require('fs')
const path = require('path')
const os = require('os')
const { execSync } = require('child_process')

const { downloadFile } = require('./lib/download')

/**
 * Download the Piper neural TTS runtime and one bundled voice, so every
 * Standalone build speaks alerts with the same voice out of the box, instead of
 * whatever the host exposes through the Web Speech API.
 */

const PIPER_VERSION = '2023.11.14-2'

// The macOS `aarch64` asset of this release is really an x86_64 build, so Apple
// Silicon has no usable prebuilt runtime and compiles its own instead, through
// `build-piper-macos-arm64.js`.
const RUNTIME_ARCHIVES = {
  linux: { x64: 'piper_linux_x86_64.tar.gz', arm64: 'piper_linux_aarch64.tar.gz' },
  darwin: { x64: 'piper_macos_x64.tar.gz' },
  win32: { x64: 'piper_windows_amd64.zip' },
}

const piperBinaryName = (platform) => (platform === 'win32' ? 'piper.exe' : 'piper')

/**
 * Whether a complete runtime sits in the target dir. The binary alone is not
 * enough: the app refuses to speak without the phoneme data beside it, so an
 * interrupted install that left only the binary must not pass for installed.
 * @param {string} targetDir
 * @param {string} platform
 * @returns {boolean}
 */
function hasRuntime(targetDir, platform) {
  return (
    fs.existsSync(path.join(targetDir, piperBinaryName(platform))) &&
    fs.existsSync(path.join(targetDir, 'espeak-ng-data'))
  )
}

// Bundled voice. Only the low-quality Amy model ships in the build to keep the
// installer smaller; the app downloads the higher-quality voices on demand. All
// en_US Piper models are ~63 MB regardless of tier, so "low" here is about
// output quality (16 kHz), not size.
const VOICE = {
  name: 'en_US-amy-low',
  onnxUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/low/en_US-amy-low.onnx?download=true',
  jsonUrl:
    'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/low/en_US-amy-low.onnx.json?download=true',
}

/**
 * The macOS build links its dylibs through `@rpath` but ships no rpath entry of
 * its own, so dyld cannot find them. Point the rpath at the binary's directory,
 * where the dylibs sit. `DYLD_LIBRARY_PATH` is not an option, since the signed
 * app runs under the hardened runtime, which strips `DYLD_*` from the child.
 * @param {string} binaryPath
 * @param {string} rpath
 */
function addMacRpath(binaryPath, rpath = '@executable_path') {
  try {
    execSync(`install_name_tool -add_rpath ${rpath} "${binaryPath}"`, { stdio: 'pipe' })
    // Rewriting the load commands invalidates the signature, and macOS kills a
    // binary whose signature no longer matches, so sign it again ad-hoc.
    execSync(`codesign --force --sign - "${binaryPath}"`, { stdio: 'pipe' })
  } catch (error) {
    throw new Error(`Could not add the ${rpath} rpath to "${binaryPath}": ${error.message}`)
  }
}

/**
 * Extract the Piper runtime archive straight into the target dir. The archive
 * expands into a top-level `piper/` folder holding the binary, shared libraries
 * (with relative symlinks between them) and the espeak-ng phoneme data;
 * `--strip-components=1` drops that folder while keeping the symlinks intact.
 * @param {string} archivePath
 * @param {string} targetDir
 * @param {string} platform
 */
function extractRuntime(archivePath, targetDir, platform) {
  try {
    console.log('Extracting Piper runtime...')
    try {
      // Windows ships a zip, which its bundled tar (bsdtar) reads just as well.
      execSync(`tar ${platform === 'win32' ? '-xf' : '-xzf'} "${archivePath}" -C "${targetDir}" --strip-components=1`)
    } catch (error) {
      throw new Error('tar command not available. Please install tar.')
    }

    const binaryPath = path.join(targetDir, piperBinaryName(platform))
    if (!fs.existsSync(binaryPath)) {
      throw new Error(`Piper binary not found after extraction at: ${binaryPath}`)
    }
    if (platform !== 'win32') {
      fs.chmodSync(binaryPath, '755')
    }
    if (platform === 'darwin') {
      addMacRpath(binaryPath)
    }

    fs.unlinkSync(archivePath)

    console.log('✅ Piper runtime installed successfully!')
  } catch (error) {
    try {
      fs.unlinkSync(archivePath)
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    throw error
  }
}

/**
 * Download and install the Piper runtime and bundled voice for the current platform.
 */
async function installPiper() {
  const platform = os.platform()
  const arch = os.arch()

  // Always create the target dir so `extraResources` has a source on every build
  // platform, even where the bundle is skipped and it stays empty.
  const targetDir = path.join(__dirname, '..', 'binaries', 'piper')
  fs.mkdirSync(targetDir, { recursive: true })

  const runtimeArchive = RUNTIME_ARCHIVES[platform]?.[arch]
  const buildsFromSource = platform === 'darwin' && arch === 'arm64'
  if (!runtimeArchive && !buildsFromSource) {
    console.log(`Skipping Piper download: no bundled runtime for ${platform}-${arch}.`)
    return
  }

  console.log(`Installing the Piper runtime and voice for ${platform}-${arch}...`)

  const voicesDir = path.join(targetDir, 'voices')
  fs.mkdirSync(voicesDir, { recursive: true })

  const onnxPath = path.join(voicesDir, `${VOICE.name}.onnx`)
  const jsonPath = path.join(voicesDir, `${VOICE.name}.onnx.json`)

  if (hasRuntime(targetDir, platform) && fs.existsSync(onnxPath) && fs.existsSync(jsonPath)) {
    console.log('Piper runtime and voice already exist. Skipping download.')
    return
  }

  try {
    if (!hasRuntime(targetDir, platform)) {
      if (runtimeArchive) {
        const archiveFile = path.join(targetDir, `piper-${platform}-${arch}.${platform === 'win32' ? 'zip' : 'tar.gz'}`)
        await downloadFile(
          `https://github.com/rhasspy/piper/releases/download/${PIPER_VERSION}/${runtimeArchive}`,
          archiveFile
        )
        extractRuntime(archiveFile, targetDir, platform)
      } else {
        console.log('No prebuilt Piper runtime for this platform. Build one with `yarn build:piper`.')
      }
    }

    if (!fs.existsSync(onnxPath)) {
      await downloadFile(VOICE.onnxUrl, onnxPath)
    }
    if (!fs.existsSync(jsonPath)) {
      await downloadFile(VOICE.jsonUrl, jsonPath)
    }

    console.log(`✅ Piper voice "${VOICE.name}" installed successfully!`)
  } catch (error) {
    console.error('❌ Failed to install Piper:', error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  installPiper().catch((error) => {
    console.error('❌ Installation failed:', error.message)
    process.exit(1)
  })
}

module.exports = { addMacRpath, hasRuntime, installPiper }
