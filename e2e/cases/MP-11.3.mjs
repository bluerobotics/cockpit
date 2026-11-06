import { median, missionPanelButton, sampleGroundSpeed } from '../lib/mission.mjs'
import { runAtCruiseSpeed } from '../lib/speed.mjs'

export const meta = { title: 'Changing speed during the mission', route: '/mission-planning', needs: ['vehicle'] }

/**
 * Run at 1 m/s, then set 2 m/s on the mission control panel's speed slider and show the vehicle speed up.
 */
export default async function run(ctx) {
  const { page, vehicle } = ctx
  await runAtCruiseSpeed(ctx, 1, 0.3)
  await page.caption('Mission control panel: speed, slide to 2 m/s')
  await page.click(await missionPanelButton(page, 'mdi-speedometer'), { settle: 900 })
  const track = await page.box('.v-overlay--active .v-slider .v-slider-track')
  // The slider runs 0.1 to 5 m/s.
  const x = track.x - track.w / 2 + ((2 - 0.1) / 4.9) * track.w
  await page.click({ x, y: track.y }, { settle: 900 })
  await page.check('Slider reads 2.0 m/s', async () => {
    const shown = await page.eval(`document.querySelector('.v-overlay--active')?.innerText ?? ''`)
    return { ok: /2\.0\s*m\/s/.test(shown), detail: shown.replace(/\s+/g, ' ').slice(0, 40) }
  })
  await page.key('Escape', { show: false })
  await page.caption('Measuring ground speed from the autopilot')
  await page.wait(6000)
  const measured = median(await sampleGroundSpeed(vehicle, 8000))
  await page.check('Vehicle now cruises at 2 ± 0.4 m/s', () => ({
    ok: Math.abs(measured - 2) <= 0.4,
    detail: `median ${measured.toFixed(2)} m/s`,
  }))
  await page.wait(1500)
}
