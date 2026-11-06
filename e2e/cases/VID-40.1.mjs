import { dismissTutorial } from '../lib/cockpit.mjs'
import { dismissFeaturesDialog } from '../lib/extensions.mjs'
import { closeMenu } from '../lib/mavlink-tools.mjs'
import {
  keepRecordingsInRun,
  openTelemetryPanel,
  OVERLAY_DEFAULTS,
  OVERLAY_KEYS,
  parseAss,
  pickOverlayColor,
  recordAndReadAss,
  removeOverlayVariable,
  setOverlayField,
  showAss,
  toggleOverlayCheckbox,
} from '../lib/subtitles.mjs'
import { setUpRecording } from '../lib/video.mjs'

export const meta = {
  title: 'Subtitle options and variables change the generated .ass file',
  route: '/',
  needs: ['vehicle', 'camera'],
  synced: OVERLAY_DEFAULTS,
  restore: OVERLAY_KEYS,
}

export const setup = async (ctx) => {
  const { page } = ctx
  await dismissFeaturesDialog(page)
  await dismissTutorial(page, 3000)
  await keepRecordingsInRun(ctx)
  await setUpRecording(page)
}

/**
 * Record with the default overlay, then change font size, bold, font colour and drop "Battery
 * voltage", record again, and compare the two .ass files.
 */
export default async function run({ page }) {
  await page.caption('Record a few seconds with the default telemetry overlay')
  const first = await recordAndReadAss(page, 6)
  await page.check('The recording got a .ass file', () => ({ ok: !!first, detail: first?.name ?? 'none' }))
  if (!first) return
  await showAss(page, 'Default overlay', first.text)
  const before = parseAss(first.text)

  await page.caption('Settings → Telemetry → Overlay Options: font size 44, bold, red text')
  await openTelemetryPanel(page, 'Overlay Options')
  await setOverlayField(page, 'Font size', 44)
  await toggleOverlayCheckbox(page, 'Bold')
  await pickOverlayColor(page, 'Font color', [255, 0, 0])
  await page.caption('Remove "Battery voltage" from the grid')
  await removeOverlayVariable(page, 'Battery voltage')
  await closeMenu(page)

  await page.caption('Record again')
  const second = await recordAndReadAss(page, 6)
  await page.check('The second recording got its own .ass file', () => ({
    ok: !!second,
    detail: second?.name ?? 'none',
  }))
  if (!second) return
  await showAss(page, 'Changed overlay', second.text)
  const after = parseAss(second.text)

  await page.check('Font size 30 → 44', () => ({
    ok: before.style.Fontsize === '30' && after.style.Fontsize === '44',
    detail: `${before.style.Fontsize} → ${after.style.Fontsize}`,
  }))
  await page.check('Bold off → on', () => ({
    ok: before.style.Bold === '0' && after.style.Bold === '-1',
    detail: `${before.style.Bold} → ${after.style.Bold}`,
  }))
  // ASS colours are &HAABBGGRR, with 00 alpha meaning opaque.
  await page.check('Text colour white → red', () => ({
    ok: before.style.PrimaryColour === '&H00FFFFFF' && after.style.PrimaryColour === '&H000000FF',
    detail: `${before.style.PrimaryColour} → ${after.style.PrimaryColour}`,
  }))
  const battery = (ass) => ass.dialogues.some((d) => d.text.includes('Battery voltage'))
  await page.check('"Battery voltage" leaves the subtitles, "Battery current" stays', () => ({
    ok: battery(before) && !battery(after) && after.dialogues.some((d) => d.text.includes('Battery current')),
    detail: `before ${battery(before)}, after ${battery(after)}`,
  }))
}
