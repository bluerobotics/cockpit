import { applyGlobalAddress, comesOnline, connectionState } from '../lib/global-address.mjs'
import { centre, NO_VEHICLE, setup as quiet } from '../lib/prf.mjs'

export const meta = {
  title: 'Vehicle discovery finds the vehicle and connects to it',
  route: '/',
  needs: ['vehicle'],
  platforms: ['electron'],
}

/**
 * Move Cockpit to an address with no vehicle, outside the recording, so picking the found one is what connects.
 */
export const setup = async (ctx) => {
  await quiet(ctx)
  await applyGlobalAddress(ctx.page, NO_VEHICLE)
}

const FOUND = `[...document.querySelectorAll('.v-overlay--active button')].find((b) => b.getClientRects().length
  && /\\(\\d+\\.\\d+\\.\\d+\\.\\d+\\)$/.test(b.innerText.trim()))`

/**
 * Settings → General → "Search for vehicles": the dialog scans the network, lists the vehicle with its
 * name and address, and picking it points Cockpit there and connects.
 */
export default async function run({ page }) {
  await page.caption('Settings → General → "Search for vehicles"')
  if (await page.exists('text=Close')) await page.click('text=Close', { settle: 600 })
  await page.click('text=Search for vehicles', { settle: 1500 })
  await page.caption('In the Vehicle Discovery dialog: "Search for vehicles"')
  await page.click(
    await centre(
      page,
      `[...document.querySelectorAll('.v-overlay--active button')].find((b) => /^(Search for vehicles|Search again)$/.test(b.innerText.trim()))`
    ),
    { settle: 1000 }
  )
  const found = await page
    .waitFor(() => page.eval(`!!${FOUND}`), { timeout: 120000, label: 'a vehicle in the list' })
    .catch(() => false)
  const listed = found ? await page.eval(`${FOUND}.innerText.replace(/\\s+/g, ' ').trim()`) : ''
  const address = listed.match(/\((.+)\)$/)?.[1] ?? ''
  await page.check('The vehicle is listed with its name and address', () => ({
    ok: found && /^\S.*\(\d+\.\d+\.\d+\.\d+\)$/.test(listed),
    detail: listed || 'nothing found',
  }))
  await page.caption('Pick it')
  await page.click(await centre(page, FOUND), { settle: 1500 })
  await page
    .waitFor(async () => (await page.eval('performance.now()')) < 4000, { timeout: 15000 })
    .catch(() => undefined)
  await page.waitFor(() => page.eval(`!!document.querySelector('#app')?.__vue_app__`), { timeout: 30000 })
  const online = await comesOnline(page, 45000)
  const after = await connectionState(page)
  await page.check('Cockpit is pointed at the picked address and the vehicle is online', () => ({
    ok: online && after.address === address,
    detail: `${after.address} (picked ${address}), online ${online}`,
  }))
}
