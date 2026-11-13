import { dismissTutorial, drawSimplePath, missionState, toPlanning } from '../lib/cockpit.mjs'
import { dismissFeaturesDialog } from '../lib/extensions.mjs'
import { closeMenu, openMenuPage } from '../lib/mavlink-tools.mjs'
import {
  median,
  planningZoom,
  sampleGroundSpeed,
  setCruiseSpeed,
  setHomeByPill,
  startUploadedMission,
  uploadMission,
} from '../lib/mission.mjs'
import { LONG_PATH } from '../lib/speed.mjs'

export const meta = {
  title: 'Mission cruise speed is set and shown in the display speed unit',
  route: '/',
  needs: ['vehicle'],
}

export const setup = async ({ page }) => {
  await dismissFeaturesDialog(page)
  await dismissTutorial(page, 3000)
}

const MPH = 4.5

/**
 * Show speeds in miles per hour and plan a mission at 4.5 mph: the field keeps what was typed, the
 * mission is planned and run in m/s at the speed the field shows, and the mission panel shows it in mph.
 */
export default async function run({ page, vehicle }) {
  await page.caption('Settings → Interface → Display units → Speed: Miles per hour')
  await openMenuPage(page, 'Settings', 'Interface')
  await page.click('text=Miles per hour', { settle: 1500 })
  await closeMenu(page)

  await page.caption('Mission planning: the cruise speed is in mph')
  await toPlanning(page)
  await planningZoom(page)
  await drawSimplePath(page, LONG_PATH)
  const unit = () =>
    page.eval(
      `[...document.querySelectorAll('p')].find((p) => p.textContent.trim() === 'Cruise speed')?.parentElement.lastElementChild.textContent.trim()`
    )
  await page.check('The cruise speed field is labelled mph', async () => ({
    ok: (await unit()) === 'mph',
    detail: await unit(),
  }))
  await setCruiseSpeed(page, MPH)
  const field = () =>
    page.eval(
      `Number([...document.querySelectorAll('p')].find((p) => p.textContent.trim() === 'Cruise speed')?.parentElement.querySelector('input').value)`
    )
  const typed = await field()
  await page.check(`The field keeps the ${MPH} mph typed`, () => ({
    ok: typed === MPH,
    detail: `field shows ${typed} mph`,
  }))
  await setHomeByPill(page, [0.42, 0.62])
  await page.check('"Mission upload succeeded"', () => uploadMission(page))

  await page.check('The mission is planned in m/s at the speed the field shows', async () => {
    const { cruiseSpeed } = await missionState(page)
    return {
      ok: Math.abs(cruiseSpeed - typed * 0.44704) <= 0.03,
      detail: `${cruiseSpeed.toFixed(3)} m/s for ${typed} mph (${(typed * 0.44704).toFixed(3)} m/s)`,
    }
  })
  const planned = (await missionState(page)).cruiseSpeed
  await page.caption('Flight view, press play')
  await startUploadedMission(page, vehicle)
  await page.check('The mission panel shows the cruise speed in mph', async () => {
    const tip = await page.eval(
      `[...document.querySelectorAll('.mdi-speedometer')].map((i) => i.closest('button,div')?.parentElement?.innerText ?? '').join(' ')`
    )
    const titled = await page.eval(
      `document.body.innerHTML.match(/Cruise speed \\(([\\d.]+) ([^)]+)\\)/)?.slice(1).join(' ') ?? ''`
    )
    const shown = Number.parseFloat(titled)
    return {
      ok: /mph/.test(titled) && Math.abs(shown - typed) <= 0.05,
      detail: titled || tip.replace(/\s+/g, ' ').slice(0, 80),
    }
  })
  await page.caption('Let it settle into the leg')
  await page.wait(8000)
  await page.caption(`Measuring ground speed from the autopilot (planned ${planned.toFixed(2)} m/s)`)
  const measured = median(await sampleGroundSpeed(vehicle, 10000))
  await page.check(`The vehicle cruises at the planned speed ± 0.3 m/s`, () => ({
    ok: Math.abs(measured - planned) <= 0.3,
    detail: `median ${measured.toFixed(2)} m/s (${(measured / 0.44704).toFixed(1)} mph), planned ${planned.toFixed(
      2
    )} m/s`,
  }))
}
