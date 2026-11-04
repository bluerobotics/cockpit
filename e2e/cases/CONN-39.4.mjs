import { connectionSummary, heartbeatsFlowing, setMainConnection } from '../lib/connections.mjs'

export { setup } from '../lib/conn-case.mjs'

export const meta = {
  title: 'The connection panel reports a link that took over without a gap',
  route: '/',
  needs: ['vehicle'],
  platforms: ['electron'],
}

/**
 * Switch straight from the default link to TCP, so the vehicle never drops, and read the panel's
 * status once its 5-second "connecting..." window is over.
 */
export default async function run({ page, vehicleHost }) {
  const uri = `tcpout://${vehicleHost}:5762`
  await page.caption('Settings → General: switch the main connection straight to TCP')
  await setMainConnection(page, uri)
  await page.check('The vehicle stays online over TCP', () => heartbeatsFlowing(page, 7000))
  await page.caption('What the panel says about it')
  await page.check('The panel says it is connected', async () => {
    const { address, status } = await connectionSummary(page)
    return { ok: address === uri && status === 'connected', detail: `${address} · ${status}` }
  })
  await page.wait(2500)
}
