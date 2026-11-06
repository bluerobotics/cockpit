import { ACTION_KEYS, newAction, NO_ACTIONS, openActions } from '../lib/actions.mjs'
import { fieldByLabel } from '../lib/cockpit.mjs'
import { addActionButton, enterEditMode, exitEditMode } from '../lib/custom-widget.mjs'
import { addInputContainer, INPUT_KEYS, INPUT_SYNCED, quietStart } from '../lib/inputs.mjs'
import { closeMenu } from '../lib/mavlink-tools.mjs'

export const meta = {
  title: 'A widget button runs a MAVLink message action',
  route: '/',
  needs: ['vehicle'],
  synced: { ...NO_ACTIONS, ...INPUT_SYNCED },
  restore: [...ACTION_KEYS, ...INPUT_KEYS],
}

const NAME = 'Release arm'

// A MAVLink message action as the dialog starts it: COMMAND_LONG arming the vehicle.
export const setup = async (ctx) => {
  const { page } = ctx
  await quietStart(ctx)
  await openActions(page)
  await newAction(page, 'MAVLink Message Action')
  await page.fill(await fieldByLabel(page, 'Action Name'), NAME)
  await page.click('text=Create', { settle: 1500 })
  await closeMenu(page)
}

/**
 * Add a button bound to the MAVLink action and press it: the vehicle arms.
 */
export default async function run({ page, vehicle }) {
  await page.check('The vehicle starts disarmed', async () => !(await vehicle.isArmed()))
  await page.caption('Edit interface → Input → Add new container, with a Button on the MAVLink action')
  await enterEditMode(page)
  const rows = await addInputContainer(page)
  await addActionButton(page, rows[0], 'Arm', NAME)
  await exitEditMode(page)

  await page.caption('Press it')
  await page.click('text=Arm', { settle: 1500 })
  await page.check('The vehicle reports itself armed, and Cockpit shows it', async () => {
    const armed = await page.waitFor(() => vehicle.isArmed(), { timeout: 8000 }).catch(() => false)
    const shown = await page
      .waitFor(() => page.store('main-vehicle', 's.isArmed'), { timeout: 5000 })
      .catch(() => false)
    return { ok: armed && shown, detail: `vehicle armed ${await vehicle.isArmed()}, Cockpit armed ${shown}` }
  })
}
