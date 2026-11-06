import { lawnmower, MAP_PROFILE, mapWorkout, missionOnMap, prepareMap } from '../lib/perf.mjs'

export const meta = {
  title: 'Map with a 400-waypoint survey: idle, wheel zoom and pan',
  route: '/',
  needs: ['vehicle'],
  perf: true,
  synced: { ...MAP_PROFILE, 'cockpit-vehicle-mission': [] },
}

const WAYPOINTS = 400
// ArduPilot keeps item 0 as the home position, so the map draws one point fewer than was uploaded.
const DRAWN = WAYPOINTS - 1

/**
 * Load a 400-waypoint survey around the boat on the vehicle, so Cockpit finds it there on start.
 */
export async function beforeLaunch({ vehicle }) {
  await vehicle.writeMission(lawnmower(await vehicle.position(), WAYPOINTS))
}

/**
 * Wait for the survey to be on the map, then centre the map on the boat at a known zoom, all off camera.
 */
export async function setup({ page, vehicle }) {
  await page.waitFor(() => missionOnMap(page).then(({ markers }) => markers >= DRAWN), {
    label: `the ${WAYPOINTS}-waypoint survey to be drawn`,
    timeout: 180000,
  })
  await prepareMap(page, vehicle)
}

/**
 * The same workout as PERF-01, with the survey drawn on the map.
 */
export default async function run({ page }) {
  await page.check('The survey is on the map', async () => {
    const { points, markers } = await missionOnMap(page)
    return { ok: markers >= DRAWN, detail: `${markers} waypoint markers, ${points}-point line (read on Leaflet only)` }
  })
  await mapWorkout(page)
}
