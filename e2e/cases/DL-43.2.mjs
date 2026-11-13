import { downloadCurrentSession, downloadsOf, LOGGER_DEFAULTS, medianStep } from '../lib/data-logs.mjs'
import { recordWith, setup } from '../lib/dl-case.mjs'

export { setup }

export const meta = {
  title: 'Download a recorded session as JSON',
  route: '/',
  needs: ['vehicle'],
  synced: LOGGER_DEFAULTS,
}

const BOOT = '/mavlink/1/1/SYSTEM_TIME/time_boot_ms'
const MODE = '/mavlink/1/1/HEARTBEAT/custom_mode'

/**
 * Record at the default 1 s interval and download the session as JSON: a list of points, each with
 * its epoch and both variables, one per second, with the flight mode the vehicle is in.
 */
export default async function run({ page, vehicle, outDir, meta: { id } }) {
  await recordWith(page, { ids: [BOOT, MODE], ms: 10000, what: 'the default 1000 ms interval' })
  await page.caption('Download the current session as JSON')
  const { text } = await downloadCurrentSession(page, downloadsOf(outDir, id), 'JSON')
  let points = []
  await page.check('The file is a JSON list of points', () => {
    points = JSON.parse(text)
    return { ok: Array.isArray(points) && points.length > 0, detail: `${points.length} points` }
  })
  // The clock was ticked first, so the points before the mode was ticked have no mode.
  const fromMode = points.slice(points.findIndex((p) => p.data?.[MODE] !== undefined))
  await page.check('Once both are recorded, every point has an epoch and both variables', () => ({
    ok:
      fromMode.length >= 5 &&
      fromMode.every(
        (p) => Number.isFinite(p.epoch) && Number.isFinite(p.data?.[BOOT]) && Number.isFinite(p.data?.[MODE])
      ),
    detail: `${fromMode.length} points, last ${JSON.stringify(points.at(-1))}`,
  }))
  await page.check('One point per second', () => {
    const step = medianStep(points.map((p) => p.epoch))
    return {
      ok: points.length >= 7 && Math.abs(step - 1000) <= 100,
      detail: `${points.length} points, median step ${step} ms`,
    }
  })
  const mode = (await vehicle.heartbeat())?.custom_mode
  await page.check('The flight mode logged is the one the vehicle reports', () => ({
    ok: points.at(-1)?.data?.[MODE] === mode,
    detail: `logged ${points.at(-1)?.data?.[MODE]}, vehicle ${mode}`,
  }))
}
