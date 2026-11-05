import { exitEditMode } from '../lib/custom-widget.mjs'
import {
  angleGap,
  armInManual,
  attitudeDegrees,
  canvasFrame,
  hookCanvases,
  placeWidget,
  quietStart,
  turnBy,
} from '../lib/widgets.mjs'

export const meta = {
  title: 'Compass follows the heading',
  route: '/',
  needs: ['vehicle'],
}

export const setup = async (ctx) => {
  await quietStart(ctx)
  await hookCanvases(ctx.page)
}

const shownHeading = async (page, hash) => {
  const text = (await canvasFrame(page, hash))?.texts.find((t) => /^-?\d+°$/.test(t))
  return text === undefined ? NaN : Number.parseFloat(text)
}

/**
 * Add a Compass, arm in Manual and drive a 180° turn: its heading turns with the boat and ends on the
 * autopilot's ATTITUDE yaw.
 */
export default async function run({ page, vehicle }) {
  await page.caption('Edit interface: add a Compass')
  const widget = await placeWidget(page, 'Compass')
  await exitEditMode(page)
  const before = { shown: await shownHeading(page, widget.hash), attitude: (await attitudeDegrees(vehicle)).yaw }
  await page.caption('Arm in Manual and drive a 180° turn')
  await armInManual(vehicle)
  const seen = new Set()
  const turned = await turnBy(vehicle, 180, {
    onTick: async (t) => {
      seen.add(Math.round(await shownHeading(page, widget.hash)))
      await page.caption(`Turning: ${Math.abs(t).toFixed(0)}° so far`)
    },
  })
  await page.caption('Stopped')
  await page.wait(2500)
  const after = { shown: await shownHeading(page, widget.hash), attitude: (await attitudeDegrees(vehicle)).yaw }
  await page.check('Before and after the turn the shown heading = ATTITUDE yaw within 2°', () => ({
    ok: angleGap(before.shown, before.attitude) <= 2 && angleGap(after.shown, after.attitude) <= 2,
    detail: `before ${before.shown}° / ${before.attitude.toFixed(1)}°, after ${after.shown}° / ${after.attitude.toFixed(
      1
    )}°`,
  }))
  await page.check('It moved through the turn with the boat', () => ({
    ok: turned >= 180 && seen.size >= 3,
    detail: `boat turned ${turned.toFixed(0)}°; shown values while turning: ${[...seen].join(', ')}`,
  }))
}
