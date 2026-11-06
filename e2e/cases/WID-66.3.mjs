import { exitEditMode } from '../lib/custom-widget.mjs'
import { armInManual, circleFor, diyElement, lake, placeWidget, quietStart, writeDiy } from '../lib/widgets.mjs'

const HEADING = '/mavlink/1/1/VFR_HUD/heading'

export const meta = {
  title: 'DIY widget reads a data-lake variable',
  route: '/',
  needs: ['vehicle'],
}

export const setup = quietStart

/**
 * A DIY widget whose script writes the VFR_HUD heading into it every 500 ms: drive a turn and the
 * number follows, ending on the autopilot's heading.
 */
export default async function run({ page, vehicle }) {
  await page.caption('Edit interface: a DIY widget that shows the heading')
  const widget = await placeWidget(page, 'Do It Yourself', { configure: true })
  await writeDiy(page, {
    html: '<div id="r">-</div>',
    js: `setInterval(() => document.getElementById('r').textContent = cockpit.getDataLakeVariableData('${HEADING}'), 500)`,
  })
  await exitEditMode(page)
  await page.wait(1500)
  const start = (await diyElement(page, widget.hash, 'r'))?.text
  await page.caption('Arm in Manual and drive in circles')
  await armInManual(vehicle)
  const seen = new Set()
  await circleFor(vehicle, 6000, async () => seen.add((await diyElement(page, widget.hash, 'r'))?.text))
  await page.wait(2000)
  const shown = (await diyElement(page, widget.hash, 'r'))?.text
  await page.check('The number changed while turning', () => ({
    ok: seen.size >= 5 && /^\d+$/.test(start ?? ''),
    detail: `started at ${start}, ${seen.size} distinct values`,
  }))
  const [cockpitHeading, hud] = await Promise.all([lake(page, HEADING), vehicle.read('VFR_HUD')])
  await page.check('Stopped: it shows the VFR_HUD heading', () => ({
    ok: Number(shown) === cockpitHeading && Math.abs(Number(shown) - hud.heading) <= 1,
    detail: `shows ${shown}; Cockpit ${cockpitHeading}, vehicle ${hud?.heading}`,
  }))
}
