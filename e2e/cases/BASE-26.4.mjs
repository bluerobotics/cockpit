import { chooseInPanel, openBaseStationPanel, placeBaseStation } from '../lib/base-station.mjs'
import { mapPoint, wheelZoom } from '../lib/cockpit.mjs'
import { sawSnackbar } from '../lib/mission.mjs'

export const meta = { title: 'Cellular coverage from OpenCellID (web build)', route: '/', needs: ['vehicle'] }

/**
 * A base station placed before recording.
 */
export async function setup({ page }) {
  await wheelZoom(page, 'widget', 14)
  await placeBaseStation(page, await mapPoint(page, 'widget', 0.45, 0.55))
}

/**
 * Switch the link to mobile data with OpenCellID, the default provider, and show the browser
 * build explain it cannot load it.
 */
export default async function run({ page }) {
  await page.caption('Open the base station panel')
  await openBaseStationPanel(page)
  const told = sawSnackbar(page, 'cannot be loaded from a browser', 10000)
  await chooseInPanel(page, 'Comms', 'Mobile data (4G/5G)')
  await page.check('A message says OpenCellID cannot load in a browser', () => told)
  await page.check('The panel suggests OpenStreetMap or Standalone', async () => {
    const text = await page.text()
    return (
      /OpenCellID cannot be loaded from a browser/.test(text) && /OpenStreetMap/.test(text) && /Standalone/.test(text)
    )
  })
  await page.check('OpenCellID cannot be picked in the browser', () =>
    page.eval(
      `[...document.querySelectorAll('.config-row select option')].find((o) => o.value === 'OpenCellID')?.disabled === true`
    )
  )
  // Serial receivers cannot be read from a browser either, so the panel's serial button is disabled; it has to read
  // as a disabled button, not as a blank white bar.
  await page.check('The disabled serial receiver button stays dark and readable', async () => {
    const look = await page.eval(`(() => {
      const btn = document.querySelector('.config-serial-gnss-btn'); if (!btn) return null
      const s = getComputedStyle(btn); return { bg: s.backgroundColor, color: s.color, text: btn.innerText.trim() } })()`)
    if (!look) return { ok: false, detail: 'no serial button' }
    // A translucent fill shows the dark panel through it, so its alpha weighs how light it really looks.
    const [r, g, b, alpha = 1] = look.bg.match(/[\d.]+/g).map(Number)
    const dark = (alpha * (0.2126 * r + 0.7152 * g + 0.0722 * b)) / 255 < 0.5
    return { ok: dark && look.color !== look.bg, detail: `"${look.text}" ${look.color} on ${look.bg}` }
  })
  await page.wait(2000)
}
