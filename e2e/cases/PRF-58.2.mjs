import { closeMenu, openMenuPage } from '../lib/mavlink-tools.mjs'
import { freshUsername, setup as quiet, startNewUserFromDefaults, switchUser } from '../lib/prf.mjs'
import { chooseUnitSystem, UNITS_KEY } from '../lib/units.mjs'

/**
 * Cockpit runs as relusera, which exists before the case with settings of its own.
 */
export const setup = async (ctx) => {
  await quiet(ctx)
  await switchUser(ctx.page, 'relusera')
  await closeMenu(ctx.page)
}

export const meta = {
  title: 'The display units follow the user',
  route: '/',
  needs: ['vehicle'],
}

const inUse = (page) => page.eval(`window.cockpit.getDataLakeVariableData('UNITS/displayPreference')`)

/**
 * As relusera pick imperial units; switch to a new user, started from the defaults, then back: imperial for
 * relusera only, both in the app and in each user's settings on the vehicle.
 */
export default async function run({ page, vehicle }) {
  await page.check('Running as relusera', async () => ({
    ok: (await page.store('mission', 's.username')) === 'relusera',
  }))
  await page.caption('Settings → Interface → Display units: imperial')
  await chooseUnitSystem(page, 'imperial')
  const asA = await inUse(page)
  await page.check('As relusera the units are imperial', () => ({ ok: asA === 'imperial', detail: asA }))
  await closeMenu(page)
  await page.wait(4000)

  const userB = freshUsername()
  await page.caption(`Manage users: add ${userB} and start it from Cockpit's defaults`)
  await switchUser(page, userB)
  const asked = await startNewUserFromDefaults(page)
  await page.check("Cockpit asks whether to copy relusera's settings or start from the defaults", () => ({ ok: asked }))
  await openMenuPage(page, 'settings-interface')
  const asB = await inUse(page)
  await page.check("As the new user they are not relusera's imperial", () => ({ ok: asB !== 'imperial', detail: asB }))
  await closeMenu(page)

  await page.caption('Manage users: back to relusera')
  await switchUser(page, 'relusera')
  await openMenuPage(page, 'settings-interface')
  const again = await inUse(page)
  await page.check('Back as relusera they are imperial again', () => ({ ok: again === 'imperial', detail: again }))
  const [a, b] = [
    await vehicle.getSyncedSetting('relusera', UNITS_KEY),
    await vehicle.getSyncedSetting(userB, UNITS_KEY),
  ]
  await page.check('The stored unit preference differs between the two users', () => ({
    ok: JSON.stringify(a) !== JSON.stringify(b),
    detail: `relusera ${JSON.stringify(a)} · ${userB} ${JSON.stringify(b)}`,
  }))
}
