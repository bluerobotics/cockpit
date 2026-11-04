import { DIALOG_CLOSE, dialogOpensWithin, restartCockpit, UNDECIDED } from '../lib/extensions.mjs'

export const meta = {
  title: 'The features dialog comes back at the next boot only while something is undecided',
  route: '/',
  needs: ['vehicle'],
  synced: UNDECIDED,
}

/**
 * Close the dialog undecided and restart: it comes back. Then ignore the action and the remaining
 * joystick mappings and restart again: it stays closed.
 */
export default async function run({ page }) {
  await restartCockpit(page)
  if (!(await dialogOpensWithin(page))) throw new Error('the BlueOS Extension Features dialog did not open')
  await page.caption('Close it undecided (Close anyway)')
  await page.click(DIALOG_CLOSE, { settle: 1200 })
  await page.click('text=Close anyway', { settle: 1500 })

  await page.caption('Restart Cockpit')
  await restartCockpit(page)
  await page.check('It opens again, since nothing was decided', async () => ({
    ok: await dialogOpensWithin(page, 30000),
  }))
  await page.wait(1200)

  await page.caption('Decide everything: Ignore the action, Ignore remaining suggestions')
  await page.click('text=Ignore', { settle: 1200 })
  await page.click('text=Joystick Mappings', { settle: 1200 })
  await page.click('text=Ignore remaining suggestions', { settle: 1500 })
  await page.click(DIALOG_CLOSE, { settle: 1200 })
  await page.check('With nothing pending it closes without a warning', async () => ({
    ok: !(await page.exists('text=Close anyway')) && !(await page.exists('.features-modal')),
  }))
  // The decisions sync to the vehicle a moment after they are made.
  await page.wait(4000)

  await page.caption('Restart Cockpit again')
  await restartCockpit(page)
  await page.check('It stays closed', async () => {
    const opened = await dialogOpensWithin(page, 25000)
    return { ok: !opened, detail: opened ? 'opened' : 'not opened in 25 s' }
  })
  await page.wait(1500)
}
