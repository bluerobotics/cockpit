// Mission-planning steps shared by the MP cases. Shapes are given as fractions of the planning map
// at zoom 18, around the vehicle, so they land on water near the simulator wherever it is parked.
// The map opens centred on the vehicle and its marker takes clicks, so no point sits near 0.5, 0.5.

import { drawSimplePath, geoToPage, mapPoint, missionState, openCockpit, pageToGeo, wheelZoom } from './cockpit.mjs'
import { sleep } from './driver.mjs'
import { distance } from './vehicle.mjs'

export const PLANNING_ZOOM = 18
export const PATH4 = [
  [0.4, 0.28],
  [0.56, 0.26],
  [0.62, 0.44],
  [0.44, 0.62],
]
export const SURVEY_SE = [
  [0.62, 0.62],
  [0.74, 0.62],
  [0.74, 0.8],
  [0.62, 0.8],
]

// Selectors for the orbit menu that opens on a survey polygon.
export const orbit = (icon) => `.context-menu button:has(.${icon})`
export const DELETE_SURVEY = '.context-menu .bg-red'

/**
 * Zoom the planning map in to where waypoint markers are drawn at a readable size.
 * @param {object} page - Driver page
 */
export async function planningZoom(page) {
  await wheelZoom(page, 'planning', PLANNING_ZOOM)
}

/**
 * Draw the standard four-waypoint simple path.
 * @param {object} page - Driver page
 * @param {object} [options] - Passed to drawSimplePath
 * @returns {Promise<Array<{lat: number, lon: number}>>} Where each waypoint was clicked
 */
export async function drawPath4(page, options) {
  await planningZoom(page)
  return drawSimplePath(page, PATH4, options)
}

/**
 * Draw a survey polygon with the sidebar survey button and generate its waypoints.
 * @param {object} page - Driver page
 * @param {Array<[number, number]>} corners - Polygon corners as fractions of the planning map box
 * @param {object} [options] - Options
 * @param {Function} [options.onCorner] - Called after each corner click with its index
 * @returns {Promise<Array<{lat: number, lon: number}>>} The corners on the map
 */
export async function drawSurvey(page, corners, { onCorner } = {}) {
  await page.click('button:has(.mdi-grid)', { settle: 700 })
  await clickCorners(page, corners, onCorner)
  await page.click('text=GENERATE WAYPOINTS', { settle: 1200 })
  return Promise.all(
    corners.map(async ([fx, fy]) => pageToGeo(page, 'planning', await mapPoint(page, 'planning', fx, fy)))
  )
}

/**
 * Click polygon corners while a survey is being drawn.
 * @param {object} page - Driver page
 * @param {Array<[number, number]>} corners - Corners as fractions of the planning map box
 * @param {Function} [onCorner] - Called after each click with its index
 */
export async function clickCorners(page, corners, onCorner) {
  for (const [i, [fx, fy]] of corners.entries()) {
    await page.click(await mapPoint(page, 'planning', fx, fy), { settle: 400 })
    if (onCorner) await onCorner(i)
  }
}

/**
 * Viewport centre of the sidebar number input under the label that starts with `label`.
 * @param {object} page - Driver page
 * @param {string} label - Label text, e.g. 'Distance between lines'
 * @returns {Promise<{x: number, y: number}>} Viewport point
 */
export async function sidebarInput(page, label) {
  const wanted = JSON.stringify(label)
  const p = await page.eval(`(() => {
    const p = [...document.querySelectorAll('p')].find((e) => e.getClientRects().length && e.textContent.trim().startsWith(${wanted}))
    const input = p?.nextElementSibling
    if (input?.tagName !== 'INPUT') return null
    const r = input.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (!p) throw new Error(`no sidebar input labelled "${label}"`)
  return p
}

/**
 * Right-click a survey polygon to open its orbit menu.
 * @param {object} page - Driver page
 * @param {number} [index] - Which survey, in drawing order
 */
export async function openSurveyMenu(page, index = 0) {
  const at =
    await page.eval(`(() => { const p = [...document.querySelectorAll('#planningMap path.survey-polygon')][${index}];
    if (!p) return null; const r = p.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (!at) throw new Error(`no survey polygon #${index}`)
  await page.rightClick(at, { settle: 1100 })
  await page.waitFor('.context-menu .orbit-container', { label: 'the survey menu' })
}

/**
 * Viewport point halfway along the path segment that leaves waypoint `i` (0-based).
 * @param {object} page - Driver page
 * @param {number} i - Index of the segment's first waypoint
 * @returns {Promise<{x: number, y: number}>} Viewport point
 */
export async function segmentMidpoint(page, i) {
  const { waypoints } = await missionState(page)
  const a = await geoToPage(page, 'planning', waypoints[i])
  const b = await geoToPage(page, 'planning', waypoints[i + 1])
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/**
 * Hover a path segment until its "+" knob shows, click it, and pick a radial menu entry.
 * @param {object} page - Driver page
 * @param {number} i - Index of the segment's first waypoint
 * @param {string} entry - Radial button title, e.g. 'Add waypoint' or 'Insert survey here'
 */
export async function insertViaKnob(page, i, entry) {
  await page.hover(await segmentMidpoint(page, i), 900)
  await page.waitFor('.mission-segment-add-knob', { label: 'the segment "+" knob', timeout: 5000 })
  await page.click('.mission-segment-add-knob', { settle: 900 })
  await page.click(`.radial-btn[title="${entry}"]`, { settle: 900 })
}

// Text of the snackbars on screen.
export const snackbars = (page) => page.eval(`document.querySelector('#snackbar-container')?.innerText ?? ''`)

/**
 * Wait for a snackbar containing `text`.
 * @param {object} page - Driver page
 * @param {string} text - Text to look for
 * @param {number} [timeout] - ms
 * @returns {Promise<boolean>} Whether it showed up
 */
export async function sawSnackbar(page, text, timeout = 8000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if ((await snackbars(page)).includes(text)) return true
    await sleep(200)
  }
  return false
}

// Rows of the "Mission estimates" card, as { label: text }.
export const estimates = (page) =>
  page.eval(`(() => {
    const title = [...document.querySelectorAll('*')].find((e) => e.childElementCount === 0 && e.textContent.trim() === 'Mission estimates' && e.getClientRects().length)
    const lines = (title?.closest('.v-card, div[class*=rounded]')?.innerText ?? '').split('\\n').map((l) => l.trim()).filter(Boolean).slice(1)
    const out = {}; for (let i = 0; i + 1 < lines.length; i += 2) out[lines[i]] = lines[i + 1]
    return out })()`)

/**
 * Parse an estimates value ("1.2 km", "3m 49s", "222 m") into metres or seconds.
 * @param {string} text - Displayed value
 * @returns {number} Metres for distances, seconds for durations, NaN otherwise
 */
export function parseEstimate(text = '') {
  const km = text.match(/^([\d.,]+)\s*km$/)
  if (km) return Number(km[1].replace(/,/g, '')) * 1000
  const m = text.match(/^([\d.,]+)\s*m$/)
  if (m) return Number(m[1].replace(/,/g, ''))
  const parts = [...text.matchAll(/(\d+)\s*([hms])/g)]
  if (!parts.length) return NaN
  return parts.reduce((s, [, n, unit]) => s + Number(n) * { h: 3600, m: 60, s: 1 }[unit], 0)
}

/**
 * Add one waypoint where the map is right-clicked, through "Add waypoint here".
 * @param {object} page - Driver page
 * @param {{x: number, y: number}} at - Viewport point
 * @returns {Promise<{lat: number, lon: number}>} The clicked position
 */
export async function addWaypointHere(page, at) {
  const geo = await pageToGeo(page, 'planning', at)
  await page.rightClick(at, { settle: 900 })
  await page.click('text=Add waypoint here', { settle: 900 })
  return geo
}

/**
 * Number labels shown on the waypoint markers, in mission order.
 * @param {object} page - Driver page
 * @returns {Promise<string[]>} One label per waypoint ('' when a marker shows none)
 */
export async function waypointLabels(page) {
  const { waypoints } = await missionState(page)
  const labels =
    await page.eval(`(() => { const m = (window.__e2eMaps || []).find((m) => m.getContainer().id === 'planningMap'); const out = []
    m.eachLayer((l) => { const el = l.getElement?.(); if (!el?.classList.contains('waypoint-marker-icon') && !el?.querySelector?.('.waypoint-marker-icon')) return
      const ll = l.getLatLng(); out.push({ lat: ll.lat, lon: ll.lng, text: (el.innerText || l.getTooltip?.()?.getElement?.()?.innerText || '').trim() }) })
    return out })()`)
  return waypoints.map(
    (w) => labels.find((l) => Math.abs(l.lat - w.lat) < 1e-9 && Math.abs(l.lon - w.lon) < 1e-9)?.text ?? ''
  )
}

/**
 * Set the mission home with the sidebar "Set mission home" pill and a click on the map.
 * @param {object} page - Driver page
 * @param {[number, number]} fraction - Where to click, as a fraction of the planning map box
 * @returns {Promise<{lat: number, lon: number}>} The clicked position
 */
export async function setHomeByPill(page, [fx, fy]) {
  const at = await mapPoint(page, 'planning', fx, fy)
  const geo = await pageToGeo(page, 'planning', at)
  await page.click('text=Set mission home', { settle: 700 })
  await page.click(at, { settle: 1200 })
  return geo
}

/**
 * Press "Upload mission to vehicle" and wait for the result dialog.
 * @param {object} page - Driver page
 * @param {object} [options] - Options
 * @param {number} [options.timeout] - How long the upload may take, in ms
 * @returns {Promise<boolean>} Whether Cockpit reported success
 */
export async function uploadMission(page, { timeout = 60000 } = {}) {
  await page.click('text=UPLOAD MISSION TO VEHICLE', { settle: 800 })
  const done = () => page.eval(`/Mission upload (succeeded|failed)/.test(document.body.innerText)`)
  await page.waitFor(done, { timeout, label: 'the mission upload to finish' })
  return page.eval(`document.body.innerText.includes('Mission upload succeeded')`)
}

// Navigation items on the vehicle, in order, with the home (item 0) split out.
export const vehicleRoute = async (vehicle) => {
  const items = await vehicle.readMission()
  const [home, ...rest] = items
  return { home, waypoints: rest.filter((i) => i.command === 'MAV_CMD_NAV_WAYPOINT'), items }
}

/**
 * The home marker on a map, if one is drawn.
 * @param {object} page - Driver page
 * @param {string} which - 'planning', 'widget' or a map container id
 * @returns {Promise<{lat: number, lon: number, grab: {x: number, y: number}}|null>} The marker
 */
export async function homeMarker(page, which) {
  const id = which === 'planning' ? `'planningMap'` : null
  return page.eval(`(() => { const m = (window.__e2eMaps || []).filter((m) => ${
    id ? `m.getContainer().id === ${id}` : `m.getContainer().id.startsWith('map-')`
  } && m.getContainer().getClientRects().length).at(-1)
    if (!m) return null; let found = null
    m.eachLayer((l) => { const el = l.getElement?.(); if (found || !l.getLatLng || !el || el.classList.contains('leaflet-tooltip')) return
      const tip = l.getTooltip?.()?.getElement?.()
      if (!/mdi-home/.test(el.innerHTML + (tip?.innerHTML ?? ''))) return
      const b = el.getBoundingClientRect(); const ll = l.getLatLng()
      found = { lat: ll.lat, lon: ll.lng, grab: { x: b.x + b.width / 2, y: b.y + b.height / 2 } } })
    return found })()`)
}

/**
 * Ask the vehicle for its home and wait for the answer.
 * @param {object} vehicle - Vehicle helpers
 * @returns {Promise<{lat: number, lon: number}|null>} The home the autopilot holds
 */
export async function vehicleHome(vehicle) {
  await vehicle.command('MAV_CMD_REQUEST_MESSAGE', [242])
  const msg = (await vehicle.waitFor('HOME_POSITION', () => true, 3000)) ?? (await vehicle.read('HOME_POSITION'))
  return msg && { lat: msg.latitude / 1e7, lon: msg.longitude / 1e7 }
}

// A compact square close to the vehicle, so missions that actually run finish in well under a minute.
export const RUN_PATH = [
  [0.58, 0.44],
  [0.64, 0.38],
  [0.6, 0.3],
  [0.54, 0.33],
]
const ROVER_AUTO = 10

/**
 * Pick an entry in the open dropdown menu, scrolling it with the mouse wheel until the entry renders.
 * @param {object} page - Driver page
 * @param {string} text - Entry text as shown
 */
export async function pickFromMenu(page, text) {
  const target = `text=${text}`
  for (let i = 0; i < 60 && !(await page.exists(target)); i++) {
    const list = await page.box('.v-overlay--active .v-list')
    await page.moveTo(list, 200)
    await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: list.x, y: list.y, deltaX: 0, deltaY: 160 })
    await sleep(120)
  }
  await page.click(target, { settle: 800 })
}

/**
 * Add a non-navigation command to a waypoint through its side panel, then close the panel.
 * @param {object} page - Driver page
 * @param {number} index - Waypoint index (0-based)
 * @param {string} command - Command as listed, e.g. 'DO_SET_SERVO'
 * @param {Record<number, number>} params - Parameter values by parameter number
 */
export async function addWaypointCommand(page, index, command, params) {
  const { waypoints } = await missionState(page)
  await page.click(await geoToPage(page, 'planning', waypoints[index]), { settle: 1200 })
  await page.click('text=APPEND NEW COMMAND', { settle: 1000 })
  // The panel's selects, top to bottom: MAV frame, then the new command's Type, then its Command.
  const selects = () =>
    page.eval(`[...document.querySelectorAll('.v-select')].filter((e) => e.getClientRects().length && e.getBoundingClientRect().x > 1150)
      .map((e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })`)
  await page.click((await selects()).at(-1), { settle: 800 })
  await page.click('text=MAVLink Non-Navigation Command', { settle: 900 })
  await page.click((await selects()).at(-1), { settle: 900 })
  await pickFromMenu(page, command)
  for (const [n, value] of Object.entries(params)) {
    const at = await page.eval(`(() => {
      const p = [...document.querySelectorAll('p')].find((e) => e.getClientRects().length && e.textContent.trim().startsWith('Param ${n}'))
      const input = p?.parentElement?.querySelector('input'); if (!input) return null
      const r = input.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
    if (!at) throw new Error(`no field for Param ${n}`)
    await page.fill(at, value)
  }
  await page.click('text=Add', { settle: 1000 })
}

/**
 * Close a waypoint's side panel by clicking empty map. Leaving it open across the switch to the
 * Flight view keeps an invisible panel over the right edge there, so cases close it first.
 * @param {object} page - Driver page
 */
export async function deselectWaypoint(page) {
  await page.click(await mapPoint(page, 'planning', 0.3, 0.9), { settle: 900 })
}

/**
 * From the upload result dialog, switch to the Flight view and press play on the mission control
 * panel; resolves once the autopilot reports armed and in AUTO.
 * @param {object} page - Driver page
 * @param {object} vehicle - Vehicle helpers
 */
export async function startUploadedMission(page, vehicle) {
  await page.click('text=Switch to Flight Mode', { settle: 2500 })
  const running = async () => {
    const hb = await vehicle.heartbeat()
    return Boolean(hb && hb.base_mode.bits & 128 && hb.custom_mode === ROVER_AUTO)
  }
  // Say what the autopilot did instead, so a failed start is evidence rather than a timeout.
  const why = async () => {
    const hb = await vehicle.heartbeat()
    const ack = await vehicle.read('COMMAND_ACK')
    const text = (await vehicle.read('STATUSTEXT'))?.text
    const status = Array.isArray(text) ? text.join('') : text ?? ''
    const armed = Boolean(hb?.base_mode.bits & 128)
    return `mode ${hb?.custom_mode}, armed ${armed}, last ack ${ack?.command?.type} ${
      ack?.result?.type
    }, last status "${status.replace(/\0/g, '')}"`
  }
  // Play sometimes arms without starting the mission; that is recorded, then Play is pressed again
  // the way an operator would, so the rest of the case still gets tested.
  for (const press of [1, 2]) {
    await page.click(await missionPanelButton(page, 'mdi-play'), { settle: 1500 })
    try {
      await page.waitFor(running, { timeout: 20000, label: 'the vehicle to arm and enter AUTO' })
      return
    } catch (error) {
      const detail = await why()
      if (press === 2) throw new Error(`${error.message}: ${detail}`)
      await page.check('Play started the mission on the first press', () => ({ ok: false, detail }))
      await page.caption('The mission did not start; pressing Play again')
    }
  }
}

/**
 * A button of the Flight view's "Mission control panel", once the panel has stopped moving. Other
 * widgets carry the same icons, so the search is scoped to the panel.
 * @param {object} page - Driver page
 * @param {string} icon - Button icon class, e.g. 'mdi-play'
 * @returns {Promise<{x: number, y: number}>} Viewport point
 */
export async function missionPanelButton(page, icon) {
  const locate = () =>
    page.eval(`(() => {
      const title = [...document.querySelectorAll('*')].find((e) => e.childElementCount === 0 && e.textContent.trim() === 'Mission control panel' && e.getClientRects().length)
      let panel = title; while (panel && !panel.querySelector('button .${icon}')) panel = panel.parentElement
      const btn = panel?.querySelector('button:has(.${icon})'); if (!btn) return null
      const r = btn.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) } })()`)
  let last = null
  for (let i = 0; i < 40; i++) {
    const now = await locate()
    if (now && last && now.x === last.x && now.y === last.y) return now
    last = now
    await sleep(250)
  }
  throw new Error(`no steady ${icon} button on the mission control panel`)
}

/**
 * Set the planning sidebar's cruise speed.
 * @param {object} page - Driver page
 * @param {number} speed - m/s
 */
export async function setCruiseSpeed(page, speed) {
  await page.fill(await sidebarInput(page, 'Cruise speed'), speed)
  await page.key('Tab', { show: false })
}

/**
 * Sample VFR_HUD ground speed every 500 ms for `ms`.
 * @param {object} vehicle - Vehicle helpers
 * @param {number} ms - How long to sample
 * @returns {Promise<number[]>} The samples, m/s
 */
export async function sampleGroundSpeed(vehicle, ms) {
  const out = []
  const end = Date.now() + ms
  while (Date.now() < end) {
    out.push((await vehicle.read('VFR_HUD'))?.groundspeed ?? NaN)
    await sleep(500)
  }
  return out
}

export const median = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  return sorted.length ? sorted[sorted.length >> 1] : NaN
}

export const ROVER = { HOLD: 4, LOITER: 5, AUTO: 10, RTL: 11, SMART_RTL: 12, GUIDED: 15 }

/**
 * Open Cockpit again on a brand-new profile with an empty plan, as another computer would. Whatever
 * mission is on the vehicle was then not uploaded by this Cockpit.
 * @param {object} ctx - Case context from the runner
 * @param {object} ctx.page - Driver page
 * @param {object} ctx.vehicle - Vehicle helpers
 * @param {string} ctx.url - Cockpit base URL
 * @param {string} ctx.user - Cockpit user the runner uses
 * @param {string} route - Route to open
 */
export async function reopenAsAnotherComputer({ page, vehicle, url, user }, route) {
  await vehicle.setSyncedSetting(user, 'cockpit-draft-mission', {})
  await vehicle.setSyncedSetting(user, 'cockpit-last-uploaded-mission', {})
  await page.restartBrowser({ freshProfile: true })
  await openCockpit(page, { url, route })
}

/**
 * Arm the simulator directly over MAVLink (a precondition, not the thing under test).
 * @param {object} vehicle - Vehicle helpers
 */
export async function armVehicle(vehicle) {
  for (let i = 0; i < 10 && !(await vehicle.isArmed()); i++) {
    await vehicle.command('MAV_CMD_COMPONENT_ARM_DISARM', [1, 0])
    await sleep(1000)
  }
  if (!(await vehicle.isArmed())) throw new Error('could not arm the simulator')
}

/**
 * Wait until the vehicle is within `radius` metres of a point.
 * @param {object} vehicle - Vehicle helpers
 * @param {{lat: number, lon: number}} target - Point
 * @param {object} [options] - Options
 * @param {number} [options.radius] - Metres
 * @param {number} [options.timeout] - ms
 * @param {Function} [options.onTick] - Called with the distance about once a second
 * @returns {Promise<number>} The closest distance reached
 */
export async function waitArrival(vehicle, target, { radius = 3, timeout = 90000, onTick } = {}) {
  const deadline = Date.now() + timeout
  let closest = Infinity
  while (Date.now() < deadline) {
    const gap = distance(await vehicle.position(), target)
    closest = Math.min(closest, gap)
    if (onTick) await onTick(gap)
    if (gap <= radius) break
    await sleep(1000)
  }
  return closest
}

/**
 * Plan a mission, upload it and press play from the Flight view.
 * @param {object} page - Driver page
 * @param {object} vehicle - Vehicle helpers
 * @param {Array<[number, number]>} path - Path as fractions of the planning map
 * @param {number} speed - Cruise speed, m/s
 * @returns {Promise<Array<{lat: number, lon: number}>>} The planned waypoints
 */
export async function planUploadAndRun(page, vehicle, path, speed) {
  await planningZoom(page)
  await drawSimplePath(page, path)
  await setCruiseSpeed(page, speed)
  await setHomeByPill(page, [0.42, 0.62])
  if (!(await uploadMission(page))) throw new Error('upload failed')
  const { waypoints } = await missionState(page)
  await startUploadedMission(page, vehicle)
  return waypoints
}

// Whether a polyline on the map runs through `points` consecutively, in order.
export const lineThrough = (lines, points, tolerance = 2e-6) =>
  lines.some((pts) =>
    pts.some((_, start) =>
      points.every(
        (p, i) =>
          pts[start + i] &&
          Math.abs(pts[start + i].lat - p.lat) < tolerance &&
          Math.abs(pts[start + i].lon - p.lon) < tolerance
      )
    )
  )

/**
 * Confirm Cockpit's slide-to-confirm prompt (arming, GoTo...) by dragging its handle to the end.
 * @param {object} page - Driver page
 * @returns {Promise<string>} The prompt text that was confirmed
 */
export async function confirmSlider(page) {
  await page.waitFor('.slideunlock-handler', { timeout: 8000, label: 'the slide-to-confirm prompt' })
  const { text, track } =
    await page.eval(`(() => { const t = [...document.querySelectorAll('.slideunlock')].find((e) => e.getClientRects().length)
    const r = t.getBoundingClientRect(); return { text: t.innerText.trim(), track: { right: r.x + r.width, y: r.y + r.height / 2 } } })()`)
  const handle = await page.box('.slideunlock-handler')
  await page.drag(handle, { x: track.right + 10, y: track.y }, { duration: 900, settle: 1200 })
  return text
}
