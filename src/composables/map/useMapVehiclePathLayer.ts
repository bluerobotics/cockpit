import type { Map as MapLibreMap } from 'maplibre-gl'
import { type ShallowRef, onBeforeUnmount, watch } from 'vue'

import { lineFeature, removeLayersAndSource, setLineLayer, slottedLayerId } from '@/libs/map/maplibre'
import { isMapReady } from '@/libs/map/utils-map'
import type { WaypointCoordinates } from '@/types/mission'

const vehiclePathColor = '#ffff00'
const vehiclePathLayerId = slottedLayerId('vehicle-path', 'trail')

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
 * Draws the vehicle's traveled path as a line on the given map. The trail grows at the telemetry rate, so redraws
 * are coalesced to one per animation frame, and the layer is removed when hidden, emptied or the owner unmounts.
 * @param {ShallowRef<MapLibreMap | undefined>} map - The map to draw on; the layer (re)draws once available.
 * @param {UseMapVehiclePathLayerOptions} options - Reactive getters for the path, its revision and visibility.
 * @returns {void}
 */
export const useMapVehiclePathLayer = (
  map: ShallowRef<MapLibreMap | undefined>,
  options: UseMapVehiclePathLayerOptions
): void => {
  let pendingFrame: number | undefined

  const removeLine = (): void => {
    removeLayersAndSource(map.value, [vehiclePathLayerId], vehiclePathLayerId)
  }

  const redraw = (): void => {
    pendingFrame = undefined
    if (!isMapReady(map.value)) return

    const points = options.path()
    if (!options.show() || points.length === 0) {
      removeLine()
      return
    }
    // ponytail: every redraw re-sends the whole trail to the map's worker, which is fine for the history lengths the
    // mission store keeps; a trail of tens of thousands of points would need splitting into appended chunks.
    setLineLayer(map.value, vehiclePathLayerId, 'vehicle-path', lineFeature(points), { color: vehiclePathColor })
  }

  const scheduleRedraw = (): void => {
    pendingFrame = pendingFrame ?? requestAnimationFrame(redraw)
  }

  watch([() => options.revision(), () => options.show()], scheduleRedraw)
  watch(
    map,
    (instance) => {
      if (isMapReady(instance)) redraw()
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    if (pendingFrame !== undefined) cancelAnimationFrame(pendingFrame)
    removeLine()
  })
}
