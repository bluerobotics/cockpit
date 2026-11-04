// The shared body of the CONN-39 cases: switch Standalone's main connection to `uri` and show the
// vehicle coming online over it.

import { dismissTutorial } from './cockpit.mjs'
import { connectionSummary, heartbeatsFlowing, setMainConnection } from './connections.mjs'
import { dismissFeaturesDialog } from './extensions.mjs'

// Nothing listens there, so the vehicle can only come back over the link the case then sets.
export const DEAD_LINK = (host) => `tcpout://${host}:5999`

export const setup = async ({ page }) => {
  await dismissFeaturesDialog(page)
  await dismissTutorial(page, 5000)
}

/**
 * Wait for the vehicle to be online (or not) as the vehicle store sees it.
 * @param {object} page - Driver page
 * @param {boolean} online - State to wait for
 * @param {number} [timeout] - ms
 * @returns {Promise<boolean>} Whether it got there
 */
export const vehicleBecomes = (page, online, timeout = 15000) =>
  page
    .waitFor(async () => (await page.store('main-vehicle', 's.isVehicleOnline')) === online, { timeout })
    .catch(() => false)

/**
 * Drop the vehicle by pointing at a dead link, then switch to `uri` and check it comes back over it.
 * @param {object} page - Driver page
 * @param {string} host - Vehicle address
 * @param {string} uri - Connection URI
 * @param {string} what - How the caption names the link
 */
export async function switchAndCheck(page, host, uri, what) {
  await page.caption('Settings → General: first point the main connection at a port nobody serves')
  await setMainConnection(page, DEAD_LINK(host))
  await page.check('The vehicle goes offline: the old link is gone', async () => ({
    ok: await vehicleBecomes(page, false),
  }))

  await page.caption(`Now point it at ${what}`)
  await setMainConnection(page, uri)
  await page.check('The vehicle comes back online', async () => ({ ok: await vehicleBecomes(page, true) }))
  await page.check(`The panel shows ${uri}, connected`, async () => {
    let summary
    await page
      .waitFor(
        async () => {
          summary = await connectionSummary(page)
          return summary.address === uri && summary.status === 'connected'
        },
        { timeout: 10000 }
      )
      .catch(() => undefined)
    return {
      ok: summary.address === uri && summary.status === 'connected',
      detail: `${summary.address} · ${summary.status}`,
    }
  })
  await page.caption('Heartbeats keep arriving over it')
  await page.check('Heartbeats keep arriving over the new link', () => heartbeatsFlowing(page, 4000))
  await page.wait(1500)
}
