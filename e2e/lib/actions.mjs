// Settings → Actions as the ACT cases drive it, and a local server that records the HTTP requests
// an action makes.

import { createServer } from 'node:http'

import { fieldByLabel } from './cockpit.mjs'
import { openMenuPage } from './mavlink-tools.mjs'

// Every custom action the test user has, restored after a case and emptied before it.
export const ACTION_KEYS = [
  'cockpit-http-request-actions',
  'cockpit-mavlink-message-actions',
  'cockpit-javascript-actions',
]
export const NO_ACTIONS = Object.fromEntries(ACTION_KEYS.map((key) => [key, {}]))

/**
 * Listen on a free local port and keep every request that arrives. Preflights are answered so a
 * web Cockpit on another origin can call it, and are kept apart from the real calls.
 * @returns {Promise<{url: string, requests: Array<object>, close: Function}>} Server handle
 */
export async function startEchoServer() {
  const requests = []
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      const url = new URL(req.url, 'http://local')
      if (req.method !== 'OPTIONS')
        requests.push({
          method: req.method,
          path: url.pathname,
          query: Object.fromEntries(url.searchParams),
          headers: req.headers,
          body,
          at: Date.now(),
        })
      res.writeHead(req.method === 'OPTIONS' ? 204 : 200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': '*',
        'Access-Control-Allow-Headers': '*',
        'Content-Type': 'application/json',
      })
      res.end('{"ok":true}')
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  // The run ends when its cases do, not when this server stops listening.
  server.unref()
  return { url: `http://127.0.0.1:${server.address().port}`, requests, close: () => server.close() }
}

const topDialog = `[...document.querySelectorAll('.v-overlay--active')].at(-1)`

const centreOf = (page, expr) =>
  page.eval(`(() => { const el = ${expr}; if (!el) return null; el.scrollIntoView({ block: 'nearest' })
    const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)

/**
 * Click the `nth` button reading `text` in the topmost dialog.
 * @param {object} page - Driver page
 * @param {string} text - Button text, any case
 * @param {object} [options] - Options
 * @param {number} [options.nth] - Which of the buttons with that text
 * @param {number} [options.settle] - ms to wait afterwards
 */
export async function clickDialogButton(page, text, { nth = 0, settle = 1000 } = {}) {
  const wanted = JSON.stringify(text.toUpperCase())
  const at = await centreOf(
    page,
    `[...${topDialog}.querySelectorAll('button')].filter((b) => b.innerText.trim().toUpperCase() === ${wanted})[${nth}]`
  )
  if (!at) throw new Error(`no "${text}" button in the dialog`)
  await page.click(at, { settle })
}

/**
 * Open the select labelled `label` in the topmost dialog and pick `option` from its menu.
 * @param {object} page - Driver page
 * @param {string} label - Field label
 * @param {string} option - Item title
 */
export async function pickFromSelect(page, label, option) {
  await page.click(await fieldByLabel(page, label), { settle: 900 })
  const item = `[...${topDialog}.querySelectorAll('.v-list-item')].find((i) => i.innerText.trim() === ${JSON.stringify(
    option
  )})`
  // Long lists render lazily: scroll the menu until the item exists.
  for (let i = 0; i < 80 && !(await page.eval(`!!${item}`)); i++)
    await page.eval(`(() => { const l = ${topDialog}.querySelector('.v-list'); l.scrollTop += l.clientHeight })()`)
  const at = await centreOf(page, item)
  if (!at) throw new Error(`no option "${option}" under "${label}"`)
  await page.click(at, { settle: 800 })
}

/**
 * Settings → Actions, unless it is already open.
 * @param {object} page - Driver page
 */
export async function openActions(page) {
  // After a reload Cockpit comes back on the page it was showing.
  if (!(await page.exists('text=Cockpit actions configuration'))) await openMenuPage(page, 'Settings', 'Actions')
  // The panel opens collapsed when Cockpit started in a narrow window, as Standalone's does.
  // A collapsed panel clips the table rather than removing it, so look at what is on top of its middle.
  const tableShown = `(() => { const t = document.querySelector('.v-data-table'); if (!t) return false; const r = t.getBoundingClientRect()
    return t.contains(document.elementFromPoint(r.x + r.width / 2, r.y + Math.min(r.height / 2, 40))) })()`
  if (await page.eval(tableShown)) return
  // The panel's own "Actions" title, right of the side menu entry of the same name.
  const title = `[...document.querySelectorAll('*')].find((e) => e.childElementCount === 0 && e.textContent.trim() === 'Actions'
    && e.getClientRects().length && e.getBoundingClientRect().x > 150)`
  await page.click(await centreOf(page, title), { settle: 1000 })
}

/**
 * Names in the actions table, as shown.
 * @param {object} page - Driver page
 * @returns {Promise<string[]>} Names
 */
export const listedActions = (page) =>
  page.eval(`[...document.querySelectorAll('.v-data-table tbody tr')].map((r) => r.querySelector('td p')?.textContent.trim())
    .filter(Boolean)`)

/**
 * Click one of an action's row buttons.
 * @param {object} page - Driver page
 * @param {string} name - Action name
 * @param {'pencil'|'link'|'play'|'export'|'trash-can-outline'} icon - Which button
 * @param {number} [settle] - ms to wait afterwards
 */
export async function clickActionButton(page, name, icon, settle = 1500) {
  const at = await centreOf(
    page,
    `[...document.querySelectorAll('.v-data-table tbody tr')].find((r) => r.querySelector('td p')?.textContent.trim() === ${JSON.stringify(
      name
    )})?.querySelector('.mdi-${icon}')?.closest('button')`
  )
  if (!at) throw new Error(`no ${icon} button for the action "${name}"`)
  await page.click(at, { settle })
}

/**
 * Fill the HTTP action dialog that is open.
 * @param {object} page - Driver page
 * @param {object} action - What to set; fields left out keep what the dialog has
 * @param {string} [action.name] - Action Name
 * @param {string} [action.method] - Request Type
 * @param {string} [action.url] - URL
 * @param {Array<{key: string, fixed?: string, variable?: string}>} [action.params] - URL parameters to add
 * @param {Array<[string, string]>} [action.headers] - Headers to add
 * @param {string} [action.body] - JSON body template
 */
export async function fillHttpAction(page, { name, method, url, params = [], headers = [], body }) {
  if (name !== undefined) await page.fill(await fieldByLabel(page, 'Action Name'), name)
  if (method !== undefined) await pickFromSelect(page, 'Request Type', method)
  if (url !== undefined) await page.fill(await fieldByLabel(page, 'URL'), url)
  for (const param of params) {
    await clickDialogButton(page, 'Add', { nth: 0 })
    await page.fill(await fieldByLabel(page, 'Parameter Key'), param.key)
    if (param.variable) await pickFromSelect(page, 'Parameter Value', param.variable)
    else await page.fill(await fieldByLabel(page, 'Fixed Value'), param.fixed)
    await clickDialogButton(page, 'Save')
  }
  for (const [key, value] of headers) {
    await clickDialogButton(page, 'Add', { nth: 1 })
    await page.fill(await fieldByLabel(page, 'Header Key'), key)
    await page.fill(await fieldByLabel(page, 'Header Value'), value)
    await clickDialogButton(page, 'Save')
  }
  if (body !== undefined) {
    await clickDialogButton(page, 'Edit')
    await page.fill(await fieldByLabel(page, 'JSON Body Template'), body)
    await page.wait(500)
    await clickDialogButton(page, 'Save')
  }
}

/**
 * Settings → Actions → New action → `type`.
 * @param {object} page - Driver page
 * @param {'HTTP Request Action'|'MAVLink Message Action'|'JavaScript Action'} type - Action type
 */
export async function newAction(page, type) {
  await page.click('text=New action', { settle: 1000 })
  await page.click(`text=${type}`, { settle: 1500 })
}
