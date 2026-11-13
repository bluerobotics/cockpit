import { enterEditMode, exitEditMode } from '../lib/custom-widget.mjs'
import {
  addInputContainer,
  closeElementPanel,
  createElementVariable,
  dropCard,
  elementAt,
  INPUT_SYNCED,
  lakeValue,
  openElementPanel,
  placed,
  quietStart,
  setPanelNumber,
} from '../lib/inputs.mjs'

export const meta = {
  title: 'A Slider writes its number variable within its range',
  route: '/',
  synced: INPUT_SYNCED,
}

export const setup = quietStart

/**
 * A Slider from -10 to 10 on a new variable, dragged to both ends and the middle.
 */
export default async function run({ page }) {
  await page.caption('Edit interface → Input → Add new container; drag a Slider into it')
  await enterEditMode(page)
  const rows = await addInputContainer(page)
  await dropCard(page, 'Slider', rows[0])
  const { hash } = await placed(page, 'Slider')
  await page.caption('Options: Min Value -10, Max Value 10; create the variable "release-test/slider"')
  await openElementPanel(page, hash)
  await setPanelNumber(page, 'Min Value', -10)
  await setPanelNumber(page, 'Max Value', 10)
  await createElementVariable(page, 'release-test/slider')
  const slider = await placed(page, 'Slider')
  const id = slider?.options.dataLakeVariable?.id
  await page.check('The slider runs from -10 to 10 on a new variable', () => ({
    ok: slider?.options.layout.minValue === -10 && slider?.options.layout.maxValue === 10 && !!id,
    detail: `${slider?.options.layout.minValue} to ${slider?.options.layout.maxValue}, ${id ?? 'no variable'}`,
  }))
  await closeElementPanel(page)
  await exitEditMode(page)

  const track = await page.box(`[data-widget-hash="${hash}"] .v-slider-track`)
  const values = {}
  for (const [label, x] of [
    ['the left end', track.x - track.w / 2 - 30],
    ['the right end', track.x + track.w / 2 + 30],
    ['the middle', track.x],
  ]) {
    await page.caption(`Drag the slider to ${label}`)
    await page.drag(await elementAt(page, hash, '.v-slider-thumb'), { x, y: track.y }, { duration: 900, settle: 800 })
    values[label] = await lakeValue(page, id)
  }
  await page.check('The variable reads -10, 10 and about 0', () => ({
    ok: values['the left end'] === -10 && values['the right end'] === 10 && Math.abs(values['the middle']) <= 1,
    detail: Object.values(values).join(', '),
  }))
}
