import { geoToPage, missionState, near, pageToGeo } from '../lib/cockpit.mjs'
import { drawPath4, homeMarker, setHomeByPill } from '../lib/mission.mjs'

export const meta = { title: 'Drag the home marker', route: '/mission-planning', needs: ['vehicle'] }

let home

/**
 * Path and mission home, set before recording.
 */
export async function setup({ page }) {
  await drawPath4(page)
  home = await setHomeByPill(page, [0.36, 0.7])
}

/**
 * Drag the mission home marker and show the planned home follow it.
 */
export default async function run({ page }) {
  const marker = await homeMarker(page, 'planning')
  await page.check('Home marker on the map', () => Boolean(marker))
  await page.caption('Drag the home marker')
  const anchor = await geoToPage(page, 'planning', home)
  const delta = { dx: -80, dy: 50 }
  await page.drag(marker.grab, delta)
  const expected = await pageToGeo(page, 'planning', { x: anchor.x + delta.dx, y: anchor.y + delta.dy })
  await page.check('Planned home moved to the drop point', async () => {
    const { home: now } = await missionState(page)
    return {
      ok: Boolean(now) && near({ lat: now[0], lon: now[1] }, expected, 3e-5),
      detail: now ? `${now[0].toFixed(6)}, ${now[1].toFixed(6)}` : 'none',
    }
  })
  await page.check('Marker drawn at the new place', async () => {
    const m = await homeMarker(page, 'planning')
    return { ok: Boolean(m) && near(m, expected, 3e-5) }
  })
  await page.wait(1500)
}
