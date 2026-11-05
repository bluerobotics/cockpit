import { exitEditMode } from '../lib/custom-widget.mjs'
import {
  armInManual,
  attitudeDegrees,
  canvasFrame,
  circleFor,
  hookCanvases,
  placeWidget,
  quietStart,
} from '../lib/widgets.mjs'

export const meta = {
  title: 'Virtual Horizon follows roll and pitch',
  route: '/',
  needs: ['vehicle'],
}

export const setup = async (ctx) => {
  await quietStart(ctx)
  await hookCanvases(ctx.page)
}

// The horizon is drawn rotated by -roll (its third rotation of a frame) and the sky's lower edge sits
// 4·(pitch/90)·R below the centre, R being a third of the sky's width.
const rendered = async (page, hash) => {
  const f = await canvasFrame(page, hash)
  const sky = f?.rects.find(([, , w, h]) => w > 0 && Math.abs(h + w) < 1e-6)
  if (!f || f.rotates.length < 3 || !sky) return { roll: NaN, pitch: NaN }
  return { roll: (-f.rotates[2] * 180) / Math.PI, pitch: (sky[1] * 90) / (4 * (sky[2] / 3)) }
}

/**
 * Add a Virtual Horizon, drive a sharp turn, and compare the roll and pitch it draws with the ATTITUDE
 * Cockpit received at that moment, then with the autopilot's once stopped.
 */
export default async function run({ page, vehicle }) {
  await page.caption('Edit interface: add a Virtual Horizon')
  const widget = await placeWidget(page, 'Virtual Horizon')
  await exitEditMode(page)
  await page.caption('Arm in Manual and drive in circles for 8 s')
  await armInManual(vehicle)
  const samples = []
  await circleFor(vehicle, 8000, async () => {
    const [values, lake] = await Promise.all([
      rendered(page, widget.hash),
      page.eval(
        `['roll', 'pitch'].map((k) => window.cockpit.getDataLakeVariableData('/mavlink/1/1/ATTITUDE/' + k) * 180 / Math.PI)`
      ),
    ])
    samples.push({ ...values, lakeRoll: lake[0], lakePitch: lake[1] })
  })
  const worst = Math.max(
    ...samples.map((s) => Math.max(Math.abs(s.roll - s.lakeRoll), Math.abs(s.pitch - s.lakePitch)))
  )
  const peak = Math.max(...samples.map((s) => Math.abs(s.lakeRoll)))
  await page.check('During the turn the drawn horizon follows ATTITUDE within 1°', () => ({
    ok: samples.length > 5 && worst <= 1,
    detail: `${samples.length} samples, worst gap ${worst.toFixed(2)}°, roll peaked at ${peak.toFixed(2)}°`,
  }))
  await page.wait(1500)
  const [values, attitude] = await Promise.all([rendered(page, widget.hash), attitudeDegrees(vehicle)])
  await page.check('Stopped: drawn roll/pitch = the autopilot ATTITUDE within 1°', () => ({
    ok: Math.abs(values.roll - attitude.roll) <= 1 && Math.abs(values.pitch - attitude.pitch) <= 1,
    detail: `drawn r ${values.roll.toFixed(2)} p ${values.pitch.toFixed(2)}; ATTITUDE r ${attitude.roll.toFixed(
      2
    )} p ${attitude.pitch.toFixed(2)}`,
  }))
}
