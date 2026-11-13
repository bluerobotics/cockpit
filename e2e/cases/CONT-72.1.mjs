import { enterEditMode, exitEditMode } from '../lib/custom-widget.mjs'
import { barDropPoint, dropCard, INPUT_SYNCED, paletteMode, placed, quietStart } from '../lib/inputs.mjs'

export const meta = {
  title: 'Mini widgets added to the top and bottom bars',
  route: '/',
  needs: ['vehicle'],
  synced: INPUT_SYNCED,
}

export const setup = quietStart

/**
 * Drop a Clock into the top bar and a Very Generic Indicator into the bottom bar, then reload: both stay.
 */
export default async function run({ page }) {
  await page.caption('Edit interface → Mini: Clock into the top bar, Very Generic Indicator into the bottom bar')
  await enterEditMode(page)
  await paletteMode(page, 'Mini')
  await dropCard(page, 'Clock', await barDropPoint(page, 'top'))
  await dropCard(page, 'Very Generic Indicator', await barDropPoint(page, 'bottom'))
  const clock = await placed(page, 'Clock')
  const indicator = await placed(page, 'VeryGenericIndicator')
  await page.check('The Clock is in the top bar, the indicator in the bottom bar', () => ({
    ok: clock?.where === 'top bar' && indicator?.where === 'bottom bar',
    detail: `Clock in ${clock?.where ?? 'nothing'}, indicator in ${indicator?.where ?? 'nothing'}`,
  }))
  await exitEditMode(page)

  const shown = (hash) =>
    page.eval(`(() => { const el = document.querySelector('[data-widget-hash="${hash}"]')
      return el?.getClientRects().length ? el.innerText.replace(/\\s+/g, ' ').trim() : null })()`)
  const now = () =>
    page.eval(
      `(() => { const d = new Date(); return [d.getHours(), d.getMinutes()].map((n) => String(n).padStart(2, '0')).join(':') })()`
    )
  await page.check('The clock shows the current time, the indicator is drawn', async () => {
    const text = await shown(clock.hash)
    return {
      ok: !!text?.includes(await now()) && (await shown(indicator.hash)) !== null,
      detail: `clock "${text}", indicator "${await shown(indicator.hash)}"`,
    }
  })

  await page.caption('Reload')
  await page.reload()
  await page.waitFor(() => page.eval(`!!document.querySelector('#app')?.__vue_app__`), { timeout: 30000 })
  await page
    .waitFor(() => page.eval(`!!document.querySelector('[data-widget-hash="${clock.hash}"]')`), {
      timeout: 30000,
      label: 'the clock after the reload',
    })
    .catch(() => undefined)
  await page.wait(2000)
  await page.check('Both are still in their bars after the reload', async () => {
    const c = await placed(page, 'Clock')
    const i = await placed(page, 'VeryGenericIndicator')
    const visible = (await shown(clock.hash)) !== null && (await shown(indicator.hash)) !== null
    return {
      ok:
        c?.hash === clock.hash &&
        c.where === 'top bar' &&
        i?.hash === indicator.hash &&
        i.where === 'bottom bar' &&
        visible,
      detail: `Clock in ${c?.where ?? 'nothing'}, indicator in ${i?.where ?? 'nothing'}, both drawn ${visible}`,
    }
  })
}
