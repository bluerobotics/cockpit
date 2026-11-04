import { missionPanelButton, planUploadAndRun } from '../lib/mission.mjs'
import { LONG_PATH } from '../lib/speed.mjs'

export const meta = { title: 'Skip to the next and previous waypoint', route: '/mission-planning', needs: ['vehicle'] }

const currentItem = async (vehicle) => (await vehicle.read('MISSION_CURRENT'))?.seq

/**
 * Skip forward and back on a running mission and show the vehicle's current mission item follow.
 */
export default async function run({ page, vehicle }) {
  await page.caption('Run a long mission')
  await planUploadAndRun(page, vehicle, LONG_PATH, 2)
  await page.wait(4000)
  const first = await currentItem(vehicle)
  await page.caption('Skip to the next waypoint')
  await page.click(await missionPanelButton(page, 'mdi-skip-next'), { settle: 2500 })
  const next = await currentItem(vehicle)
  await page.check('Vehicle moved on to a later mission item', () => ({
    ok: next > first,
    detail: `item ${first} → ${next}`,
  }))
  await page.caption('Back to the previous waypoint')
  await page.click(await missionPanelButton(page, 'mdi-skip-previous'), { settle: 2500 })
  const back = await currentItem(vehicle)
  await page.check('Vehicle went back to an earlier mission item', () => ({
    ok: back < next,
    detail: `item ${next} → ${back}`,
  }))
  await page.wait(1500)
}
