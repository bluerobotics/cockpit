import { dismissTutorial } from '../lib/cockpit.mjs'
import { addActionButton, addCollapsibleContainer, enterEditMode, exitEditMode } from '../lib/custom-widget.mjs'
import { dismissFeaturesDialog } from '../lib/extensions.mjs'

export const meta = {
  title: 'Built-in actions run from a custom widget button',
  route: '/',
  needs: ['vehicle'],
}

export const setup = async ({ page }) => {
  await dismissFeaturesDialog(page)
  await dismissTutorial(page, 3000)
}

/**
 * Build a custom widget with three buttons bound to built-in actions (arm, Manual mode, toggle the
 * top bar), press each and check its effect, on the vehicle where there is one.
 */
export default async function run({ page, vehicle }) {
  await page.caption('Edit Interface → drag a Collapsible Container onto the view')
  await enterEditMode(page)
  await addCollapsibleContainer(page)
  const x = page.width * 0.56
  await page.caption('Add a button for each built-in action')
  await addActionButton(page, { x, y: page.height * 0.3 }, 'Arm', 'Mavlink arm')
  await addActionButton(page, { x, y: page.height * 0.36 }, 'Manual', 'Manual Mode (ArduPilot Rover)')
  await addActionButton(page, { x, y: page.height * 0.42 }, 'Top bar', 'Toggle top bar')
  await exitEditMode(page)

  const until = (probe) => page.waitFor(probe, { timeout: 8000 }).catch(() => false)
  await page.caption('Press "Arm"')
  await page.click('text=Arm', { settle: 1500 })
  await page.check('Mavlink arm: the vehicle reports itself armed', async () => ({
    ok: await until(() => vehicle.isArmed()),
    detail: `armed ${await vehicle.isArmed()}`,
  }))
  await page.caption('Press "Manual"')
  await page.click('text=Manual', { settle: 1500 })
  await page.check('Manual Mode: the vehicle reports custom mode 0', async () => ({
    ok: await until(async () => (await vehicle.heartbeat())?.custom_mode === 0),
    detail: `custom mode ${(await vehicle.heartbeat())?.custom_mode}`,
  }))
  const topBar = () => page.eval(`!!document.querySelector('#mainTopBar')?.getClientRects().length`)
  await page.caption('Press "Top bar" twice')
  await page.click('text=Top bar', { settle: 1500 })
  const hidden = !(await topBar())
  await page.click('text=Top bar', { settle: 1500 })
  await page.check('Toggle top bar: hidden, then shown again', async () => ({
    ok: hidden && (await topBar()),
    detail: `hidden after one press ${hidden}, back after two ${await topBar()}`,
  }))
}
