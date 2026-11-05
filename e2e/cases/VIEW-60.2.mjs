import { TEST_USER } from '../lib/cockpit.mjs'
import { exitEditMode } from '../lib/custom-widget.mjs'
import {
  addMiniWidget,
  addRegularWidget,
  centreOf,
  createView,
  profileViews,
  quietStart,
  VIEWS_KEY,
  widgetByHash,
} from '../lib/widgets.mjs'

const NAME = 'Release test view'

export const meta = {
  title: 'Changes to a new view persist across a reload',
  route: '/',
  needs: ['vehicle'],
}

export const setup = async (ctx) => {
  await quietStart(ctx)
  await createView(ctx.page, NAME)
}

const near = (a, b) => Math.abs(a - b) < 0.002

/**
 * On a new view, add a Compass and resize it, put a Clock in the bottom bar, leave edit mode and reload:
 * both are still there, the Compass where and as large as it was, and the vehicle's copy of the views has them.
 */
export default async function run({ page, vehicle }) {
  await page.caption(`"${NAME}" in edit mode: drag a Compass onto it`)
  const compass = await addRegularWidget(page, 'Compass', { x: page.width * 0.62, y: page.height * 0.4 })
  await page.caption('Resize it from its bottom-right corner')
  const outer = `document.querySelector('[data-e2e-widget="${compass.hash}"]')`
  await page.hover(await centreOf(page, outer), 800)
  const corner = await centreOf(page, `${outer}.querySelector('.resize-handle.bottom-right')`)
  await page.drag(corner, { dx: 120, dy: 90 }, { duration: 900, settle: 1200 })
  const placed = await widgetByHash(page, compass.hash)
  await page.caption('Mini: drag a Clock into the bottom bar')
  const clock = await addMiniWidget(page, 'Clock', 'bottom', 0)
  await exitEditMode(page)
  await page.wait(3000)

  await page.caption('Reload Cockpit')
  await page.reload()
  await page.waitFor(
    async () => (await page.store('widget-manager', 's.currentView.name').catch(() => null)) === NAME,
    { timeout: 60000, label: `"${NAME}" to come back` }
  )
  await page.wait(3000)
  const view = (await profileViews(page)).find((v) => v.name === NAME)
  const after = view?.widgets.find((w) => w.hash === compass.hash)
  await page.check('After the reload the Compass is there, same place and size', () => ({
    ok:
      Boolean(after) &&
      near(after.position.x, placed.position.x) &&
      near(after.position.y, placed.position.y) &&
      near(after.size.width, placed.size.width) &&
      near(after.size.height, placed.size.height) &&
      placed.size.width > 0.1,
    detail: after
      ? `at ${after.position.x.toFixed(3)}, ${after.position.y.toFixed(3)} size ${after.size.width.toFixed(
          3
        )}×${after.size.height.toFixed(3)} (before ${placed.size.width.toFixed(3)}×${placed.size.height.toFixed(3)})`
      : 'no Compass on the view',
  }))
  await page.check('The Clock is still in the bottom bar, and shows the time', async () => {
    const shown = await page.eval(`document.querySelector('[data-widget-hash="${clock}"]')?.innerText.trim() ?? ''`)
    const kept = view?.miniWidgetContainers.some((c) => c.widgets.some((w) => w.hash === clock))
    return { ok: kept && /\d{1,2}:\d{2}/.test(shown), detail: `stored ${kept}, shows "${shown}"` }
  })
  await page.check(`The vehicle's ${VIEWS_KEY} holds the view with both`, async () => {
    const synced = await vehicle.getSyncedSetting(TEST_USER, VIEWS_KEY)
    const v = synced?.views?.find((x) => x.name === NAME)
    const hasCompass = v?.widgets.some((w) => w.hash === compass.hash && w.component === 'Compass')
    const hasClock = v?.miniWidgetContainers.some((c) => c.widgets.some((w) => w.hash === clock))
    return { ok: hasCompass && hasClock, detail: `view ${Boolean(v)}, Compass ${hasCompass}, Clock ${hasClock}` }
  })
}
