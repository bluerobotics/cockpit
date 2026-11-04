// Performance measurement inside a recorded case. The page keeps a timestamp per animation frame,
// every long task and every trusted input event from the moment `startSampling` runs; `measure`
// only marks where a window begins and ends, and the numbers are cut from that one series afterwards.
// Nothing is averaged inside the page, so a stall can never be smoothed away before it is counted.

import { readFileSync } from 'fs'

import { dismissTutorial, mapExpr, mapLibrary, mapPoint, mapPolylines, mapView, setMapView } from './cockpit.mjs'
import { sleep } from './driver.mjs'
import { featuresDialogOpen, ignoreAllFeatures } from './extensions.mjs'

/**
 * Synced settings that give a map case its own profile: one view with the Map widget full screen and the HUDs
 * on top, and no video player or recorder, whose streams would load the machine being measured. Cases spread
 * it into `meta.synced`; the runner puts the test user's layout back afterwards.
 */
export const MAP_PROFILE = {
  'cockpit-views-group-v1': JSON.parse(readFileSync(new URL('../fixtures/perf-map-profile.json', import.meta.url))),
  'cockpit-current-view-index-v1': 0,
}

/**
 * Let a freshly started Cockpit finish arriving before anything is measured: the welcome tour and the
 * extension features dialog can open well after boot on a slow machine, over the map. Returns once
 * neither has shown up for `quiet` ms.
 * @param {object} page - Driver page
 * @param {object} [options] - Options
 * @param {number} [options.quiet] - ms with no late dialog that counts as settled
 * @param {number} [options.timeout] - ms to give up after
 * @returns {Promise<void>}
 */
export async function settle(page, { quiet = 4000, timeout = 60000 } = {}) {
  const deadline = Date.now() + timeout
  let calmSince = Date.now()
  while (Date.now() - calmSince < quiet) {
    if (Date.now() > deadline) throw new Error('Cockpit kept opening dialogs; nothing measured')
    // Ignoring the extension features, rather than closing the dialog, stops it opening in later runs.
    const features = await featuresDialogOpen(page)
    if (features) {
      console.log('   settle: the extension features dialog opened; ignoring every feature')
      await ignoreAllFeatures(page)
    }
    const tour = !features && (await dismissTutorial(page, 0))
    if (tour) console.log('   settle: the welcome tour opened; closed it with "Don\'t show again"')
    if (features || tour) calmSince = Date.now()
    await sleep(1000)
  }
}

// Installed on every document. Idle until started; afterwards a rAF loop and two listeners, the same
// load in a recorded run and an unrecorded one.
export const SAMPLER = `(() => {
  if (window.__perf) return
  const cap = 1 << 18
  const frames = new Float64Array(cap)
  let n = 0
  let on = false
  const tasks = []
  const inputs = []
  const marks = []
  const map = []
  // Chromium merges wheel events while the page is busy, as it does for a real mouse, adding their
  // deltas with sign: what is conserved is the net scroll, not the event count or the total travel.
  let wheel = 0
  let wheelNet = 0
  const tick = (t) => { if (!on) return; if (n < cap) frames[n++] = t; requestAnimationFrame(tick) }
  try {
    new PerformanceObserver((list) => { if (on) for (const e of list.getEntries()) tasks.push([e.startTime, e.duration]) })
      .observe({ type: 'longtask' })
  } catch {}
  for (const type of ['wheel', 'pointerdown', 'pointerup', 'pointermove']) {
    addEventListener(type, (e) => {
      if (!on || !e.isTrusted || (type === 'pointermove' && !e.buttons)) return
      inputs.push([e.timeStamp, type])
      if (type === 'wheel') { wheel += Math.abs(e.deltaY); wheelNet += e.deltaY }
    }, { capture: true, passive: true })
  }
  const watched = new WeakSet()
  window.__perf = {
    start() { n = wheel = wheelNet = 0; tasks.length = inputs.length = marks.length = map.length = 0; on = true; requestAnimationFrame(tick) },
    mark(label) { marks.push([performance.now(), label]) },
    // The map's own move/zoom events: when the map actually reacted to an input. Registered one type at a
    // time, the only form MapLibre and the Cesium map accept.
    watchMap(m) {
      if (!m || watched.has(m)) return Boolean(m)
      watched.add(m)
      for (const type of ['move', 'zoom']) m.on(type, () => { if (on) map.push([performance.now(), type]) })
      return true
    },
    peek() { return { frames: n, inputs: inputs.length, map: map.length, wheel, wheelNet } },
    stop() {
      on = false
      return { origin: performance.timeOrigin, frames: Array.from(frames.subarray(0, n)), tasks, inputs, marks, map }
    },
  }
})()`

const quantile = (sorted, q) =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : null
const round = (x, digits = 1) => (x === null || x === undefined ? null : Number(x.toFixed(digits)))
const firstAtOrAfter = (list, t) => list.find((x) => x >= t)

/**
 * Numbers for one window of the series, between `from` and `to` (page clock, ms).
 * @param {object} raw - What `__perf.stop()` returned
 * @param {number} from - Window start
 * @param {number} to - Window end
 * @returns {object} Frame, stall, long-task and response statistics
 */
export function windowStats(raw, from, to) {
  const frames = raw.frames.filter((t) => t >= from && t <= to)
  const gaps = frames.slice(1).map((t, i) => t - frames[i])
  const sorted = [...gaps].sort((a, b) => a - b)
  const span = (to - from) / 1000
  const tasks = raw.tasks.filter(([start]) => start >= from && start <= to)
  // Each input's response: the first frame after the map's own move/zoom event that followed it,
  // within a second. An input the map never answered (a notch past the zoom limit) is counted apart
  // rather than paired with the next gesture's movement.
  const mapTimes = raw.map.filter(([t]) => t >= from).map(([t]) => t)
  const inputs = raw.inputs.filter(([t]) => t >= from && t <= to)
  const answered = inputs.map(([t]) => {
    const moved = firstAtOrAfter(mapTimes, t)
    const shown = moved === undefined || moved - t > 1000 ? undefined : firstAtOrAfter(frames, moved)
    return shown === undefined ? null : shown - t
  })
  const responses = answered.filter((x) => x !== null).sort((a, b) => a - b)
  return {
    seconds: round(span, 2),
    frames: frames.length,
    // Frames over wall time, not the mean of 1000/dt: one 500 ms freeze among sixty-frame seconds
    // counts as the half second it was, instead of one slow sample in a crowd of fast ones.
    fps: round(frames.length / span),
    frameP50: round(quantile(sorted, 0.5)),
    frameP95: round(quantile(sorted, 0.95)),
    frameP99: round(quantile(sorted, 0.99)),
    worstFrame: round(sorted.at(-1) ?? null),
    over50: gaps.filter((g) => g > 50).length,
    over100: gaps.filter((g) => g > 100).length,
    // Time lost to frames that took longer than 50 ms: what an operator feels as the map sticking.
    stalledMs: Math.round(gaps.filter((g) => g > 50).reduce((sum, g) => sum + g - 1000 / 60, 0)),
    longTasks: tasks.length,
    longTaskMs: Math.round(tasks.reduce((sum, [, d]) => sum + d, 0)),
    worstLongTask: round(Math.max(0, ...tasks.map(([, d]) => d))),
    inputs: inputs.length,
    unanswered: answered.filter((x) => x === null).length,
    responseP50: round(quantile(responses, 0.5)),
    responseP95: round(quantile(responses, 0.95)),
    worstResponse: round(responses.at(-1) ?? null),
  }
}

/**
 * Start the page's sampler. The runner calls this once per case, right before recording would start,
 * so a recorded run and an unrecorded one sample over the same stretch.
 * @param {object} page - Driver page
 */
export async function startSampling(page) {
  await page.eval('window.__perf.start()')
  page.perfWindows = []
}

/**
 * Measure what happens while `fn` runs: frames, stalls, long tasks and how fast the map answered input.
 * @param {object} page - Driver page
 * @param {string} label - Window name, shown in the report and on the video
 * @param {Function} fn - The gesture or wait to measure
 * @param {object} [options] - Options
 * @param {string} [options.map] - A map expression (`mapExpr(...)`) whose move/zoom events count as the response
 * @returns {Promise<{frames: number, inputs: number, map: number, wheel: number}>} What the page counted in the
 *   window (wheel is the total scroll in px), for the case to check that the gesture really reached the app
 */
export async function measure(page, label, fn, { map } = {}) {
  if (map && !(await page.eval(`window.__perf.watchMap(${map})`))) throw new Error('no map to watch for responses')
  const shotsBefore = page.recordedFrames()
  const before = await page.eval(`(window.__perf.mark(${JSON.stringify(`begin:${label}`)}), window.__perf.peek())`)
  await fn()
  const after = await page.eval(`(window.__perf.mark(${JSON.stringify(`end:${label}`)}), window.__perf.peek())`)
  page.perfWindows.push({ label, videoFrames: page.recordedFrames() - shotsBefore })
  const delta = (k) => after[k] - before[k]
  return { frames: delta('frames'), inputs: delta('inputs'), map: delta('map'), wheel: delta('wheel') }
}

// The GPU WebGL renders on: a build that fell back to software rendering is measuring the CPU, not the map.
const GPU = `(() => { const gl = document.createElement('canvas').getContext('webgl'); if (!gl) return 'no WebGL';
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  return gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) })()`

/**
 * Stop sampling and turn the series into one set of numbers per `measure` window.
 * @param {object} page - Driver page
 * @returns {Promise<{windows: object[], raw: object, env: object}>} Per-window statistics, the raw series, and the
 *   map library and GPU the numbers came from
 */
export async function finishSampling(page) {
  const raw = await page.eval('window.__perf.stop()')
  const env = { map: await mapLibrary(page, 'widget').catch(() => null), gpu: await page.eval(GPU).catch(() => null) }
  const at = (prefix, label) => raw.marks.find(([, l]) => l === `${prefix}:${label}`)?.[0]
  const windows = (page.perfWindows ?? []).map(({ label, videoFrames }) => {
    const stats = windowStats(raw, at('begin', label), at('end', label))
    return { label, ...stats, videoFps: page.bare || page.hdmi ? null : round(videoFrames / stats.seconds) }
  })
  return { windows, raw, env }
}

/**
 * Wheel notches at a fixed pace, the way a hand turns the wheel, as a gesture plan (see `page.gestures`): the app gets
 * the same input however slow it is, and has to queue it.
 * @param {{x: number, y: number}} at - Where the pointer sits
 * @param {number[]} notches - +1 zooms out, -1 zooms in, 0 is a beat with the hand still; one entry per beat
 * @param {object} [options] - Options
 * @param {number} [options.every] - ms between notches
 * @returns {{t: number, params: object}[]} The plan, starting at 0
 */
export const wheelPlan = (at, notches, { every = 40 } = {}) =>
  notches.flatMap((n, i) =>
    n ? [{ t: i * every, params: { type: 'mouseWheel', x: at.x, y: at.y, deltaX: 0, deltaY: n * 100 } }] : []
  )

/**
 * A left-button drag along a straight line at 60 moves a second, as a gesture plan.
 * @param {{x: number, y: number}} from - Where the drag starts
 * @param {{dx: number, dy: number}} by - How far it goes
 * @param {object} [options] - Options
 * @param {number} [options.duration] - ms from press to release
 * @returns {{t: number, params: object}[]} The plan, starting at 0
 */
export const dragPlan = (from, { dx, dy }, { duration = 700 } = {}) => {
  const steps = Math.round(duration / 16)
  const event = (t, type, x, y, buttons) => ({ t, params: { type, x, y, button: 'left', buttons, clickCount: 1 } })
  return [
    event(0, 'mousePressed', from.x, from.y, 1),
    ...Array.from({ length: steps }, (_, i) =>
      event((i + 1) * 16, 'mouseMoved', from.x + (dx * (i + 1)) / steps, from.y + (dy * (i + 1)) / steps, 1)
    ),
    event(steps * 16, 'mouseReleased', from.x + dx, from.y + dy, 0),
  ]
}

/**
 * Measure a window of input played as one gesture plan on the measured machine. The plan carries the window's marks,
 * so the window starts with the first input and ends `tail` ms after the last, whatever it took to start the player.
 * @param {object} page - Driver page
 * @param {string} label - Window name
 * @param {{x: number, y: number}} at - Where the pointer rests before the input starts
 * @param {{t: number, params: object}[]} steps - The input, from 0
 * @param {number} tail - ms the window stays open after the last input, for a slow app to catch up
 * @param {object} [options] - Options
 * @param {string} [options.map] - Expression of the map whose own events are counted
 * @returns {Promise<{frames: number, inputs: number, map: number, wheel: number, refused: number}>} Counts over the
 *   window, and how many inputs the browser refused (the harness failing to deliver, not the app dropping input)
 */
export async function measureGestures(page, label, at, steps, tail, { map } = {}) {
  if (map && !(await page.eval(`window.__perf.watchMap(${map})`))) throw new Error('no map to watch for responses')
  const shotsBefore = page.recordedFrames()
  const before = await page.eval('window.__perf.peek()')
  const end = Math.max(0, ...steps.map((step) => step.t)) + tail
  const { refused } = await page.gestures([
    { t: 0, params: { type: 'mouseMoved', x: at.x, y: at.y, button: 'none', buttons: 0 } },
    { t: 0, mark: `begin:${label}` },
    ...steps,
    { t: end, mark: `end:${label}` },
  ])
  const after = await page.eval('window.__perf.peek()')
  page.perfWindows.push({ label, videoFrames: page.recordedFrames() - shotsBefore })
  const delta = (k) => after[k] - before[k]
  return { frames: delta('frames'), inputs: delta('inputs'), map: delta('map'), wheel: delta('wheel'), refused }
}

/**
 * Several gesture plans one after another, each starting `gap` ms after the previous one ends.
 * @param {{t: number, params: object}[][]} plans - The plans, each from 0
 * @param {number} [gap] - ms between them
 * @returns {{t: number, params: object}[]} One plan
 */
export const inSequence = (plans, gap = 0) => {
  let offset = 0
  return plans.flatMap((plan) => {
    const shifted = plan.map((step) => ({ ...step, t: step.t + offset }))
    offset += Math.max(0, ...plan.map((step) => step.t)) + gap
    return shifted
  })
}

// A flick of the wheel is six notches 40 ms apart; one flick in, a beat, one flick out, a beat.
export const ZOOM_FLICKS = [-1, -1, -1, -1, -1, -1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0]
const PANS = [
  { dx: 300, dy: 0 },
  { dx: 0, dy: -200 },
  { dx: -300, dy: 0 },
  { dx: 0, dy: 200 },
]

/**
 * Centre the Map widget on the boat at zoom 16, off camera, so every build starts from the same view.
 * @param {object} page - Driver page
 * @param {object} vehicle - Vehicle helpers
 * @returns {Promise<void>}
 */
export async function prepareMap(page, vehicle) {
  await settle(page)
  // A boat driven by the previous case keeps gliding after the disarm, and the map following it would move "at rest".
  const still = await vehicle.waitFor('VFR_HUD', (m) => m.groundspeed < 0.1, 90000)
  if (!still) console.log('   the boat was still moving after 90 s; the map may move while measured')
  await setMapView(page, 'widget', await vehicle.position(), 16)
  await sleep(2000)
}

/**
 * The standard map workout, each part measured on its own: 15 s at rest, three wheel flicks in and
 * out, four drag pans. Checks that every gesture reached the app and the map answered it.
 * @param {object} page - Driver page
 * @returns {Promise<void>}
 */
export async function mapWorkout(page) {
  const map = mapExpr('widget')
  const at = await mapPoint(page, 'widget', 0.35, 0.6)

  await page.caption('Map at rest for 15 s')
  const idle = await measure(page, 'idle', () => page.wait(15000), { map })
  await page.check('Frames were counted at rest', () => ({ ok: idle.frames > 0, detail: `${idle.frames} frames` }))

  await page.caption('Wheel: three flicks in and out, notches 40 ms apart')
  const zoomStart = (await mapView(page, 'widget')).zoom
  const wheelSoFar = () => page.eval('window.__perf.peek()')
  const before = await wheelSoFar()
  const zoom = await measureGestures(
    page,
    'wheel zoom',
    at,
    wheelPlan(at, [...ZOOM_FLICKS, ...ZOOM_FLICKS, ...ZOOM_FLICKS]),
    1500,
    {
      map,
    }
  )
  const failed = zoom.refused
  const scroll = 3 * ZOOM_FLICKS.filter(Boolean).length * 100
  const net = 3 * ZOOM_FLICKS.reduce((sum, n) => sum + n * 100, 0)
  // A frozen page handles queued wheel events late, after the window has closed; give them time to land.
  await page
    .waitFor(async () => (await wheelSoFar()).wheel - before.wheel >= scroll, { timeout: 3000 })
    .catch(() => false)
  const after = await wheelSoFar()
  const arrived = after.wheel - before.wheel
  const arrivedNet = after.wheelNet - before.wheelNet
  await page.check('Every wheel notch was delivered to the browser', () => ({
    ok: failed === 0,
    detail: failed ? `${failed} refused` : 'none refused',
  }))
  // A net that differs from what was sent is scroll lost on the way to the app. Travel short of what was
  // sent, with the net intact, is notches in opposite directions merged while the page was frozen.
  await page.check('The scrolling that reached the app adds up to what was sent', () => ({
    ok: arrivedNet === net && arrived <= scroll,
    detail: `net ${arrivedNet}/${net} px; ${scroll - arrived} px of in-and-out merged by a frozen page`,
  }))
  await page.check('The map zoomed', () => ({
    ok: zoom.map > 0,
    detail: `${zoom.map} map moves, started at z${zoomStart}`,
  }))

  await page.caption('Pan: four drags, 300 px each')
  const pan = await measureGestures(
    page,
    'drag pan',
    at,
    inSequence(
      PANS.map((by) => dragPlan(at, by)),
      400
    ),
    1000,
    {
      map,
    }
  )
  await page.check('The map panned with the drags', () => ({ ok: pan.map > 0, detail: `${pan.map} map moves` }))
}

/**
 * A lawnmower of `count` waypoints centred on `centre`: legs of 20 points 30 m apart, 40 m between legs.
 * @param {{lat: number, lon: number}} centre - Where the survey is centred
 * @param {number} count - Number of waypoints
 * @returns {{lat: number, lon: number}[]} The waypoints in order
 */
export function lawnmower(centre, count) {
  const perLeg = 20
  const legs = Math.ceil(count / perLeg)
  const mPerLon = 111320 * Math.cos((centre.lat * Math.PI) / 180)
  return Array.from({ length: count }, (_, i) => {
    const leg = Math.floor(i / perLeg)
    const along = leg % 2 ? perLeg - 1 - (i % perLeg) : i % perLeg
    return {
      lat: centre.lat + ((leg - (legs - 1) / 2) * 40) / 111320,
      lon: centre.lon + ((along - (perLeg - 1) / 2) * 30) / mPerLon,
    }
  })
}

/**
 * How much of a mission the Map widget is drawing: the longest line's points, and the waypoint
 * markers it put in the page (each one a DOM element, which is what a large survey costs), plus the waypoints a build
 * draws with the map itself. Lines are only read on Leaflet, so cases check the markers.
 * @param {object} page - Driver page
 * @returns {Promise<{points: number, markers: number}>} Line points and marker elements
 */
export async function missionOnMap(page) {
  const lines = await mapPolylines(page, 'widget')
  const markers = await page.count('.waypoint-marker-icon')
  return { points: Math.max(0, ...lines.map((l) => l.length)), markers: markers + (await drawnWaypoints(page)) }
}

// Waypoints a build draws with the map itself instead of DOM markers: Leaflet canvas dots, the MapLibre waypoint source,
// or the Cesium waypoint vector layer.
const drawnWaypoints = (page) =>
  page.eval(`(() => { const m = ${mapExpr('widget')}; if (!m) return 0
    if (typeof m.getStyle === 'function') return m.getSource('mission::waypoints')?.serialize?.().data?.features?.length ?? 0
    if (typeof m.eachLayer === 'function') { let n = 0; m.eachLayer((l) => { if (l.options?.className === 'cockpit-waypoint-dot') n++ }); return n }
    return m.vectors?.get('mission::waypoint-markers')?.features?.length ?? 0 })()`)
