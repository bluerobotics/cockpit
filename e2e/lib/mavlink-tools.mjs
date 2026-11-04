// Steps for the MAVLink tools page (inspector, message dumper) and the alerts it feeds.

import { readFileSync } from 'node:fs'

/**
 * Open a page of the main menu, e.g. ('Tools', 'MAVLink') or ('Settings', 'Alerts').
 * @param {object} page - Driver page
 * @param {string} section - Main menu entry
 * @param {string} title - Page in that section
 */
export async function openMenuPage(page, section, title) {
  // Another menu page is open: close it first, the way an operator would.
  if (!(await page.exists('.mdi-menu-right'))) await closeMenu(page)
  await page.click('.mdi-menu-right', { settle: 900 })
  await page.click(`text=${section}`, { settle: 900 })
  await page.click(`text=${title}`, { settle: 1500 })
}

/**
 * Close the open menu page with its X, then the main menu with a click beside it.
 * @param {object} page - Driver page
 */
export async function closeMenu(page) {
  const close = '.flex.gap-x-2.absolute.top-0.right-0 button'
  if (await page.exists(close)) await page.click(close, { settle: 800 })
  await page.click({ x: page.width * 0.85, y: page.height * 0.45 }, { settle: 800 })
}

/**
 * Search the inspector for a message type and start tracking it.
 * @param {object} page - Driver page
 * @param {string} type - MAVLink message name
 */
export async function trackMessage(page, type) {
  await page.fill('input[placeholder="Search messages..."]', type)
  await page.click(`text=${type}`, { settle: 1200 })
}

const inspectorBlock = (type) =>
  `[...document.querySelectorAll('.font-bold span')].find((s) => s.textContent.trim() === ${JSON.stringify(
    type
  )})?.closest('.mb-4')`

/**
 * The last message of a type as the inspector shows it, or null when it shows none.
 * @param {object} page - Driver page
 * @param {string} type - MAVLink message name
 * @param {'incoming'|'outgoing'} direction - Which of the two the inspector lists
 * @returns {Promise<object|null>} Message
 */
export const inspectorMessage = (page, type, direction) => {
  const stampClass = direction === 'incoming' ? '.text-blue-300' : '.text-green-300'
  return page.eval(`(() => {
    const pre = ${inspectorBlock(type)}?.querySelector('${stampClass}')?.parentElement.querySelector('pre')
    return pre ? JSON.parse(pre.textContent) : null })()`)
}

/**
 * Message types the inspector's list currently shows.
 * @param {object} page - Driver page
 * @returns {Promise<string[]>} Message names
 */
export const inspectorListed = (page) =>
  page.eval(`[...document.querySelectorAll('.cursor-pointer.rounded')]
    .filter((e) => e.getClientRects().length && /^[A-Z0-9_]+$/.test(e.textContent.trim())).map((e) => e.textContent.trim())`)

/**
 * Text currently shown in the top alert bar.
 * @param {object} page - Driver page
 * @returns {Promise<string>} Alert text
 */
export const alertBarText = (page) =>
  page.eval(`[...document.querySelectorAll('p.text-xl.text-ellipsis')].map((p) => p.textContent.trim()).join(' | ')`)

/**
 * Wait until the alert bar shows `text`.
 * @param {object} page - Driver page
 * @param {string} text - Text to look for
 * @param {number} [timeout] - ms
 * @returns {Promise<string>} What the bar showed last
 */
export async function waitAlertBar(page, text, timeout = 15000) {
  await page.waitFor(async () => (await alertBarText(page)).includes(text), { timeout }).catch(() => undefined)
  return alertBarText(page)
}

// Records what Cockpit hands to the browser's speech engine, with the volume, without silencing it.
export const SPEECH_SPY = `(() => {
  window.__spoken = []
  const speak = SpeechSynthesis.prototype.speak
  SpeechSynthesis.prototype.speak = function (u) { window.__spoken.push({ text: u.text, volume: u.volume }); return speak.call(this, u) }
})()`

/**
 * Utterances recorded by SPEECH_SPY.
 * @param {object} page - Driver page
 * @returns {Promise<Array<{text: string, volume: number}>>} Utterances
 */
export const spoken = (page) => page.eval('window.__spoken ?? []')

/**
 * Record a message dump for `seconds` with the dumper's Start/Stop and download it into `dir`.
 * The MAVLink tools page must be open.
 * @param {object} page - Driver page
 * @param {string} dir - Download folder
 * @param {number} seconds - How long to record
 * @returns {Promise<string>} Path of the downloaded dump
 */
export async function recordDump(page, dir, seconds) {
  await page.click('text=Start', { settle: 500 })
  for (let left = seconds; left > 0; left -= 5) {
    await page.caption(`Dumping messages · ${left} s left`)
    await page.wait(Math.min(5, left) * 1000)
  }
  await page.click('text=Stop', { settle: 800 })
  return page.download(dir, () => page.click('text=Download dump'))
}

/**
 * Message types in a dump file, with how many and over which time span each was captured.
 * @param {string} path - Dump file (JSON lines)
 * @returns {Record<string, {count: number, first: number, last: number}>} Per message type
 */
export function dumpSummary(path) {
  const types = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue
    const { ts, msg } = JSON.parse(line)
    const type = msg?.message?.type
    if (!type) continue
    const t = (types[type] ??= { count: 0, first: ts, last: ts })
    t.count += 1
    t.last = ts
  }
  return types
}
