import { missionState } from '../lib/cockpit.mjs'
import { drawPath4, drawSurvey, openSurveyMenu, orbit, sidebarInput, SURVEY_SE } from '../lib/mission.mjs'

export const meta = { title: 'Change survey line spacing and angle', route: '/mission-planning', needs: ['vehicle'] }

let before

/**
 * Path plus one survey, drawn before recording.
 */
export async function setup({ page }) {
  await drawPath4(page)
  await drawSurvey(page, SURVEY_SE)
  before = (await missionState(page)).surveys[0]
}

/**
 * Halve the line spacing and turn the lines 45°, regenerate, and show the denser, rotated pattern.
 */
export default async function run({ page }) {
  const spacing = Math.max(1, Math.round(before.spacing / 2))
  const angle = (Math.round(before.angle) + 45) % 360
  await page.caption('Edit the survey')
  await openSurveyMenu(page)
  await page.click(orbit('mdi-pencil'), { settle: 1200 })
  await page.caption(`Distance between lines: ${before.spacing} → ${spacing} m`)
  await page.fill(await sidebarInput(page, 'Distance between lines'), spacing)
  await page.caption(`Lines angle: ${Math.round(before.angle)}° → ${angle}°`)
  await page.fill(await sidebarInput(page, 'Lines angle'), angle)
  await page.wait(800)
  await page.click('text=GENERATE WAYPOINTS', { settle: 1500 })

  await page.caption('Denser lines, turned 45°')
  await page.check(`Survey spacing is ${spacing} m`, async () => {
    const [s] = (await missionState(page)).surveys
    return { ok: s?.spacing === spacing, detail: `${s?.spacing} m` }
  })
  await page.check(`Survey lines angle is ${angle}°`, async () => {
    const [s] = (await missionState(page)).surveys
    return { ok: Math.round(s?.angle) === angle, detail: `${s?.angle}°` }
  })
  await page.check('More survey waypoints than before', async () => {
    const [s] = (await missionState(page)).surveys
    const n = s?.waypointIds.length ?? 0
    return { ok: n > before.waypointIds.length, detail: `${before.waypointIds.length} → ${n}` }
  })
  await page.wait(1500)
}
