// Base station steps: placing it from the map menu, its configuration panel, and reading back the
// coverage it draws.

import { chooseOption, dismissTutorial, mapExpr } from './cockpit.mjs'
import { dismissFeaturesDialog } from './extensions.mjs'

// Mirrors DEFAULT_BASE_STATION_CONFIG (src/types/baseStation.ts); written whole because a partial
// value synced in after startup skips Cockpit's merge with the defaults.
export const BASE_STATION_DEFAULT = {
  enabled: false,
  name: '',
  position: null,
  commsType: 'Radio link',
  radioBaseStationKind: 'Blue Robotics BaseStation',
  antenna: { type: 'Omnidirectional', gain: 7, beamwidth: 360, range: 250, bearing: 0 },
  baseStationAntennaHeightMeters: 1,
  vehicleHasBlueBoatAntennaMast: false,
  tetherLengthMeters: 150,
  txPowerMilliwatts: 1000,
  mobileCoverage: {
    provider: 'OpenCellID',
    openCellIdOperator: '',
    customTileUrl: '',
    osmOperator: '',
    displayMode: 'Heatmap',
    overlayOpacity: 0.3,
    showRingLabels: true,
    heatmapIntensity: 0.5,
  },
  coverageColor: '#3B82F6',
  coverageOpacity: 1,
  showSignalOnMap: true,
}

/**
 * The base station config as synced to the vehicle for `user`.
 * @param {object} vehicle - Vehicle helpers
 * @param {string} user - Cockpit user
 * @returns {Promise<object|undefined>} Config
 */
export const syncedBaseStation = (vehicle, user) => vehicle.getSyncedSetting(user, 'cockpit-base-station-config')

/**
 * The outer radius, in metres, of the radio coverage drawn on a map: the largest non-interactive circle.
 * @param {object} page - Driver page
 * @param {string} which - 'planning', 'widget' or a map container id
 * @returns {Promise<number|null>} Radius, or null when no coverage is drawn
 */
export const coverageRadius = (page, which) =>
  page.eval(`(() => {
    const radii = Object.values(${mapExpr(which)}?._layers ?? {})
      .filter((l) => typeof l.getRadius === 'function' && l.options.interactive === false)
      .map((l) => l.getRadius())
    return radii.length ? Math.max(...radii) : null })()`)

/**
 * The base station marker's viewport centre, or null when it is not on the map.
 * @param {object} page - Driver page
 * @returns {Promise<{x: number, y: number}|null>} Viewport point
 */
export const baseStationMarker = (page) =>
  page.eval(`(() => { const el = [...document.querySelectorAll('.base-station-marker-icon')].find((e) => e.checkVisibility({ visibilityProperty: true }))
    const r = el?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null })()`)

/**
 * Right-click the map and "Set base station here".
 * @param {object} page - Driver page
 * @param {{x: number, y: number}} at - Viewport point
 */
export async function placeBaseStation(page, at) {
  // Standalone can bring up the welcome tour or the extension features dialog a while after it starts, over the map.
  await dismissFeaturesDialog(page, 1000)
  await dismissTutorial(page, 3000)
  await page.rightClick(at, { settle: 900 })
  await page.click('text=Set base station here', { settle: 1200 })
}

/**
 * Open the configuration panel from the marker's right-click popup.
 * @param {object} page - Driver page
 */
export async function openBaseStationPanel(page) {
  const marker = await baseStationMarker(page)
  if (!marker) throw new Error('no base station marker on the map')
  await page.rightClick(marker, { settle: 800 })
  await page.click('[aria-label="Configure base station"]', { settle: 1200 })
}

// JS expression for the visible panel row whose label starts with `label`.
const panelRow = (
  label
) => `[...document.querySelectorAll('.config-row')].find((r) => r.checkVisibility({ visibilityProperty: true })
  && r.querySelector('.config-label')?.textContent.trim().startsWith(${JSON.stringify(label)}))`

/**
 * Viewport centre of the panel control in the row labelled `label`.
 * @param {object} page - Driver page
 * @param {string} label - Row label as shown, matched by prefix
 * @param {string} [control] - Selector for the control inside the row
 * @returns {Promise<{x: number, y: number}>} Viewport point
 */
export async function panelControl(page, label, control = 'input, select') {
  const p = await page.eval(`(() => {
    const row = ${panelRow(label)}
    const el = row?.querySelector(${JSON.stringify(control)}); if (!el) return null
    el.scrollIntoView({ block: 'nearest' }); const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (!p) throw new Error(`no base station panel row "${label}"`)
  return p
}

/**
 * Choose `value` in the panel's select labelled `label`.
 * @param {object} page - Driver page
 * @param {string} label - Row label as shown, matched by prefix
 * @param {string} value - Option value
 */
export async function chooseInPanel(page, label, value) {
  await page.caption(`${label}: ${value}`)
  await chooseOption(page, `${panelRow(label)}?.querySelector('select')`, value)
}
