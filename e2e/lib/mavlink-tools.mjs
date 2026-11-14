// Steps for the MAVLink tools page (inspector, message dumper) and the alerts it feeds.

import { readFileSync } from 'node:fs'

/**
 * Open a page of the main menu, e.g. 'tools-mavlink' or 'settings-alerts'.
 * @param {object} page - Driver page
 * @param {string} id - The page's id (`SubMenuComponentName` in src/types/general.ts), whose prefix names its section
 */
export async function openMenuPage(page, id) {
  // Another menu page is open: close it first, the way an operator would.
  if (!(await page.exists('#menu-trigger'))) await closeMenu(page)
  await page.click('#menu-trigger', { settle: 900 })
  await clickWhenStill(page, `#main-menu-${id.split('-')[0]}`, 900)
  await clickWhenStill(page, `#menu-page-${id}`, 1500)
  const opened = () =>
    page.eval(`document.querySelector('#app').__vue_app__.config.globalProperties.$router
      .currentRoute.value.meta.menuPage === ${JSON.stringify(id)}`)
  await page.waitFor(opened, { label: `the ${id} menu page to open`, timeout: 5000 })
}

/**
 * Click a main-menu entry once it has stopped moving: the menu animates its height between levels, moving its
 * entries out from under a click aimed at where they were.
 * @param {object} page - Driver page
 * @param {string} selector - CSS selector of the entry
 * @param {number} settle - ms to wait after the click
 */
export async function clickWhenStill(page, selector, settle) {
  const rect = `JSON.stringify(document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect())`
  let last
  await page.waitFor(
    async () => {
      const now = await page.eval(rect)
      const still = now !== undefined && now === last
      last = now
      return still
    },
    { label: `${selector} to stop moving`, timeout: 5000 }
  )
  await page.click(selector, { settle })
}

/**
 * Close the open menu page with its X, then the main menu with a click beside it.
 * @param {object} page - Driver page
 */
export async function closeMenu(page) {
  const close = '#menu-page-close'
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
    .filter((e) => e.checkVisibility({ visibilityProperty: true }) && /^[A-Z0-9_]+$/.test(e.textContent.trim())).map((e) => e.textContent.trim())`)

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
