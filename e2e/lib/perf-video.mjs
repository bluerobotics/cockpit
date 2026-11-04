// Burns a live frame-rate plot into a performance case's video after the run. The plot is drawn on
// this machine from the timings the page recorded, so the machine being measured never paints it:
// the video shows the app's frame rate without the act of showing it changing the frame rate.

import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { launch } from './driver.mjs'

const WIDTH = 560
const HEIGHT = 210
const PLOT_FPS = 10

// The plot page: `draw(now)` paints the ten seconds of frames before `now` (page clock, ms).
const plotPage = (raw) => `<!doctype html><meta charset="utf-8"><body style="margin:0;background:transparent">
<canvas id="c" width="${WIDTH}" height="${HEIGHT}"></canvas><script>
const raw = ${JSON.stringify({ frames: raw.frames, marks: raw.marks, tasks: raw.tasks })}
const ctx = document.getElementById('c').getContext('2d')
const W = ${WIDTH}, H = ${HEIGHT}, L = 40, T = 30, PW = W - L - 12, PH = H - T - 26, SPAN = 10000, MAXF = 70
const y = (fps) => T + PH - (Math.min(fps, MAXF) / MAXF) * PH
const x = (t, now) => L + PW - ((now - t) / SPAN) * PW
const label = (now) => {
  let open = null
  for (const [t, l] of raw.marks) if (t <= now) open = l.startsWith('begin:') ? l.slice(6) : null
  return open
}
window.draw = (now) => {
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = 'rgba(2,6,23,.82)'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, 10); ctx.fill()
  ctx.font = '600 13px -apple-system,Segoe UI,sans-serif'; ctx.textBaseline = 'middle'
  for (const ref of [0, 30, 60]) {
    ctx.strokeStyle = ref ? 'rgba(148,163,184,.45)' : 'rgba(148,163,184,.25)'; ctx.setLineDash(ref ? [4, 4] : [])
    ctx.beginPath(); ctx.moveTo(L, y(ref)); ctx.lineTo(L + PW, y(ref)); ctx.stroke()
    ctx.fillStyle = '#94a3b8'; ctx.fillText(String(ref), 12, y(ref))
  }
  ctx.setLineDash([])
  const f = raw.frames
  let lo = 0
  while (lo < f.length && f[lo] < now - SPAN - 1000) lo++
  let hi = lo
  while (hi < f.length && f[hi] <= now) hi++
  // Long frames as red bands, so a freeze reads as a freeze rather than as a dip.
  ctx.fillStyle = 'rgba(239,68,68,.28)'
  for (let i = Math.max(lo, 1); i < hi; i++) if (f[i] - f[i - 1] > 50) {
    const a = Math.max(x(f[i - 1], now), L), b = x(f[i], now)
    if (b > L) ctx.fillRect(a, T, b - a, PH)
  }
  const line = (color, width, value) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); let started = false
    for (let i = Math.max(lo, 1); i < hi; i++) {
      const px = x(f[i], now); if (px < L) continue
      const py = y(value(i)); started ? ctx.lineTo(px, py) : ctx.moveTo(px, py); started = true
    }
    ctx.stroke()
  }
  // Instantaneous (one frame's interval) in yellow, frames per second over the last second in green.
  line('#facc15', 1.2, (i) => 1000 / (f[i] - f[i - 1]))
  let j = lo
  const perSecond = (i) => { while (f[j] < f[i] - 1000) j++; return i - j }
  line('#4ade80', 2.4, perSecond)
  let k = lo
  while (k < hi && f[k] < now - 1000) k++
  const lastSecond = hi - k
  const ended = hi === f.length && f.length > 0 && now > f[f.length - 1] + 1000
  const lastGap = hi > 1 && !ended ? now - f[hi - 1] : 0
  ctx.fillStyle = '#e2e8f0'; ctx.font = '700 15px -apple-system,Segoe UI,sans-serif'
  ctx.fillText((hi && !ended ? lastSecond : '–') + ' fps', L, 16)
  ctx.font = '600 13px -apple-system,Segoe UI,sans-serif'
  ctx.fillStyle = lastGap > 50 ? '#f87171' : '#94a3b8'
  const note = ended ? 'sampling ended' : 'yellow: each frame · green: last second'
  ctx.fillText(lastGap > 50 ? 'no frame for ' + Math.round(lastGap) + ' ms' : note, L + 90, 16)
  const open = label(now)
  ctx.fillStyle = '#93c5fd'; ctx.textAlign = 'right'
  ctx.fillText(open ? 'measuring: ' + open : '', W - 12, H - 12); ctx.textAlign = 'left'
  ctx.fillStyle = '#64748b'; ctx.fillText('last 10 s', L, H - 12)
}
</script>`

/**
 * Overlay the frame-rate plot on `video` in place. When anything fails the plain recording is kept.
 * @param {string} video - The case's mp4
 * @param {object} raw - The page's series (`finishSampling().raw`)
 * @param {{t: number, ts: number}[]} timeline - Video time and page time of each recorded frame
 * @returns {Promise<string|null>} Why the plot could not be added, or null
 */
export async function overlayFrameRate(video, raw, timeline) {
  if (timeline.length < 2) return 'too few frames carry a timestamp'
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-e2e-plot-'))
  const page = await launch({ width: WIDTH, height: HEIGHT, bare: true })
  try {
    const html = join(dir, 'plot.html')
    writeFileSync(html, plotPage(raw))
    await page.goto(`file://${html}`)
    await page.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })
    // Video time → page time, by interpolating between the recorded frames' own timestamps.
    const pageTime = (t) => {
      let i = timeline.findIndex((p) => p.t >= t)
      if (i === -1) i = timeline.length - 1
      const a = timeline[Math.max(0, i - 1)]
      const b = timeline[i]
      const ts = b.t === a.t ? b.ts : a.ts + ((t - a.t) * (b.ts - a.ts)) / (b.t - a.t)
      return ts * 1000 - raw.origin
    }
    const duration = timeline.at(-1).t
    for (let n = 0; n * (1 / PLOT_FPS) <= duration; n++) {
      await page.eval(`draw(${pageTime(n / PLOT_FPS)})`)
      const { data } = await page.send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(join(dir, `p${String(n).padStart(5, '0')}.png`), Buffer.from(data, 'base64'))
    }
    // Sized to the video, so a small capture gets a proportionally small plot.
    const probe = spawnSync(
      'ffprobe',
      ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width'].concat(['-of', 'csv=p=0', video]),
      { encoding: 'utf8' }
    )
    const videoWidth = Number(probe.stdout.trim()) || 1600
    const plotWidth = Math.round(videoWidth * 0.35)
    const margin = Math.round(videoWidth / 100)
    const out = join(dir, 'out.mp4')
    const ff = spawnSync(
      'ffmpeg',
      ['-y', '-i', video, '-framerate', String(PLOT_FPS), '-i', join(dir, 'p%05d.png')].concat([
        '-filter_complex',
        `[1:v]scale=${plotWidth}:-1[p];[0:v][p]overlay=${margin}:main_h-overlay_h-${margin * 4}:eof_action=pass`,
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
      ]),
      { encoding: 'utf8' }
    )
    if (ff.status !== 0) return ff.stderr?.slice(-500) ?? 'ffmpeg failed'
    renameSync(out, video)
    return null
  } finally {
    await page.close()
    rmSync(dir, { recursive: true, force: true })
  }
}
