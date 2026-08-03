import type { Ref } from 'vue'

import type { WaypointCoordinates } from '@/types/mission'

/**
 * Shared initial map centering for the map widget and the mission-planning view: while neither a home point nor the
 * vehicle is known, start the map where the operator is. A single fix is requested rather than a position watch, so a
 * moving topside never drags the map away from wherever the user panned to.
 * @param {Ref<WaypointCoordinates>} mapCenter - Map center to write the operator's location into.
 * @param {() => boolean} hasBetterCenter - Whether a home point or the vehicle position is already known.
 * @returns {void}
 */
export const useMapCenterFromUserLocation = (
  mapCenter: Ref<WaypointCoordinates>,
  hasBetterCenter: () => boolean
): void => {
  navigator?.geolocation?.getCurrentPosition(
    (position) => {
      if (hasBetterCenter()) return
      mapCenter.value = [position.coords.latitude, position.coords.longitude]
    },
    (error) => console.error(`Failed to get position: (${error.code}) ${error.message}`),
    { enableHighAccuracy: false, timeout: 5000, maximumAge: 0 }
  )
}
