import { applyGlobalAddress } from '../lib/global-address.mjs'
import { sawSnackbar } from '../lib/mission.mjs'
import { NO_VEHICLE, OFFER, OFFER_SUPPRESS, setup as quiet } from '../lib/prf.mjs'

export const meta = {
  title: 'Turning off the startup vehicle search sticks across restarts',
  route: '/',
  needs: ['vehicle'],
  platforms: ['electron'],
}

export const setup = async (ctx) => {
  await quiet(ctx)
  await applyGlobalAddress(ctx.page, NO_VEHICLE)
}

const PREVENT_KEY = 'cockpit-prevent-auto-vehicle-discovery-dialog'

/**
 * With no vehicle, the startup offer to search for vehicles comes up; its "do not offer again" button
 * turns it off, and after a restart it does not come back.
 */
export default async function run({ page }) {
  await page.caption('Restart Cockpit with no vehicle: the search offer comes up')
  await page.reload()
  const offered = await sawSnackbar(page, OFFER, 15000)
  await page.check('Cockpit offers to search for vehicles', () => ({ ok: offered }))
  await page.caption('Click the offer\'s "Do not offer a vehicle search on startup" button')
  await page.click(OFFER_SUPPRESS, { settle: 1500 })
  const stored = await page.eval(`localStorage.getItem('${PREVENT_KEY}')`)
  await page.caption('Restart Cockpit again and wait')
  await page.reload()
  const again = await sawSnackbar(page, OFFER, 12000)
  await page.check('After the restart the offer does not come back', () => ({
    ok: !again && stored === 'true',
    detail: `offered again ${again}, ${PREVENT_KEY} ${stored}`,
  }))
}
