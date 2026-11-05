import { exitEditMode } from '../lib/custom-widget.mjs'
import { closeMenu } from '../lib/mavlink-tools.mjs'
import {
  addViewNamed,
  freshUsername,
  setup as quiet,
  startNewUserFromDefaults,
  switchUser,
  viewState,
} from '../lib/prf.mjs'

/**
 * Cockpit runs as relusera, which exists before the case with settings of its own.
 */
export const setup = async (ctx) => {
  await quiet(ctx)
  await switchUser(ctx.page, 'relusera')
  await closeMenu(ctx.page)
}

export const meta = {
  title: "Switching user loads that user's views",
  route: '/',
  needs: ['vehicle'],
}

const VIEW = 'User A view'
const VIEWS_KEY = 'cockpit-views-group-v1'

/**
 * As relusera, add a view "User A view"; switch to a new user, started from the defaults, and back. The view
 * is listed only as relusera, and the vehicle keeps it only in relusera's settings.
 */
export default async function run({ page, vehicle }) {
  await page.check('Running as relusera', async () => ({
    ok: (await page.store('mission', 's.username')) === 'relusera',
  }))
  await page.caption(`Edit interface: add a view named "${VIEW}"`)
  await addViewNamed(page, VIEW)
  await exitEditMode(page)
  const asA = await viewState(page)
  await page.check(`As relusera, "${VIEW}" is in the list`, () => ({
    ok: asA.names.includes(VIEW),
    detail: asA.names.join(', '),
  }))
  await page.wait(4000)

  const userB = freshUsername()
  await page.caption(`Manage users: add ${userB} and start it from Cockpit's defaults`)
  await switchUser(page, userB)
  const asked = await startNewUserFromDefaults(page)
  await page.check("Cockpit asks whether to copy relusera's settings or start from the defaults", () => ({ ok: asked }))
  await closeMenu(page)
  const asB = await viewState(page)
  await page.check(`As the new user, "${VIEW}" is not in the list`, () => ({
    ok: !asB.names.includes(VIEW),
    detail: asB.names.join(', '),
  }))

  await page.caption('Manage users: back to relusera')
  await switchUser(page, 'relusera')
  await closeMenu(page)
  const again = await viewState(page)
  await page.check(`Back as relusera, "${VIEW}" is there again`, () => ({
    ok: again.names.includes(VIEW),
    detail: again.names.join(', '),
  }))
  const stored = async (user) => ((await vehicle.getSyncedSetting(user, VIEWS_KEY))?.views ?? []).map((v) => v.name)
  const [a, b] = [await stored('relusera'), await stored(userB)]
  await page.check("On the vehicle, only relusera's views hold it", () => ({
    ok: a.includes(VIEW) && !b.includes(VIEW),
    detail: `relusera: ${a.join(', ') || 'none'} · ${userB}: ${b.join(', ') || 'none'}`,
  }))
}
