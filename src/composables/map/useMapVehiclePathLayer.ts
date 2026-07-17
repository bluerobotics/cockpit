import L, { type LatLngExpression, type Map, type Polyline } from 'leaflet'
import { type ShallowRef, onBeforeUnmount, shallowRef, watch } from 'vue'

import { isLeafletMapReady } from '@/libs/map/utils-map'
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
 * Draws the vehicle's traveled path as a polyline on the given map. Keeps a single persistent polyline on a
 * dedicated Canvas renderer and appends only the new points on each revision bump, so a long-running trail
 * does not stutter the map. Falls back to a full rebuild on first draw or when the trail shrinks, and removes
 * the layer when hidden, emptied or the owner unmounts.
 * @param {ShallowRef<Map | undefined>} map - The Leaflet map to draw on; the layer (re)draws once available.
 * @param {UseMapVehiclePathLayerOptions} options - Reactive getters for the path, its revision and visibility.
 * @returns {void}
 */
export const useMapVehiclePathLayer = (
  map: ShallowRef<Map | undefined>,
  options: UseMapVehiclePathLayerOptions
): void => {
  // A dedicated Canvas renderer keeps the growing trail off the SVG pane, which otherwise stutters as points accumulate.
  const renderer = L.canvas()
  const polyline = shallowRef<Polyline>()
  let lastDrawnLength = 0

  const removeLine = (): void => {
    if (polyline.value && map.value) map.value.removeLayer(polyline.value)
    polyline.value = undefined
    lastDrawnLength = 0
  }

  const redraw = (): void => {
    if (!isLeafletMapReady(map.value)) return

    const points = options.path()
    if (!options.show() || points.length === 0) {
      removeLine()
      return
    }

    if (polyline.value === undefined) {
      polyline.value = L.polyline([], { color: vehiclePathColor, renderer }).addTo(map.value)
      lastDrawnLength = 0
    }

    if (points.length > lastDrawnLength && lastDrawnLength > 0) {
      // Append only the new points — O(1) per fire instead of an O(N) full rebuild.
      for (let i = lastDrawnLength; i < points.length; i++) {
        polyline.value.addLatLng(points[i] as LatLngExpression)
      }
    } else {
      // First draw, or the trail shrank (clear/simplify) / stayed the same length (push+shift): full rebuild.
      polyline.value.setLatLngs(points as LatLngExpression[])
    }
    lastDrawnLength = points.length
  }

  watch([() => options.revision(), () => options.show()], redraw)
  watch(
    map,
    (instance) => {
      if (isLeafletMapReady(instance)) redraw()
    },
    { immediate: true }
  )

  onBeforeUnmount(removeLine)
}
