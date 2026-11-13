import {
  addCompoundVariable,
  addUserVariable,
  editUserVariable,
  lake,
  NO_USER_VARIABLES,
  openDataLake,
  shownRow,
} from '../lib/act-dl.mjs'
import { setup as quiet } from '../lib/dl-case.mjs'

export const meta = {
  title: 'A compound variable of two user variables recomputes when one changes',
  route: '/',
  needs: [],
  synced: NO_USER_VARIABLES,
}

const A = { id: 'release-test/a', name: 'Release a', value: 2 }
const B = { id: 'release-test/b', name: 'Release b', value: 3 }
const PRODUCT = { id: 'release-test/a-times-b', name: 'Release a times b', expression: `{{ ${A.id} }} * {{ ${B.id} }}` }

export const setup = async (ctx) => {
  await quiet(ctx)
  await addUserVariable(ctx.page, A)
  await addUserVariable(ctx.page, B)
}

/**
 * Add a × b as a compound variable (6), then set a to 4: it becomes 12.
 */
export default async function run({ page }) {
  await page.caption('Add compound variable: {{ release-test/a }} * {{ release-test/b }}, with a = 2 and b = 3')
  const typed = await addCompoundVariable(page, PRODUCT)
  await page.check('The editor held the expression', () => ({ ok: typed === PRODUCT.expression, detail: typed }))
  const shows = async (want) => {
    await openDataLake(page, PRODUCT.id)
    const row = await shownRow(page, PRODUCT.name)
    const value = await lake(page, PRODUCT.id)
    return { ok: row?.value === String(want) && value === want, detail: `row ${row?.value}, data lake ${value}` }
  }
  await page.check('It shows 6', () => shows(6))
  await page.caption('Edit a to 4')
  await editUserVariable(page, A.name, 4)
  await page.check('It shows 12', () => shows(12))
}
