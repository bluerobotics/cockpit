import { pickMode, setup, shownMode } from '../lib/prf.mjs'

export { setup }

export const meta = {
  title: 'Switch flight mode from the mode selector',
  route: '/',
  needs: ['vehicle'],
}

const MODES = { MANUAL: 0, HOLD: 4 }

/**
 * Pick Manual and then Hold in the bottom bar's mode selector: the vehicle reports each mode, and the
 * selector shows it.
 */
export default async function run({ page, vehicle }) {
  await page.check('In Hold', async () => ({ ok: (await shownMode(page)) === 'HOLD', detail: await shownMode(page) }))
  for (const [mode, number] of Object.entries(MODES)) {
    await page.caption(`Mode selector → ${mode}`)
    await pickMode(page, mode)
    const confirmed = await vehicle.waitFor('HEARTBEAT', (hb) => hb.custom_mode === number, 8000)
    await page.waitFor(async () => (await shownMode(page)) === mode, { timeout: 5000 }).catch(() => undefined)
    await page.check(`The vehicle reports ${mode} (custom_mode ${number}) and the selector shows it`, async () => ({
      ok: Boolean(confirmed) && (await shownMode(page)) === mode,
      detail: `custom_mode ${(await vehicle.heartbeat())?.custom_mode}, shown ${await shownMode(page)}`,
    }))
  }
}
