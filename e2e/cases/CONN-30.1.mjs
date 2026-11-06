import { applyGlobalAddress } from '../lib/global-address.mjs'
import { sawSnackbar } from '../lib/mission.mjs'
import { NO_VEHICLE, OFFER, setup as quiet } from '../lib/prf.mjs'

export const meta = {
  title: 'With no vehicle, Standalone offers a vehicle search on its own',
  route: '/',
  needs: ['vehicle'],
  platforms: ['electron'],
}

export const setup = async (ctx) => {
  if (!(await ctx.page.eval('!!window.electronAPI'))) throw new Error('the startup offer is Standalone-only (--app)')
  await quiet(ctx)
  await applyGlobalAddress(ctx.page, NO_VEHICLE)
}

/**
 * Restart Cockpit pointed at an address with no vehicle and wait: about 5 s in, it offers to search for
 * vehicles, and the offer's action opens the Vehicle Discovery dialog.
 */
export default async function run({ page }) {
  await page.caption(`Restart Cockpit with the address on ${NO_VEHICLE}, where nothing answers, and wait`)
  await page.reload()
  const offered = await sawSnackbar(page, OFFER, 15000)
  await page.check('Cockpit offers to search for vehicles', () => ({
    ok: offered,
    detail: offered ? OFFER : 'no offer',
  }))
  await page.caption('"Search for vehicles" in the offer opens the discovery dialog')
  await page.click('text=Search for vehicles', { settle: 1500 })
  await page.check('The Vehicle Discovery dialog is open', async () => ({
    ok: await page.exists('text=Vehicle Discovery'),
  }))
}
