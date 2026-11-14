import { setUpActions } from '../lib/act-case.mjs'
import { createCommandAction, reloadCockpit } from '../lib/act-dl.mjs'
import { clickActionButton, listedActions, NO_ACTIONS, openActions } from '../lib/actions.mjs'
import { fieldByLabel } from '../lib/cockpit.mjs'

export const meta = {
  title: 'An edited MAVLink action keeps its new field after a restart',
  route: '/',
  needs: ['vehicle'],
  synced: NO_ACTIONS,
}

const NAME = 'Disarm (release)'

export const setup = async (ctx) => {
  await setUpActions(ctx, false)
  await createCommandAction(ctx.page, 'Arm (release)')
  await createCommandAction(ctx.page, NAME, { Arm: 0 })
}

/**
 * Edit "Disarm (release)" to Arm = 1, restart Cockpit, play it while disarmed: the
 * vehicle arms, so the stored action carries the edit.
 */
export default async function run({ page, vehicle, user }) {
  await page.caption(`Edit "${NAME}": Arm = 1, Save`)
  await clickActionButton(page, NAME, 'pencil')
  await page.fill(await fieldByLabel(page, 'Arm'), 1)
  await page.click('text=Save', { settle: 1500 })

  await page.caption('Restart Cockpit')
  await reloadCockpit(page)
  await openActions(page)
  await page.waitFor(async () => (await listedActions(page)).includes(NAME), { timeout: 20000 }).catch(() => undefined)
  await page.check('Both actions are back after the restart', async () => {
    const names = await listedActions(page)
    return { ok: names.includes(NAME) && names.includes('Arm (release)'), detail: names.join(', ') }
  })
  await page.check('The synced action carries Arm = 1', async () => {
    const stored = Object.values((await vehicle.getSyncedSetting(user, 'cockpit-mavlink-message-actions')) ?? {})
    const param1 = stored.find((a) => a.name === NAME)?.messageConfig?.param1?.value
    return { ok: String(param1) === '1', detail: `param1 ${JSON.stringify(param1)}` }
  })

  await page.caption(`Play "${NAME}" while disarmed`)
  const before = await vehicle.isArmed()
  await clickActionButton(page, NAME, 'play')
  await page.check('The vehicle arms', async () => {
    await page.waitFor(() => vehicle.isArmed(), { timeout: 8000 }).catch(() => undefined)
    return {
      ok: !before && (await vehicle.isArmed()),
      detail: `armed before ${before}, after ${await vehicle.isArmed()}`,
    }
  })
}
