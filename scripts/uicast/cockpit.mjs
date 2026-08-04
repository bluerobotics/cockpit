/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-env node */
// Shared setup for Cockpit demo scenarios: an app that boots straight into the thing being
// filmed, with no splash, tutorial or discovery dialog stealing the first ten seconds.

export const APP = process.env.COCKPIT_URL ?? 'http://localhost:5199'

// The stock vehicle address resolves to whatever BlueOS answers on the LAN, which would pull
// that vehicle's views, points of interest and telemetry into the recording. Point it at a dead
// host so every run starts from the same empty state.
const QUIET_STARTUP = `
  localStorage.setItem('cockpit-vehicle-address', '127.0.0.1:1')
  localStorage.setItem('cockpit-show-splash-screen-on-startup', 'false')
  localStorage.setItem('cockpit-has-seen-tutorial', 'true')
  localStorage.setItem('cockpit-show-mission-creation-tips', 'false')
  localStorage.setItem('cockpit-prevent-auto-vehicle-discovery-dialog', 'true')
`

// A Cockpit with no vehicle to sync from has no widgets at all — it boots to "You currently have
// no widgets!". Any demo of a widget therefore has to bring its own layout, so this seeds a
// profile holding a single full-screen map, which is the backdrop most Cockpit features need.
const MAP_ONLY_PROFILE = JSON.stringify({
  name: 'Demo',
  hash: '4f2c1a90-0000-4000-8000-000000000010',
  views: [
    {
      hash: '4f2c1a90-0000-4000-8000-000000000011',
      name: 'Map',
      showBottomBarOnBoot: false,
      visible: true,
      widgets: [
        {
          hash: '4f2c1a90-0000-4000-8000-000000000012',
          name: 'Map',
          component: 'Map',
          position: { x: 0, y: 0 },
          size: { width: 1, height: 1 },
          options: { showVehiclePath: true },
        },
      ],
      miniWidgetContainers: [
        { name: 'Bottom-left container', widgets: [] },
        { name: 'Bottom-center container', widgets: [] },
        { name: 'Bottom-right container', widgets: [] },
      ],
    },
  ],
})

/** Preload snippet for `boot` that puts a single full-screen map on the view. */
export const WITH_MAP = `localStorage.setItem('cockpit-views-group-v1', ${JSON.stringify(MAP_ONLY_PROFILE)})`

/**
 * Navigate to a Cockpit route with the startup overlays suppressed.
 * @param {object} page - Scenario page helpers from the recorder.
 * @param {string} [route] - Hash route to open, e.g. '/mission-planning'.
 * @param {string} [preload] - Extra JS to run in the page before the app boots.
 * @returns {Promise<void>}
 */
export const boot = async (page, route = '/', preload = '') => {
  // Semicolon-joined: a preload starting with '(' would otherwise be parsed as a call on the
  // last statement of QUIET_STARTUP, and the whole injected script would throw before running.
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `${QUIET_STARTUP};\n${preload};` })
  // Not page.goto: Cockpit holds subresources open, so the window load event never fires.
  await page.send('Page.navigate', { url: `${APP}/#${route}` })
  await page.waitFor('#menu-trigger', 90000)
  await page.wait(1500)
}

/**
 * Wait for a map view to be on screen and for its tiles to finish painting.
 * @param {object} page - Scenario page helpers from the recorder.
 * @returns {Promise<void>}
 */
export const waitForMap = async (page) => {
  await page.waitFor('.leaflet-container', 45000)
  await page.wait(3000)
}

/**
 * Centre point of an element, for helpers that take a viewport point rather than a selector.
 * @param {object} page - Scenario page helpers from the recorder.
 * @param {string} selector - CSS selector to measure.
 * @param {number} [dx] - Horizontal offset from the centre, in pixels.
 * @param {number} [dy] - Vertical offset from the centre, in pixels.
 * @returns {Promise<{x: number, y: number}>} The resulting viewport point.
 */
export const pointIn = async (page, selector, dx = 0, dy = 0) => {
  const box = await page.box(selector)
  return { x: Math.round(box.x + dx), y: Math.round(box.y + dy) }
}

/**
 * Right-click at a point or element, which the recorder's left-only click helper cannot do.
 * @param {object} page - Scenario page helpers from the recorder.
 * @param {object|string} target - Selector or {x, y} viewport point.
 * @param {number} [settle] - Milliseconds to wait after the release.
 * @returns {Promise<{x: number, y: number}>} The point that was clicked.
 */
export const rightClick = async (page, target, settle = 900) => {
  const at = await page.moveTo(target)
  await page.eval(`__uicast.click(${at.x}, ${at.y})`)
  const event = { x: at.x, y: at.y, button: 'right', clickCount: 1 }
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', buttons: 2, ...event })
  await page.wait(60)
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', buttons: 0, ...event })
  await page.wait(settle)
  return at
}

/**
 * Double-click a point. A pair of single clicks does not carry the clickCount the DOM needs.
 * @param {object} page - Scenario page helpers from the recorder.
 * @param {object|string} target - Selector or {x, y} viewport point.
 * @param {number} [settle] - Milliseconds to wait afterwards.
 * @returns {Promise<void>}
 */
export const doubleClick = async (page, target, settle = 1200) => {
  const at = await page.moveTo(target)
  await page.eval(`__uicast.click(${at.x}, ${at.y})`)
  for (const clickCount of [1, 2]) {
    const event = { x: at.x, y: at.y, button: 'left', clickCount }
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', buttons: 1, ...event })
    await page.wait(40)
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', buttons: 0, ...event })
    await page.wait(60)
  }
  await page.wait(settle)
}

/**
 * Type into the focused element one character at a time, so the video shows real typing.
 * @param {object} page - Scenario page helpers from the recorder.
 * @param {string} text - Text to type.
 * @param {number} [perChar] - Milliseconds between keystrokes.
 * @returns {Promise<void>}
 */
export const type = async (page, text, perChar = 55) => {
  for (const char of text) {
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', text: char })
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', text: char })
    await page.wait(perChar)
  }
}

/**
 * Point of a Vuetify field identified by its floating label. Cockpit renders selects and inputs
 * outside the open dialog too, so positional lookups grab the wrong element.
 * @param {object} page - Scenario page helpers from the recorder.
 * @param {string} container - Wrapper selector, e.g. '.v-select' or '.v-text-field'.
 * @param {string} label - Exact label text of the wanted field.
 * @returns {Promise<{x: number, y: number}|null>} The field centre, or null when it is absent.
 */
export const fieldLabelled = (page, container, label) =>
  page.eval(`(() => {
    const el = [...document.querySelectorAll(${JSON.stringify(container)})]
      .find((c) => c.querySelector('label')?.textContent.trim() === ${JSON.stringify(label)})
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)

/**
 * Open a Vuetify select and pick an option by its text. Options render into a detached overlay,
 * so they cannot be reached from the select element itself.
 * @param {object} page - Scenario page helpers from the recorder.
 * @param {string} label - Label of the select to open.
 * @param {string} optionText - Text (or a substring) of the option to choose.
 * @returns {Promise<void>}
 */
export const chooseFromSelect = async (page, label, optionText) => {
  const select = await fieldLabelled(page, '.v-select', label)
  if (!select) throw new Error(`no select labelled ${label}`)
  await page.click(select, { settle: 800 })

  const option = await page.eval(`(() => {
    const el = [...document.querySelectorAll('.v-overlay .v-list-item')]
      .find((i) => i.textContent.includes(${JSON.stringify(optionText)}))
    if (!el) return null
    el.scrollIntoView({ block: 'center' })
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (!option) throw new Error(`option ${optionText} was not offered by the ${label} select`)
  await page.click(option, { settle: 1000 })
}
