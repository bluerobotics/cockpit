import { planUploadAndRun, RUN_PATH, waitArrival } from '../lib/mission.mjs'

export const meta = {
  title: 'The map shows mission progress while it runs',
  route: '/mission-planning',
  needs: ['vehicle'],
}

const reached = (page) => page.count('.marker-icon--reached')
const currentWp = (page) =>
  page.eval(`(() => { const t = [...document.querySelectorAll('*')].find((e) => e.childElementCount === 0 && e.textContent.trim() === 'Curr. WP')
    return t?.nextElementSibling?.textContent.trim() ?? '' })()`)

/**
 * Run a short mission and watch the map mark waypoints as reached and the panel's current waypoint advance.
 */
export default async function run({ page, vehicle }) {
  const waypoints = await planUploadAndRun(page, vehicle, RUN_PATH, 3)
  const seen = []
  for (const [i, wp] of waypoints.entries()) {
    await waitArrival(vehicle, wp, {
      onTick: async () =>
        page.caption(`Curr. WP ${await currentWp(page)} · reached on the map: ${await reached(page)}`),
    })
    // The autopilot reports a waypoint reached inside its own radius, a moment after the vehicle is
    // within 3 m, so give the map a few seconds to catch up before judging it. The last one takes longest: the boat
    // slows to stop on it.
    await page.waitFor(async () => (await reached(page)) >= i + 1, { timeout: 30000 }).catch(() => undefined)
    seen.push({ wp: await currentWp(page), reached: await reached(page) })
    await page.check(
      `After waypoint ${i + 1}: ${seen.at(-1).reached} marked reached, Curr. WP ${seen.at(-1).wp}`,
      () => seen.at(-1).reached >= i + 1
    )
  }
  await page.check('Curr. WP advanced through the mission', () => {
    const values = seen.map((s) => Number(s.wp)).filter(Number.isFinite)
    return {
      ok: values.length >= 2 && values.every((v, i) => i === 0 || v >= values[i - 1]),
      detail: seen.map((s) => s.wp).join(' → '),
    }
  })
  await page.wait(1500)
}
