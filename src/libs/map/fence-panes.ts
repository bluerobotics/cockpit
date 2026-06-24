import L from 'leaflet'

/**
 * Leaflet pane holding every geofence marker, both the committed handles and
 * the ones drawn while a fence is in progress.
 *
 * They are kept out of `markerPane` so the planning view's fence-mode dimming
 * can fade that pane wholesale without fading the fence being edited. A class
 * on each marker would not be enough: Leaflet hangs a `circleMarker`'s renderer
 * `<svg>` on the pane and puts the class on the inner `<path>`, one level too
 * deep for a direct-child selector.
 */
export const FENCE_MARKER_PANE = 'fenceMarkerPane'

/**
 * Class marking an SVG path as fence geometry, so the same dimming rule spares
 * committed fences and in-progress drawings alike.
 */
export const FENCE_PATH_CLASS = 'fence-path'

/**
 * Creates {@link FENCE_MARKER_PANE} on the given map if it is not there yet.
 * Leaflet's `createPane` does not check for an existing pane, so calling it
 * twice would orphan the markers already in the first one.
 * @param { L.Map } map The Leaflet map to create the pane on.
 */
export const ensureFenceMarkerPane = (map: L.Map): void => {
  if (map.getPane(FENCE_MARKER_PANE)) return
  map.createPane(FENCE_MARKER_PANE).style.zIndex = '610'
}
