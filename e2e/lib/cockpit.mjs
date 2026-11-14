// Cockpit-specific steps shared by the cases: opening the app on a clean test user, finding things
// on the Leaflet maps, and reading mission state back for checks.

import { sleep } from './driver.mjs'

/** Cockpit user the tests run as, so the operators' own synced settings on the vehicle are never touched. */
export const TEST_USER = 'release-tests'

/**
 * localStorage entries for a fresh profile.
 * @param {string} vehicleHost - Vehicle (BlueOS) address
 * @returns {Record<string, string>} Entries to seed
 */
export const seedFor = (vehicleHost) => ({
  'cockpit-vehicle-address': vehicleHost,
  'cockpit-username': TEST_USER,
  'cockpit-last-connected-user': TEST_USER,
  'cockpit-show-splash-screen-on-startup': 'false',
  // Read once at mount, before the vehicle's copy arrives, to decide whether the tour opens; the vehicle's still wins after.
  'cockpit-has-seen-tutorial': 'true',
})

// Collects every Leaflet map as it is created, so checks can convert coordinates and read centre
// and zoom. Read-only: interaction still goes through real mouse events.
export const MAP_HOOK = `(() => {
  let real
  Object.defineProperty(window, 'L', { configurable: true, get() { return real }, set(v) {
    real = v
    try { v.Map.addInitHook(function () { (window.__e2eMaps ||= []).push(this) }) } catch {}
  } })
  // MapLibre and Cesium builds bundle their map library with no global, so their maps are found through the
  // map context each map view provides to its Vue children (Leaflet builds have it too).
  const contextMaps = () => {
    const out = []
    const seen = new Set()
    const walk = (vnode) => {
      if (!vnode || typeof vnode !== 'object') return
      const c = vnode.component
      if (c && !seen.has(c)) {
        seen.add(c)
        for (const key of Object.getOwnPropertySymbols(c.provides || {})) {
          if (key.description === 'CockpitMapContext' && c.provides[key]?.map?.value) out.push(c.provides[key].map.value)
        }
        walk(c.subTree)
      }
      if (vnode.suspense) walk(vnode.suspense.activeBranch)
      if (Array.isArray(vnode.children)) vnode.children.forEach(walk)
    }
    walk(document.querySelector('#app')?._vnode)
    return out
  }
  window.__e2eFindMap = (match) => {
    const cached = (window.__e2eMaps || []).filter(match).at(-1)
    if (cached) return cached
    window.__e2eMaps = [...new Set([...(window.__e2eMaps || []), ...contextMaps()])]
    return window.__e2eMaps.filter(match).at(-1)
  }
})()`

const MAPS = {
  planning: `(m) => m.getContainer().id === 'planningMap' && m.getContainer().checkVisibility({ visibilityProperty: true })`,
  widget: `(m) => m.getContainer().id.startsWith('map-') && m.getContainer().checkVisibility({ visibilityProperty: true })`,
}
// `which` is 'planning', 'widget' (the last visible Map widget), or a map container id.
export const mapExpr = (which) =>
  `window.__e2eFindMap(${MAPS[which] ?? `(m) => m.getContainer().id === ${JSON.stringify(which)}`})`

// Centre and zoom read the same on every map library: zoom on Leaflet's 256-pixel tile scale, which the
// Cesium build keeps and MapLibre (512-pixel tiles) runs one level below.
const VIEW_OF = `(m) => { const c = m.getCenter(); const maplibre = typeof m.getStyle === 'function';
  return { lat: Array.isArray(c) ? c[0] : c.lat, lon: Array.isArray(c) ? c[1] : c.lng, zoom: m.getZoom() + (maplibre ? 1 : 0) } }`

/**
 * Which map library a map belongs to.
 * @param {object} page - Driver page
 * @param {string} which - 'planning', 'widget' or a map container id
 * @returns {Promise<'leaflet'|'maplibre'|'cesium'|null>} The library, or null without that map
 */
export const mapLibrary = (page, which) =>
  page.eval(`(() => { const m = ${mapExpr(which)}; if (!m) return null;
    return typeof m.getStyle === 'function' ? 'maplibre' : typeof m.eachLayer === 'function' ? 'leaflet' : 'cesium' })()`)

/**
 * Move a map straight to a centre and zoom, without animation, for setting up a scene off camera.
 * @param {object} page - Driver page
 * @param {string} which - 'planning', 'widget' or a map container id
 * @param {{lat: number, lon: number}} centre - Where to centre
 * @param {number} zoom - Zoom on Leaflet's tile scale
 * @returns {Promise<void>}
 */
export async function setMapView(page, which, { lat, lon }, zoom) {
  await page.eval(`(() => { const m = ${mapExpr(which)};
    if (typeof m.getStyle === 'function') m.jumpTo({ center: [${lon}, ${lat}], zoom: ${zoom - 1} });
    else if (typeof m.setView === 'function') m.setView([${lat}, ${lon}], ${zoom}, { animate: false });
    else m.jumpTo([${lat}, ${lon}], ${zoom}) })()`)
}

/**
 * Page coordinates of a lat/lon on one of the maps.
 * @param {object} page - Driver page
 * @param {string} which - 'planning', 'widget' or a map container id
 * @param {{lat: number, lon: number}} at - Position
 * @returns {Promise<{x: number, y: number}>} Viewport point
 */
export async function geoToPage(page, which, { lat, lon }) {
  const map = mapExpr(which)
  const p = await page.eval(`(() => { const m = ${map}; if (!m) return null;
    const pt = m.latLngToContainerPoint([${lat}, ${lon}]); const r = m.getContainer().getBoundingClientRect();
    return { x: r.x + pt.x, y: r.y + pt.y } })()`)
  if (!p) throw new Error(`no ${which} map on screen`)
  return p
}

/**
 * Lat/lon under a viewport point on one of the maps.
 * @param {object} page - Driver page
 * @param {string} which - 'planning', 'widget' or a map container id
 * @param {{x: number, y: number}} at - Viewport point
 * @returns {Promise<{lat: number, lon: number}>} Position
 */
export async function pageToGeo(page, which, { x, y }) {
  const map = mapExpr(which)
  return page.eval(`(() => { const m = ${map}; const r = m.getContainer().getBoundingClientRect();
    const ll = m.containerPointToLatLng([${x} - r.x, ${y} - r.y]); return { lat: ll.lat, lon: ll.lng } })()`)
}

/**
 * Centre, zoom and on-screen box of a map.
 * @param {object} page - Driver page
 * @param {string} which - 'planning', 'widget' or a map container id
 * @returns {Promise<{lat: number, lon: number, zoom: number, box: object}|null>} The view, or null without that map
 */
export async function mapView(page, which) {
  const map = mapExpr(which)
  return page.eval(`(() => { const m = ${map}; if (!m) return null;
    const r = m.getContainer().getBoundingClientRect();
    return { ...(${VIEW_OF})(m), box: { x: r.x, y: r.y, w: r.width, h: r.height } } })()`)
}

/**
 * Viewport point at a fraction of the map box.
 * @param {object} page - Driver page
 * @param {string} which - 'planning', 'widget' or a map container id
 * @param {number} fx - Horizontal fraction, 0 (left) to 1 (right)
 * @param {number} fy - Vertical fraction, 0 (top) to 1 (bottom)
 * @returns {Promise<{x: number, y: number}>} Viewport point
 */
export async function mapPoint(page, which, fx, fy) {
  const { box } = await mapView(page, which)
  return { x: box.x + box.w * fx, y: box.y + box.h * fy }
}

/**
 * Zoom with the mouse wheel over the map until it reaches `zoom`, like a person would.
 * @param {object} page - Driver page
 * @param {string} which - 'planning', 'widget' or a map container id
 * @param {number} zoom - Target Leaflet zoom level
 * @param {{x: number, y: number}} [at] - Where to scroll; the map centre by default
 */
export async function wheelZoom(page, which, zoom, at) {
  const target = at ?? (await mapPoint(page, which, 0.5, 0.5))
  await page.moveTo(target)
  for (let i = 0; i < 12; i++) {
    const { zoom: current } = await mapView(page, which)
    if (Math.abs(current - zoom) < 0.5) return
    const deltaY = current < zoom ? -120 : 120
    await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: target.x, y: target.y, deltaX: 0, deltaY })
    await sleep(450)
  }
}

/**
 * Viewport centre of the visible text field labelled `label`, inside the open dialog when there is one.
 * @param {object} page - Driver page
 * @param {string} label - Field label as shown
 * @returns {Promise<{x: number, y: number}>} Viewport point
 */
export async function fieldByLabel(page, label) {
  const wanted = JSON.stringify(label)
  const p = await page.eval(`(() => {
    const scope = [...document.querySelectorAll('.v-overlay--active')].at(-1) ?? document
    const field = [...scope.querySelectorAll('.v-field')]
      .find((f) => f.checkVisibility({ visibilityProperty: true }) && f.querySelector('label')?.textContent.trim().startsWith(${wanted}))
    // Data-lake expression fields (coordinates, heading) are Monaco editors under a legend.
    const expression = [...scope.querySelectorAll('fieldset.dl-expression-field')]
      .find((f) => f.checkVisibility({ visibilityProperty: true }) && f.querySelector('legend')?.textContent.trim().startsWith(${wanted}))
    const input = field?.querySelector('input, textarea') ?? expression?.querySelector('.monaco-editor .view-lines')
    if (!input) return null
    const r = input.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (!p) throw new Error(`no field labelled "${label}"`)
  return p
}

/**
 * POI markers on a map.
 * @param {object} page - Driver page
 * @param {string} which - 'planning', 'widget' or a map container id
 * @returns {Promise<Array<{lat: number, lon: number, x: number, y: number, onScreen: boolean, text: string}>>} Markers
 */
export function poiMarkers(page, which) {
  const map = mapExpr(which)
  return page.eval(`(() => { const m = ${map}; if (!m) return []; const out = [];
    const r = m.getContainer().getBoundingClientRect();
    m.eachLayer((l) => {
      const el = l.getElement?.()
      if (!el?.querySelector?.('.poi-marker-container')) return
      const ll = l.getLatLng(); const pt = m.latLngToContainerPoint(ll); const b = el.getBoundingClientRect()
      const grab = { x: b.x + b.width / 2, y: b.y + b.height / 2 }
      const onScreen = pt.x >= 0 && pt.y >= 0 && pt.x <= r.width && pt.y <= r.height
      out.push({ lat: ll.lat, lon: ll.lng, x: r.x + pt.x, y: r.y + pt.y, grab, onScreen, text: el.innerText.trim() }) })
    return out })()`)
}

/**
 * Place a point of interest through a map's context menu and the "Place Point of Interest" dialog.
 * @param {object} page - Driver page
 * @param {string} which - 'planning', 'widget' or a map container id
 * @param {{x: number, y: number}} at - Where to right-click
 * @param {string} name - Name typed into the dialog
 * @param {object} [options] - Options
 * @param {string|number} [options.heading] - Typed into "Heading (optional)": an angle or a {{ variable }} expression
 * @returns {Promise<{lat: number, lon: number}>} Where the map was right-clicked
 */
export async function placePoi(page, which, at, name, { heading } = {}) {
  const clicked = await pageToGeo(page, which, at)
  await page.rightClick(at, { settle: 900 })
  await page.click('text=Place point of interest', { settle: 1000 })
  await page.fill(await fieldByLabel(page, 'Name'), name)
  if (heading !== undefined) await page.fill(await fieldByLabel(page, 'Heading (optional)'), heading)
  await page.wait(400)
  await page.click('text=Save', { settle: 1200 })
  return clicked
}

/**
 * The POI marker sitting at a position on a map, if any.
 * @param {object} page - Driver page
 * @param {string} which - 'planning', 'widget' or a map container id
 * @param {{lat: number, lon: number}} near - Expected position
 * @param {number} [tolerance] - Degrees
 * @param {boolean} [onScreenOnly] - Ignore markers outside the visible map, so a check also proves the video shows it
 * @returns {Promise<object|undefined>} The marker
 */
export async function poiAt(page, which, near, tolerance = 1e-5, onScreenOnly = true) {
  const pois = await poiMarkers(page, which)
  const close = (p) => Math.abs(p.lat - near.lat) < tolerance && Math.abs(p.lon - near.lon) < tolerance
  return pois.find((p) => close(p) && (p.onScreen || !onScreenOnly))
}

// Navigation between the Flight view and Mission planning, through the buttons an operator uses.
export const toPlanning = async (page) => {
  await page.click('text=EDIT MISSION', { settle: 1500 })
  await page.waitFor(() => mapView(page, 'planning'), { label: 'the planning map' })
  await sleep(1000)
}
export const toFlight = async (page) => {
  await page.click('text=FLIGHT MODE', { settle: 1500 })
  await page.waitFor(() => mapView(page, 'widget'), { label: 'the Map widget' })
  await sleep(1000)
}

/**
 * Polylines (not polygons) drawn on a map.
 * @param {object} page - Driver page
 * @param {string} which - 'planning', 'widget' or a map container id
 * @returns {Promise<Array<Array<{lat: number, lon: number}>>>} One array of points per line
 */
export function mapPolylines(page, which) {
  const map = mapExpr(which)
  // Duck-typed: the app and its plugins load separate Leaflet copies, so instanceof is unreliable.
  return page.eval(`(() => { const m = ${map}; if (!m?.eachLayer) return []; const out = [];
    m.eachLayer((l) => { if (!l.getLatLngs || l.options?.fill) return; const ll = l.getLatLngs();
      if (Array.isArray(ll[0]) || ll.length < 2) return; out.push(ll.map((p) => ({ lat: p.lat, lon: p.lng }))) })
    return out })()`)
}

// Visible waypoint markers on the planning map.
export const waypointMarkerCount = (page) =>
  page.eval(
    `[...document.querySelectorAll('#planningMap .waypoint-marker-icon')].filter((e) => e.checkVisibility({ visibilityProperty: true })).length`
  )

/**
 * Draw a simple path through the sidebar button, one click per waypoint.
 * @param {object} page - Driver page
 * @param {Array<[number, number]>} fractions - Click points as fractions of the planning map box
 * @param {object} [options] - Options
 * @param {Function} [options.onPoint] - Called after each click with its index
 * @returns {Promise<Array<{lat: number, lon: number}>>} Where each click landed on the map
 */
export async function drawSimplePath(page, fractions, { onPoint } = {}) {
  await page.click('button:has(.mdi-vector-polyline)', { settle: 700 })
  const clicked = []
  for (const [i, [fx, fy]] of fractions.entries()) {
    const at = await mapPoint(page, 'planning', fx, fy)
    clicked.push(await pageToGeo(page, 'planning', at))
    const count = (await missionState(page)).waypoints.length
    await page.click(at, { settle: 450 })
    // A marker under the click (the vehicle, a POI) takes it instead of the map; say so here rather
    // than as a wrong count three checks later.
    if ((await missionState(page)).waypoints.length !== count + 1)
      throw new Error(`path click ${i + 1} did not add a waypoint`)
    if (onPoint) await onPoint(i)
  }
  await page.click('text=END SIMPLE PATH', { settle: 800 })
  return clicked
}

export const near = (a, b, tolerance = 1e-5) =>
  Math.abs(a.lat - b.lat) < tolerance && Math.abs(a.lon - b.lon) < tolerance

// Mission planning state, as plain data.
export const missionState = (page) =>
  page.store(
    'mission',
    `({ waypoints: s.currentPlanningWaypoints.map((w) => ({ id: w.id, lat: w.coordinates[0], lon: w.coordinates[1], commands: w.commands })),
       surveys: s.currentPlanningSurveys.map((v) => ({ id: v.id, polygon: v.polygonCoordinates, spacing: v.distanceBetweenLines,
         angle: v.surveyLinesAngle, crosshatch: Boolean(v.crosshatch), waypointIds: (v.waypoints ?? []).map((w) => w.id) })),
       home: s.plannedHomePosition, cruiseSpeed: s.cruiseSpeed, plannedCruiseSpeed: s.plannedCruiseSpeed })`
  )

export const vehicleOnline = (page) => page.store('main-vehicle', 's.isVehicleOnline').catch(() => false)

// Set when Cockpit has finished syncing its settings with the vehicle it connected to.
const SYNC_HOOK = `addEventListener('vehicle-sync-complete', () => { window.__e2eSynced = true })`

/**
 * Load Cockpit on a route and get it to a quiet state: app mounted, vehicle online and its settings synced when the
 * case needs it, first-run tutorial closed.
 * @param {object} page - Driver page
 * @param {object} options - Options
 * @param {string} options.url - Cockpit base URL
 * @param {string} [options.route] - Hash route, e.g. '/mission-planning'
 * @param {boolean} [options.needsVehicle] - Wait for the vehicle to come online
 */
export async function openCockpit(page, { url, route = '/', needsVehicle = true }) {
  let hookMissed = false
  if (!page.mapHooked) {
    await page.addScript(MAP_HOOK)
    await page.addScript(SYNC_HOOK)
    page.mapHooked = true
    // Standalone is already running when the driver attaches, so its first document never got the hook.
    hookMissed = url.endsWith('.html')
  }
  // A Standalone build is a file URL ending in index.html; a web build is a server root.
  await page.goto(url.endsWith('.html') ? `${url}#${route}` : `${url.replace(/\/$/, '')}/#${route}`)
  if (hookMissed) await page.reload()
  const mounted = () => page.eval(`!!document.querySelector('#app')?.__vue_app__`)
  await page.waitFor(mounted, { label: 'Cockpit to mount', timeout: 30000 })
  if (needsVehicle) {
    await page.waitFor(() => vehicleOnline(page), { label: 'the vehicle to come online', timeout: 45000 })
    // Its first settings sync can still replace what a case does before it lands, like a downloaded mission.
    await page.waitFor(() => page.eval('window.__e2eSynced === true'), {
      label: "Cockpit's first sync with the vehicle",
      timeout: 45000,
    })
  }
  // The tour opens 6 s after start unless the user has seen it; the runner marks it seen, so the wait is
  // only for profiles where that has not arrived. A tour that opened anyway is still closed.
  const seen = await page.store('responsive', 's.userHasSeenTutorial').catch(() => false)
  if (await dismissTutorial(page, seen ? 0 : 9000)) console.log('   the welcome tour opened at start; closed it')
}

/**
 * Close the "Welcome to Cockpit!" tutorial if it shows up in time.
 * @param {object} page - Driver page
 * @param {number} [within] - How long to wait for it, in ms
 * @returns {Promise<boolean>} Whether it was there and got closed
 */
export async function dismissTutorial(page, within = 0) {
  const deadline = Date.now() + within
  do {
    const close = await page.eval(`(() => {
      const title = [...document.querySelectorAll('*')]
        .find((el) => el.childElementCount === 0 && el.textContent.trim() === 'Welcome to Cockpit!' && el.checkVisibility({ visibilityProperty: true }))
      // The nearest ancestor holding a close button is the tour's own dialog, whatever it is styled with.
      let card = title
      while (card && !card.querySelector('button .mdi-close')) card = card.parentElement
      const btn = card?.querySelector('button:has(.mdi-close)')
      if (!btn) return null
      const r = btn.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
    if (close) {
      // Have the app itself store "don't show again", so the tour stops opening in later runs. The toggle
      // reads "Show on startup" when the app already counts it as seen; going through it writes the
      // setting from this profile either way.
      if (await page.exists('text=Show on startup')) await page.click('text=Show on startup', { settle: 400 })
      if (await page.exists("text=Don't show again")) await page.click("text=Don't show again", { settle: 400 })
      await page.click(close, { settle: 600 })
      return true
    }
    await sleep(500)
  } while (Date.now() < deadline)
  return false
}

/**
 * The direction the first POI marker's heading tip points to, or null when it has no tip.
 * @param {object} page - Driver page
 * @param {string} which - 'planning', 'widget' or a map container id
 * @returns {Promise<number|null>} Degrees clockwise from north
 */
export async function poiHeading(page, which) {
  const map = mapExpr(which)
  const rotation = await page.eval(`(() => { const m = ${map}; let out = null
    m.eachLayer((l) => { const el = l.getElement?.(); const tip = el?.querySelector?.('.poi-marker-heading')
      if (out === null && tip) out = Number(tip.style.transform.match(/rotate\\(([-\\d.]+)deg\\)/)?.[1]) })
    return out })()`)
  // The tip is the corner of a teardrop pin whose corner sits at 225° before rotation (utils-poi.ts).
  return rotation === null ? null : (((rotation + 225) % 360) + 360) % 360
}

/**
 * Pick an option of a native select. The cursor goes to the select, but the option is set from
 * script: a native select's popup is drawn outside the page and never reaches the screencast.
 * @param {object} page - Driver page
 * @param {string} selectExpr - JS expression evaluating to the select element
 * @param {string} option - Option text or value
 */
export async function chooseOption(page, selectExpr, option) {
  const box =
    await page.eval(`(() => { const s = ${selectExpr}; if (!s) return null; s.scrollIntoView({ block: 'nearest' })
    const r = s.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (!box) throw new Error(`no select for "${option}"`)
  await page.hover(box, 500)
  const wanted = JSON.stringify(option)
  const ok = await page.eval(`(() => { const s = ${selectExpr}
    const o = [...s.options].find((o) => o.value === ${wanted} || o.text.trim() === ${wanted}); if (!o) return false
    // By index: options bound to objects all carry the value "[object Object]".
    s.selectedIndex = o.index; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true }))
    return true })()`)
  if (!ok) throw new Error(`no option "${option}"`)
  await page.wait(1000)
}
