import { clickDialogButton } from '../lib/actions.mjs'
import { fieldByLabel } from '../lib/cockpit.mjs'
import { createVariable, openDataLake, setup as quiet, shownValue } from '../lib/prf.mjs'

const COMPOUND_KEY = 'cockpit-transforming-functions'

export const meta = {
  title: 'A compound variable recomputes when the variables it reads change',
  route: '/',
  needs: ['vehicle'],
  synced: { [COMPOUND_KEY]: [] },
  restore: [COMPOUND_KEY],
}

const A = 'release-test/a'
const B = 'release-test/b'
const SUM = 'Release test sum'

export const setup = async (ctx) => {
  await quiet(ctx)
  await createVariable(ctx.page, A, 1)
  await createVariable(ctx.page, B, 2)
}

/**
 * Edit a variable's value through its pencil in Tools → Data-lake.
 * @param {object} page - Driver page
 * @param {string} id - Variable ID (and name)
 * @param {number} value - New value
 */
async function editValue(page, id, value) {
  const pencil =
    await page.eval(`(() => { const row = [...document.querySelectorAll('.v-data-table tbody tr')].find((r) =>
    r.querySelector('td')?.innerText.trim() === ${JSON.stringify(
      id
    )}); const b = row?.querySelector('button[title=Edit]')
    if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (!pencil) throw new Error(`no edit button for ${id}`)
  await page.click(pencil, { settle: 1000 })
  // "Value" when only the value can be edited, "Initial Value" when the whole variable can.
  const field = await fieldByLabel(page, 'Value').catch(() => fieldByLabel(page, 'Initial Value'))
  await page.fill(field, value)
  await page.wait(400)
  await clickDialogButton(page, 'Save', { settle: 200 })
}

/**
 * Tools → Data-lake → "Add compound variable" summing release-test/a and release-test/b, then edit each
 * input: the sum follows within a second.
 */
export default async function run({ page }) {
  await page.caption('Tools → Data-lake → Add compound variable: {{release-test/a}} + {{release-test/b}}')
  await openDataLake(page, 'release-test')
  await page.click('text=Add compound variable', { settle: 1500 })
  await page.fill(await fieldByLabel(page, 'Variable Name'), SUM)
  await page.click('text=Number', { settle: 500 })
  // The editor closes "{{" by itself, as it does for an operator typing it.
  await page.fill('.v-overlay--active .monaco-editor .view-lines', `{{ ${A} `)
  // Past the closing braces the editor added, the way an operator steps out of them with the arrow key.
  await page.key('ArrowRight', { show: false })
  await page.key('ArrowRight', { show: false })
  await page.type(` + {{ ${B} `)
  await page.wait(500)
  // The editor closes "{{" only now and then (not while its suggestion list is open), so close what it left open.
  const typed = await page.eval(
    `document.querySelector('.v-overlay--active .monaco-editor .view-lines')?.innerText.replace(/\\s+/g, ' ').trim() ?? ''`
  )
  if (!typed.endsWith('}}')) await page.type('}}')
  await page.wait(800)
  await clickDialogButton(page, 'Save', { settle: 2000 })
  await openDataLake(page, 'release-test')

  const sumId = await page.eval(
    `Object.values(window.cockpit.getAllDataLakeVariablesInfo()).find((v) => v.name === ${JSON.stringify(
      SUM
    )})?.id ?? null`
  )
  const sum = () => page.eval(`window.cockpit.getDataLakeVariableData(${JSON.stringify(sumId)})`)
  const reaches = (value) => page.waitFor(async () => (await sum()) === value, { timeout: 1000 }).catch(() => false)

  await page.check('The sum reads 3', async () => ({
    ok: Boolean(sumId) && (await reaches(3)),
    detail: `${sumId}: ${await sum()} (shown "${await shownValue(page, SUM)}")`,
  }))
  await page.caption(`Edit ${A} to 10`)
  await editValue(page, A, 10)
  await page.check('After a = 10 the sum reads 12', async () => ({
    ok: await reaches(12),
    detail: `${await sum()} (shown "${await shownValue(page, SUM)}")`,
  }))
  await page.caption(`Edit ${B} to -4`)
  await editValue(page, B, -4)
  await page.check('After b = -4 the sum reads 6', async () => ({
    ok: await reaches(6),
    detail: `${await sum()} (shown "${await shownValue(page, SUM)}")`,
  }))
}
