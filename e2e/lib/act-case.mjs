// What the ACT-41 cases share: an echo server standing in for the device an HTTP action calls, the
// action they create through the UI, and how a request it made is shown and checked.

import { clickActionButton, fillHttpAction, newAction, openActions, startEchoServer } from './actions.mjs'
import { dismissTutorial } from './cockpit.mjs'
import { dismissFeaturesDialog } from './extensions.mjs'

export const NAME = 'Release test request'

/**
 * The action every ACT-41 case starts from: a PUT with a placeholder in the path, a fixed and a
 * data-lake URL parameter, a header from the data lake and a JSON body mixing both.
 * @param {string} echo - Echo server base URL
 * @returns {object} Fields for fillHttpAction
 */
export const httpAction = (echo) => ({
  name: NAME,
  method: 'PUT',
  url: `${echo}/release/{{ vehicle-address }}?source=cockpit`,
  params: [
    { key: 'fixed', fixed: 'yes' },
    { key: 'sysid', variable: 'autopilotSystemId' },
  ],
  headers: [['X-Release-Mode', '{{ /mavlink/1/1/HEARTBEAT/custom_mode }}']],
  body: '{"groundspeed": "{{ /mavlink/1/1/VFR_HUD/groundspeed }}", "vehicle": "{{ vehicle-address }}", "note": "release test"}',
})

/**
 * Start the echo server, open Settings → Actions, and optionally create the action there.
 * @param {object} ctx - Case context from the runner; gets `echo`
 * @param {boolean} create - Whether to create the action too
 */
export async function setUpActions(ctx, create) {
  const { page } = ctx
  await dismissFeaturesDialog(page)
  await dismissTutorial(page, 3000)
  ctx.echo = await startEchoServer()
  await openActions(page)
  if (!create) return
  await newAction(page, 'HTTP Request Action')
  await fillHttpAction(page, httpAction(ctx.echo.url))
  await page.click('text=Create', { settle: 1500 })
}

/**
 * Press an action's play button and wait for the echo server to get the call.
 * @param {object} page - Driver page
 * @param {object} echo - Echo server
 * @param {string} name - Action name
 * @returns {Promise<object|undefined>} The request, if one came
 */
export async function runAndCatch(page, echo, name = NAME) {
  const before = echo.requests.length
  await clickActionButton(page, name, 'play', 500)
  await page
    .waitFor(() => echo.requests.length > before, { timeout: 8000, label: 'the request' })
    .catch(() => undefined)
  return echo.requests[before]
}

const escape = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

/**
 * Show the request the echo server received, full screen for a moment.
 * @param {object} page - Driver page
 * @param {object} request - Recorded request
 */
export async function showRequest(page, request) {
  const query = new URLSearchParams(request.query).toString()
  const lines = [
    `${request.method} ${request.path}${query ? `?${query}` : ''}`,
    `X-Release-Mode: ${request.headers['x-release-mode'] ?? '(none)'}`,
    `Content-Type: ${request.headers['content-type'] ?? '(none)'}`,
    '',
    request.body || '(no body)',
  ]
  await page.card(
    `<div style="font-family:Menlo,monospace;color:#e2e8f0;font-size:20px;max-width:80vw;white-space:pre-wrap;text-align:left">
      <div style="font-family:-apple-system,sans-serif;font-size:24px;opacity:.7;margin-bottom:16px">What the server received</div>${lines
        .map(escape)
        .join('\n')}</div>`,
    4500
  )
}
