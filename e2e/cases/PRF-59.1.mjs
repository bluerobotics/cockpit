import { armerLabel, armerShows, clickArmer, setup, vehicleArmed } from '../lib/prf.mjs'

export { setup }

export const meta = {
  title: 'Arm and disarm from the Armer button',
  route: '/',
  needs: ['vehicle'],
}

/**
 * Click the Armer button in the bottom bar to arm (sliding the confirmation if asked), wait, and click it
 * again to disarm: the vehicle follows each time, and so does the button.
 */
export default async function run({ page, vehicle }) {
  await armerShows(page, 'Disarmed')
  await page.check('Disarmed in Hold', async () => {
    const hb = await vehicle.heartbeat()
    return { ok: !(await vehicle.isArmed()) && hb?.custom_mode === 4, detail: `custom_mode ${hb?.custom_mode}` }
  })
  await page.caption('Click the Armer button')
  await clickArmer(page)
  const armed = await vehicleArmed(vehicle, true)
  await armerShows(page, 'Armed')
  await page.check('The vehicle is armed and the button says "Armed"', async () => ({
    ok: armed && (await armerLabel(page)) === 'Armed',
    detail: `armed bit ${armed}, "${await armerLabel(page)}"`,
  }))
  await page.wait(3000)
  await page.caption('Click it again to disarm')
  await clickArmer(page)
  const disarmed = await vehicleArmed(vehicle, false)
  await armerShows(page, 'Disarmed')
  await page.check('The vehicle is disarmed and the button says "Disarmed"', async () => ({
    ok: disarmed && (await armerLabel(page)) === 'Disarmed',
    detail: `armed bit cleared ${disarmed}, "${await armerLabel(page)}"`,
  }))
}
