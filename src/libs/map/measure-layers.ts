import L, { type Map as LeafletMap } from 'leaflet'

import type { WaypointCoordinates } from '@/types/mission'

const MEASURE_PANE = 'measureToolPane'
/** Marks a readout on the map that a ruler's readout opens clear of. */
export const MAP_TAG_CLASS = 'map-tag'
/** BlueBoat hull colors the measurements can be drawn in. */
export type MeasureColorScheme = 'blue' | 'garibaldi-orange' | 'axolotl-pink' | 'moray-green'
/** Hull color each scheme draws its measurements in. */
export const MEASURE_SCHEME_COLORS: Record<MeasureColorScheme, string> = {
  'blue': '#2c5cc4',
  'garibaldi-orange': '#ec882c',
  'axolotl-pink': '#ce40a4',
  'moray-green': '#9cc83a',
}
const FLOATING_LINE_CLASS = 'drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]'
/** A press that travels farther than this, in pixels, before it lifts was a pan, not a point. */
export const CLICK_SLOP_PX = 6

/**
 * Creates the pane the measurement readouts draw on, once per map.
 * @param {LeafletMap} map The map to create it on.
 * @returns {string} The pane's name.
 */
export const ensureMeasurePane = (map: LeafletMap): string => {
  if (map.getPane(MEASURE_PANE)) return MEASURE_PANE
  const pane = map.createPane(MEASURE_PANE)
  pane.style.zIndex = '655'
  pane.style.pointerEvents = 'none'
  return MEASURE_PANE
}

/**
 * A measurement line, lifted off the map by a slight shadow.
 * @param {WaypointCoordinates[]} points The line's points, in order.
 * @param {L.PolylineOptions} style Its stroke.
 * @returns {L.Polyline} The line, not yet on a map.
 */
export const measureLine = (points: WaypointCoordinates[], style: L.PolylineOptions): L.Polyline =>
  L.polyline(points, { ...style, className: FLOATING_LINE_CLASS })

/**
 * A text-only readout pinned to the map, one line per entry, built without HTML so labels from POIs and hazards
 * render as text.
 * @param {L.LatLngExpression} at Where it is pinned.
 * @param {string[]} lines Its lines, top to bottom.
 * @param {string} className Pill style, `measure-angle-pill` centered on the point or `live-measure-pill` beside it.
 * @returns {L.Marker} The readout, not yet on a map.
 */
export const measurePill = (at: L.LatLngExpression, lines: string[], className: string): L.Marker => {
  const element = document.createElement('div')
  element.className = className
  lines.forEach((line, index) => {
    if (index > 0) element.append(document.createElement('br'))
    element.append(line)
  })
  const icon = L.divIcon({ html: element, className: 'live-measure-tag', iconSize: [0, 0], iconAnchor: [0, 0] })
  return L.marker(at, { icon, interactive: false, keyboard: false, pane: MEASURE_PANE })
}

/**
 * The red trash button the survey polygon's corners show on hover, hidden until {@link showDeleteOnHover} reveals it.
 * @param {string} label What pressing it removes, read by screen readers and shown on hover.
 * @returns {string} Its markup, for a marker's icon.
 */
export const deleteButtonHtml = (label: string): string => `
  <div class="delete-popup" style="display: none;">
    <button type="button" class="delete-button" aria-label="${label}" title="${label}">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 4h12M4 4v10a2 2 0 002 2h4a2 2 0 002-2V4M6 4V2h4v2"
              stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>`

export const setDeleteShown = (marker: L.Marker, shown: boolean): void => {
  const popup = marker.getElement()?.querySelector<HTMLElement>('.delete-popup')
  if (popup) popup.style.display = shown ? 'block' : 'none'
}

/**
 * Shows a marker's {@link deleteButtonHtml} while the pointer is over it, skipping the hover a marker gets when it is
 * placed right under the pointer.
 * @param {L.Marker} marker The marker.
 * @returns {L.Marker} The same marker.
 */
export const showDeleteOnHover = (marker: L.Marker): L.Marker => {
  let justCreated = true
  return marker
    .on('mouseover', () => {
      if (!justCreated) setDeleteShown(marker, true)
      justCreated = false
    })
    .on('mouseout dragstart', () => {
      justCreated = false
      setDeleteShown(marker, false)
    })
}

/**
 * Whether a marker click landed on its {@link deleteButtonHtml}.
 * @param {L.LeafletMouseEvent} event The marker's click.
 * @returns {boolean} True for the trash button.
 */
export const clickedDelete = (event: L.LeafletMouseEvent): boolean =>
  !!(event.originalEvent.target as Element | null)?.closest('.delete-popup')

/**
 * Whether a pointer event landed on the map itself, rather than on a control or panel the map hosts.
 * @param {LeafletMap} map The map.
 * @param {Event} event The pointer event.
 * @returns {boolean} True for the map's background, tiles, and layers.
 */
export const isOnMap = (map: LeafletMap, event: Event): boolean => {
  const target = event.target as HTMLElement | null
  return target === map.getContainer() || !!target?.closest('.leaflet-map-pane')
}

/**
 * Halfway between two points, where a segment's readout sits.
 * @param {WaypointCoordinates} from One end.
 * @param {WaypointCoordinates} to The other end.
 * @returns {L.LatLng} The point halfway between them.
 */
export const midpoint = (from: WaypointCoordinates, to: WaypointCoordinates): L.LatLng =>
  L.latLng((from[0] + to[0]) / 2, (from[1] + to[1]) / 2)
