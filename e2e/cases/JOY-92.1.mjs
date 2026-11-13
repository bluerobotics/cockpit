import {
  axisMapping,
  editAxis,
  JOY_META,
  joystickSetup,
  lakeValue,
  openJoystickPage,
  setAxis,
} from '../lib/joystick.mjs'
import { openMenuPage } from '../lib/mavlink-tools.mjs'

export const meta = { ...JOY_META, title: 'An axis drives an arbitrary data-lake variable feeding a compound' }

export const setup = joystickSetup

const read = async (page) => ({
  increase: await lakeValue(page, 'camera-zoom-increase'),
  zoom: await lakeValue(page, 'camera-zoom'),
})

/**
 * Map axis 3 to camera-zoom-increase, which the compound Camera Zoom is computed from, and push it.
 */
export default async function run({ page }) {
  await page.caption('Settings → Joystick → Table: axis 3 → "Camera Zoom Increase", Min -1, Max 1')
  await openJoystickPage(page)
  await editAxis(page, 3, { min: -1, action: 'Camera Zoom Increase', max: 1 })
  await page.check('Axis 3 drives camera-zoom-increase', async () => {
    const m = await axisMapping(page, 3)
    return { ok: m?.action.id === 'camera-zoom-increase', detail: `${m?.action.id} ${m?.min} / ${m?.max}` }
  })

  await page.caption('Tools → Data-lake: watch "Camera Zoom"')
  await openMenuPage(page, 'tools-datalake')
  await page.fill('input[placeholder="Search variables..."]', 'Camera Zoom')
  await page.wait(1000)
  await page.caption('Push axis 3 to +1')
  await setAxis(page, 3, 1)
  await page.wait(1500)
  const pushed = await read(page)
  await page.caption('Release it')
  await setAxis(page, 3, 0)
  await page.wait(1500)
  const released = await read(page)
  await page.check('Pushed: camera-zoom-increase and the compound camera-zoom are 1', () => ({
    ok: pushed.increase === 1 && pushed.zoom === 1,
    detail: JSON.stringify(pushed),
  }))
  await page.check('Released: both back to 0', () => ({
    ok: released.increase === 0 && released.zoom === 0,
    detail: JSON.stringify(released),
  }))
}
