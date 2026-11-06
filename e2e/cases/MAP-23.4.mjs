import { drawSimplePath, geoToPage, missionState } from '../lib/cockpit.mjs'
import {
  missionPanelButton,
  planningZoom,
  ROVER,
  RUN_PATH,
  setCruiseSpeed,
  setHomeByPill,
  uploadMission,
} from '../lib/mission.mjs'

export const meta = {
  title: 'The panel stays usable after coming from mission planning with a waypoint selected',
  route: '/mission-planning',
  needs: ['vehicle'],
}

/**
 * Plan and upload, select a waypoint, then switch to the Flight view and press play and pause.
 */
export default async function run({ page, vehicle }) {
  await planningZoom(page)
  await drawSimplePath(page, RUN_PATH)
  await setCruiseSpeed(page, 2)
  await setHomeByPill(page, [0.42, 0.62])
  await page.caption('Select a waypoint (its side panel opens), then upload')
  await page.click(await geoToPage(page, 'planning', (await missionState(page)).waypoints[1]), { settle: 1200 })
  await page.check('"Mission upload succeeded"', () => uploadMission(page))
  await page.caption('"Switch to Flight Mode" with the waypoint still selected, then play')
  await page.click('text=Switch to Flight Mode', { settle: 3000 })
  const play = await missionPanelButton(page, 'mdi-play')
  const covered = await page.eval(
    `(() => { const e = document.elementFromPoint(${play.x}, ${play.y}); return e.closest('button')?.querySelector('.mdi-play') ? '' : e.tagName + '.' + e.className })()`
  )
  await page.click(play, { settle: 4000 })
  await page.check('Play started the mission', async () => {
    const mode = (await vehicle.heartbeat()).custom_mode
    return {
      ok: mode === ROVER.AUTO,
      detail: covered ? `play button covered by ${covered.slice(0, 50)}` : `mode ${mode}`,
    }
  })
  await page.wait(1500)
}
