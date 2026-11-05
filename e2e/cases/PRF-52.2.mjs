import { armerLabel, armerShows, setup, vehicleArmed } from '../lib/prf.mjs'

export { setup }

export const meta = {
  title: 'The Armer button follows an arm and disarm done outside Cockpit',
  route: '/',
  needs: ['vehicle'],
}

/**
 * Arm and then disarm the vehicle over mavlink2rest, with no input to Cockpit: the Armer button follows.
 */
export default async function run({ page, vehicle }) {
  await armerShows(page, 'Disarmed')
  await page.check('Disarmed, and the Armer button says so', async () => ({
    ok: !(await vehicle.isArmed()) && (await armerLabel(page)) === 'Disarmed',
    detail: `Armer "${await armerLabel(page)}"`,
  }))
  await page.caption('Arm the vehicle from outside Cockpit (COMMAND_LONG over mavlink2rest)')
  await vehicle.command('MAV_CMD_COMPONENT_ARM_DISARM', [1, 0])
  const armed = await vehicleArmed(vehicle, true)
  await armerShows(page, 'Armed', 5000)
  await page.check('The vehicle is armed and the Armer button says "Armed"', async () => ({
    ok: armed && (await armerLabel(page)) === 'Armed',
    detail: `vehicle armed ${armed}, Armer "${await armerLabel(page)}"`,
  }))
  await page.wait(2000)
  await page.caption('Disarm it the same way')
  await vehicle.command('MAV_CMD_COMPONENT_ARM_DISARM', [0, 0])
  const disarmed = await vehicleArmed(vehicle, false)
  await armerShows(page, 'Disarmed', 5000)
  await page.check('The vehicle is disarmed and the Armer button says "Disarmed"', async () => ({
    ok: disarmed && (await armerLabel(page)) === 'Disarmed',
    detail: `vehicle disarmed ${disarmed}, Armer "${await armerLabel(page)}"`,
  }))
}
