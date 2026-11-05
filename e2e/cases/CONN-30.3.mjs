import { heartbeatsFlowing } from '../lib/connections.mjs'
import { sawSnackbar } from '../lib/mission.mjs'
import { OFFER, setup as quiet } from '../lib/prf.mjs'

export const meta = {
  title: 'With the vehicle reachable, Standalone offers no vehicle search',
  route: '/',
  needs: ['vehicle'],
  platforms: ['electron'],
}

export const setup = async (ctx) => {
  if (!(await ctx.page.eval('!!window.electronAPI'))) throw new Error('the startup offer is Standalone-only (--app)')
  await quiet(ctx)
}

/**
 * Restart Cockpit pointed at the vehicle: it connects, and the "No vehicle connected yet" offer never shows.
 */
export default async function run({ page }) {
  await page.caption('Restart Cockpit with the vehicle reachable and wait')
  await page.reload()
  const offered = await sawSnackbar(page, OFFER, 12000)
  await page.check('No vehicle search is offered', () => ({ ok: !offered, detail: `offered ${offered}` }))
  await page.check('The vehicle is connected', () => heartbeatsFlowing(page))
}
