import { dismissTutorial } from '../lib/cockpit.mjs'
import { dismissFeaturesDialog } from '../lib/extensions.mjs'
import { closeMenu } from '../lib/mavlink-tools.mjs'
import {
  chooseUnitSystem,
  DEPTH_METRES,
  placeDepthAndTemperature,
  readouts,
  TEMPERATURE,
  UNITS_KEY,
} from '../lib/units.mjs'

export const meta = {
  title: 'Depth and temperature widgets follow the display units',
  route: '/',
  needs: ['vehicle'],
  restore: [UNITS_KEY],
}

export const setup = async ({ page }) => {
  await dismissFeaturesDialog(page)
  await dismissTutorial(page, 3000)
  await placeDepthAndTemperature(page)
  await chooseUnitSystem(page, 'metric')
  await closeMenu(page)
}

const number = (text) => Number.parseFloat(text)

/**
 * With a Depth indicator at a known 12.5 m and a generic indicator on the water temperature, switch
 * the display units from metric to imperial and then set depth alone back to metres: each readout
 * converts, and each quantity follows its own choice.
 */
export default async function run({ page }) {
  const celsius = (await page.eval(`window.cockpit.getDataLakeVariableData(${JSON.stringify(TEMPERATURE)})`)) / 100
  const fahrenheit = celsius * 1.8 + 32
  await page.caption(`Metric: depth ${DEPTH_METRES} m, water at ${celsius.toFixed(1)} °C`)
  let shown = await readouts(page)
  await page.check('Metric: depth in metres, temperature in °C', () => ({
    ok:
      shown.depth.endsWith(' m') &&
      Math.abs(number(shown.depth) - DEPTH_METRES) <= 0.05 &&
      shown.temperature.endsWith('°C') &&
      Math.abs(number(shown.temperature) - celsius) <= 0.1,
    detail: `${shown.depth}, ${shown.temperature}`,
  }))

  await page.caption('Settings → Interface → Display units: imperial')
  await chooseUnitSystem(page, 'imperial')
  await closeMenu(page)
  shown = await readouts(page)
  await page.check('Imperial: depth in feet, temperature in °F, both converted', () => ({
    ok:
      shown.depth.endsWith(' ft') &&
      Math.abs(number(shown.depth) - DEPTH_METRES * 3.28084) <= 0.1 &&
      shown.temperature.endsWith('°F') &&
      Math.abs(number(shown.temperature) - fahrenheit) <= 0.15,
    detail: `${shown.depth} (expected ${(DEPTH_METRES * 3.28084).toFixed(1)}), ${
      shown.temperature
    } (expected ${fahrenheit.toFixed(1)})`,
  }))

  await page.caption('Depth alone back to Meters: the system becomes Mixed')
  await chooseUnitSystem(page, 'imperial')
  const depthMeters = `[...document.querySelectorAll('.v-radio-group')].find((g) => g.closest('.flex-row')?.firstElementChild?.textContent.trim() === 'Depth')
    ?.querySelectorAll('input[type=radio]')[0]`
  const at = await page.eval(
    `(() => { const r = (${depthMeters}).closest('.v-radio').getBoundingClientRect(); return { x: r.x + 12, y: r.y + r.height / 2 } })()`
  )
  await page.click(at, { settle: 1500 })
  const mixed = await page.exists('text=Mixed — pick a system, or set each quantity below')
  await closeMenu(page)
  shown = await readouts(page)
  await page.check('Depth in metres, temperature still in °F', () => ({
    ok: mixed && shown.depth.endsWith(' m') && shown.temperature.endsWith('°F'),
    detail: `${shown.depth}, ${shown.temperature}, mixed ${mixed}`,
  }))
}
