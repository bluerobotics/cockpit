import { placePoi, poiMarkers, wheelZoom } from '../lib/cockpit.mjs'

export const meta = {
  title: 'Two Map widgets in the same view stay in sync',
  route: '/',
  needs: ['vehicle'],
}

// Visible Map widgets, left to right, as `{ id, box }`.
const mapWidgets = (page) =>
  page.eval(`(window.__e2eMaps || []).filter((m) => m.getContainer().id.startsWith('map-') && m.getContainer().checkVisibility({ visibilityProperty: true }))
    .map((m) => { const r = m.getContainer().getBoundingClientRect(); return { id: m.getContainer().id, box: { x: r.x, y: r.y, w: r.width, h: r.height } } })
    .sort((a, b) => a.box.x - b.box.x)`)

/**
 * Split the view between the existing Map widget and a second one, through the widget store. The
 * next case starts from the test user's own layout again.
 */
export async function setup({ page }) {
  await page.store(
    'widget-manager',
    `(() => {
      const view = s.currentView
      const map = view.widgets.find((w) => w.component === 'Map')
      map.position = { x: 0, y: 0.05 }; map.size = { width: 0.5, height: 0.88 }
      const second = s.addWidget({ component: 'Map', name: 'Map', options: {} }, view)
      second.position = { x: 0.5, y: 0.05 }; second.size = { width: 0.5, height: 0.88 }
      return true })()`
  )
  await page.waitFor(async () => (await mapWidgets(page)).length === 2, { label: 'two Map widgets' })
  await page.wait(2500)
}

/**
 * Place a POI on the left Map widget and show it appear on the right one.
 */
export default async function run({ page }) {
  const [left, right] = await mapWidgets(page)
  await page.caption('Two Map widgets side by side')
  await page.check('Two Map widgets on the view, no POIs yet', async () => {
    const counts = [(await poiMarkers(page, left.id)).length, (await poiMarkers(page, right.id)).length]
    return { ok: counts.every((n) => n === 0), detail: `POIs: ${counts.join(' / ')}` }
  })

  await page.caption('Place a point of interest on the left one')
  const centre = { x: left.box.x + left.box.w / 2, y: left.box.y + left.box.h / 2 }
  await wheelZoom(page, left.id, 17, centre)
  const placed = await placePoi(
    page,
    left.id,
    { x: left.box.x + left.box.w * 0.7, y: left.box.y + left.box.h * 0.35 },
    'Shared buoy'
  )

  await page.caption('It shows on the right one too, at the same coordinates')
  await page.check('Left widget has it where it was placed', async () => {
    const [poi] = await poiMarkers(page, left.id)
    return { ok: Boolean(poi) && Math.abs(poi.lat - placed.lat) < 1e-5 && Math.abs(poi.lon - placed.lon) < 1e-5 }
  })
  await page.check('Right widget has it too, at the same coordinates, on screen', async () => {
    const [poi] = await poiMarkers(page, right.id)
    const ok = Boolean(poi?.onScreen) && Math.abs(poi.lat - placed.lat) < 1e-5 && Math.abs(poi.lon - placed.lon) < 1e-5
    return { ok, detail: poi ? `${poi.lat.toFixed(6)}, ${poi.lon.toFixed(6)}` : 'missing' }
  })
  await page.wait(1500)
}
