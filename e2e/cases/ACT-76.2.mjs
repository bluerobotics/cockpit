import { setUpActions } from '../lib/act-case.mjs'
import { addUserVariable, createCommandAction, editUserVariable, NO_USER_VARIABLES } from '../lib/act-dl.mjs'
import { clickActionButton, NO_ACTIONS, openActions } from '../lib/actions.mjs'
import { dismissTutorial } from '../lib/cockpit.mjs'
import { dismissFeaturesDialog } from '../lib/extensions.mjs'

export const meta = {
  title: 'A data-lake placeholder in a MAVLink action field is read on every call',
  route: '/',
  needs: ['vehicle'],
  synced: { ...NO_ACTIONS, ...NO_USER_VARIABLES },
}

const NAME = 'Release mode from variable'
const VARIABLE = { id: 'release-test/mode', name: 'Release mode', value: 0 }

export const setup = async (ctx) => {
  await dismissFeaturesDialog(ctx.page)
  await dismissTutorial(ctx.page, 3000)
  await addUserVariable(ctx.page, VARIABLE)
  await setUpActions(ctx, false)
}

/**
 * A set-mode COMMAND_LONG whose Custom Mode is {{ release-test/mode }}: played with the variable at
 * 0 the boat goes to Manual, played again at 4 it goes to Hold.
 */
export default async function run({ page, vehicle }) {
  await page.caption('New MAVLink action: set mode, Custom Mode = {{ release-test/mode }}')
  await createCommandAction(page, NAME, {
    'Command ID': 'MAV_CMD_DO_SET_MODE',
    'Mode': 1,
    'Custom Mode': `{{ ${VARIABLE.id} }}`,
  })
  const inMode = async (custom, shown) => {
    await page
      .waitFor(async () => (await vehicle.heartbeat())?.custom_mode === custom, { timeout: 8000 })
      .catch(() => undefined)
    await page.wait(1500)
    const mode = await page.store('main-vehicle', 's.mode')
    const hb = (await vehicle.heartbeat())?.custom_mode
    return {
      ok: hb === custom && mode?.toLowerCase() === shown,
      detail: `vehicle custom_mode ${hb}, mode selector ${mode}`,
    }
  }
  await page.caption('Play it with release-test/mode at 0')
  await clickActionButton(page, NAME, 'play')
  await page.check('Manual (custom_mode 0)', () => inMode(0, 'manual'))

  await page.caption('Tools → Data-lake: set release-test/mode to 4')
  await editUserVariable(page, VARIABLE.name, 4)
  await page.caption('Settings → Actions: play it again')
  await openActions(page)
  await clickActionButton(page, NAME, 'play')
  await page.check('Hold (custom_mode 4)', () => inMode(4, 'hold'))
}
