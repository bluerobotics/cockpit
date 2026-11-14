import { dismissTutorial } from '../lib/cockpit.mjs'
import { dismissFeaturesDialog } from '../lib/extensions.mjs'
import { closeMenu } from '../lib/mavlink-tools.mjs'
import {
  keepRecordingsInRun,
  openTelemetryPanel,
  OVERLAY_DEFAULTS,
  parseAss,
  recordAndReadAss,
} from '../lib/subtitles.mjs'
import { setUpRecording } from '../lib/video.mjs'

export const meta = {
  title: 'Telemetry frequency sets how often the subtitles update',
  route: '/',
  needs: ['vehicle', 'camera'],
  synced: OVERLAY_DEFAULTS,
}

export const setup = async (ctx) => {
  const { page } = ctx
  await dismissFeaturesDialog(page)
  await dismissTutorial(page, 3000)
  await keepRecordingsInRun(ctx)
  await setUpRecording(page)
}

const steps = (ass) => {
  const starts = [...new Set(ass.dialogues.map((d) => d.start))].sort((a, b) => a - b)
  const gaps = starts
    .slice(1)
    .map((s, i) => s - starts[i])
    .sort((a, b) => a - b)
  return { lines: starts.length, median: gaps[Math.floor(gaps.length / 2)] }
}

/**
 * Record at the default 1 Hz, set the telemetry frequency to 5 Hz, record again: the subtitles change
 * once a second in the first file and five times a second in the second.
 */
export default async function run({ page }) {
  await page.caption('Record at the default telemetry frequency (1 Hz)')
  const first = await recordAndReadAss(page, 8)
  await page.caption('Settings → Telemetry → Settings: Telemetry frequency 5 Hz')
  await openTelemetryPanel(page, 'Settings')
  const field =
    await page.eval(`(() => { const i = [...document.querySelectorAll('p')].find((p) => p.textContent.trim().startsWith('Telemetry frequency')
      && p.checkVisibility({ visibilityProperty: true }))?.nextElementSibling?.querySelector('input[type=number]')
    i.scrollIntoView({ block: 'center' }); const r = i.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  await page.fill(field, 5)
  await page.key('Tab', { show: false })
  await page.wait(1000)
  await closeMenu(page)
  await page.caption('Record again at 5 Hz')
  const second = await recordAndReadAss(page, 8)
  await page.check('Both recordings got a .ass file', () => ({
    ok: !!first && !!second,
    detail: `${first?.name}, ${second?.name}`,
  }))
  if (!first || !second) return
  const slow = steps(parseAss(first.text))
  const fast = steps(parseAss(second.text))
  await page.check('1 Hz: a new subtitle every second', () => ({
    ok: Math.abs(slow.median - 1) <= 0.1,
    detail: `${slow.lines} updates, median ${slow.median.toFixed(2)} s apart`,
  }))
  await page.check('5 Hz: a new subtitle every 0.2 s', () => ({
    ok: Math.abs(fast.median - 0.2) <= 0.05,
    detail: `${fast.lines} updates, median ${fast.median.toFixed(2)} s apart`,
  }))
}
