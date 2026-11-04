// Draws the cursor, clicks, keys, checks, captions and cards of a capture-card recording onto its video afterwards.
// The page under test never runs the overlay: the same overlay script is replayed here, in a transparent headless page
// the size of the app's, recorded with its transparency and laid over the captured screen where the app sat.

import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { launch, OVERLAY_SCRIPT, sleep } from './driver.mjs'

const ignore = () => undefined

/**
 * Replay a recording's overlay calls and burn them into its video, in place.
 * @param {string} video - The encoded capture (mp4), rewritten with the overlays on top
 * @param {object} overlays - What `page.overlays()` returned
 * @param {{at: number, call: string}[]} overlays.log - Overlay calls with this machine's time (ms)
 * @param {number[]} overlays.seen - Video times of the first and last flash (s)
 * @param {number[]} overlays.at - This machine's time of the same flashes (ms)
 * @param {{x: number, y: number, width: number, height: number, scale: number}} overlays.placement - The page on the
 *   captured screen, in CSS pixels
 * @returns {Promise<string|null>} Why nothing was drawn, or null once the video carries the overlays
 */
export async function burnOverlays(video, { log, seen, at, placement }) {
  if (!log.length) return 'no overlay calls were made'
  const rate = (seen[1] - seen[0]) / (at[1] - at[0])
  const toVideo = (ms) => seen[0] + (ms - at[0]) * rate
  const events = log.map((e) => ({ t: toVideo(e.at), call: e.call })).filter((e) => e.t >= 0)
  const width = Math.round(placement.width)
  const height = Math.round(placement.height)

  const page = await launch({ width, height })
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-e2e-overlay-'))
  try {
    await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    await page.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })
    await page.eval(OVERLAY_SCRIPT)

    const frames = []
    page.on('Page.screencastFrame', ({ data, sessionId, metadata }) => {
      frames.push({ data, ts: metadata.timestamp })
      page.send('Page.screencastFrameAck', { sessionId }).catch(ignore)
    })
    await page.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 })
    // Played in real time inside the page, so transitions, animations and timers run exactly as they would have.
    const start = await page.eval(`(() => {
      for (const e of ${JSON.stringify(
        events
      )}) setTimeout(() => { try { (0, eval)('window.__e2e.' + e.call) } catch {} }, e.t * 1000)
      return Date.now() / 1000
    })()`)
    await sleep((Math.max(...events.map((e) => e.t)) + 2) * 1000)
    await page.send('Page.stopScreencast').catch(ignore)
    if (frames.length === 0) return 'the overlay page produced no frames'

    // Each still lasts until the next one; a transparent still covers the time before the first.
    const blank = join(dir, 'blank.png')
    spawnSync('ffmpeg', [
      '-y',
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      `color=c=black@0.0:s=${width}x${height},format=rgba`,
      '-frames:v',
      '1',
      blank,
    ])
    const lines = [`file '${blank}'`, `duration ${Math.max(0.001, frames[0].ts - start).toFixed(3)}`]
    frames.forEach((frame, i) => {
      const file = join(dir, `f${String(i).padStart(6, '0')}.png`)
      writeFileSync(file, Buffer.from(frame.data, 'base64'))
      const next = frames[i + 1]?.ts ?? frame.ts + 1
      lines.push(`file '${file}'`, `duration ${Math.max(0.001, next - frame.ts).toFixed(3)}`)
    })
    lines.push(`file '${join(dir, `f${String(frames.length - 1).padStart(6, '0')}.png`)}'`)
    writeFileSync(join(dir, 'list.txt'), lines.join('\n'))

    const scale = placement.scale || 1
    const out = join(dir, 'burned.mp4')
    const ff = spawnSync(
      'ffmpeg',
      [
        '-y',
        '-v',
        'error',
        '-i',
        video,
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        join(dir, 'list.txt'),
        '-filter_complex',
        `[1:v]scale=${Math.round(width * scale)}:${Math.round(height * scale)},format=rgba[o];` +
          `[0:v][o]overlay=${Math.round(placement.x * scale)}:${Math.round(
            placement.y * scale
          )}:eof_action=pass:shortest=0[v]`,
        '-map',
        '[v]',
        '-c:v',
        'libx264',
        '-preset',
        'medium',
        '-crf',
        '22',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        out,
      ],
      { encoding: 'utf8' }
    )
    if (ff.status !== 0) return `ffmpeg failed: ${ff.stderr?.slice(-400)}`
    renameSync(out, video)
    return null
  } finally {
    await page.close().catch(ignore)
    rmSync(dir, { recursive: true, force: true })
  }
}
