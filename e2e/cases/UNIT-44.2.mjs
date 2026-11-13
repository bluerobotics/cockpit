import { clickDialogButton } from '../lib/actions.mjs'
import { dismissTutorial, fieldByLabel } from '../lib/cockpit.mjs'
import { dismissFeaturesDialog } from '../lib/extensions.mjs'
import { openMenuPage } from '../lib/mavlink-tools.mjs'
import { TEMPERATURE } from '../lib/units.mjs'

const COMPOUND_KEY = 'cockpit-transforming-functions'

export const meta = {
  title: 'A unit suffix converts a variable inside an expression',
  route: '/',
  needs: ['vehicle'],
  synced: { [COMPOUND_KEY]: [] },
}

export const setup = async ({ page }) => {
  await dismissFeaturesDialog(page)
  await dismissTutorial(page, 3000)
}

/**
 * Tools → Data-lake → Add compound variable whose expression reads the water temperature (stored in
 * centidegrees Celsius) with `: imperial`, and another with `: metric`: they come out in °F and °C.
 * @param {object} page - Driver page
 * @param {string} system - Unit-system suffix
 * @param {string} unit - Unit of the result
 */
async function addCompound(page, system, unit) {
  await page.click('text=Add compound variable', { settle: 1500 })
  await page.fill(await fieldByLabel(page, 'Variable Name'), `Water temperature (${system})`)
  await page.click('text=Number', { settle: 500 })
  await page.fill(await fieldByLabel(page, 'Unit'), unit)
  // The editor closes "{{" by itself, as it does for an operator typing it.
  await page.fill('.v-overlay--active .monaco-editor .view-lines', `{{ ${TEMPERATURE} : ${system} `)
  await page.wait(800)
  await clickDialogButton(page, 'Save', { settle: 2000 })
}

/** A unit suffix converts a variable inside an expression. */
export default async function run({ page }) {
  await page.caption('Tools → Data-lake → Add compound variable: the temperature read as imperial')
  await openMenuPage(page, 'Tools', 'Data-lake')
  await addCompound(page, 'imperial', 'degF')
  await page.caption('… and another read as metric')
  await addCompound(page, 'metric', 'degC')
  await page.caption('Both are in the data lake')
  await page.fill('input[placeholder="Search variables..."]', 'Water temperature')
  await page.wait(2500)

  // The dialog derives a compound variable's ID from its name, so they are found by name.
  const byName = (name) =>
    page.eval(
      `(() => { const info = Object.values(window.cockpit.getAllDataLakeVariablesInfo()).find((v) => v.name === ${JSON.stringify(
        name
      )}); return info && window.cockpit.getDataLakeVariableData(info.id) })()`
    )
  const celsius = (await page.eval(`window.cockpit.getDataLakeVariableData(${JSON.stringify(TEMPERATURE)})`)) / 100
  const imperial = await byName('Water temperature (imperial)')
  const metric = await byName('Water temperature (metric)')
  await page.caption(`Raw: ${(celsius * 100).toFixed(0)} cdegC`)
  await page.check('": imperial" gives the temperature in °F', () => ({
    ok: typeof imperial === 'number' && Math.abs(imperial - (celsius * 1.8 + 32)) <= 0.2,
    detail: `${imperial} (expected ${(celsius * 1.8 + 32).toFixed(2)})`,
  }))
  await page.check('": metric" gives it in °C', () => ({
    ok: typeof metric === 'number' && Math.abs(metric - celsius) <= 0.1,
    detail: `${metric} (expected ${celsius.toFixed(2)})`,
  }))
}
