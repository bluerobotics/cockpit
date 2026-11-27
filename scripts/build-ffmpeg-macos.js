#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable no-undef */

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execSync } = require('child_process')

const { downloadFile } = require('./lib/download')

/**
 * Build FFmpeg for macOS from the official source release.
 *
 * There is no macOS counterpart to the versioned BtbN builds the other platforms
 * download: the static builds that do exist are replaced in place on every new
 * FFmpeg release, and the 7.1 ones Cockpit used were built with
 * `--enable-nonfree`, which FFmpeg itself marks as not redistributable. Building
 * it here pins the version and keeps the license to LGPL: no `--enable-gpl` and
 * no external library but zlib and Apple's own frameworks. Cockpit only remuxes
 * recordings, decodes one frame for a thumbnail and relays RTSP for go2rtc, all
 * of which FFmpeg's native components cover.
 */

const FFMPEG_VERSION = '7.1.5'
// The tarball whose signature by the FFmpeg release key was checked when this version was reviewed.
const FFMPEG_SOURCE_SHA256 = 'de668509caf9e35e3cd162473441fdb29538c6d96ed080292b3cf9e6fc5d558f'
const FFMPEG_SOURCE_URL = `https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.xz`

// Electron itself supports macOS 12 and later, and so must the binary we spawn.
const MACOS_DEPLOYMENT_TARGET = '12.0'

const CONFIGURE_FLAGS = [
  '--disable-autodetect',
  '--enable-zlib',
  // RTSP over TLS, as the previous build had through the same framework
  '--enable-securetransport',
  '--disable-doc',
  '--disable-debug',
  '--disable-ffplay',
  '--disable-ffprobe',
  // Saves depending on nasm; nothing Cockpit runs decodes more than a single frame
  '--disable-x86asm',
  `--extra-cflags=-mmacosx-version-min=${MACOS_DEPLOYMENT_TARGET}`,
  `--extra-ldflags=-mmacosx-version-min=${MACOS_DEPLOYMENT_TARGET}`,
]

const run = (command, cwd) => execSync(command, { cwd, stdio: 'inherit' })

/**
 * Download the pinned FFmpeg source tarball into a directory and check it against the reviewed checksum.
 * @param {string} directory - Where to put the tarball
 * @returns {Promise<string>} The path of the checked tarball
 */
async function downloadFFmpegSource(directory) {
  const tarball = path.join(directory, `ffmpeg-${FFMPEG_VERSION}.tar.xz`)
  await downloadFile(FFMPEG_SOURCE_URL, tarball)
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(tarball)).digest('hex')
  if (sha256 !== FFMPEG_SOURCE_SHA256) {
    fs.unlinkSync(tarball)
    throw new Error(`FFmpeg source checksum mismatch: expected ${FFMPEG_SOURCE_SHA256}, got ${sha256}`)
  }
  return tarball
}

/**
 * Compile FFmpeg and install it into `binaries/ffmpeg`, next to its license and a notice of how it was built.
 */
async function buildFFmpeg() {
  if (os.platform() !== 'darwin') {
    throw new Error(`This build is only for macOS, not ${os.platform()}.`)
  }

  const targetDir = path.join(__dirname, '..', 'binaries', 'ffmpeg')
  const targetFile = path.join(targetDir, 'ffmpeg')
  // Only this build writes the license, so a binary without it is an older download that must be replaced.
  const licenseFile = path.join(targetDir, 'COPYING.LGPLv2.1')
  if (fs.existsSync(targetFile) && fs.existsSync(licenseFile)) {
    console.log('FFmpeg binary already exists. Skipping build.')
    return
  }
  fs.mkdirSync(targetDir, { recursive: true })

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-ffmpeg-'))
  try {
    const tarball = await downloadFFmpegSource(workDir)
    run(`tar -xf "${tarball}"`, workDir)

    const sourceDir = path.join(workDir, `ffmpeg-${FFMPEG_VERSION}`)
    console.log(`Building FFmpeg ${FFMPEG_VERSION} for macOS ${os.arch()}...`)
    run(`./configure ${CONFIGURE_FLAGS.map((flag) => `"${flag}"`).join(' ')}`, sourceDir)
    run(`make -j${os.cpus().length} ffmpeg`, sourceDir)

    const stagedBinary = `${targetFile}.part`
    fs.copyFileSync(path.join(sourceDir, 'ffmpeg'), stagedBinary)
    fs.chmodSync(stagedBinary, '755')
    fs.renameSync(stagedBinary, targetFile)

    // Written last, so an interrupted build never leaves a binary the next run would skip over.
    const notice = [
      `FFmpeg ${FFMPEG_VERSION}, licensed under the GNU LGPL version 2.1 or later (see COPYING.LGPLv2.1).`,
      `Built from ${FFMPEG_SOURCE_URL} (sha256 ${FFMPEG_SOURCE_SHA256}), which is also published`,
      'next to the macOS installers on every Cockpit release, with these configure flags:',
      ...CONFIGURE_FLAGS.map((flag) => `  ${flag}`),
      '',
    ].join('\n')
    fs.writeFileSync(path.join(targetDir, 'FFMPEG-SOURCE.txt'), notice)
    fs.copyFileSync(path.join(sourceDir, 'COPYING.LGPLv2.1'), licenseFile)
    console.log('✅ FFmpeg built successfully!')
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true })
  }
}

if (require.main === module) {
  buildFFmpeg().catch((error) => {
    console.error('❌ Could not build FFmpeg:', error.message)
    process.exit(1)
  })
}

module.exports = { buildFFmpeg, downloadFFmpegSource }
