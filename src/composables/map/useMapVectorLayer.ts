import L, { type Map } from 'leaflet'
import { type ShallowRef, onBeforeUnmount, shallowRef, watch } from 'vue'

/**
 * Reactive inputs for a self-managed Leaflet vector overlay.
 */
export interface UseMapVectorLayerOptions {
  /** Value(s) the drawing depends on; any change repopulates the layer. */
  source: () => unknown
  /** Whether the layer is currently drawn. */
  show: () => boolean
  /** Populates the freshly-cleared group; only called when the map is ready and `show` is true. */
  draw: (group: L.LayerGroup) => void
}

/**
 * Manages a single Leaflet layer group on the given map: creates it once the map is ready, clears and
 * repopulates it via `draw` whenever `source` or `show` change, and removes it when the owner unmounts.
 * Keeps Leaflet vector drawing out of components and shared across overlays (mission path, vehicle trail).
 * @param {ShallowRef<Map | undefined>} map - The Leaflet map to draw on; the layer (re)draws once available.
 * @param {UseMapVectorLayerOptions} options - Reactive getters for the source, visibility and draw routine.
 * @returns {void}
 */
export const useMapVectorLayer = (map: ShallowRef<Map | undefined>, options: UseMapVectorLayerOptions): void => {
  const layerGroup = shallowRef<L.LayerGroup>()

  // The map ref can momentarily hold the container DOM element before the Leaflet instance is assigned.
  const isMapReady = (instance: Map | undefined): instance is Map =>
    !!instance && typeof instance.getContainer === 'function' && !!instance.getContainer()

  const redraw = (): void => {
    if (!isMapReady(map.value)) return
    if (!layerGroup.value) layerGroup.value = L.layerGroup().addTo(map.value)
    layerGroup.value.clearLayers()
    if (!options.show()) return
    options.draw(layerGroup.value)
  }

  watch([() => options.source(), () => options.show()], redraw, { deep: true })
  watch(
    map,
    (instance) => {
      if (isMapReady(instance)) redraw()
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    layerGroup.value?.remove()
    layerGroup.value = undefined
  })
}
