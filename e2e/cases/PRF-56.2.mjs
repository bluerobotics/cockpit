import { addCollapsibleContainer, enterEditMode, exitEditMode } from '../lib/custom-widget.mjs'
import { centre, setup, VARIABLES_KEYS } from '../lib/prf.mjs'

export { setup }

export const meta = {
  title: 'A Slider element loads and moves its data-lake variable',
  route: '/',
  needs: ['vehicle'],
  synced: { [VARIABLES_KEYS[0]]: [], [VARIABLES_KEYS[1]]: {} },
}

const NAME = 'release-test/slider'
const SLIDER = `[...document.querySelectorAll('.slider-container')].find((e) => e.checkVisibility({ visibilityProperty: true }))`
const SLIDER_CARD = `[...document.querySelectorAll('.palette-card')].find((e) => e.checkVisibility({ visibilityProperty: true })
  && e.querySelector('.palette-card-label')?.innerText.trim().toLowerCase() === 'slider')?.querySelector('.palette-card-handle')`

/**
 * Edit interface: a Collapsible Container with a Slider, given a new variable from its side panel; out of
 * edit mode, drag the slider to the middle: the variable reads about 50.
 */
export default async function run({ page }) {
  await page.caption('Edit interface → drag a Collapsible Container onto the view')
  await enterEditMode(page)
  await addCollapsibleContainer(page)
  await page.caption('Input → drag a Slider into it')
  if (!(await page.eval(`!!${SLIDER_CARD}`))) await page.click('text=INPUT', { settle: 1200 })
  await page.drag(
    await centre(page, SLIDER_CARD),
    { x: page.width * 0.56, y: page.height * 0.3 },
    {
      duration: 1000,
      settle: 1500,
    }
  )
  await page.caption(`Click the slider; Actions → Data-lake variable → create "${NAME}"`)
  await page.click(await centre(page, SLIDER), { settle: 1200 })
  await page.click('text=create', { settle: 800 })
  const nameInput = `[...document.querySelectorAll('input[type=text]')].find((i) => i.checkVisibility({ visibilityProperty: true })
    && i.parentElement?.querySelector('p')?.textContent.trim() === 'Name')`
  await page.fill(await centre(page, nameInput), NAME)
  await page.wait(400)
  await page.click('text=save', { settle: 1200 })
  const id = await page.store('widget-manager', `s.elementToShowOnDrawer?.options?.dataLakeVariable?.id ?? null`)
  await page.check('The slider has its new variable', () => ({ ok: Boolean(id), detail: id ?? 'none' }))
  await exitEditMode(page)

  await page.caption('Drag the slider to about the middle')
  const track = await page.eval(`(() => { const t = ${SLIDER}?.querySelector('.v-slider-track'); if (!t) return null
    const r = t.getBoundingClientRect(); return { x: r.x, y: r.y + r.height / 2, w: r.width } })()`)
  await page.check('The slider renders', () => ({ ok: Boolean(track?.w), detail: `track ${track?.w ?? 0} px wide` }))
  const thumb = await page.box(`.slider-container .v-slider-thumb`)
  await page.drag(thumb, { x: track.x + track.w / 2, y: track.y }, { duration: 900, settle: 1200 })
  const value = await page.eval(`window.cockpit.getDataLakeVariableData(${JSON.stringify(id)})`)
  await page.check('Its variable reads about 50', () => ({
    ok: typeof value === 'number' && Math.abs(value - 50) <= 5,
    detail: `${value}`,
  }))
}
