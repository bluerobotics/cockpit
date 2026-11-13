import {
  addCompoundVariable,
  armInManual,
  followsSpeed,
  NO_USER_VARIABLES,
  openDataLake,
  reloadCockpit,
  sampleSpeedWhileDriving,
  shownRow,
  SPEED_KMH as COMPOUND,
} from '../lib/act-dl.mjs'
import { setup as quiet } from '../lib/dl-case.mjs'

export const meta = {
  title: 'A compound variable survives a restart and keeps recomputing',
  route: '/',
  needs: ['vehicle'],
  synced: NO_USER_VARIABLES,
}

export const setup = async (ctx) => {
  await quiet(ctx)
  await addCompoundVariable(ctx.page, COMPOUND)
  await armInManual(ctx.vehicle)
}

/**
 * Restart Cockpit with the DL-82.1 compound variable: its definition is kept, synced, and it still
 * follows the groundspeed while driving.
 */
export default async function run({ page, vehicle, user }) {
  await page.caption('Restart Cockpit')
  await reloadCockpit(page)
  await openDataLake(page, COMPOUND.id)
  await page.check('Still listed as a number in km/h', async () => {
    const row = await shownRow(page, COMPOUND.name)
    return { ok: row?.type === 'number' && row.unit === 'km/h', detail: JSON.stringify(row) }
  })
  await page.check('Its definition is kept', async () => {
    const stored = ((await vehicle.getSyncedSetting(user, 'cockpit-transforming-functions')) ?? []).find(
      (f) => f.id === COMPOUND.id
    )
    return {
      ok: stored?.expression === COMPOUND.expression && stored.unit === COMPOUND.unit,
      detail: JSON.stringify(stored),
    }
  })
  await page.caption('Drive for 10 s')
  const samples = await sampleSpeedWhileDriving(page, vehicle)
  await page.check('It still equals groundspeed × 3.6 while driving', () => followsSpeed(samples))
}
