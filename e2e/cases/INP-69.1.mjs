import { fillHttpAction, newAction, NO_ACTIONS, openActions, startEchoServer } from '../lib/actions.mjs'
import { addActionButton, enterEditMode, exitEditMode } from '../lib/custom-widget.mjs'
import { addInputContainer, INPUT_SYNCED, placed, quietStart } from '../lib/inputs.mjs'
import { closeMenu } from '../lib/mavlink-tools.mjs'

export const meta = {
  title: 'A widget button runs an HTTP action',
  route: '/',
  needs: ['vehicle'],
  synced: { ...NO_ACTIONS, ...INPUT_SYNCED },
}

const NAME = 'Release button request'

export const setup = async (ctx) => {
  const { page } = ctx
  await quietStart(ctx)
  ctx.echo = await startEchoServer()
  await openActions(page)
  await newAction(page, 'HTTP Request Action')
  await fillHttpAction(page, { name: NAME, method: 'GET', url: `${ctx.echo.url}/release/button` })
  await page.click('text=Create', { settle: 1500 })
  await closeMenu(page)
}

/**
 * Add a container with a button bound to the HTTP action, press it once, and count what the server got.
 */
export default async function run({ page, echo }) {
  await page.caption('Edit interface → Input → Add new container')
  await enterEditMode(page)
  const rows = await addInputContainer(page)
  await page.caption(`Drag a Button in and set its action to "${NAME}"`)
  await addActionButton(page, rows[0], 'Request', NAME)
  await page.check('The button is bound to the HTTP action', async () => {
    const button = await placed(page, 'Button')
    return {
      ok: button?.options.cockpitAction?.name === NAME,
      detail: button?.options.cockpitAction?.name ?? 'no button',
    }
  })
  await exitEditMode(page)

  await page.caption('Press it once')
  await page.click('text=Request', { settle: 500 })
  await page.waitFor(() => echo.requests.length > 0, { timeout: 8000, label: 'the request' }).catch(() => undefined)
  await page.wait(1500)
  await page.check('The server got exactly one GET /release/button', () => ({
    ok: echo.requests.length === 1 && echo.requests[0].method === 'GET' && echo.requests[0].path === '/release/button',
    detail: echo.requests.map((r) => `${r.method} ${r.path}`).join(', ') || 'nothing',
  }))
}
