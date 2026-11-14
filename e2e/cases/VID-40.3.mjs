import { dismissTutorial } from '../lib/cockpit.mjs'
import { dismissFeaturesDialog } from '../lib/extensions.mjs'
import { closeMenu } from '../lib/mavlink-tools.mjs'
import {
  keepRecordingsInRun,
  openTelemetryPanel,
  OVERLAY_DEFAULTS,
  parseAss,
  pickOverlayColor,
  recordAndReadAss,
  setOverlayField,
  showAss,
} from '../lib/subtitles.mjs'
import { setUpRecording } from '../lib/video.mjs'

export const meta = {
  title: 'Outline colour, shadow size and shadow colour reach the .ass file',
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

/**
 * Set a blue outline, shadow size 4 and a green shadow, record, and read the style back: each
 * option the panel offers should land in the file.
 */
export default async function run({ page }) {
  await page.caption('Settings → Telemetry → Overlay Options: blue outline, shadow size 4, green shadow')
  await openTelemetryPanel(page, 'Overlay Options')
  await pickOverlayColor(page, 'Outline color', [0, 0, 255])
  await setOverlayField(page, 'Shadow size', 4)
  await pickOverlayColor(page, 'Shadow color', [0, 255, 0])
  await closeMenu(page)
  await page.caption('Record a few seconds')
  const ass = await recordAndReadAss(page, 6)
  await page.check('The recording got a .ass file', () => ({ ok: !!ass, detail: ass?.name ?? 'none' }))
  if (!ass) return
  await showAss(page, 'Overlay style', ass.text)
  const { style } = parseAss(ass.text)
  await page.check('Outline colour: blue', () => ({
    ok: style.OutlineColour === '&H00FF0000',
    detail: style.OutlineColour,
  }))
  await page.check('Shadow size: 4', () => ({ ok: style.Shadow === '4', detail: style.Shadow }))
  // In ASS the shadow takes BackColour.
  await page.check('Shadow colour: green', () => ({ ok: style.BackColour === '&H0000FF00', detail: style.BackColour }))
}
