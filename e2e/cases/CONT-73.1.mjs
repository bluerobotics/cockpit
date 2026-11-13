import { addActionButton, enterEditMode, exitEditMode } from '../lib/custom-widget.mjs'
import { centreOf, dropCard, INPUT_SYNCED, paletteMode, placed, quietStart } from '../lib/inputs.mjs'

export const meta = {
  title: 'Mini and input widgets inside a Mini Widgets Bar',
  route: '/',
  needs: ['vehicle'],
  synced: INPUT_SYNCED,
}

export const setup = quietStart

const BAR = `[...document.querySelectorAll('[class*="bg-slate-600/50"]')].find((e) => e.getClientRects().length)`

const barWidgets = (page) =>
  page.store(
    'widget-manager',
    `s.currentView.widgets.filter((w) => w.component === 'MiniWidgetsBar').flatMap((w) => w.options.miniWidgetsContainer?.widgets ?? []).map((w) => w.component)`
  )

/**
 * Drag a Mini Widgets Bar onto the view, put a Battery Indicator and a Button (toggling the top bar) in it, use
 * them, and reload: both stay in the bar.
 */
export default async function run({ page }) {
  await page.caption('Edit interface → Regular: drag a Mini Widgets Bar onto the view')
  await enterEditMode(page)
  await paletteMode(page, 'Regular')
  const card = await centreOf(
    page,
    `[...document.querySelectorAll('[draggable=true]')].find((e) => e.innerText.includes('Mini Widgets Bar'))`
  )
  await page.drag(card, { x: page.width * 0.56, y: page.height * 0.3 }, { html5: true, duration: 1200, settle: 2000 })
  await page.caption('Mini → Battery Indicator into it')
  await paletteMode(page, 'Mini')
  await dropCard(page, 'Battery Indicator', await centreOf(page, BAR))
  await page.caption('Input → a Button into it, set to "Toggle top bar"')
  await paletteMode(page, 'Input')
  // Beside the indicator rather than on it: dropped onto it, the button stays in the bottom bar it crossed on the way.
  const free = await page.eval(
    `(() => { const r = ${BAR}.getBoundingClientRect(); return { x: r.right - 20, y: r.y + r.height / 2 } })()`
  )
  await addActionButton(page, free, 'Top bar', 'Toggle top bar')
  await page.check('The bar holds the Battery Indicator and the Button', async () => {
    const list = await barWidgets(page)
    return { ok: list.includes('BatteryIndicator') && list.includes('Button'), detail: list.join(', ') || 'empty' }
  })
  await exitEditMode(page)

  const battery = await placed(page, 'BatteryIndicator')
  const batteryText = () =>
    page.eval(`document.querySelector('[data-widget-hash="${battery?.hash}"]')?.innerText.replace(/\\s+/g, ' ').trim()`)
  await page.check('The Battery Indicator shows the vehicle voltage', async () => {
    const text = await batteryText()
    return { ok: /\d+(\.\d+)?\s*V/.test(text ?? ''), detail: text ?? 'not drawn' }
  })
  const topBar = () => page.eval(`!!document.querySelector('#mainTopBar')?.getClientRects().length`)
  await page.caption('Press "Top bar" twice')
  await page.click('text=Top bar', { settle: 1500 })
  const hidden = !(await topBar())
  await page.click('text=Top bar', { settle: 1500 })
  await page.check('The Button works: the top bar hides, then comes back', async () => ({
    ok: hidden && (await topBar()),
    detail: `hidden after one press ${hidden}, back after two ${await topBar()}`,
  }))

  await page.caption('Reload')
  await page.reload()
  await page.waitFor(() => page.eval(`!!document.querySelector('#app')?.__vue_app__`), { timeout: 30000 })
  await page
    .waitFor(() => page.eval(`!!${BAR}?.querySelector('[data-widget-hash]')`), {
      timeout: 30000,
      label: 'the bar after the reload',
    })
    .catch(() => undefined)
  await page.wait(2000)
  await page.check('Both are still in the bar after the reload', async () => {
    const list = await barWidgets(page)
    const drawn = await page.eval(`${BAR}?.querySelectorAll('[data-widget-hash]').length ?? 0`)
    return {
      ok: list.includes('BatteryIndicator') && list.includes('Button') && drawn >= 2,
      detail: `${list.join(', ') || 'empty'}; ${drawn} drawn`,
    }
  })
}
