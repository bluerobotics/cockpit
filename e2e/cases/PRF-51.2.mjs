import { vehicleOnline } from '../lib/cockpit.mjs'
import { heartbeatsFlowing } from '../lib/connections.mjs'
import { armerLabel, armerShows, pauseBlueOS, setup } from '../lib/prf.mjs'

export { setup }

export const meta = {
  title: 'Cockpit reconnects by itself after the vehicle link drops',
  route: '/',
  needs: ['vehicle'],
}

/**
 * Freeze the BlueOS container for 15 s, which stops every message from the vehicle without touching the
 * browser, then let it go: Cockpit shows the vehicle offline, then online again with no reload.
 */
export default async function run({ page, vehicleHost }) {
  await page.check('Connected to the vehicle', () => heartbeatsFlowing(page, 2000))
  const loadedAt = await page.eval('performance.timeOrigin')
  await page.caption('Drop the vehicle link: the BlueOS container is frozen for 15 s')
  pauseBlueOS(vehicleHost, true)
  let offline = false
  let shown = ''
  try {
    offline = await page.waitFor(async () => !(await vehicleOnline(page)), { timeout: 15000 }).catch(() => false)
    await armerShows(page, 'Offline', 3000)
    shown = await armerLabel(page)
    await page.check('Cockpit shows the vehicle offline', () => ({
      ok: offline && shown === 'Offline',
      detail: `Armer "${shown}"`,
    }))
    await page.wait(Math.max(0, 15000 - 4000))
  } finally {
    pauseBlueOS(vehicleHost, false)
  }
  await page.caption('Link restored: wait up to 30 s')
  const back = await page.waitFor(() => vehicleOnline(page), { timeout: 30000 }).catch(() => false)
  await armerShows(page, 'Disarmed', 10000)
  await page.check('The vehicle is online again and the Armer button reads "Disarmed"', async () => ({
    ok: back && (await armerLabel(page)) === 'Disarmed',
    detail: `online ${back}, Armer "${await armerLabel(page)}"`,
  }))
  await page.check('Heartbeats flow again, in the same page load', async () => {
    const flowing = await heartbeatsFlowing(page, 3000)
    const same = (await page.eval('performance.timeOrigin')) === loadedAt
    return { ok: flowing.ok && same, detail: `${flowing.detail}, no reload ${same}` }
  })
}
