import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

import {
  drawFenceCircle,
  drawFencePolygon,
  FENCE_CIRCLE,
  FENCE_SQUARE,
  fenceState,
  openFenceTab,
} from '../lib/fence.mjs'

export const meta = { title: 'Save and load the fence file', route: '/mission-planning', needs: ['vehicle'] }

/**
 * A polygon and a circle, drawn before recording.
 */
export async function setup({ page }) {
  await openFenceTab(page)
  await drawFencePolygon(page, FENCE_SQUARE)
  await drawFenceCircle(page, FENCE_CIRCLE.centre, FENCE_CIRCLE.edge)
}

/**
 * Save the fence to a file, clear it, load the file back, and show the same fence returns.
 */
export default async function run({ page, outDir }) {
  const saved = await fenceState(page)
  const dir = join(outDir, 'FENCE-27.6-files')
  mkdirSync(dir, { recursive: true })
  await page.caption('"Save fence to file"')
  const file = await page.download(dir, () => page.click('button:has(.mdi-content-save)', { settle: 1500 }))
  await page.check('A fence file was saved', () => ({ ok: Boolean(file), detail: file.split('/').at(-1) }))
  await page.caption('"Clear current fence"')
  await page.click('text=CLEAR CURRENT FENCE', { settle: 1200 })
  await page.click('text=Clear plan', { settle: 1200 })
  await page.check('Fence cleared', async () => {
    const { polygons, circles } = await fenceState(page)
    return polygons.length === 0 && circles.length === 0
  })
  await page.caption('"Load fence from file", pick the saved file')
  await page.chooseFiles([file], () => page.click('button:has(.mdi-upload)', { settle: 500 }))
  await page.wait(2000)
  await page.check('The same fence is back', async () => {
    const now = await fenceState(page)
    const same =
      JSON.stringify(now.polygons) === JSON.stringify(saved.polygons) && now.circles.length === saved.circles.length
    return { ok: same, detail: `${now.polygons.length} polygons, ${now.circles.length} circles` }
  })
  await page.wait(1500)
}
