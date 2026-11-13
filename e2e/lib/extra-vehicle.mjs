// What the MAP-24 cases share: a stand-in second vehicle near the boat, and adding it under Settings → General →
// "Other vehicles (telemetry only)".

import { dismissTutorial, fieldByLabel } from './cockpit.mjs'
import { dismissFeaturesDialog } from './extensions.mjs'
import { startFakeVehicle } from './fake-vehicle.mjs'
import { openMenuPage } from './mavlink-tools.mjs'

const EARTH_RADIUS_M = 6371000

/**
 * Start a stand-in vehicle going round a circle `eastM` metres east of the boat.
 * @param {object} ctx - Case context from the runner; gets `extra`
 * @param {number} systemId - System ID it announces
 * @param {number} [eastM] - How far east of the boat its circle is centred
 */
export async function startExtraVehicle(ctx, systemId, eastM = 150) {
  await dismissFeaturesDialog(ctx.page)
  await dismissTutorial(ctx.page, 3000)
  const boat = await ctx.vehicle.position()
  const centre = {
    lat: boat.lat,
    lon: boat.lon + (eastM / (EARTH_RADIUS_M * Math.cos((boat.lat * Math.PI) / 180))) * (180 / Math.PI),
  }
  ctx.extra = await startFakeVehicle({ systemId, centre })
}

/**
 * Settings → General → Other vehicles (telemetry only): type the address and press "Add vehicle".
 * @param {object} page - Driver page
 * @param {string} url - The vehicle's MAVLink2Rest WebSocket address
 */
export async function addExtraVehicle(page, url) {
  await openMenuPage(page, 'settings-general')
  await page.eval(`[...document.querySelectorAll('*')].find((e) => e.childElementCount === 0
    && e.textContent.trim() === 'Other vehicles (telemetry only)')?.scrollIntoView({ block: 'center' })`)
  await page.wait(600)
  await page.fill(await fieldByLabel(page, 'Vehicle telemetry address'), url)
  await page.wait(400)
  await page.click('text=Add vehicle', { settle: 1500 })
}

/**
 * The text of the row listing `url` in the "Other vehicles" panel.
 * @param {object} page - Driver page
 * @param {string} url - The vehicle's address
 * @returns {Promise<string>} Row text
 */
export const extraVehicleRow = (page, url) =>
  page.eval(`(() => { const cell = [...document.querySelectorAll('*')].find((e) => e.childElementCount === 0
    && e.textContent.trim() === ${JSON.stringify(url)}); let row = cell
    for (let i = 0; i < 4 && row && !/System ID|Waiting|Connected|Disconnected/i.test(row.innerText); i++) row = row.parentElement
    return (row ?? cell)?.innerText.replace(/\\s+/g, ' ').trim() ?? '' })()`)

export const lake = (page, id) => page.eval(`window.cockpit.getDataLakeVariableData(${JSON.stringify(id)})`)
