import L, { type LatLngTuple, type Map } from 'leaflet'
import { type ShallowRef } from 'vue'

import { useMapVectorLayer } from '@/composables/map/useMapVectorLayer'
import type { Waypoint } from '@/types/mission'

const missionPathColor = '#358AC3'

/**
 * Reactive inputs driving the mission layer. Getters so the composable can watch them.
 */
export interface UseMapMissionLayerOptions {
  /** Waypoints to connect, in order; typically the vehicle mission's navigation waypoints. */
  waypoints: () => Waypoint[]
  /** Whether the mission is currently drawn. */
  show: () => boolean
}

/**
 * Draws a mission as a connecting path plus a dot per waypoint on the given map, keeping it in sync with the
 * source waypoints and a show/hide toggle.
 * @param {ShallowRef<Map | undefined>} map - The Leaflet map to draw on; the layer (re)draws once available.
 * @param {UseMapMissionLayerOptions} options - Reactive getters for the waypoints and visibility.
 * @returns {void}
 */
export const useMapMissionLayer = (map: ShallowRef<Map | undefined>, options: UseMapMissionLayerOptions): void => {
  useMapVectorLayer(map, {
    source: () => options.waypoints(),
    show: () => options.show(),
    draw: (group) => {
      const coordinates = options.waypoints().map((waypoint) => waypoint.coordinates as LatLngTuple)
      if (coordinates.length === 0) return

      L.polyline(coordinates, { color: missionPathColor, weight: 2 }).addTo(group)
      coordinates.forEach((coordinate) => {
        L.circleMarker(coordinate, {
          radius: 3,
          color: '#ffffff',
          weight: 1,
          fillColor: missionPathColor,
          fillOpacity: 1,
        }).addTo(group)
      })
    },
  })
}
