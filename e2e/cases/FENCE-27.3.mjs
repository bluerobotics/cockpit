import { near } from '../lib/cockpit.mjs'
import {
  drawFenceCircle,
  drawFencePolygon,
  FENCE_CIRCLE,
  FENCE_SQUARE,
  fenceState,
  openFenceTab,
  vehicleFence,
} from '../lib/fence.mjs'

export const meta = { title: 'The fence reaches the vehicle', route: '/mission-planning', needs: ['vehicle'] }

/**
 * A square inclusion fence and a circle, drawn before recording.
 */
export async function setup({ page }) {
  await openFenceTab(page)
  await drawFencePolygon(page, FENCE_SQUARE)
  await drawFenceCircle(page, FENCE_CIRCLE.centre, FENCE_CIRCLE.edge)
}

/**
 * Upload the fence and read it back from the autopilot.
 */
export default async function run({ page, vehicle }) {
  const plan = await fenceState(page)
  await page.caption('A polygon and a circle: "Upload fence to vehicle"')
  await page.click('text=UPLOAD FENCE TO VEHICLE', { settle: 1000 })
  await page.waitFor(async () => !(await page.store('geo-fence', 's.syncInProgress')), {
    timeout: 30000,
    label: 'the fence upload',
  })
  await page.wait(1500)
  const onVehicle = await vehicleFence(vehicle)
  await page.check('Vehicle holds the polygon, corner by corner', () => {
    const vertices = plan.polygons[0].vertices
    const ok =
      onVehicle.polygonVertices.length === vertices.length &&
      vertices.every(([lat, lon], i) => near({ lat, lon }, onVehicle.polygonVertices[i], 2e-7))
    return { ok, detail: `${onVehicle.polygonVertices.length} vertices on the vehicle` }
  })
  await page.check('Vehicle holds the circle, same centre and radius', () => {
    const [c] = plan.circles
    const v = onVehicle.circles[0]
    const ok =
      Boolean(v) && near({ lat: c.center[0], lon: c.center[1] }, v.center, 2e-7) && Math.abs(v.radius - c.radius) < 0.5
    return { ok, detail: v ? `radius ${v.radius.toFixed(1)} m` : 'no circle' }
  })
  await page.wait(1500)
}
