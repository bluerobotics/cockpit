import { enterEditMode } from '../lib/custom-widget.mjs'
import { barDropPoint, centreOf, dropCard, INPUT_SYNCED, paletteMode, placed, quietStart } from '../lib/inputs.mjs'

export const meta = {
  title: 'Widgets removed from the top and bottom bars',
  route: '/',
  synced: INPUT_SYNCED,
}

// What CONT-72.1 and 72.2 leave: a mini widget in the top bar and an input element in the bottom bar.
export const setup = async (ctx) => {
  const { page } = ctx
  await quietStart(ctx)
  await enterEditMode(page)
  await paletteMode(page, 'Mini')
  await dropCard(page, 'Clock', await barDropPoint(page, 'top'))
  await paletteMode(page, 'Input')
  await dropCard(page, 'Switch', await barDropPoint(page, 'bottom'))
  ctx.added = { Clock: (await placed(page, 'Clock'))?.hash, Switch: (await placed(page, 'Switch'))?.hash }
}

const stillThere = (page, hash) =>
  page.store(
    'widget-manager',
    `[...s.currentMiniWidgetsProfile.containers, ...s.currentView.miniWidgetContainers].some((c) => c.widgets.some((w) => w.hash === ${JSON.stringify(
      hash
    )}))`
  )

/**
 * Remove both with the trash icons next to them in the edit menu's Top Bar and Bottom Bar lists.
 */
export default async function run({ page, added }) {
  await page.check('A Clock in the top bar and a Switch in the bottom bar to start with', async () => ({
    ok: (await stillThere(page, added.Clock)) && (await stillThere(page, added.Switch)),
    detail: JSON.stringify(added),
  }))
  for (const [name, bar] of [
    ['Clock', 'Top Bar'],
    ['Switch', 'Bottom Bar'],
  ]) {
    await page.caption(`Edit menu → ${bar}: trash icon next to "${name}"`)
    // Each listed widget is a row holding its name and its cog and trash icons; the newest row with that name is setup's.
    const trash = await centreOf(
      page,
      `[...document.querySelectorAll('#view-widgets-list p')].filter((p) => p.textContent.trim() === ${JSON.stringify(
        name
      )} && p.getClientRects().length).at(-1)?.parentElement.parentElement.querySelector('.mdi-trash-can')`
    )
    if (!trash) throw new Error(`no trash icon for "${name}" under ${bar}`)
    await page.click(trash, { settle: 1500 })
  }
  await page.check('Both are gone from the stored bars', async () => {
    const clock = await stillThere(page, added.Clock)
    const toggle = await stillThere(page, added.Switch)
    return { ok: !clock && !toggle, detail: `Clock stored ${clock}, Switch stored ${toggle}` }
  })
  await page.check('Neither is drawn in the bars', async () => ({
    ok: !(await page.eval(
      `!!document.querySelector('[data-widget-hash="${added.Clock}"], [data-widget-hash="${added.Switch}"]')`
    )),
  }))
}
