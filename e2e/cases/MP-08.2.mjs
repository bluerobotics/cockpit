import { mapPoint, missionState, near, pageToGeo } from '../lib/cockpit.mjs'
import { drawPath4, homeMarker, sawSnackbar } from '../lib/mission.mjs'

export const meta = {
  title: 'Set the mission home from the map context menu',
  route: '/mission-planning',
  needs: ['vehicle'],
}

/**
 * The standard four-waypoint path, drawn before recording.
 */
export async function setup({ page }) {
  await drawPath4(page)
}

/**
 * Right-click the map, "Set mission home", and show the home there.
 */
export default async function run({ page }) {
  const at = await mapPoint(page, 'planning', 0.34, 0.68)
  const clicked = await pageToGeo(page, 'planning', at)
  await page.caption('Right-click the map, "Set mission home"')
  const said = sawSnackbar(page, 'Mission home set to', 10000)
  await page.rightClick(at, { settle: 900 })
  await page.click('text=Set mission home', { settle: 1200 })
  await page.check('"Mission home set to …" shown', () => said)
  await page.check('Planned home is where the map was right-clicked', async () => {
    const { home } = await missionState(page)
    return {
      ok: Boolean(home) && near({ lat: home[0], lon: home[1] }, clicked),
      detail: home ? `${home[0].toFixed(6)}, ${home[1].toFixed(6)}` : 'none',
    }
  })
  await page.check('Home marker drawn there', async () => {
    const marker = await homeMarker(page, 'planning')
    return {
      ok: Boolean(marker) && near(marker, clicked, 2e-5),
      detail: marker ? `${marker.lat.toFixed(6)}, ${marker.lon.toFixed(6)}` : 'none',
    }
  })
  await page.wait(1500)
}
