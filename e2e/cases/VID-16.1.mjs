import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

import { dismissTutorial } from '../lib/cockpit.mjs'
import { dismissFeaturesDialog } from '../lib/extensions.mjs'
import { keepRecordingsInRun } from '../lib/subtitles.mjs'
import { recordFor, RECORDING_MINUTES, setUpRecording, STREAM, videoPlayback } from '../lib/video.mjs'

export const meta = {
  title: `${RECORDING_MINUTES}-minute recording in Standalone with the 1080p stream on WebRTC`,
  route: '/',
  needs: ['vehicle', 'camera'],
  platforms: ['electron'],
}

/**
 * Keep the recording in the run folder, and put a Video widget on the 1080p stream with the mini
 * recorder beside it.
 */
export const setup = async (ctx) => {
  await dismissFeaturesDialog(ctx.page)
  await dismissTutorial(ctx.page, 3000)
  await keepRecordingsInRun(ctx)
  await setUpRecording(ctx.page)
}

const probe = (file, args) => spawnSync('ffprobe', ['-v', 'error', ...args, file], { encoding: 'utf8' }).stdout.trim()

// Mean luma of one frame at `seconds`, 0 (black) to 255.
const brightness = (file, seconds) => {
  const out = spawnSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-ss',
      String(seconds),
      '-i',
      file,
      '-frames:v',
      '1',
      '-vf',
      'signalstats,metadata=print:file=-',
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8' }
  )
  return Number((out.stderr + out.stdout).match(/YAVG=([\d.]+)/)?.[1] ?? NaN)
}

/**
 * Record the 1080p stream for the configured time in Standalone, wait for Cockpit to finish the file,
 * and check the file on disk: its length, and frames at the start, middle and end that are not black.
 */
export default async function run({ page, outDir, meta: { id } }) {
  await page.caption(`"${STREAM}" playing live in a Video widget`)
  await page.check('The 1080p video is live', async () => {
    const v = await videoPlayback(page)
    return { ok: v?.width > 0, detail: v ? `${v.width}×${v.height}` : 'no video' }
  })
  // The snackbar is up for a few seconds only, so every text that appears is noted from now on.
  await page.eval(`(() => { window.__seenTexts = new Set(); new MutationObserver(() => {
    for (const el of document.querySelectorAll('#snackbar-container, .v-snackbar')) window.__seenTexts.add(el.innerText.trim()) })
    .observe(document.body, { childList: true, subtree: true, characterData: true }) })()`)
  await recordFor(page, RECORDING_MINUTES)

  await page.caption('Cockpit finishes the video file')
  const seen = () => page.eval(`[...window.__seenTexts].some((t) => t.includes('Video processing completed.'))`)
  const finished = await page.waitFor(seen, { timeout: 600000, label: 'processing to finish' }).catch(() => false)
  await page.check('"Video processing completed."', () => finished)

  const folder = join(outDir, 'cockpit-folder', id, 'videos')
  const videos = readdirSync(folder).filter((f) => f.endsWith('.mp4'))
  await page.check('The recording is saved as an mp4 in the Cockpit folder', () => ({
    ok: videos.length === 1,
    detail: videos.join(', ') || `nothing in ${folder}`,
  }))
  if (videos.length !== 1) return
  const file = join(folder, videos[0])
  const seconds = Number(probe(file, ['-show_entries', 'format=duration', '-of', 'csv=p=0']))
  await page.check(`The file is about ${RECORDING_MINUTES} min long`, () => ({
    ok: Math.abs(seconds - RECORDING_MINUTES * 60) <= Math.max(0.03 * RECORDING_MINUTES * 60, 10),
    detail: `${(seconds / 60).toFixed(2)} min (${probe(file, [
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=codec_name,width,height',
      '-of',
      'csv=p=0',
    ])})`,
  }))
  const levels = [5, seconds / 2, seconds - 5].map((t) => brightness(file, t))
  await page.check('Frames at the start, middle and end show the camera, not black', () => ({
    ok: levels.every((y) => y > 16),
    detail: `mean luma ${levels.map((y) => y.toFixed(0)).join(' / ')}`,
  }))
}
