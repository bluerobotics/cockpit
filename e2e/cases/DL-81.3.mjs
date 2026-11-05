import {
  addUserVariable,
  editUserVariable,
  lake,
  NO_USER_VARIABLES,
  openDataLake,
  reloadCockpit,
  shownRow,
  USER_VARIABLE_KEYS,
} from '../lib/act-dl.mjs'
import { setup } from '../lib/dl-case.mjs'

export { setup }

export const meta = {
  title: 'Without "Save variable value" only the variable survives a restart',
  route: '/',
  needs: [],
  synced: NO_USER_VARIABLES,
  restore: USER_VARIABLE_KEYS,
}

const VARIABLE = { id: 'release-test/user-var2', name: 'Release user var 2', value: 1, saveValue: false }

/**
 * Add a variable that persists but does not save its value, set it to 9 and restart: it is listed
 * again, without a value.
 */
export default async function run({ page }) {
  await page.caption('Add release-test/user-var2 = 1, "Save variable value between boots" unticked')
  await addUserVariable(page, VARIABLE)
  await page.check('Persisted, without its value', async () => {
    const info = await page.eval(`window.cockpit.getDataLakeVariableInfo(${JSON.stringify(VARIABLE.id)})`)
    return { ok: info?.persistent === true && info.persistValue === false, detail: JSON.stringify(info) }
  })
  await page.caption('Edit it to 9')
  await editUserVariable(page, VARIABLE.name, 9)
  await page.caption('Restart Cockpit')
  await reloadCockpit(page, false)
  await openDataLake(page, VARIABLE.id)
  await page.check('Listed again, without a value', async () => {
    const row = await shownRow(page, VARIABLE.name)
    const value = await lake(page, VARIABLE.id)
    return {
      ok: !!row && row.value === '' && value === undefined,
      detail: `row ${JSON.stringify(row)}, data lake ${value}`,
    }
  })
}
