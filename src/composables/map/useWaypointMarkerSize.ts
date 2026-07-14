import { watch } from 'vue'

import { useMissionStore } from '@/stores/mission'
import type { MarkerSizes } from '@/types/mission'

const getMarkerSizeFromZoom = (zoomLevel: number): MarkerSizes => {
  if (zoomLevel <= 17) return 'xs'
  if (zoomLevel > 17 && zoomLevel <= 19) return 'sm'
  return 'md'
}

/**
 * Return type of {@link useWaypointMarkerSize}.
 */
export interface UseWaypointMarkerSizeReturn {
  /** Resolves the effective marker size for a zoom level, forcing full size when numbers are always shown. */
  getEffectiveMarkerSize: (zoomLevel: number) => MarkerSizes
}

/**
 * Shared waypoint-marker sizing for the map widget and the mission-planning view. The effective size honors the
 * user's always-show-numbers toggle, and flipping that toggle re-renders the caller's markers.
 * @param {() => void} refreshMarkers - Re-renders the caller's waypoint markers when the toggle changes.
 * @returns {UseWaypointMarkerSizeReturn} Resolver for the effective marker size.
 */
export const useWaypointMarkerSize = (refreshMarkers: () => void): UseWaypointMarkerSizeReturn => {
  const missionStore = useMissionStore()

  // Forces the full-size numbered marker when the user opts to always show waypoint numbers, regardless of zoom.
  const getEffectiveMarkerSize = (zoomLevel: number): MarkerSizes =>
    missionStore.alwaysShowWaypointNumbers ? 'md' : getMarkerSizeFromZoom(zoomLevel)

  watch(() => missionStore.alwaysShowWaypointNumbers, refreshMarkers)

  return { getEffectiveMarkerSize }
}
