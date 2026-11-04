import { ACTION_NAME, dialogOpensWithin, restartCockpit, UNDECIDED } from '../lib/extensions.mjs'

export const meta = {
  title: 'The BlueOS Extension Features dialog opens by itself at boot',
  route: '/',
  needs: ['vehicle'],
  synced: UNDECIDED,
}

/**
 * Start Cockpit with undecided extension features and wait, without touching anything, for the
 * dialog to come up with them.
 */
export default async function run({ page }) {
  await page.caption('Start Cockpit with an action and joystick mappings still undecided')
  const started = Date.now()
  await restartCockpit(page)
  await page.check('The dialog opens by itself', async () => {
    const open = await dialogOpensWithin(page, 30000)
    return {
      ok: open,
      detail: open ? `${((Date.now() - started) / 1000).toFixed(1)} s after start` : 'not within 30 s',
    }
  })
  await page.check('It shows the pending action, and flags the Joystick Mappings tab', async () => {
    const action = await page.exists(`text=${ACTION_NAME}`)
    const blinking = await page.eval(
      `!!document.querySelector('.v-tab.tab-blink')?.textContent.includes('Joystick Mappings')`
    )
    return {
      ok: action && blinking,
      detail: `action ${action ? 'listed' : 'missing'}, joystick tab ${blinking ? 'flagged' : 'not flagged'}`,
    }
  })
  await page.wait(2500)
}
