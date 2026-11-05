import { enterEditMode, exitEditMode } from '../lib/custom-widget.mjs'
import { armerLabel, armerShows, clickArmer, setup, vehicleArmed } from '../lib/prf.mjs'

export { setup }

export const meta = {
  title: 'The Armer button loads, shows the arm state and arms',
  route: '/',
  needs: ['vehicle'],
}

/**
 * Edit interface: the boat profile already carries an Armer Button in the bottom bar; out of edit mode it
 * reads "Disarmed", and a click (with the slide confirmation when asked) arms the vehicle.
 */
export default async function run({ page, vehicle }) {
  await page.caption('Edit interface: the Armer Button sits in the bottom bar')
  await enterEditMode(page)
  const inBar = await page.store(
    'widget-manager',
    `s.currentView.miniWidgetContainers.some((c) => c.widgets.some((w) => w.component === 'ArmerButton'))`
  )
  await page.check('The view has an Armer Button in its bottom bar', () => ({ ok: inBar }))
  await exitEditMode(page)
  await armerShows(page, 'Disarmed')
  await page.check('It reads "Disarmed", not "..."', async () => ({
    ok: (await armerLabel(page)) === 'Disarmed' && !(await vehicle.isArmed()),
    detail: `"${await armerLabel(page)}"`,
  }))
  await page.caption('Click it to arm')
  const asked = await clickArmer(page)
  const armed = await vehicleArmed(vehicle, true)
  await armerShows(page, 'Armed')
  await page.check('The vehicle armed and the button says "Armed"', async () => ({
    ok: armed && (await armerLabel(page)) === 'Armed',
    detail: `armed ${armed}, confirmation asked ${asked}, "${await armerLabel(page)}"`,
  }))
}
