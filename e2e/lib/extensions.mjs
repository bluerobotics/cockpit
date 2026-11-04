// BlueOS extension features (widgets, actions, joystick suggestions) as the cases see them.

import { Buffer } from 'node:buffer'

/**
 * Let the test browser read extensions through the vehicle's /extensionv2 proxy.
 *
 * The proxy adds its own Access-Control-Allow-Origin on top of the extension's, and a browser
 * rejects a response carrying two. A Cockpit served by the vehicle is same-origin and the Standalone
 * app does not enforce it, but the test browser loads Cockpit from localhost, so the pair is
 * collapsed into one in transit. Nothing else about the response changes, unless `editExtras` is
 * given, which rewrites the cockpit_extras.json payloads.
 * @param {object} page - Driver page
 * @param {object} [options] - Options
 * @param {Function} [options.editExtras] - (extras, url) => extras, for cockpit_extras.json responses
 */
export async function passExtensionCors(page, { editExtras } = {}) {
  page.on('Fetch.requestPaused', async ({ requestId, request, responseStatusCode, responseHeaders = [] }) => {
    const seen = new Set()
    const headers = responseHeaders.filter(({ name }) => {
      const key = name.toLowerCase()
      if (!key.startsWith('access-control-')) return true
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    const extras = editExtras && request.url.endsWith('/cockpit_extras.json')
    if (headers.length === responseHeaders.length && !extras) {
      await page.send('Fetch.continueResponse', { requestId }).catch(() => undefined)
      return
    }
    let { body, base64Encoded } = await page.send('Fetch.getResponseBody', { requestId })
    if (extras) {
      const text = base64Encoded ? Buffer.from(body, 'base64').toString() : body
      body = Buffer.from(JSON.stringify(editExtras(JSON.parse(text), request.url))).toString('base64')
      base64Encoded = true
    }
    if (!base64Encoded) body = Buffer.from(body).toString('base64')
    // getResponseBody hands back the decoded body, so the length and encoding headers no longer apply.
    const kept = headers.filter(({ name }) => !['content-length', 'content-encoding'].includes(name.toLowerCase()))
    await page.send('Fetch.fulfillRequest', {
      requestId,
      responseCode: responseStatusCode,
      responseHeaders: kept,
      body,
    })
  })
  // Only script requests: a document served from DevTools loses its local-network standing, and
  // Chrome then blocks the extension page's own assets inside an iframe.
  const patterns = ['Fetch', 'XHR', 'Other'].map((resourceType) => ({
    urlPattern: '*/extensionv2/*',
    resourceType,
    requestStage: 'Response',
  }))
  await page.send('Fetch.enable', { patterns })
}

/**
 * Record the requests whose URL contains `fragment`, with their response status.
 * @param {object} page - Driver page
 * @param {string} fragment - Part of the URL to watch
 * @returns {Promise<Array<{method: string, url: string, status?: number, body?: string}>>} Live list
 */
export async function watchRequests(page, fragment) {
  const seen = []
  const byId = new Map()
  page.on('Network.requestWillBeSent', ({ requestId, request }) => {
    if (!request.url.includes(fragment)) return
    const entry = { method: request.method, url: request.url, body: request.postData }
    byId.set(requestId, entry)
    seen.push(entry)
  })
  page.on('Network.responseReceived', ({ requestId, response }) => {
    const entry = byId.get(requestId)
    if (entry) entry.status = response.status
  })
  page.on('Network.loadingFailed', ({ requestId, errorText, blockedReason, corsErrorStatus }) => {
    const entry = byId.get(requestId)
    if (entry) entry.error = blockedReason ?? corsErrorStatus?.corsError ?? errorText
  })
  await page.send('Network.enable')
  return seen
}

/** The test vehicle's only extension with Cockpit extras: 4K Cam Manager. */
export const EXTENSION = '4kcammanager'
export const ACTION_NAME = '4K Cam One-Push White Balance (All)'
export const ACTION_URL_PART = `/extensionv2/${EXTENSION}/v1/camera/control`

// Every extension feature undecided again, and none of them registered, at the start of a case.
export const UNDECIDED = {
  'cockpit-handled-actions': { applied: [], ignored: [] },
  'cockpit-handled-joystick-suggestions-v2': { applied: [], ignored: [] },
  'cockpit-http-request-actions': {},
}

export const DIALOG_TITLE = 'text=BlueOS Extension Features'
export const featuresDialogOpen = (page) => page.exists(DIALOG_TITLE)

/**
 * Restart Cockpit with the extensions readable, the way an operator reopens it.
 * @param {object} page - Driver page
 * @param {object} [options] - Options for passExtensionCors, applied once per page
 * @returns {Promise<void>}
 */
export async function restartCockpit(page, options) {
  if (!page.extensionsPassed) {
    await passExtensionCors(page, options)
    page.extensionsPassed = true
  }
  await page.reload()
  await page.waitFor(() => page.eval(`!!document.querySelector('#app')?.__vue_app__`), { label: 'Cockpit to mount' })
}

/**
 * Wait up to `timeout` for the features dialog to open by itself.
 * @param {object} page - Driver page
 * @param {number} [timeout] - ms
 * @returns {Promise<boolean>} Whether it opened
 */
export async function dialogOpensWithin(page, timeout = 20000) {
  return page.waitFor(() => featuresDialogOpen(page), { label: 'the features dialog', timeout }).catch(() => false)
}

// The features dialog's own close X (the Ignore buttons carry mdi-close icons too).
export const DIALOG_CLOSE = '.features-modal > .fixed button'

/**
 * Plug in a virtual standard gamepad. Cockpit polls navigator.getGamepads(), so a stand-in that
 * returns this pad is all it sees; `pressButton` holds a button down for a moment.
 * @param {object} page - Driver page
 */
export async function plugVirtualGamepad(page) {
  await page.eval(`(() => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }))
    window.__pad = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)', index: 0,
      connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons, timestamp: performance.now(), vibrationActuator: null }
    navigator.getGamepads = () => [window.__pad, null, null, null]
    window.dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad: window.__pad }))
  })()`)
}

/**
 * Press and release a button of the virtual gamepad.
 * @param {object} page - Driver page
 * @param {number} button - Standard-mapping button index
 * @param {number} [holdMs] - How long it stays down
 */
export async function pressButton(page, button, holdMs = 400) {
  const set = (down) =>
    page.eval(`(() => { const b = window.__pad.buttons[${button}]; b.pressed = ${down}; b.value = ${down ? 1 : 0}
      window.__pad.timestamp = performance.now() })()`)
  await set(true)
  await page.wait(holdMs)
  await set(false)
}

/**
 * Close the features dialog if it comes up within `within`, leaving its items undecided.
 * @param {object} page - Driver page
 * @param {number} [within] - How long to wait for it, in ms
 */
export async function dismissFeaturesDialog(page, within = 15000) {
  if (!(await dialogOpensWithin(page, within))) return
  await page.click(DIALOG_CLOSE, { settle: 800 })
  if (await page.exists('text=Close anyway')) await page.click('text=Close anyway', { settle: 800 })
}

/**
 * Ignore every pending feature in the open features dialog, then close it. Stored as ignored in the
 * test user's synced settings, so the dialog stops opening at start until a case resets them
 * (`UNDECIDED`).
 * @param {object} page - Driver page
 * @returns {Promise<void>}
 */
export async function ignoreAllFeatures(page) {
  await page.click('text=Actions', { settle: 400 })
  for (let i = 0; i < 30 && (await page.exists('text=Ignore')); i++) await page.click('text=Ignore', { settle: 400 })
  await page.click('text=Joystick Mappings', { settle: 400 })
  for (let i = 0; i < 10 && (await page.exists('text=Ignore remaining suggestions')); i++) {
    await page.click('text=Ignore remaining suggestions', { settle: 400 })
  }
  if (await featuresDialogOpen(page)) await page.click(DIALOG_CLOSE, { settle: 800 })
  if (await page.exists('text=Close anyway')) await page.click('text=Close anyway', { settle: 800 })
}
