// Settings → General → "Vehicle network connection (global address)", which Cockpit applies by
// restarting itself.

import { dismissTutorial, vehicleOnline } from './cockpit.mjs'
import { openMenuPage } from './mavlink-tools.mjs'

// Nothing answers there on the test network.
export const NO_VEHICLE = '192.168.0.250'

const panelInput = `[...document.querySelectorAll('form')].find((f) => f.getClientRects().length
  && f.querySelector('.mdi-restore'))?.querySelector('input')`

/**
 * Type `address` into the global address field and Apply, then wait for Cockpit to come back up.
 * @param {object} page - Driver page
 * @param {string} address - Vehicle address, e.g. blueos.local
 */
export async function applyGlobalAddress(page, address) {
  // Standalone offers to search for vehicles when none is connected; that dialog covers the field.
  if (await page.exists('text=Vehicle Discovery')) await page.click('text=Close', { settle: 800 })
  if (!(await page.eval(`!!(${panelInput})`))) await openMenuPage(page, 'Settings', 'General')
  if (await page.exists('text=Vehicle Discovery')) await page.click('text=Close', { settle: 800 })
  const at =
    await page.eval(`(() => { const i = ${panelInput}; i.scrollIntoView({ block: 'center' }); const r = i.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  await page.fill(at, address)
  await page.wait(500)
  const apply =
    await page.eval(`(() => { const b = [...(${panelInput}).closest('form').querySelectorAll('button[type=submit]')][0]
    const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  await page.click(apply, { settle: 1500 })
  // Cockpit warns, then reloads itself a few seconds later.
  await page
    .waitFor(() => page.exists('text=Restarting Cockpit in 4 seconds...'), {
      timeout: 5000,
      label: 'the restart warning',
    })
    .catch(() => undefined)
  await page.waitFor(async () => (await page.eval(`performance.now()`)) < 4000, {
    timeout: 15000,
    label: 'Cockpit to restart',
  })
  await page.waitFor(() => page.eval(`!!document.querySelector('#app')?.__vue_app__`), {
    label: 'Cockpit to mount',
    timeout: 30000,
  })
}

/**
 * What Cockpit is pointed at and whether the vehicle is there.
 * @param {object} page - Driver page
 * @returns {Promise<{address: string, link: string, online: boolean, vehicleId: string}>} Connection state
 */
export const connectionState = async (page) => ({
  address: await page.store('main-vehicle', 's.globalAddress'),
  link: await page.store('main-vehicle', 'String(s.MAVLink2RestWebsocketURI ?? "")'),
  online: await vehicleOnline(page),
  vehicleId: (await page.store('main-vehicle', 's.currentlyConnectedVehicleId ?? ""')) || '',
})

/**
 * Wait for the vehicle to come online (or not) within `timeout`.
 * @param {object} page - Driver page
 * @param {number} [timeout] - ms
 * @returns {Promise<boolean>} Whether it came online
 */
export const comesOnline = (page, timeout = 30000) =>
  page.waitFor(() => vehicleOnline(page), { timeout }).catch(() => false)

export const quiet = (page) => dismissTutorial(page, 3000)

/**
 * Close Standalone's "Vehicle Discovery" dialog, which opens a few seconds after Cockpit starts
 * without a vehicle. The web build has no such dialog, so there this just waits.
 * @param {object} page - Driver page
 * @param {number} [within] - How long to wait for it, in ms
 */
export async function dismissVehicleDiscovery(page, within = 12000) {
  const shown = await page.waitFor(() => page.exists('text=Vehicle Discovery'), { timeout: within }).catch(() => false)
  if (shown) await page.click('text=Close', { settle: 800 })
}
