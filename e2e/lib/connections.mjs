// Pointing Cockpit Standalone's main vehicle connection at a TCP, UDP or serial endpoint.

import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { sleep } from './driver.mjs'
import { openMenuPage } from './mavlink-tools.mjs'

// The main connection form: the one with an "Enable custom" switch whose field holds a vehicle link
// (the WebRTC signalling form next to it has a switch too, but a signalling address).
const formExpr = `(window.__mainConnectionForm ??= [...document.querySelectorAll('form')].find((f) => f.getClientRects().length
  && f.querySelector('input[type=checkbox]') && [...f.querySelectorAll('input')].some((i) => /mavlink2rest|tcp|udp|serial/.test(i.value))))`

const centre = (page, expr) =>
  page.eval(`(() => { const el = ${expr}; if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)

/**
 * The "Current address" and "Status" lines under the connection panel's title.
 * @param {object} page - Driver page
 * @returns {Promise<{address: string, status: string}>} As shown
 */
export async function connectionSummary(page) {
  // The global-address panel above has a "Current address" line too, but no status.
  const text =
    await page.eval(`(() => { const t = [...document.querySelectorAll('*')].find((el) => el.childElementCount < 3
    && /^Current address:[\\s\\S]*Status:/.test(el.textContent.trim()) && el.getClientRects().length); return t?.textContent ?? '' })()`)
  return {
    address: text.match(/Current address:\s*(\S+)/)?.[1] ?? '',
    status: text.match(/Status:\s*([a-z .]+)/i)?.[1]?.trim() ?? '',
  }
}

/**
 * Settings → General → the main connection panel: enable a custom URI, type it, Apply.
 * @param {object} page - Driver page
 * @param {string} uri - Connection URI, e.g. tcpout://192.168.0.2:5762
 */
export async function setMainConnection(page, uri) {
  if (!(await page.eval(`!!${formExpr}`))) await openMenuPage(page, 'settings-general')
  await page.waitFor(() => page.eval(`!!(${formExpr})`), { label: 'the main connection form' })
  const enabled = await page.eval(`(${formExpr}).querySelector('input[type=checkbox]').checked`)
  if (!enabled)
    await page.click(await centre(page, `(${formExpr}).querySelector('input[type=checkbox]')`), { settle: 800 })
  await page.fill(await centre(page, `(${formExpr}).querySelector('input:not([type=checkbox])')`), uri)
  await page.wait(500)
  const apply = `[...(${formExpr}).querySelectorAll('button[type=submit]')].find((b) => b.textContent.trim() === 'Apply')`
  await page.click(await centre(page, apply), { settle: 1500 })
}

/**
 * Whether heartbeats keep arriving: the vehicle store's last heartbeat moves on within `ms`.
 * @param {object} page - Driver page
 * @param {number} [ms] - How long to watch
 * @returns {Promise<{ok: boolean, detail: string}>} Check result
 */
export async function heartbeatsFlowing(page, ms = 3000) {
  const read = () => page.store('main-vehicle', 's.lastHeartbeat?.getTime() ?? 0')
  const first = await read()
  await sleep(ms)
  const later = await read()
  const online = await page.store('main-vehicle', 's.isVehicleOnline')
  return { ok: online && later > first, detail: `online ${online}, ${later - first} ms of new heartbeats` }
}

/**
 * Start a pty that relays a TCP MAVLink stream, standing in for a USB serial adapter.
 * @param {string} host - TCP host
 * @param {number} port - TCP port
 * @returns {Promise<{path: string, stop: Function}>} The serial device and a way to tear it down
 */
export function startSerialBridge(host, port) {
  const script = join(dirname(fileURLToPath(import.meta.url)), 'serial-bridge.py')
  const child = spawn('python3', [script, host, String(port)])
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('the serial bridge did not start')), 8000)
    child.once('exit', (code) => reject(new Error(`the serial bridge exited (${code})`)))
    child.stdout.once('data', (data) => {
      clearTimeout(timer)
      resolve({ path: data.toString().trim(), stop: () => child.kill() })
    })
  })
}
