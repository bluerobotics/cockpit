import L, { type LatLngTuple, type Map } from 'leaflet'
import { type ShallowRef } from 'vue'

import { useMapVectorLayer } from '@/composables/map/useMapVectorLayer'
import type { WaypointCoordinates } from '@/types/mission'

const vehiclePathColor = '#ffff00'

/**
 * Reactive inputs driving the vehicle-path layer. Getters so the composable can watch them.
 */
export interface UseMapVehiclePathLayerOptions {
  /** Trail coordinates in order; typically the mission store's vehicle position history. */
  path: () => WaypointCoordinates[]
  /** Revision counter bumped on every `path` mutation, so the layer redraws without deep-watching it. */
  revision: () => number
  /** Whether the trail is currently drawn. */
  show: () => boolean
}

/**
 * Draws the vehicle's traveled path as a polyline on the given map, redrawing whenever the trail's revision
 * counter changes or the show/hide toggle flips.
 * @param {ShallowRef<Map | undefined>} map - The Leaflet map to draw on; the layer (re)draws once available.
 * @param {UseMapVehiclePathLayerOptions} options - Reactive getters for the path, its revision and visibility.
 * @returns {void}
 */
export const useMapVehiclePathLayer = (
  map: ShallowRef<Map | undefined>,
  options: UseMapVehiclePathLayerOptions
): void => {
  useMapVectorLayer(map, {
    source: () => options.revision(),
    show: () => options.show(),
    draw: (group) => {
      const coordinates = options.path() as LatLngTuple[]
      if (coordinates.length < 2) return
      L.polyline(coordinates, { color: vehiclePathColor, weight: 2 }).addTo(group)
    },
  })
}
