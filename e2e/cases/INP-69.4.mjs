import { addActionButton, enterEditMode, exitEditMode } from '../lib/custom-widget.mjs'
import { addInputContainer, INPUT_SYNCED, quietStart } from '../lib/inputs.mjs'

export const meta = {
  title: 'Widget buttons run built-in actions',
  route: '/',
  needs: ['vehicle'],
  synced: INPUT_SYNCED,
}

export const setup = quietStart

/**
 * Two buttons in a container from "Add new container": "Toggle top bar" pressed twice, "Mavlink arm" once.
 */
export default async function run({ page, vehicle }) {
  await page.caption('Edit interface → Input → Add new container, with two Buttons')
  await enterEditMode(page)
  const rows = await addInputContainer(page)
  await addActionButton(page, rows[0], 'Top bar', 'Toggle top bar')
  await addActionButton(page, rows[1], 'Arm', 'Mavlink arm')
  await exitEditMode(page)

  const topBar = () =>
    page.eval(`!!document.querySelector('#mainTopBar')?.checkVisibility({ visibilityProperty: true })`)
  await page.caption('Press "Top bar" twice')
  await page.click('text=Top bar', { settle: 1500 })
  const hidden = !(await topBar())
  await page.click('text=Top bar', { settle: 1500 })
  await page.check('The top bar hides, then comes back', async () => ({
    ok: hidden && (await topBar()),
    detail: `hidden after one press ${hidden}, back after two ${await topBar()}`,
  }))

  await page.caption('Press "Arm"')
  await page.click('text=Arm', { settle: 1500 })
  await page.check('The vehicle reports itself armed', async () => ({
    ok: await page.waitFor(() => vehicle.isArmed(), { timeout: 8000 }).catch(() => false),
    detail: `armed ${await vehicle.isArmed()}`,
  }))
}
