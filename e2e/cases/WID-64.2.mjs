import { exitEditMode } from '../lib/custom-widget.mjs'
import {
  closeDialog,
  createNumberVariable,
  hookCanvases,
  pickItem,
  placeWidget,
  plotterStats,
  quietStart,
  setVariable,
} from '../lib/widgets.mjs'

const VARIABLE = 'release-test/plot'
const NAME = 'Release test plot'

export const meta = {
  title: 'Plotter follows a user variable step',
  route: '/',
  needs: ['vehicle'],
}

export const setup = async (ctx) => {
  await quietStart(ctx)
  await hookCanvases(ctx.page)
  await createNumberVariable(ctx.page, VARIABLE, NAME, 0)
}

/**
 * Plot a user variable at 0, step it to 5 and then to -2: Current follows, Max is 5 and Min -2.
 */
export default async function run({ page }) {
  await page.caption(`Edit interface: add a Plotter on "${NAME}"`)
  const widget = await placeWidget(page, 'Plotter', { configure: true })
  await pickItem(page, 'Data Lake variable', NAME, 'Release test plot')
  await closeDialog(page)
  await exitEditMode(page)
  await page.wait(2000)

  await page.caption(`${VARIABLE} = 5`)
  await setVariable(page, VARIABLE, 5)
  await page.wait(3000)
  const five = await plotterStats(page, widget.hash)
  await page.check('Current reads 5, Max 5', () => ({
    ok: five.Current === 5 && five.Max === 5,
    detail: JSON.stringify(five),
  }))
  await page.caption(`${VARIABLE} = -2`)
  await setVariable(page, VARIABLE, -2)
  await page.wait(3000)
  const minus = await plotterStats(page, widget.hash)
  await page.check('Current reads -2, Max 5, Min -2', () => ({
    ok: minus.Current === -2 && minus.Max === 5 && minus.Min === -2,
    detail: JSON.stringify(minus),
  }))
}
