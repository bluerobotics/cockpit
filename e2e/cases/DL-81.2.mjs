import {
  addUserVariable,
  editUserVariable,
  lake,
  NO_USER_VARIABLES,
  openDataLake,
  reloadCockpit,
  shownRow,
  USER_VARIABLE as VARIABLE,
  USER_VARIABLE_KEYS,
} from '../lib/act-dl.mjs'
import { setup as quiet } from '../lib/dl-case.mjs'

export const meta = {
  title: 'A user variable and its value survive a restart',
  route: '/',
  needs: [],
  synced: NO_USER_VARIABLES,
  restore: USER_VARIABLE_KEYS,
}

export const setup = async (ctx) => {
  await quiet(ctx)
  await addUserVariable(ctx.page, VARIABLE)
}

/**
 * Set the DL-81.1 variable to 12 and restart Cockpit: it is still listed, with 12.
 */
export default async function run({ page }) {
  await page.caption(`Edit ${VARIABLE.id} to 12`)
  await editUserVariable(page, VARIABLE.name, 12)
  await page.check('It reads 12 before the restart', async () => ({
    ok: (await lake(page, VARIABLE.id)) === 12,
    detail: `${await lake(page, VARIABLE.id)}`,
  }))
  await page.caption('Restart Cockpit')
  await reloadCockpit(page, false)
  await openDataLake(page, VARIABLE.id)
  await page.check('Still listed with 12 m', async () => {
    const row = await shownRow(page, VARIABLE.name)
    return { ok: row?.value === '12' && row.unit === 'm', detail: JSON.stringify(row) }
  })
  await page.check('The data lake holds 12 after the restart', async () => {
    const value = await lake(page, VARIABLE.id)
    return { ok: value === 12, detail: `${value}` }
  })
}
