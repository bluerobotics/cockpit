import { enterEditMode, exitEditMode } from '../lib/custom-widget.mjs'
import { armVehicle } from '../lib/mission.mjs'
import { centre, setup } from '../lib/prf.mjs'

export { setup }

export const meta = {
  title: 'The Virtual Horizon loads and follows the attitude',
  route: '/',
  needs: ['vehicle'],
}

const CARD = `[...document.querySelectorAll('[draggable=true]')].find((e) => e.innerText.trim() === 'Virtual Horizon')`
// What each visible horizon draws: how many pixels are painted, and a checksum that moves when it tilts.
const DRAWN = `[...document.querySelectorAll('.virtualHorizon canvas')].filter((c) => c.getClientRects().length && c.width)
  .map((c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let painted = 0; let sum = 0
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3]) painted++; sum = (sum * 31 + d[i] + d[i + 1] * 7 + d[i + 2] * 13) % 1000000007 }
    return { painted: painted / (d.length / 4), sum } })`
const horizons = (page) =>
  page.store('widget-manager', `s.currentView.widgets.filter((w) => w.component === 'VirtualHorizon').length`)
const degrees = (rad) => (rad * 180) / Math.PI
// Steering on channel 1 and throttle on channel 3; 0 hands a channel back.
const override = (steer, throttle) => ({
  type: 'RC_CHANNELS_OVERRIDE',
  target_system: 1,
  target_component: 1,
  ...Object.fromEntries(Array.from({ length: 18 }, (_, i) => [`chan${i + 1}_raw`, 0])),
  chan1_raw: steer,
  chan3_raw: throttle,
})

/**
 * Edit interface: drag a Virtual Horizon onto the view. Then arm the boat and drive it in a turn for 10 s
 * with RC overrides from outside Cockpit: the horizon is drawn, and the attitude it is fed tracks the
 * vehicle's ATTITUDE.
 */
export default async function run({ page, vehicle }) {
  const before = await horizons(page)
  await page.caption('Edit interface → drag a Virtual Horizon onto the view')
  await enterEditMode(page)
  await page.drag(
    await centre(page, CARD),
    { x: page.width * 0.3, y: page.height * 0.45 },
    {
      html5: true,
      duration: 1200,
      settle: 2000,
    }
  )
  await exitEditMode(page)
  const after = await horizons(page)
  const drawn = await page.eval(DRAWN)
  await page.check('A new Virtual Horizon is on the view and drawn, not a blank box', () => ({
    ok: after === before + 1 && drawn.length > 0 && drawn.every((d) => d.painted > 0.3),
    detail: `${before} → ${after} horizons, painted ${drawn.map((d) => `${Math.round(d.painted * 100)}%`).join(', ')}`,
  }))

  await page.caption('Arm, Manual, and drive the boat in a turn for 10 s (RC override from outside Cockpit)')
  await armVehicle(vehicle)
  await vehicle.command('MAV_CMD_DO_SET_MODE', [1, 0])
  const rolls = []
  const sums = new Set(drawn.map((d) => d.sum))
  const fed = []
  const end = Date.now() + 10000
  while (Date.now() < end) {
    await vehicle.send(override(1900, 1800))
    const truth = await vehicle.read('ATTITUDE')
    const shown = await page.store('main-vehicle', '({ roll: s.attitude.roll, pitch: s.attitude.pitch })')
    if (truth) {
      rolls.push(degrees(truth.roll))
      fed.push(Math.max(Math.abs(degrees(truth.roll - shown.roll)), Math.abs(degrees(truth.pitch - shown.pitch))))
    }
    for (const d of await page.eval(DRAWN)) sums.add(d.sum)
    await page.wait(250)
  }
  await vehicle.send(override(0, 0))
  const span = rolls.length ? Math.max(...rolls) - Math.min(...rolls) : 0
  // Sampled a few hundred ms apart from two sources, so a degree of difference is timing, not a wrong value.
  await page.check("The attitude the horizon draws tracks the vehicle's ATTITUDE", () => ({
    ok: fed.length > 10 && Math.max(...fed) < 1.5,
    detail: `${fed.length} samples, worst difference ${Math.max(0, ...fed).toFixed(2)}°`,
  }))
  await page.check('The horizon tilts when the boat rolls', () => ({
    ok: span < 0.3 || sums.size > 1,
    detail:
      span < 0.3
        ? `the boat rolled only ${span.toFixed(2)}°`
        : `rolled ${span.toFixed(1)}°, ${sums.size} distinct drawings`,
  }))
}
