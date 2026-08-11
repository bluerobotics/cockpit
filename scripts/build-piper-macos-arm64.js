#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable no-undef */

const fs = require('fs')
const path = require('path')
const os = require('os')
const { execSync } = require('child_process')
const { addMacRpath, hasRuntime } = require('./download-piper')

/**
 * Build the Piper runtime for Apple Silicon from source.
 *
 * Every other platform gets a prebuilt binary from the archived rhasspy/piper
 * release, but its `aarch64` macOS asset is really an x86_64 build, so it runs
 * under Rosetta 2 and aborts inside the signed app. The maintained piper1-gpl
 * repository has no downloadable binaries at all, only CI artifacts, so the one
 * way to get a native arm64 synthesizer is to compile its CLI ourselves. That
 * CLI takes the same arguments as the rhasspy one, so the app cannot tell the
 * two apart.
 */

const PIPER_SOURCE_TAG = 'v1.6.0'
const PIPER_SOURCE_REPO = 'https://github.com/OHF-Voice/piper1-gpl.git'

// Electron itself supports macOS 11 and later, and so must the binary we spawn.
const MACOS_DEPLOYMENT_TARGET = '11.0'

// espeak-ng composes every phoneme source path into a 180-byte buffer, appending
// up to 36 bytes ("/../phsource/" plus its longest name) to its data directory.
// Past that it truncates each of them and fails with hundreds of "Bad vowel
// file" errors that never mention the length, so keep the build tree shallow.
const MAX_ESPEAK_DATA_PATH = 179 - 36

const run = (command, cwd) => execSync(command, { cwd, stdio: 'inherit' })

/**
 * Lay the CMake install tree out the way the app expects: the binary named
 * `piper`, its libraries beside it and the phoneme data in `espeak-ng-data`.
 * @param {string} installDir
 * @param {string} targetDir
 */
function collectRuntime(installDir, targetDir) {
  // `cp -R` keeps the onnxruntime version symlink a symlink, which `fs.cpSync`
  // would otherwise turn into an absolute path into this build dir. The rest of
  // `lib` is CMake and pkg-config metadata that the app has no use for.
  run(`cp -R "${installDir}"/libpiper.dylib "${installDir}"/lib/*.dylib "${targetDir}"`)
  run(`cp -R "${path.join(installDir, 'espeak-ng-data')}" "${targetDir}"`)

  // The library resolves onnxruntime through `@rpath` as well, and it is loaded
  // by the app when Piper runs as a child of it, not only by the CLI.
  addMacRpath(path.join(targetDir, 'libpiper.dylib'), '@loader_path')

  // The binary is staged under a `.part` name and only takes its final one once
  // it is patched and signed, so an interrupted build never leaves a tree that
  // `hasRuntime` reads as a finished runtime.
  const stagedBinary = path.join(targetDir, 'piper.part')
  fs.copyFileSync(path.join(installDir, 'bin', 'piper_exe'), stagedBinary)
  fs.chmodSync(stagedBinary, '755')
  addMacRpath(stagedBinary)
  fs.renameSync(stagedBinary, path.join(targetDir, 'piper'))
}

/**
 * Compile Piper and install it into `binaries/piper`.
 */
function buildPiper() {
  if (os.platform() !== 'darwin' || os.arch() !== 'arm64') {
    throw new Error(`This build is only for macOS on Apple Silicon, not ${os.platform()}-${os.arch()}.`)
  }

  const targetDir = path.join(__dirname, '..', 'binaries', 'piper')
  if (hasRuntime(targetDir, os.platform())) {
    console.log('Piper runtime already built. Skipping.')
    return
  }
  fs.mkdirSync(targetDir, { recursive: true })

  // Not `os.tmpdir()`: on macOS that is a ~50 character path under /var/folders,
  // which on its own is deep enough to break the espeak-ng build below.
  const workDir = fs.mkdtempSync(path.join(fs.realpathSync('/tmp'), 'cockpit-piper-'))
  try {
    const sourceDir = path.join(workDir, 'piper1-gpl', 'libpiper')
    const installDir = path.join(workDir, 'install')
    const espeakDataDir = path.join(sourceDir, 'build/espeak_ng/src/espeak_ng_external-build/espeak-ng-data')
    if (espeakDataDir.length > MAX_ESPEAK_DATA_PATH) {
      throw new Error(`The build path "${espeakDataDir}" is too long for espeak-ng to compile its phoneme data.`)
    }

    console.log(`Building Piper ${PIPER_SOURCE_TAG} for macOS arm64...`)
    run(`git clone --depth 1 --branch ${PIPER_SOURCE_TAG} ${PIPER_SOURCE_REPO} "${workDir}/piper1-gpl"`)

    const cmakeFlags = [
      '-DCMAKE_BUILD_TYPE=Release',
      `-DCMAKE_INSTALL_PREFIX="${installDir}"`,
      `-DCMAKE_OSX_DEPLOYMENT_TARGET=${MACOS_DEPLOYMENT_TARGET}`,
      '-DCMAKE_OSX_ARCHITECTURES=arm64',
    ].join(' ')

    run(`cmake -B build ${cmakeFlags}`, sourceDir)
    run('cmake --build build --config Release --parallel', sourceDir)
    run('cmake --install build --config Release', sourceDir)

    collectRuntime(installDir, targetDir)
    console.log('✅ Piper runtime built successfully!')
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true })
  }
}

if (require.main === module) {
  try {
    buildPiper()
  } catch (error) {
    console.error('❌ Could not build the Piper runtime:', error.message)
    process.exit(1)
  }
}

module.exports = { buildPiper }
