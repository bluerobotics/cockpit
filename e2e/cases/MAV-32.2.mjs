import { closeMenu, openMenuPage, SPEECH_SPY, spoken, waitAlertBar } from '../lib/mavlink-tools.mjs'
import { armVehicle } from '../lib/mission.mjs'

export const meta = { title: 'STATUSTEXT is read aloud', route: '/', needs: ['vehicle'] }

/**
 * Turn on voice for Info alerts, arm the vehicle, and check "Throttle armed" goes to the speech engine.
 */
export default async function run({ page, vehicle }) {
  await page.eval(SPEECH_SPY)
  // ArduPilot sends "Throttle armed" at Info severity, which Cockpit keeps silent unless Info is ticked.
  await page.caption('Settings → Alerts: voice alerts on, tick "Info"')
  await openMenuPage(page, 'Settings', 'Alerts')
  await page.check('Voice alerts are enabled', () => page.store('alert', 's.enableVoiceAlerts'))
  await page.click('text=Info', { settle: 800 })
  await page.check('Info alerts are voiced', async () => {
    const levels = await page.store('alert', 's.enabledAlertLevels')
    return levels.find((l) => l.level === 'info')?.enabled === true
  })
  await closeMenu(page)
  await page.caption('Arming the vehicle; it reports "Throttle armed"')
  await armVehicle(vehicle)
  await waitAlertBar(page, 'Throttle armed')
  // Speech waits for the voice list, which can take a while in a fresh browser.
  await page.caption('Waiting for the alert to be spoken')
  await page
    .waitFor(async () => (await spoken(page)).some((u) => u.text.includes('Throttle armed')), { timeout: 40000 })
    .catch(() => undefined)
  await page.check('"Throttle armed" was spoken', async () => {
    const said = (await spoken(page)).find((u) => u.text.includes('Throttle armed'))
    return { ok: Boolean(said) && said.volume > 0, detail: said ? `volume ${said.volume}` : 'not spoken' }
  })
  await page.wait(1500)
}
