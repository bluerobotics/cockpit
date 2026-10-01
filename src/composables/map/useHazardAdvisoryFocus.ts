import L, { type Map as LeafletMap } from 'leaflet'
import { type ShallowRef, onBeforeUnmount } from 'vue'

import { fitMapToWaypoints } from '@/libs/map/utils-map'
import type { HazardArea } from '@/types/hazards'
import type { WaypointCoordinates } from '@/types/mission'

const HIGHLIGHT_DURATION_MS = 5000
const HIGHLIGHT_COLOR = '#FF8800'

/**
 * Brings one hazard advisory into view on a map.
 */
export interface UseHazardAdvisoryFocusReturn {
  /**
   * Fits the map to an advisory's area and waypoints, and rings them for a few seconds.
   */
  focusAdvisory: (area: HazardArea | undefined, waypoints: WaypointCoordinates[]) => void
}

/**
 * Lets the advisory list point at what each finding is about: the map is fitted to the area and the
 * waypoints involved, which are ringed briefly so they stand out among the rest of the mission.
 * @param {ShallowRef<LeafletMap | undefined>} map Map to focus.
 * @returns {UseHazardAdvisoryFocusReturn} The focus action.
 */
export const useHazardAdvisoryFocus = (map: ShallowRef<LeafletMap | undefined>): UseHazardAdvisoryFocusReturn => {
  let highlight: L.LayerGroup | undefined
  let clearTimer: ReturnType<typeof setTimeout> | undefined

  const clearHighlight = (): void => {
    clearTimeout(clearTimer)
    highlight?.remove()
    highlight = undefined
  }

  const focusAdvisory = (area: HazardArea | undefined, waypoints: WaypointCoordinates[]): void => {
    clearHighlight()
    const instance = map.value
    if (!instance || !fitMapToWaypoints(instance, [...(area?.coordinates ?? []), ...waypoints], { maxZoom: 17 })) return

    const group = L.layerGroup()
    const outline = { color: HIGHLIGHT_COLOR, weight: 3, opacity: 1, interactive: false }
    if (area?.kind === 'polygon') L.polygon(area.coordinates, { ...outline, fill: false }).addTo(group)
    if (area?.kind === 'line') L.polyline(area.coordinates, outline).addTo(group)
    waypoints.forEach((coordinates) =>
      L.circleMarker(coordinates, { ...outline, radius: 16, fill: false }).addTo(group)
    )
    highlight = group.addTo(instance)
    clearTimer = setTimeout(clearHighlight, HIGHLIGHT_DURATION_MS)
  }

  onBeforeUnmount(clearHighlight)

  return { focusAdvisory }
}
