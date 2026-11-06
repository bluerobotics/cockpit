import { MAP_PROFILE, mapWorkout, missionOnMap, prepareMap } from '../lib/perf.mjs'

export const meta = {
  title: 'Map without a mission: idle, wheel zoom and pan',
  route: '/',
  needs: ['vehicle'],
  perf: true,
  // The cached copy of the vehicle's mission is synced too; empty it so no earlier survey is drawn.
  synced: { ...MAP_PROFILE, 'cockpit-vehicle-mission': [] },
}

/**
 * Centre the map on the boat at a known zoom off camera and let Cockpit finish starting.
 */
export async function setup({ page, vehicle }) {
  await prepareMap(page, vehicle)
}

/**
 * Sit still, then zoom in and out with the wheel, then pan by dragging, measuring each stretch.
 */
export default async function run({ page, vehicle }) {
  // The map also draws the boat's own trail as a line, so a mission shows as waypoint markers and as
  // items on the vehicle, not as just any line.
  await page.check('No mission on the vehicle or the map', async () => {
    const items = (await vehicle.readMission()).length
    const { markers } = await missionOnMap(page)
    return { ok: items === 0 && markers === 0, detail: `${items} items on the vehicle, ${markers} waypoint markers` }
  })
  await mapWorkout(page)
}
