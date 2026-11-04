import { CENTER, isTracking, openCenterDial } from '../lib/centering.mjs'
import { mapExpr, mapPoint, mapView } from '../lib/cockpit.mjs'
import { armVehicle } from '../lib/mission.mjs'
import {
  lawnmower,
  MAP_PROFILE,
  measure,
  measureGestures,
  missionOnMap,
  prepareMap,
  wheelPlan,
  ZOOM_FLICKS,
} from '../lib/perf.mjs'
import { distance } from '../lib/vehicle.mjs'

export const meta = {
  title: 'Following the boat while it runs a 400-waypoint survey',
  route: '/',
  needs: ['vehicle'],
  perf: true,
  synced: { ...MAP_PROFILE, 'cockpit-vehicle-mission': [] },
}

const WAYPOINTS = 400
// ArduPilot keeps item 0 as the home position, so the map draws one point fewer than was uploaded.
const DRAWN = WAYPOINTS - 1
const AUTO = 10

/**
 * Load the survey on the vehicle before Cockpit starts.
 */
export async function beforeLaunch({ vehicle }) {
  await vehicle.writeMission(lawnmower(await vehicle.position(), WAYPOINTS))
}

/**
 * Wait for the survey on the map, then start the boat on it at 3 m/s, all off camera.
 */
export async function setup({ page, vehicle }) {
  await page.waitFor(() => missionOnMap(page).then(({ markers }) => markers >= DRAWN), {
    label: `the ${WAYPOINTS}-waypoint survey to be drawn`,
    timeout: 180000,
  })
  await prepareMap(page, vehicle)
  await armVehicle(vehicle)
  await vehicle.command('MAV_CMD_DO_SET_MODE', [1, AUTO])
  await vehicle.command('MAV_CMD_MISSION_START', [0, 0])
  await vehicle.command('MAV_CMD_DO_CHANGE_SPEED', [1, 3, -1])
  await page.wait(5000)
}

/**
 * Follow the boat for 30 s without touching anything, then zoom with the wheel while it keeps going.
 */
export default async function run({ page, vehicle }) {
  const map = mapExpr('widget')
  await page.caption('The boat is running the survey. Double-click the vehicle button to follow it')
  await openCenterDial(page)
  await page.dblClick(CENTER.vehicle, { settle: 1500 })
  await page.check('Vehicle button shows it is tracking', () => isTracking(page, CENTER.vehicle))
  await page.key('Escape', { show: false })

  const start = await vehicle.position()
  const gaps = []
  await page.caption('Following for 30 s, hands off')
  await measure(
    page,
    'follow',
    async () => {
      for (let i = 0; i < 15; i++) {
        await page.wait(2000)
        gaps.push(distance(await mapView(page, 'widget'), await vehicle.position()))
      }
    },
    { map }
  )
  const travelled = distance(start, await vehicle.position())
  await page.check('The boat moved', () => ({ ok: travelled > 30, detail: `${travelled.toFixed(0)} m` }))
  await page.check('The map kept the boat centred', () => {
    const worst = Math.max(...gaps)
    return { ok: worst < 15, detail: `worst ${worst.toFixed(1)} m from the centre` }
  })

  await page.caption('Zoom in and out with the wheel while following')
  const at = await mapPoint(page, 'widget', 0.35, 0.6)
  const flicks = [...ZOOM_FLICKS, ...ZOOM_FLICKS, ...ZOOM_FLICKS]
  const zoom = await measureGestures(page, 'follow + wheel zoom', at, wheelPlan(at, flicks), 1500, { map })
  await page.check('The map zoomed while following', () => ({ ok: zoom.map > 0, detail: `${zoom.map} map moves` }))
}
