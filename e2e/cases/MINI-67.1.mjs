import { exitEditMode } from '../lib/custom-widget.mjs'
import {
  addVgi,
  armInManual,
  dialogButton,
  driveStraight,
  findMiniWidget,
  lake,
  quietStart,
  stopDriving,
  vgiShown,
} from '../lib/widgets.mjs'

const SPEED = '/mavlink/1/1/VFR_HUD/groundspeed'

export const meta = {
  title: 'A VGI from the Speed preset shows the vehicle speed',
  route: '/',
  needs: ['vehicle'],
}

export const setup = quietStart

/**
 * Drop a Very Generic Indicator in the bottom bar, apply the Speed preset, and drive: it shows the
 * groundspeed Cockpit has, as it changes.
 */
export default async function run({ page, vehicle }) {
  await page.caption('Edit interface → Mini: a Very Generic Indicator in the bottom bar, preset "Speed"')
  const hash = await addVgi(page, 'Speed')
  await dialogButton(page, 'Done')
  await exitEditMode(page)
  await page.check('It is labelled "Speed" and reads VFR_HUD groundspeed', async () => {
    const { widget } = await findMiniWidget(page, hash)
    const shown = await vgiShown(page, hash)
    return {
      ok: shown?.label === 'Speed' && /VFR_HUD\/groundspeed$/.test(widget.options.variableName),
      detail: `label "${shown?.label}", variable ${widget.options.variableName}`,
    }
  })

  await page.caption('Arm in Manual and drive')
  await armInManual(vehicle)
  const samples = []
  for (let i = 0; i < 8; i++) {
    await driveStraight(vehicle, 1000)
    const [shown, speed] = await Promise.all([vgiShown(page, hash), lake(page, SPEED)])
    samples.push({ shown: Number(shown?.value), speed: Number(speed), unit: shown?.unit })
  }
  await stopDriving(vehicle)
  const off = samples.filter((s) => Math.abs(s.shown - s.speed) > 0.15)
  const values = new Set(samples.map((s) => s.shown))
  await page.check('While driving it shows the groundspeed (1 decimal), changing', () => ({
    ok: off.length <= 1 && values.size >= 3 && Math.max(...samples.map((s) => s.shown)) > 0.5,
    detail: samples.map((s) => `${s.shown}${s.unit}/${s.speed.toFixed(2)}`).join(' '),
  }))
}
