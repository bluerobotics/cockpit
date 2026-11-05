import { exitEditMode } from '../lib/custom-widget.mjs'
import {
  canvasFrame,
  closeDialog,
  createNumberVariable,
  hookCanvases,
  pickItem,
  placeWidget,
  quietStart,
  setVariable,
  widgetByHash,
} from '../lib/widgets.mjs'

// The boat has no depth sensor: an altitude variable stands in, so -2 m altitude reads as 2 m depth.
const STAND_IN = 'release-test/depth-hud'
const STAND_IN_NAME = 'Release test depth HUD'

export const meta = {
  title: 'Depth HUD follows its altitude source',
  route: '/',
  needs: ['vehicle'],
}

export const setup = async (ctx) => {
  await quietStart(ctx)
  await hookCanvases(ctx.page)
  await createNumberVariable(ctx.page, STAND_IN, STAND_IN_NAME, 0)
}

const readout = async (page, hash) =>
  (await canvasFrame(page, hash))?.texts.find((t) => /^-?\d+\.\d \S+$/.test(t)) ?? ''

/**
 * Add a Depth HUD, point it at a stand-in variable, and set that variable twice: the readout follows.
 */
export default async function run({ page }) {
  await page.caption('Edit interface: add a Depth HUD and open its cog')
  const widget = await placeWidget(page, 'Depth HUD', { configure: true })
  await page.caption('Tick "Use custom data lake variable" and pick the stand-in')
  await page.click('text=Use custom data lake variable', { settle: 1000 })
  await pickItem(page, 'Data lake variable', STAND_IN_NAME, 'Release test depth')
  await closeDialog(page)
  await exitEditMode(page)
  await page.check('The widget reads the stand-in variable', async () => {
    const { options } = await widgetByHash(page, widget.hash)
    return {
      ok: options.useCustomAltitudeVariable === true && options.altitudeVariableId === STAND_IN,
      detail: `custom ${options.useCustomAltitudeVariable}, variable ${options.altitudeVariableId}`,
    }
  })
  for (const depth of [2, 7.5]) {
    await page.caption(`Set ${STAND_IN} to ${-depth} m altitude`)
    await setVariable(page, STAND_IN, -depth)
    await page.wait(2500)
    const shown = await readout(page, widget.hash)
    await page.check(`The HUD reads ${depth.toFixed(1)} m`, () => ({
      ok: shown === `${depth.toFixed(1)} m`,
      detail: `shows "${shown}"`,
    }))
  }
}
