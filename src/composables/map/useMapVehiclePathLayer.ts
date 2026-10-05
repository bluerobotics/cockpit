import { type ShallowRef, onBeforeUnmount, watch } from 'vue'

import type { CockpitMap } from '@/libs/map/cesium-map'
import { lineFeature } from '@/libs/map/cesium-vectors'
import { isMapReady } from '@/libs/map/utils-map'
import type { WaypointCoordinates } from '@/types/mission'

const vehiclePathColor = '#ffff00'
const vehiclePathLayerId = 'vehicle-path::trail'

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
 * @param {ShallowRef<CockpitMap | undefined>} map - The map to draw on; the layer (re)draws once available.
 * @param {UseMapVehiclePathLayerOptions} options - Reactive getters for the path, its revision and visibility.
 * @returns {void}
 */
export const useMapVehiclePathLayer = (
  map: ShallowRef<CockpitMap | undefined>,
  options: UseMapVehiclePathLayerOptions
): void => {
  let pendingFrame: number | undefined

  const removeLine = (): void => {
    map.value?.removeVectors(vehiclePathLayerId)
  }

  const redraw = (): void => {
    pendingFrame = undefined
    if (!isMapReady(map.value)) return

    const points = options.path()
    if (!options.show() || points.length === 0) {
      removeLine()
      return
    }
    // ponytail: every redraw rebuilds the whole trail's polyline, which is fine for the history lengths the mission store
    // keeps; a trail of tens of thousands of points would need splitting into appended chunks.
    map.value.setVectors(vehiclePathLayerId, 'vehicle-path', [lineFeature(points, { color: vehiclePathColor })])
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
