import { exitEditMode } from '../lib/custom-widget.mjs'
import {
  armInManual,
  attitudeDegrees,
  canvasFrame,
  circleFor,
  closeDialog,
  hookCanvases,
  placeWidget,
  quietStart,
  widgetByHash,
} from '../lib/widgets.mjs'

export const meta = {
  title: 'Attitude HUD follows roll and pitch',
  route: '/',
  needs: ['vehicle'],
}

export const setup = async (ctx) => {
  await quietStart(ctx)
  await hookCanvases(ctx.page)
}

const shown = async (page, hash) => {
  const texts = (await canvasFrame(page, hash))?.texts ?? []
  const value = (prefix) => Number.parseFloat(texts.find((t) => t.startsWith(prefix))?.slice(prefix.length) ?? 'NaN')
  return { roll: value('r: '), pitch: value('p: ') }
}

/**
 * Add an Attitude HUD with its roll/pitch values on, drive a sharp turn, and compare the values it draws
 * with the ATTITUDE Cockpit received at that moment, then with the autopilot's once stopped.
 */
export default async function run({ page, vehicle }) {
  await page.caption('Edit interface: add an Attitude HUD, check "Show roll/pitch values" is on')
  const widget = await placeWidget(page, 'Attitude', { configure: true })
  await page.check('"Show roll/pitch values" is on', async () => {
    const on = (await widgetByHash(page, widget.hash))?.options.showRollPitchValues
    return { ok: on === true, detail: `showRollPitchValues ${on}` }
  })
  await closeDialog(page)
  await exitEditMode(page)

  await page.caption('Arm in Manual and drive in circles for 8 s')
  await armInManual(vehicle)
  const samples = []
  await circleFor(vehicle, 8000, async () => {
    const [values, lake] = await Promise.all([
      shown(page, widget.hash),
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
  await page.check('During the turn the values follow ATTITUDE within 1°', () => ({
    ok: samples.length > 5 && worst <= 1,
    detail: `${samples.length} samples, worst gap ${worst.toFixed(2)}°, roll peaked at ${peak.toFixed(2)}°`,
  }))
  await page.wait(1500)
  const [values, attitude] = await Promise.all([shown(page, widget.hash), attitudeDegrees(vehicle)])
  await page.check('Stopped: shown roll/pitch = the autopilot ATTITUDE within 1°', () => ({
    ok: Math.abs(values.roll - attitude.roll) <= 1 && Math.abs(values.pitch - attitude.pitch) <= 1,
    detail: `shown r ${values.roll} p ${values.pitch}; ATTITUDE r ${attitude.roll.toFixed(
      2
    )} p ${attitude.pitch.toFixed(2)}`,
  }))
}
