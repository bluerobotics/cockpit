import { enterEditMode, exitEditMode } from '../lib/custom-widget.mjs'
import {
  addInputContainer,
  centreOf,
  closeElementPanel,
  createElementVariable,
  dropCard,
  elementAt,
  INPUT_KEYS,
  INPUT_SYNCED,
  lakeValue,
  openElementPanel,
  placed,
  quietStart,
  showInDataLake,
} from '../lib/inputs.mjs'

export const meta = {
  title: 'A Checkbox, a Dial and a Dropdown write their variables',
  route: '/',
  synced: INPUT_SYNCED,
  restore: INPUT_KEYS,
}

export const setup = quietStart

const menu = `[...document.querySelectorAll('.v-overlay--active')].at(-1)`

/**
 * Fill the open option menu of the Dropdown's panel.
 * @param {object} page - Driver page
 * @param {string} name - Option name
 * @param {string} value - Option value
 */
async function fillOption(page, name, value) {
  await page.fill(await centreOf(page, `${menu}.querySelector('input[placeholder="option name"]')`), name)
  await page.fill(await centreOf(page, `${menu}.querySelector('input[placeholder="value"]')`), value)
}

const menuButton = (text) =>
  `[...${menu}.querySelectorAll('button')].find((b) => b.innerText.trim().toLowerCase() === ${JSON.stringify(text)})`

/**
 * Add the three elements to one container, each on a variable of its own, and use each once.
 */
export default async function run({ page }) {
  await page.caption('Edit interface → Input → Add new container; a Checkbox, a Dial and a Dropdown in it')
  await enterEditMode(page)
  const rows = await addInputContainer(page)
  const hashes = {}
  for (const [i, name] of ['Checkbox', 'Dial', 'Dropdown'].entries()) {
    await dropCard(page, name, rows[i])
    hashes[name] = (await placed(page, name)).hash
    await page.caption(`${name}: create the variable "release-test/${name.toLowerCase()}"`)
    await openElementPanel(page, hashes[name])
    await createElementVariable(page, `release-test/${name.toLowerCase()}`)
  }
  await page.caption('Dropdown options: a = 1, b = 2')
  const add = `[...document.querySelectorAll('.fixed.right-0 button')].find((b) => b.innerText.trim().toLowerCase() === 'add' && b.getClientRects().length)`
  await page.click(await centreOf(page, add), { settle: 900 })
  await fillOption(page, 'a', '1')
  await page.click(await centreOf(page, menuButton('add another option')), { settle: 900 })
  await fillOption(page, 'b', '2')
  await page.click(await centreOf(page, menuButton('close')), { settle: 900 })
  const ids = {}
  for (const name of Object.keys(hashes)) ids[name] = (await placed(page, name))?.options.dataLakeVariable?.id
  const options = (await placed(page, 'Dropdown'))?.options.layout.selectorOptions ?? []
  await page.check('Each element has its variable, the dropdown its two options', () => ({
    ok: Object.values(ids).every(Boolean) && options.map((o) => `${o.name}=${o.value}`).join(' ') === 'a=1 b=2',
    detail: `${Object.values(ids).join(', ')}; options ${options.map((o) => `${o.name}=${o.value}`).join(' ')}`,
  }))
  await closeElementPanel(page)
  await exitEditMode(page)

  await page.caption('Tick the checkbox')
  await page.click(await elementAt(page, hashes.Checkbox, 'input'), { settle: 1000 })
  await page.caption('Turn the dial')
  const dial = await elementAt(page, hashes.Dial, '.potentiometer-container')
  await page.drag(dial, { x: dial.x + 40, y: dial.y - 20 }, { duration: 900, settle: 1000 })
  await page.caption('Pick option b')
  await page.click(await elementAt(page, hashes.Dropdown, '.v-field'), { settle: 900 })
  await page.click(
    await centreOf(page, `[...${menu}.querySelectorAll('.v-list-item')].find((i) => i.innerText.trim() === 'b')`),
    { settle: 1000 }
  )

  const values = {}
  for (const name of Object.keys(ids)) values[name] = await lakeValue(page, ids[name])
  await page.check('Checkbox true, dial a number within 0–100, dropdown 2', () => ({
    ok:
      values.Checkbox === true &&
      typeof values.Dial === 'number' &&
      values.Dial > 0 &&
      values.Dial <= 100 &&
      String(values.Dropdown) === '2',
    detail: Object.entries(values)
      .map(([k, v]) => `${k} ${JSON.stringify(v)}`)
      .join(', '),
  }))
  await page.caption('Tools → Data-lake shows the three variables')
  await showInDataLake(page, 'release-test')
  await page.wait(2500)
}
