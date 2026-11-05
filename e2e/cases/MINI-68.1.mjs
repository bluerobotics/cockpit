import { enterEditMode, exitEditMode } from '../lib/custom-widget.mjs'
import { sleep } from '../lib/driver.mjs'
import {
  addMiniWidget,
  closeDialog,
  MINI_PROFILE_KEY,
  miniWidgetEl,
  miniWidgetsOfType,
  quietStart,
} from '../lib/widgets.mjs'

export const meta = {
  title: 'Battery indicator shows the vehicle voltage',
  route: '/',
  needs: ['vehicle'],
  restore: [MINI_PROFILE_KEY],
}

// The SITL boat starts with no battery monitor, so SYS_STATUS reads 0 V. A simulated analog monitor is
// turned on once (it takes a reboot) and left on: it changes nothing the other cases rely on.
export const beforeLaunch = async ({ vehicle }) => {
  if ((await vehicle.readParam('BATT_MONITOR')) === 4) return
  await vehicle.setParam('BATT_MONITOR', 4)
  await vehicle.command('MAV_CMD_PREFLIGHT_REBOOT_SHUTDOWN', [1])
  await sleep(5000)
  const powered = async () => {
    const s = await vehicle.read('SYS_STATUS')
    return s?.ageMs < 2000 && s.voltage_battery > 0 && Boolean((await vehicle.position())?.lat)
  }
  const deadline = Date.now() + 120000
  while (!(await powered().catch(() => false))) {
    if (Date.now() > deadline) throw new Error('the boat did not come back with a battery voltage')
    await sleep(2000)
  }
}

export const setup = quietStart

const shown = (page, hash) =>
  page.eval(`[...(${miniWidgetEl(hash)}?.querySelectorAll('.font-mono') ?? [])].map((s) => s.textContent.trim())`)

/**
 * With a Battery Indicator in the top bar (dragged in if absent), its voltage is SYS_STATUS's and it
 * follows the simulator's battery voltage when that changes.
 */
export default async function run({ page, vehicle }) {
  let hash = (await miniWidgetsOfType(page, 'BatteryIndicator'))[0]?.hash
  if (!hash) {
    await page.caption('Edit interface → Mini: drag a Battery Indicator into the top bar')
    await enterEditMode(page)
    hash = await addMiniWidget(page, 'Battery Indicator', 'top', 2)
    // It opens its configuration when dropped.
    await closeDialog(page)
    await exitEditMode(page)
  } else {
    await page.caption('The Battery Indicator is already in the top bar')
    await page.hover(await page.box(`[data-widget-hash="${hash}"]`), 1500)
  }
  const sysVolts = async () => (await vehicle.read('SYS_STATUS'))?.voltage_battery / 1000
  await page.wait(1000)
  const [values, volts] = await Promise.all([shown(page, hash), sysVolts()])
  await page.check('Voltage = SYS_STATUS voltage_battery within 0.1 V; current shown', () => ({
    ok: Math.abs(Number(values[0]) - volts) <= 0.1 && values.length >= 2 && values[1] !== '' && values[1] !== '--',
    detail: `shows ${values.join(' / ')}; SYS_STATUS ${volts.toFixed(2)} V`,
  }))

  const original = await vehicle.readParam('SIM_BATT_VOLTAGE')
  const target = 11.1
  try {
    await page.caption(`Simulator battery to ${target} V (SIM_BATT_VOLTAGE)`)
    await vehicle.setParam('SIM_BATT_VOLTAGE', target)
    const moved = await page
      .waitFor(async () => Math.abs(Number((await shown(page, hash))[0]) - target) <= 0.15, { timeout: 20000 })
      .catch(() => false)
    const [after, voltsAfter] = await Promise.all([shown(page, hash), sysVolts()])
    await page.check('The shown voltage follows the change', () => ({
      ok: moved && Math.abs(Number(after[0]) - voltsAfter) <= 0.1,
      detail: `shows ${after[0]} V; SYS_STATUS ${voltsAfter.toFixed(2)} V (was ${original} V)`,
    }))
  } finally {
    if (original !== undefined) await vehicle.setParam('SIM_BATT_VOLTAGE', original)
  }
}
