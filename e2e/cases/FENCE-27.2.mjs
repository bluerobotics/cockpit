import {
  drawFenceCircle,
  drawFencePolygon,
  FENCE_CIRCLE,
  FENCE_SQUARE,
  fenceState,
  openFenceTab,
  SIDE_POLYGON,
} from '../lib/fence.mjs'
import { distance } from '../lib/vehicle.mjs'

export const meta = { title: 'Add a circle and an exclusion zone', route: '/mission-planning', needs: ['vehicle'] }

/**
 * The square inclusion fence, drawn before recording.
 */
export async function setup({ page }) {
  await openFenceTab(page)
  await drawFencePolygon(page, FENCE_SQUARE)
}

/**
 * Try a circle inside the square, then add a circle and a small polygon turned into an exclusion zone beside it.
 */
export default async function run({ page }) {
  await page.caption('"Add circular fence" inside the square: centre, then a point on the edge')
  await drawFenceCircle(page, [0.42, 0.4], [0.47, 0.4])
  await page.check('A circle can be drawn inside the existing fence', async () => {
    const { circles } = await fenceState(page)
    return { ok: circles.length === 1, detail: circles.length ? 'drawn' : 'the clicks selected the square instead' }
  })
  await page.key('Escape')
  await page.caption('The same beside the square')
  const circle = await drawFenceCircle(page, FENCE_CIRCLE.centre, FENCE_CIRCLE.edge)
  await page.check('A circle fence with the drawn radius', async () => {
    const { circles } = await fenceState(page)
    const expected = distance(circle.center, circle.edge)
    const drawn = circles.at(-1)
    return {
      ok: Boolean(drawn) && Math.abs(drawn.radius - expected) <= Math.max(2, expected * 0.05),
      detail: `${drawn?.radius?.toFixed(1)} m (drawn ${expected.toFixed(1)} m)`,
    }
  })
  await page.caption('A small polygon, then switch it to Exclusion')
  await drawFencePolygon(page, SIDE_POLYGON)
  // Each fence in the editor list has an Inclusion/Exclusion chip; take the one on the "Polygon 2" row.
  const chip = await page.eval(`(() => {
    const leaf = (text) => (e) => e.childElementCount === 0 && e.textContent.trim() === text && e.checkVisibility({ visibilityProperty: true })
    let row = [...document.querySelectorAll('*')].find(leaf('Polygon 2'))
    while (row && ![...row.querySelectorAll('*')].some(leaf('Inclusion'))) row = row.parentElement
    const r = row && [...row.querySelectorAll('*')].find(leaf('Inclusion')).getBoundingClientRect()
    return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null
  })()`)
  if (!chip) throw new Error('no Inclusion chip for the new polygon')
  await page.click(chip, { settle: 1000 })
  await page.check('Two polygons, the new one is an exclusion zone', async () => {
    const { polygons } = await fenceState(page)
    return {
      ok: polygons.length === 2 && polygons.some((p) => !p.inclusion),
      detail: polygons.map((p) => (p.inclusion ? 'inclusion' : 'exclusion')).join(', '),
    }
  })
  await page.wait(1500)
}
