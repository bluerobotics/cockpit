// Recording through an HDMI capture card on this machine instead of the browser's screencast. The
// screencast reads every frame back from the GPU and encodes it on the measured machine's CPU, which
// on a weak machine changes the very thing being measured; a capture card costs that machine nothing
// and records what its screen actually shows. The capture has no clock of the page's, so the page
// flashes white at the start and the end of a recording and those two flashes place the video on
// the page's timeline.

import assert from 'node:assert'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Start recording a capture device with ffmpeg (AVFoundation, macOS).
 * @param {object} options - Options
 * @param {string} options.device - Device name or index, as `ffmpeg -f avfoundation -list_devices true -i ""` lists it
 * @param {string} [options.mode] - `WIDTHxHEIGHT@FPS`; the device's default when omitted
 * @param {string} options.out - Where to write the recording (.mkv survives an interrupted run)
 * @returns {Promise<{stop: Function}>} Call `stop()` to finish the file
 */
export async function startCapture({ device, mode, out }) {
  const [size, fps] = (mode ?? '').split('@')
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'avfoundation']
  if (fps) args.push('-framerate', fps)
  if (size) args.push('-video_size', size)
  args.push('-capture_cursor', '0', '-i', `${device}:none`, '-c:v', 'h264_videotoolbox', '-b:v', '24M', out)
  const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'] })
  let stderr = ''
  ff.stderr.on('data', (d) => (stderr += d))
  const exited = new Promise((resolve) => ff.once('exit', resolve))
  // A wrong device or mode makes ffmpeg exit at once, listing what the device supports.
  const early = await Promise.race([exited.then(() => true), sleep(1500).then(() => false)])
  if (early) throw new Error(`capture did not start on "${device}": ${stderr.slice(-600)}`)
  return {
    stop: async () => {
      ff.stdin.write('q')
      ff.stdin.end()
      const done = await Promise.race([exited.then(() => true), sleep(15000).then(() => false)])
      if (!done) ff.kill('SIGINT')
    },
  }
}

/**
 * When the screen turned white in a recording: the start of every stretch of frames much brighter than
 * the recording usually is. The bar sits halfway between the typical frame and the brightest, so it holds
 * whether the app fills the screen or only part of it.
 * @param {string} video - Recording to scan
 * @returns {number[]} Video times, in seconds, of each flash's first frame
 */
export function flashTimes(video) {
  const ff = spawnSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-i',
      video,
      '-vf',
      'scale=160:-1,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-',
    ].concat(['-f', 'null', '-']),
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }
  )
  const frames = []
  let at = null
  for (const line of ff.stdout.split('\n')) {
    const time = line.match(/pts_time:([\d.]+)/)
    if (time) at = Number(time[1])
    const luma = line.match(/YAVG=([\d.]+)/)
    if (luma && at !== null) frames.push([at, Number(luma[1])])
  }
  const sorted = frames.map(([, y]) => y).sort((a, b) => a - b)
  const typical = sorted[Math.floor(sorted.length / 2)]
  const brightest = sorted.at(-1)
  if (!frames.length || brightest - typical < 40) return []
  const bar = typical + (brightest - typical) / 2
  const times = []
  let bright = false
  for (const [t, y] of frames) {
    if (y > bar && !bright) times.push(t)
    bright = y > bar
  }
  return times
}

/**
 * Video time → page time, from the two flashes: the page clock time each was drawn and the video time
 * each was seen. Two points also absorb a capture clock that runs slightly fast or slow.
 * @param {number[]} seen - Video times of the first and last flash (s)
 * @param {number[]} drawn - Page times of the same flashes (ms, page clock)
 * @param {number} origin - The page's `performance.timeOrigin` (epoch ms)
 * @param {number} duration - Video length (s)
 * @returns {{t: number, ts: number}[]} One point per second: video time and page time as epoch seconds
 */
export function timelineFromFlashes(seen, drawn, origin, duration) {
  const rate = (drawn[1] - drawn[0]) / (seen[1] - seen[0]) / 1000
  return Array.from({ length: Math.ceil(duration) + 1 }, (_, t) => ({
    t,
    ts: (origin + drawn[0] + (t - seen[0]) * rate * 1000) / 1000,
  }))
}

// `node e2e/lib/hdmi.mjs` checks the flash maths: it finds two white flashes in a synthetic recording and maps
// video time to page time from them, including a page clock that runs 0.1 % fast. Needs ffmpeg.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = mkdtempSync(join(tmpdir(), 'hdmi-check-'))
  const video = join(dir, 'synth.mkv')
  const white = "drawbox=enable='between(t,1.5,1.9)+between(t,8.25,8.65)':x=0:y=0:w=iw:h=ih:color=white:t=fill"
  const synth = ['-f', 'lavfi', '-i', 'color=c=0x223344:s=320x180:r=60:d=10', '-vf', white, video]
  spawnSync('ffmpeg', ['-v', 'error', '-y', ...synth])
  try {
    const seen = flashTimes(video)
    assert.deepEqual(
      seen.map((t) => Math.round(t * 100) / 100),
      [1.5, 8.25]
    )
    const timeline = timelineFromFlashes(seen, [20000, 20000 + 6750 * 1.001], 1.7e12, 10)
    const pageAt = (t) => timeline[t].ts * 1000 - 1.7e12
    assert.ok(Math.abs(pageAt(5) - (20000 + 3500 * 1.001)) < 25, `page time at 5 s: ${pageAt(5)}`)
    console.log('hdmi selfcheck ok')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
