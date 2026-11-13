// Display units as the UNIT cases drive them: Settings → Interface → Display units, and the depth and
// temperature readouts that follow it.

import { openMenuPage } from './mavlink-tools.mjs'

export const UNITS_KEY = 'cockpit-display-unit-preferences-v2'
export const TEMPERATURE = '/mavlink/1/1/SCALED_PRESSURE/temperature'
// The boat has no depth sensor, so a variable in metres stands in for one, at a known depth.
export const DEPTH_STAND_IN = 'release-test/altitude'
export const DEPTH_METRES = 12.5

/**
 * Settings → Interface → Display units → pick a System radio (metric, imperial or nautical).
 * @param {object} page - Driver page
 * @param {'metric'|'imperial'|'nautical'} system - Unit system
 */
export async function chooseUnitSystem(page, system) {
  if (!(await page.exists('text=Display units'))) await openMenuPage(page, 'settings-interface')
  await page.click(`text=${system}`, { settle: 1500 })
}

/**
 * Put a Depth indicator reading the stand-in variable and a generic indicator on the water temperature
 * in the bottom bar.
 * @param {object} page - Driver page
 */
export async function placeDepthAndTemperature(page) {
  await page.eval(`(() => { window.cockpit.createDataLakeVariable({ id: ${JSON.stringify(
    DEPTH_STAND_IN
  )}, name: 'Release test altitude',
    type: 'number', unit: 'm' }); window.cockpit.setDataLakeVariableData(${JSON.stringify(
      DEPTH_STAND_IN
    )}, ${-DEPTH_METRES}) })()`)
  await page.store(
    'widget-manager',
    `(() => { const bar = s.currentView.miniWidgetContainers.find((c) => c.name === 'Bottom-left container')
      bar.widgets.push({ hash: crypto.randomUUID(), component: 'DepthIndicator', name: 'Depth',
        options: { altitudeVariableId: ${JSON.stringify(DEPTH_STAND_IN)}, useCustomAltitudeVariable: true } })
      bar.widgets.push({ hash: crypto.randomUUID(), component: 'VeryGenericIndicator', name: 'Water temp',
        options: { displayName: 'Water temp', variableName: ${JSON.stringify(TEMPERATURE)}, useVariableUnit: true,
          iconName: 'mdi-thermometer', decimalPlaces: 1, variableMultiplier: 1, widgetWidth: 160 } })
      return true })()`
  )
  await page.wait(1500)
}

/**
 * The depth and temperature readouts as shown in the bottom bar, value then unit, e.g. "41.0 ft".
 * @param {object} page - Driver page
 * @returns {Promise<{depth: string, temperature: string}>} Their text
 */
export const readouts = (page) =>
  page.eval(`(() => { const text = (label) => [...document.querySelectorAll('div')].filter((d) => d.getClientRects().length && d.childElementCount < 6)
      .map((d) => d.innerText.replace(/\\s+/g, ' ').trim()).find((t) => new RegExp('^-?[0-9.]+ [^ ]+ ' + label + '$').test(t))
    const value = (label) => text(label)?.replace(new RegExp(' ' + label + '$'), '') ?? ''
    return { depth: value('Depth'), temperature: value('Water temp') } })()`)
