import {
  addCompoundVariable,
  armInManual,
  followsSpeed,
  NO_USER_VARIABLES,
  openDataLake,
  sampleSpeedWhileDriving,
  shownRow,
  SPEED_KMH as COMPOUND,
} from '../lib/act-dl.mjs'
import { setup as quiet } from '../lib/dl-case.mjs'

export const meta = {
  title: 'A compound variable follows the vehicle data it is made of',
  route: '/',
  needs: ['vehicle'],
  synced: NO_USER_VARIABLES,
}

export const setup = async (ctx) => {
  await quiet(ctx)
  // Opened before arming: an armed vehicle makes the main menu warn first.
  await openDataLake(ctx.page)
  await armInManual(ctx.vehicle)
}

/**
 * Tools → Data-lake → Add compound variable: groundspeed × 3.6 in km/h, then drive for 10 s.
 */
export default async function run({ page, vehicle }) {
  await page.caption('Tools → Data-lake → Add compound variable: groundspeed × 3.6, in km/h')
  const typed = await addCompoundVariable(page, COMPOUND)
  await page.check('The editor held the expression', () => ({ ok: typed === COMPOUND.expression, detail: typed }))
  await openDataLake(page, COMPOUND.id)
  await page.check('It is listed as a compound number in km/h', async () => {
    const row = await shownRow(page, COMPOUND.name)
    return { ok: row?.type === 'number' && row.unit === 'km/h', detail: JSON.stringify(row) }
  })
  await page.caption('Drive for 10 s')
  const samples = await sampleSpeedWhileDriving(page, vehicle)
  await page.check('It always equals groundspeed × 3.6 while the speed changes', () => followsSpeed(samples))
}
