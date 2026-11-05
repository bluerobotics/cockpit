import {
  addUserVariable,
  lake,
  NO_USER_VARIABLES,
  openDataLake,
  shownRow,
  USER_VARIABLE as VARIABLE,
  USER_VARIABLE_KEYS,
} from '../lib/act-dl.mjs'
import { setup } from '../lib/dl-case.mjs'

export { setup }

export const meta = {
  title: 'Create a user variable',
  route: '/',
  needs: [],
  synced: NO_USER_VARIABLES,
  restore: USER_VARIABLE_KEYS,
}

/**
 * Tools → Data-lake → Add variable: a number with its own ID, a unit and both persistence boxes
 * ticked; it is listed with its value and unit, and kept with both flags.
 */
export default async function run({ page }) {
  await page.caption('Tools → Data-lake → Add variable: release-test/user-var, Number, 5 m, persisted with its value')
  await addUserVariable(page, VARIABLE)
  await openDataLake(page, VARIABLE.id)
  await page.check('The row shows 5 m', async () => {
    const row = await shownRow(page, VARIABLE.name)
    return { ok: row?.value === '5' && row.unit === 'm' && row.source === 'User defined', detail: JSON.stringify(row) }
  })
  await page.check('The data lake holds it: number, m, persisted with its value, value 5', async () => {
    const info = await page.eval(`window.cockpit.getDataLakeVariableInfo(${JSON.stringify(VARIABLE.id)})`)
    const value = await lake(page, VARIABLE.id)
    const ok = info?.type === 'number' && info.unit === 'm' && info.persistent && info.persistValue && value === 5
    return { ok, detail: `${JSON.stringify(info)}, value ${value}` }
  })
}
