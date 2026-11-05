import { addActionButton, addCollapsibleContainer, enterEditMode, exitEditMode } from '../lib/custom-widget.mjs'
import { addViewNamed, setup as quiet, viewState } from '../lib/prf.mjs'

export const meta = {
  title: 'A custom widget button runs "Go to next view"',
  route: '/',
  needs: ['vehicle'],
}

/**
 * The boat profile has a single view, so a second one is added in Edit interface, which Cockpit then shows.
 */
export const setup = async (ctx) => {
  const { page } = ctx
  await quiet(ctx)
  await addViewNamed(page, 'Release test view')
  await exitEditMode(page)
}

/**
 * Edit interface: a Collapsible Container with a Button set to "Go to next view"; out of edit mode, click it.
 */
export default async function run({ page }) {
  await page.caption('Edit interface → drag a Collapsible Container onto the view')
  await enterEditMode(page)
  await addCollapsibleContainer(page)
  await page.caption('Drop a Button in it and set its action to "Go to next view"')
  await addActionButton(page, { x: page.width * 0.56, y: page.height * 0.3 }, 'Next view', 'Go to next view')
  await exitEditMode(page)
  const before = await viewState(page)
  await page.caption(`On "${before.current}": click the button`)
  await page.click('text=Next view', { settle: 1500 })
  const after = await viewState(page)
  const expected = (before.index + 1) % before.names.length
  await page.check('The next view is shown', () => ({
    ok: before.names.length >= 2 && after.index === expected,
    detail: `"${before.current}" (${before.index}) → "${after.current}" (${after.index}) of ${before.names.length}`,
  }))
}
