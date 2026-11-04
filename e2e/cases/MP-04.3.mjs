import { geoToPage, missionState, near } from '../lib/cockpit.mjs'
import { drawPath4, drawSurvey, SURVEY_SE } from '../lib/mission.mjs'

export const meta = {
  title: 'Undo a survey generation and a waypoint drag',
  route: '/mission-planning',
  needs: ['vehicle'],
}

/**
 * The standard four-waypoint path, drawn before recording.
 */
export async function setup({ page }) {
  await drawPath4(page)
}

/**
 * Add a survey and drag a waypoint, then step back through both and forward again.
 */
export default async function run({ page }) {
  const path = (await missionState(page)).waypoints
  await page.caption('Add a survey')
  await drawSurvey(page, SURVEY_SE)
  const withSurvey = await missionState(page)
  await page.caption('Drag waypoint 2')
  await page.drag(await geoToPage(page, 'planning', path[1]), { dx: 0, dy: -70 })
  const dragged = await missionState(page)

  const undo = () => page.click('button:has(.mdi-undo)', { settle: 1000 })
  const redo = () => page.click('button:has(.mdi-redo)', { settle: 1000 })
  await page.caption('Undo: the drag goes first')
  await undo()
  await page.check('Waypoint 2 back where it was, survey still there', async () => {
    const s = await missionState(page)
    return near(s.waypoints[1], path[1], 1e-9) && s.surveys.length === 1
  })
  await page.caption('Undo again: the survey goes')
  await undo()
  await page.check('Survey gone, only the path left', async () => {
    const s = await missionState(page)
    return {
      ok: s.surveys.length === 0 && s.waypoints.length === path.length,
      detail: `${s.waypoints.length} waypoints`,
    }
  })
  await page.caption('Redo twice: survey, then the drag')
  await redo()
  await page.check(
    'Survey back',
    async () => (await missionState(page)).waypoints.length === withSurvey.waypoints.length
  )
  await redo()
  await page.check('Drag re-applied', async () =>
    near((await missionState(page)).waypoints[1], dragged.waypoints[1], 1e-9)
  )
  await page.wait(1500)
}
