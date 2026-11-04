import {
  ACTION_NAME,
  DIALOG_CLOSE,
  dialogOpensWithin,
  featuresDialogOpen,
  restartCockpit,
  UNDECIDED,
} from '../lib/extensions.mjs'

export const meta = {
  title: 'Closing the features dialog with undecided items warns first',
  route: '/',
  needs: ['vehicle'],
  synced: UNDECIDED,
}

const warning = (page) =>
  page.eval(
    `[...document.querySelectorAll('.v-overlay--active .v-card')].find((c) => c.innerText.includes('Pending Extension Features'))?.innerText.replace(/\\s+/g, ' ') ?? ''`
  )

/**
 * Close the boot dialog while things are still undecided: the warning lists them, "Keep reviewing"
 * goes back, and "Close anyway" closes.
 */
export default async function run({ page }) {
  await restartCockpit(page)
  if (!(await dialogOpensWithin(page))) throw new Error('the BlueOS Extension Features dialog did not open')
  await page.wait(1200)

  await page.caption('Close it with its X, leaving everything undecided')
  await page.click(DIALOG_CLOSE, { settle: 1200 })
  await page.check('A warning lists the pending action and joystick mappings', async () => {
    const text = await warning(page)
    const ok =
      text.includes(ACTION_NAME) &&
      /Pending joystick mappings \(\d+\)/.test(text) &&
      /next time you start Cockpit/.test(text)
    return { ok, detail: text.slice(0, 200) }
  })
  await page.wait(1500)

  await page.caption('Keep reviewing')
  await page.click('text=Keep reviewing', { settle: 1000 })
  await page.check('Back in the dialog', async () => ({
    ok: (await featuresDialogOpen(page)) && !(await warning(page)),
  }))

  await page.caption('Close again, then Close anyway')
  await page.click(DIALOG_CLOSE, { settle: 1200 })
  await page.click('text=Close anyway', { settle: 1500 })
  await page.check('The dialog is gone', async () => ({
    ok: !(await featuresDialogOpen(page)) && !(await warning(page)),
  }))
  await page.wait(1500)
}
