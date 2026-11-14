import { mapPolylines, toFlight } from '../lib/cockpit.mjs'
import { drawFencePolygon, FENCE_SQUARE, openFenceTab } from '../lib/fence.mjs'

export const meta = {
  title: 'Live fence overlay and enforcement toggle in flight',
  route: '/mission-planning',
  needs: ['vehicle'],
}

// Filled shapes (the fence) drawn on a map.
const filledShapes = (page) =>
  page.eval(
    `[...document.querySelectorAll('.leaflet-container path[fill]:not([fill="none"])')].filter((e) => e.checkVisibility({ visibilityProperty: true })).length`
  )

/**
 * A fence uploaded to the vehicle, then the Flight view, before recording.
 */
export async function setup({ page }) {
  await openFenceTab(page)
  await drawFencePolygon(page, FENCE_SQUARE)
  await page.click('text=UPLOAD FENCE TO VEHICLE', { settle: 1000 })
  await page.waitFor(async () => !(await page.store('geo-fence', 's.syncInProgress')), {
    timeout: 30000,
    label: 'the fence upload',
  })
  await toFlight(page)
}

/**
 * Show the fence on the Map widget, then turn enforcement on and off and check the autopilot follows.
 */
export default async function run({ page, vehicle }) {
  await page.caption('Flight view: the fence on the Map widget')
  await page.check('Fence drawn on the Map widget', async () => ({
    ok: (await filledShapes(page)) > 0 || (await mapPolylines(page, 'widget')).length > 0,
    detail: `${await filledShapes(page)} filled shapes`,
  }))
  await page.check('Fence starts disabled on the vehicle', async () => ({
    ok: (await vehicle.readParam('FENCE_ENABLE')) === 0,
    detail: `FENCE_ENABLE ${await vehicle.readParam('FENCE_ENABLE')}`,
  }))
  await page.caption('Fence control (shield), toggle enforcement on')
  await page.click('button:has(.mdi-shield-outline)', { settle: 900 })
  await page.click('button:has(.mdi-toggle-switch-off)', { settle: 2000 })
  await page.check('FENCE_ENABLE is now 1', async () => ({
    ok: (await vehicle.readParam('FENCE_ENABLE')) === 1,
    detail: `FENCE_ENABLE ${await vehicle.readParam('FENCE_ENABLE')}`,
  }))
  await page.caption('And off again')
  await page.click('button:has(.mdi-toggle-switch)', { settle: 2000 })
  await page.check('FENCE_ENABLE is back to 0', async () => ({
    ok: (await vehicle.readParam('FENCE_ENABLE')) === 0,
    detail: `FENCE_ENABLE ${await vehicle.readParam('FENCE_ENABLE')}`,
  }))
  await page.wait(1500)
}
