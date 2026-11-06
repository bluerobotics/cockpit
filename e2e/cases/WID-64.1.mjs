import { exitEditMode } from '../lib/custom-widget.mjs'
import {
  armInManual,
  closeDialog,
  driveStraight,
  hookCanvases,
  lake,
  pickItem,
  placeWidget,
  plotterStats,
  quietStart,
  stopDriving,
  widgetByHash,
} from '../lib/widgets.mjs'

const SPEED = '/mavlink/1/1/VFR_HUD/groundspeed'

export const meta = {
  title: 'Plotter plots a linked variable and its statistics update',
  route: '/',
  needs: ['vehicle'],
}

export const setup = async (ctx) => {
  await quietStart(ctx)
  await hookCanvases(ctx.page)
}

/**
 * Plot VFR_HUD groundspeed, drive for 10 s and stop: the statistics move with it and Current is the
 * speed Cockpit has.
 */
export default async function run({ page, vehicle }) {
  await page.caption('Edit interface: add a Plotter and open its cog')
  const widget = await placeWidget(page, 'Plotter', { configure: true })
  await page.caption('Data Lake variable: VFR_HUD groundspeed')
  await pickItem(page, 'Data Lake variable', { prefix: 'VFR_HUD/groundspeed (MAVLink' }, 'groundspeed')
  await page.check('The Plotter is linked to VFR_HUD/groundspeed, Current/Min/Max/Avg on', async () => {
    const { options } = await widgetByHash(page, widget.hash)
    const on = ['showCurrent', 'showMin', 'showMax', 'showAvg'].every((k) => options[k])
    return { ok: options.dataLakeVariableId === SPEED && on, detail: `${options.dataLakeVariableId}, stats on ${on}` }
  })
  await closeDialog(page)
  await exitEditMode(page)

  const idle = await plotterStats(page, widget.hash)
  await page.caption('Arm in Manual, drive for 10 s, stop')
  await armInManual(vehicle)
  let peak = 0
  const end = Date.now() + 10000
  while (Date.now() < end) {
    await driveStraight(vehicle, 1000)
    peak = Math.max(peak, Number(await lake(page, SPEED)) || 0)
  }
  const driving = await plotterStats(page, widget.hash)
  await stopDriving(vehicle)
  await page.wait(4000)
  const stats = await plotterStats(page, widget.hash)
  const current = Number(await lake(page, SPEED))
  await page.check('Max rose to the peak speed; Min ≤ Avg ≤ Max', () => ({
    ok:
      stats.Max >= peak - 0.01 &&
      peak > 0.5 &&
      stats.Min <= stats.Avg &&
      stats.Avg <= stats.Max &&
      driving.Max > (idle.Max ?? 0),
    detail: `idle max ${idle.Max}; peak ${peak.toFixed(2)} m/s; now ${JSON.stringify(stats)}`,
  }))
  await page.check('Current is the latest groundspeed (2 decimals)', () => ({
    ok: Math.abs(stats.Current - current) <= 0.011,
    detail: `Current ${stats.Current}, data lake ${current.toFixed(3)}`,
  }))
}
