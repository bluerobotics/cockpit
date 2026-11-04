import { mapPoint } from '../lib/cockpit.mjs'
import { drawPath4, drawSurvey, estimates, SURVEY_SE } from '../lib/mission.mjs'

export const meta = { title: 'Estimates board shows up with all rows', route: '/mission-planning', needs: ['vehicle'] }

const ROWS = ['Length', 'Max distance from home', 'ETA', 'Energy', 'Total survey coverage', 'Mission area (≈)']

/**
 * Path, survey and mission home, set before recording.
 */
export async function setup({ page }) {
  await drawPath4(page)
  await drawSurvey(page, SURVEY_SE)
  await page.click('text=Set mission home', { settle: 700 })
  await page.click(await mapPoint(page, 'planning', 0.36, 0.7), { settle: 1200 })
}

/**
 * Show the "Mission estimates" card with every row filled in.
 */
export default async function run({ page }) {
  await page.caption('A mission with a path, a survey and a home: the estimates card')
  await page.hover(await page.box('text=Mission estimates'), 1500)
  for (const row of ROWS) {
    await page.check(`"${row}" filled in`, async () => {
      const value = (await estimates(page))[row]
      return { ok: Boolean(value) && value !== '—' && value !== '-', detail: value ?? 'missing' }
    })
  }
  await page.wait(1500)
}
