import { missionState, near } from '../lib/cockpit.mjs'
import { drawPath4, homeMarker, sawSnackbar, setHomeByPill } from '../lib/mission.mjs'

export const meta = {
  title: 'Set the mission home from the "Set mission home" pill',
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
 * Place the mission home with the sidebar pill and show it on the map and in the plan.
 */
export default async function run({ page }) {
  await page.caption('"Set mission home", then click where home goes')
  const said = sawSnackbar(page, 'Mission home set to', 10000)
  const clicked = await setHomeByPill(page, [0.36, 0.7])
  await page.check('"Mission home set to …" shown', () => said)
  await page.check('Planned home is where the map was clicked', async () => {
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
