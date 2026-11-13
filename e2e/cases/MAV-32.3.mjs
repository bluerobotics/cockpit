import { closeMenu, openMenuPage, SPEECH_SPY, spoken, waitAlertBar } from '../lib/mavlink-tools.mjs'
import { armVehicle } from '../lib/mission.mjs'

export const meta = { title: 'Muted voice alerts are not spoken', route: '/', needs: ['vehicle'] }

/**
 * Turn voice alerts off (with Info ticked, so only the switch can silence it), arm, and check the
 * alert shows but nothing is spoken.
 */
export default async function run({ page, vehicle }) {
  await page.eval(SPEECH_SPY)
  // Alerts raised before the mute were voiced when they arrived and may still be queued, so only later ones count.
  const alertsBefore = await page.store('alert', 's.alerts.length')
  await page.caption('Settings → Alerts: tick "Info", then turn voice alerts off')
  await openMenuPage(page, 'settings-alerts')
  await page.click('text=Info', { settle: 800 })
  await page.click('text=Enable voice alerts', { settle: 800 })
  await page.check('Voice alerts are off', async () => !(await page.store('alert', 's.enableVoiceAlerts')))
  await closeMenu(page)
  await page.caption('Arming the vehicle; it reports "Throttle armed"')
  await armVehicle(vehicle)
  const shown = await waitAlertBar(page, 'Throttle armed')
  await page.check('Alert bar still shows "Throttle armed"', () => ({
    ok: shown.includes('Throttle armed'),
    detail: shown,
  }))
  // Long enough for a voiced alert to have reached the speech engine (see MAV-32.2).
  await page.caption('Listening for 40 s')
  await page.wait(40000)
  await page.check('Nothing was spoken', async () => {
    const later = await page.store('alert', `s.alerts.slice(${alertsBefore}).map((a) => a.message)`)
    const said = (await spoken(page)).filter((u) => later.includes(u.text))
    return { ok: said.length === 0, detail: said.map((u) => u.text).join(' | ') || 'silent' }
  })
  await page.wait(1500)
}
