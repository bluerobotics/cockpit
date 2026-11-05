import { enterEditMode, exitEditMode } from '../lib/custom-widget.mjs'
import {
  addInputContainer,
  containerElements,
  dropCard,
  INPUT_KEYS,
  INPUT_SYNCED,
  paletteMode,
  quietStart,
} from '../lib/inputs.mjs'

export const meta = {
  title: 'Mini and input widgets inside a Collapsible Container',
  route: '/',
  needs: ['vehicle'],
  synced: INPUT_SYNCED,
  restore: INPUT_KEYS,
}

export const setup = quietStart

/**
 * A container with a Slider and a Clock, collapsed and expanded, then reloaded.
 */
export default async function run({ page }) {
  await page.caption('Edit interface → Input → Add new container; a Slider into it')
  await enterEditMode(page)
  const rows = await addInputContainer(page)
  await dropCard(page, 'Slider', rows[0])
  await page.caption('Mini → a Clock into it')
  await paletteMode(page, 'Mini')
  await dropCard(page, 'Clock', rows[1])
  const elements = await containerElements(page)
  const kinds = () => elements.map((e) => e.component).join(', ')
  await page.check('The container holds the Slider and the Clock', () => ({
    ok: ['Slider', 'Clock'].every((c) => elements.some((e) => e.component === c)),
    detail: kinds() || 'empty',
  }))
  await exitEditMode(page)

  const hashes = elements.map((e) => e.hash)
  const shown = () =>
    page.eval(
      `${JSON.stringify(
        hashes
      )}.filter((h) => document.querySelector('[data-widget-hash="' + h + '"]')?.getClientRects().length).length`
    )
  const chevron = `[...document.querySelectorAll('button')].find((b) => b.querySelector('.mdi-chevron-left, .mdi-chevron-right')
    && b.closest('.rounded-lg.overflow-hidden')?.querySelector('[data-widget-hash="${hashes[0]}"]'))`
  const at = async () => {
    const p = await page.eval(`(() => { const b = ${chevron}; if (!b) return null; const r = b.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
    if (!p) throw new Error('no collapse button on the container')
    return p
  }
  const before = await shown()
  await page.caption('Collapse the container with its chevron')
  await page.click(await at(), { settle: 1200 })
  const collapsed = await shown()
  await page.caption('Expand it again')
  await page.click(await at(), { settle: 1200 })
  const expanded = await shown()
  await page.check('Both hide on collapse and come back on expand', () => ({
    ok: before === 2 && collapsed === 0 && expanded === 2,
    detail: `shown ${before} → collapsed ${collapsed} → expanded ${expanded}`,
  }))

  await page.caption('Reload')
  await page.reload()
  await page.waitFor(() => page.eval(`!!document.querySelector('#app')?.__vue_app__`), { timeout: 30000 })
  await page.waitFor(async () => (await shown()) === 2, { timeout: 30000 }).catch(() => undefined)
  await page.check('Both are still in the container after the reload', async () => {
    const after = (await containerElements(page)).map((e) => e.hash)
    return {
      ok: hashes.every((h) => after.includes(h)) && (await shown()) === 2,
      detail: `${after.length} stored, ${await shown()} drawn`,
    }
  })
}
