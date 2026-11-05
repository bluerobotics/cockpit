import { ACTION_KEYS, fillHttpAction, newAction, NO_ACTIONS, openActions, startEchoServer } from '../lib/actions.mjs'
import { pressButton } from '../lib/extensions.mjs'
import { buttonAction, JOY_META, joystickSetup, mapButton, openJoystickPage, settles } from '../lib/joystick.mjs'
import { closeMenu } from '../lib/mavlink-tools.mjs'

export const meta = {
  ...JOY_META,
  title: 'A button mapped to a custom action runs it',
  synced: { ...JOY_META.synced, ...NO_ACTIONS },
  restore: [...JOY_META.restore, ...ACTION_KEYS],
}

const NAME = 'Joystick request'

export const setup = async (ctx) => {
  await joystickSetup(ctx)
  ctx.echo = await startEchoServer()
}

/**
 * Create an HTTP action calling a local server, map button 5 to it, leave the page and press it once.
 */
export default async function run({ page, echo }) {
  await page.caption('Settings → Actions → New action: an HTTP request to a local server')
  await openActions(page)
  await newAction(page, 'HTTP Request Action')
  await fillHttpAction(page, { name: NAME, method: 'GET', url: `${echo.url}/joystick` })
  await page.click('text=Create', { settle: 1500 })

  await page.caption(`Settings → Joystick → Table: button 5 → "${NAME}"`)
  await openJoystickPage(page)
  await mapButton(page, 5, NAME)
  await page.check('Button 5 is mapped to the HTTP action', async () => {
    const action = await buttonAction(page, 5)
    return { ok: action?.name === NAME && action?.protocol === 'cockpit-action', detail: JSON.stringify(action) }
  })

  await page.caption('Leave the page and press button 5 once')
  await closeMenu(page)
  await page.wait(1000)
  await pressButton(page, 5)
  await settles(page, () => echo.requests.length > 0, 8000)
  await page.wait(2000)
  await page.check('The server got exactly one request', () => ({
    ok: echo.requests.length === 1 && echo.requests[0].path === '/joystick',
    detail: echo.requests.map((r) => `${r.method} ${r.path}`).join(', ') || 'no request',
  }))
}
