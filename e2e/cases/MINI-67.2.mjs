import { fieldByLabel } from '../lib/cockpit.mjs'
import { exitEditMode } from '../lib/custom-widget.mjs'
import {
  addVgi,
  armInManual,
  centreOf,
  dialogButton,
  driveStraight,
  findMiniWidget,
  lake,
  quietStart,
  stopDriving,
  vgiShown,
} from '../lib/widgets.mjs'

const SPEED = '/mavlink/1/1/VFR_HUD/groundspeed'
const ICON = 'mdi-anchor'

export const meta = {
  title: 'VGI custom settings change what it shows',
  route: '/',
  needs: ['vehicle'],
}

/**
 * The MINI-67.1 VGI: Speed preset, built through the UI, config left open.
 */
export const setup = async (ctx) => {
  await quietStart(ctx)
  ctx.hash = await addVgi(ctx.page, 'Speed')
}

/**
 * On the Speed VGI's Custom tab set a name, a ×2 multiplier, two decimals, a unit and another icon:
 * it shows twice the groundspeed with two decimals under the new name, unit and icon.
 */
export default async function run({ page, vehicle, hash }) {
  const before = await vgiShown(page, hash)
  await page.caption('Custom: "Spd x2", own unit off, unit kt, ×2, two decimals, an anchor icon')
  await page.click('text=Custom', { settle: 800 })
  await page.fill(await fieldByLabel(page, 'Display name'), 'Spd x2')
  await page.click("text=Use the variable's own unit", { settle: 600 })
  await page.fill(await fieldByLabel(page, 'Unit'), 'kt')
  await page.fill(await fieldByLabel(page, 'Multiplier'), '2')
  await page.fill(await fieldByLabel(page, 'Decimal places'), '2')
  await page.click(await fieldByLabel(page, 'Icon'), { settle: 800 })
  await page.fill('.v-overlay--active input[placeholder="Search icons..."]', 'anchor')
  await page.wait(600)
  const icon = await centreOf(page, `document.querySelector('.v-overlay--active .icon-symbol.${ICON}')`)
  if (!icon) throw new Error(`no ${ICON} in the icon grid`)
  await page.click(icon, { settle: 800 })
  await dialogButton(page, 'Done')
  await exitEditMode(page)

  const after = await vgiShown(page, hash)
  await page.check('Label, unit and icon changed', () => ({
    ok: after.label === 'Spd x2' && after.unit === 'kt' && after.icon === ICON && before.icon !== ICON,
    detail: `${JSON.stringify(before)} → ${JSON.stringify(after)}`,
  }))
  await page.check('Options saved', async () => {
    const { options } = (await findMiniWidget(page, hash)).widget
    return {
      ok:
        options.displayName === 'Spd x2' &&
        options.variableUnit === 'kt' &&
        Number(options.variableMultiplier) === 2 &&
        Number(options.decimalPlaces) === 2 &&
        options.iconName === ICON &&
        options.useVariableUnit === false,
      detail: JSON.stringify(options),
    }
  })

  await page.caption('Drive, to see twice the speed')
  await armInManual(vehicle)
  const samples = []
  for (let i = 0; i < 6; i++) {
    await driveStraight(vehicle, 1000)
    const [shown, speed] = await Promise.all([vgiShown(page, hash), lake(page, SPEED)])
    samples.push({ value: shown.value, speed: Number(speed) })
  }
  await stopDriving(vehicle)
  await page.check('It shows groundspeed × 2 with two decimals', () => ({
    ok:
      samples.every((s) => /^-?\d+\.\d{2}$/.test(s.value)) &&
      samples.filter((s) => Math.abs(Number(s.value) - 2 * s.speed) > 0.3).length <= 1 &&
      samples.some((s) => Number(s.value) > 1),
    detail: samples.map((s) => `${s.value}/${(2 * s.speed).toFixed(2)}`).join(' '),
  }))
}
