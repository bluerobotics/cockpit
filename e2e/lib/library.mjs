// The video library as the VID-46 to VID-49 cases read it, the files it hands out, and a stand-in
// for the native file picker Standalone opens to choose a chunks zip.

import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'

import { libraryButton } from './video.mjs'

// The library's own overlay; tooltips and snackbars open overlays of their own on top of it.
const overlay = `document.querySelector('.video-sub-tabs').closest('.v-overlay')`

/**
 * Open the video library from the mini recorder.
 * @param {object} page - Driver page
 */
export async function openLibrary(page) {
  await page.click(await libraryButton(page), { settle: 2000 })
  await page.waitFor(() => page.exists('.video-sub-tabs'), { timeout: 10000, label: 'the video library' })
}

/**
 * Click one of the library's video tabs.
 * @param {object} page - Driver page
 * @param {'Processed'|'Raw'|'Processing'} label - Tab
 * @returns {Promise<void>}
 */
export const libraryTab = (page, label) => page.click(`text=${label.toUpperCase()}`, { settle: 1500 })

/**
 * Whether a library tab is disabled.
 * @param {object} page - Driver page
 * @param {'Processed'|'Raw'|'Processing'} label - Tab
 * @returns {Promise<boolean>} True when it cannot be opened
 */
export const tabDisabled = (page, label) =>
  page.eval(
    `(() => { const t = [...document.querySelectorAll('.video-sub-tabs .v-tab')].find((e) => e.innerText.trim().toUpperCase() === ${JSON.stringify(
      label.toUpperCase()
    )}); return !!t && (t.disabled || t.classList.contains('v-tab--disabled') || t.classList.contains('v-btn--disabled')) })()`
  )

const GROUPS = `[...${overlay}.querySelectorAll('div.rounded-lg.border')].filter((d) => / chunks •/.test(d.innerText)
  && !d.querySelector('div.rounded-lg.border'))`

/**
 * The chunk groups the Raw tab lists.
 * @param {object} page - Driver page
 * @returns {Promise<Array<{title: string, line: string, chunks: number, icons: string[]}>>} One per group
 */
export const chunkGroups = (page) =>
  page.eval(`${GROUPS}.map((d) => { const lines = d.innerText.split('\\n').map((l) => l.trim()).filter(Boolean)
    const line = lines.find((l) => / chunks •/.test(l)) ?? ''
    return { title: lines[0], line, chunks: Number(line.match(/(\\d+) chunks/)?.[1] ?? NaN),
      icons: [...d.querySelectorAll('.v-icon')].map((i) => [...i.classList].find((c) => c.startsWith('mdi-') && c !== 'mdi')).filter(Boolean) } })`)

/**
 * Centre of a button on the chunk group titled `hash`.
 * @param {object} page - Driver page
 * @param {string} hash - Group title
 * @param {string} icon - Button icon, e.g. 'mdi-download'
 * @returns {Promise<{x: number, y: number}>} Centre
 */
export async function groupButton(page, hash, icon) {
  const at = await page.eval(`(() => { const g = ${GROUPS}.find((d) => d.innerText.trim().startsWith(${JSON.stringify(
    hash
  )}))
    const el = g?.querySelector('.${icon}')?.closest('button') ?? g?.querySelector('.${icon}'); if (!el) return null
    const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (!at) throw new Error(`no ${icon} button on the chunk group ${hash}`)
  return at
}

/**
 * The videos the Processed tab lists.
 * @param {object} page - Driver page
 * @returns {Promise<Array<{name: string, text: string}>>} File name and card text
 */
export const processedCards = (page) =>
  page.eval(`[...document.querySelectorAll('[id^="video-library-thumbnail-"]')].filter((e) => e.getClientRects().length)
    .map((e) => ({ name: e.id.slice('video-library-thumbnail-'.length), text: e.innerText.replace(/\\s+/g, ' ').trim() }))`)

/**
 * The recording hash in a Cockpit video or subtitle file name, `<mission> (<date>) #<hash>.<ext>`.
 * @param {string} name - File name
 * @returns {string|undefined} Hash
 */
export const hashOf = (name) => name?.match(/#([0-9a-f]+)\.\w+$/)?.[1]

/**
 * Entry names in a zip.
 * @param {string} zip - Zip path
 * @returns {string[]} Names
 */
export const zipEntries = (zip) => execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).split('\n').filter(Boolean)

/**
 * Join a recording's chunks from its zip in order, as the recorder wrote them, and measure the result.
 * @param {string} zip - Chunks zip
 * @param {string} hash - Recording hash
 * @param {string} dir - Where to extract and write the joined file
 * @returns {number} Duration in seconds, NaN when ffprobe cannot read it
 */
export function joinedChunksSeconds(zip, hash, dir) {
  execFileSync('unzip', ['-o', '-q', zip, '-d', dir])
  const chunks = readdirSync(dir)
    .filter((f) => new RegExp(`^${hash}_\\d+$`).test(f))
    .sort((a, b) => Number(a.split('_')[1]) - Number(b.split('_')[1]))
  const joined = join(dir, `${hash}.webm`)
  writeFileSync(joined, Buffer.concat(chunks.map((f) => readFileSync(join(dir, f)))))
  return mediaSeconds(joined)
}

/**
 * A media file's duration as ffprobe reads it; a webm made of joined chunks may carry no duration
 * header, so its packets are counted instead.
 * @param {string} file - Media file
 * @returns {number} Seconds, NaN when unreadable
 */
export function mediaSeconds(file) {
  try {
    const out = execFileSync(
      'ffprobe',
      ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts_time', '-of', 'csv=p=0', file],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    )
    const times = out.split('\n').map(Number).filter(Number.isFinite)
    return times.length ? Math.max(...times) - Math.min(...times) : NaN
  } catch {
    return NaN
  }
}

// Inspector port for the cases that stub the file picker; random per run, so an app left over by an
// earlier run cannot answer in place of this one.
export const INSPECT_PORT = 9800 + Math.floor(Math.random() * 150)

/**
 * Make Standalone's native "open file" dialog answer `paths` without showing, through the main
 * process's inspector (the app must be started with `--inspect=<port>`). The page cannot do it: the
 * preload API it would patch is frozen.
 * @param {number} port - Inspector port
 * @param {string[]} paths - Files the dialog returns
 */
export async function stubOpenDialog(port, paths) {
  const [target] = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve)
    ws.addEventListener('error', reject)
  })
  const expression = `(() => { const { dialog } = (process.mainModule?.require ?? require)('electron')
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: ${JSON.stringify(paths)} }); return true })()`
  const result = await new Promise((resolve) => {
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data)
      if (m.id === 1) resolve(m)
    })
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, includeCommandLineAPI: true } }))
  })
  ws.close()
  if (result.result?.result?.value !== true)
    throw new Error(`could not stub the open dialog: ${JSON.stringify(result)}`)
}

/**
 * Where a Standalone case keeps its recordings, as keepRecordingsInRun set it.
 * @param {object} ctx - Case context from the runner
 * @param {string} ctx.outDir - Run folder
 * @param {object} ctx.meta - Case meta
 * @returns {string} The videos folder
 */
export const videosFolder = ({ outDir, meta }) => join(outDir, 'cockpit-folder', meta.id, 'videos')

/**
 * Note every snackbar text from now on, since each is up for a few seconds only.
 * @param {object} page - Driver page
 * @returns {Promise<void>}
 */
export const watchSnackbars = (page) =>
  page.eval(`(() => { window.__seenTexts = new Set(); new MutationObserver(() => {
    for (const el of document.querySelectorAll('#snackbar-container, .v-snackbar')) window.__seenTexts.add(el.innerText.trim()) })
    .observe(document.body, { childList: true, subtree: true, characterData: true }) })()`)

/**
 * Wait for a snackbar containing `text` since watchSnackbars, and return it.
 * @param {object} page - Driver page
 * @param {string} text - Text to look for
 * @param {number} [timeout] - ms
 * @returns {Promise<string|undefined>} The whole snackbar text
 */
export async function seenSnackbar(page, text, timeout = 15000) {
  const find = `[...(window.__seenTexts ?? [])].find((t) => t.includes(${JSON.stringify(text)}))`
  await page.waitFor(() => page.eval(`!!${find}`), { timeout, label: `"${text}"` }).catch(() => undefined)
  return page.eval(find)
}

/**
 * The newest chunks zip VID-46.1 downloaded in any run under the output folder.
 * @param {string} outDir - This run's folder
 * @returns {string|undefined} Its path
 */
export function latestWebZip(outDir) {
  const root = dirname(outDir)
  return readdirSync(root)
    .map((folder) => join(root, folder, 'downloads', 'VID-46.1'))
    .filter((dir) => existsSync(dir))
    .flatMap((dir) =>
      readdirSync(dir)
        .filter((f) => /^chunks_[0-9a-f]+\.zip$/.test(f))
        .map((f) => join(dir, f))
    )
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]
}

/**
 * Copy the web build's latest chunks zip into this run, keeping its name, which Cockpit uses to find
 * a recording's other parts.
 * @param {string} outDir - This run's folder
 * @returns {{zip: string, source: string, hash: string}|undefined} The copy, where it came from, and its recording hash
 */
export function webZipForRun(outDir) {
  const source = process.env.COCKPIT_E2E_ZIP || latestWebZip(outDir)
  if (!source) return undefined
  const zip = join(outDir, 'zips', basename(source))
  mkdirSync(dirname(zip), { recursive: true })
  copyFileSync(source, zip)
  return { zip, source, hash: basename(zip).match(/^chunks_([0-9a-f]+)\.zip$/)[1] }
}

/**
 * Process a chunks zip from the library's Processing tab, the native picker answering with `zip`.
 * The library must be open and snackbars watched.
 * @param {object} page - Driver page
 * @param {number} inspectPort - Inspector port Standalone was started with
 * @param {string} zip - Zip path
 * @returns {Promise<string|undefined>} The success snackbar, if one came
 */
export async function processZip(page, inspectPort, zip) {
  await libraryTab(page, 'Processing')
  // The native file picker cannot be clicked through; it is told to answer with the zip instead.
  await stubOpenDialog(inspectPort, [zip])
  await page.caption(`Select and Process ZIP File(s): ${basename(zip)}`)
  await page.click('text=Select and Process ZIP File(s)', { settle: 1000 })
  return seenSnackbar(page, 'processed successfully', 180000)
}

// The name VID-49 gives the mission before recording.
export const RENAMED_MISSION = 'Release test mission'

/**
 * Rename the mission from the top bar: click its name, type the new one, Save, then "Rename current
 * mission".
 * @param {object} page - Driver page
 * @param {string} name - New mission name
 */
export async function renameMission(page, name) {
  const current = await page.store('mission', 's.missionName')
  const at = await page.eval(
    `(() => { const el = [...document.querySelectorAll('p.text-ellipsis')].find((e) => e.textContent.trim() === ${JSON.stringify(
      current
    )} && e.getClientRects().length); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`
  )
  if (!at) throw new Error(`the mission name "${current}" is not in the top bar`)
  await page.click(at, { settle: 1200 })
  await page.fill('.v-overlay--active .v-text-field input', name)
  await page.click('text=Save', { settle: 1200 })
  await page.click('text=Rename current mission', { settle: 1500 })
}
