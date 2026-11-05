import { angleDiff, armInManual, CUSTOM_MODE, drive, HEADING, lake, openDataLake } from '../lib/act-dl.mjs'
import { setup as quiet } from '../lib/dl-case.mjs'

export const meta = {
  title: 'A turn and a mode change show in the data lake within a second',
  route: '/',
  needs: ['vehicle'],
}

export const setup = async (ctx) => {
  await quiet(ctx)
  // Opened before arming: an armed vehicle makes the main menu warn first.
  await openDataLake(ctx.page)
  await armInManual(ctx.vehicle)
}

/**
 * With VFR_HUD/heading and HEARTBEAT/custom_mode shown, drive a 90° turn and switch to Hold: the
 * data lake follows the vehicle, the heading within a few degrees and the mode within a second.
 */
export default async function run({ page, vehicle }) {
  await page.caption('Tools → Data-lake, search "VFR_HUD/heading" and "HEARTBEAT/custom_mode"')
  await openDataLake(page, 'VFR_HUD/heading')
  await page.wait(1500)
  await openDataLake(page, 'HEARTBEAT/custom_mode')
  await openDataLake(page, 'VFR_HUD/heading')

  const start = await lake(page, HEADING)
  let worst = 0
  await page.caption('Drive a 90° turn')
  await drive(vehicle, {
    steering: 1900,
    ms: 45000,
    until: async () => {
      const [shown, hud] = await Promise.all([lake(page, HEADING), vehicle.read('VFR_HUD')])
      if (hud && hud.ageMs < 1000) worst = Math.max(worst, angleDiff(shown, hud.heading))
      return angleDiff(shown, start) >= 90
    },
  })
  const end = await lake(page, HEADING)
  await page.check('The heading swept about 90°', () => ({
    ok: angleDiff(end, start) >= 80,
    detail: `${start}° → ${end}°`,
  }))
  await page.check('The data-lake heading kept within 10° of the vehicle while turning', () => ({
    ok: worst <= 10,
    detail: `worst gap ${worst}°`,
  }))

  await page.caption('Switch to Hold, watching HEARTBEAT/custom_mode')
  await openDataLake(page, 'HEARTBEAT/custom_mode')
  const before = await lake(page, CUSTOM_MODE)
  await vehicle.command('MAV_CMD_DO_SET_MODE', [1, 4])
  let vehicleAt
  let lakeAt
  const deadline = Date.now() + 10000
  while (Date.now() < deadline && !(vehicleAt && lakeAt)) {
    const [hb, shown] = await Promise.all([vehicle.heartbeat(), lake(page, CUSTOM_MODE)])
    if (!vehicleAt && hb?.custom_mode === 4) vehicleAt = Date.now() - hb.ageMs
    if (!lakeAt && shown === 4) lakeAt = Date.now()
    await page.wait(100)
  }
  await page.wait(1500)
  await page.check('custom_mode went 0 → 4 in the data lake within 1 s of the vehicle', () => ({
    ok: before === 0 && vehicleAt && lakeAt && lakeAt - vehicleAt <= 1000,
    detail: `before ${before}; vehicle at 4 ${vehicleAt ? 'yes' : 'no'}, data lake ${
      lakeAt && vehicleAt ? `${lakeAt - vehicleAt} ms later` : 'never'
    }`,
  }))
}
