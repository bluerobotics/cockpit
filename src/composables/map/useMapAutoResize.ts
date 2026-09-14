import { useResizeObserver } from '@vueuse/core'
import type { Map as LeafletMap } from 'leaflet'
import { shallowRef } from 'vue'

/**
 * Handles exposed by the map auto-resize composable.
 */
export interface UseMapAutoResizeReturn {
  /**
   * Starts tracking the size of the given map's container.
   * @param {LeafletMap} map - The Leaflet instance whose container should be tracked.
   * @returns {void}
   */
  observe: (map: LeafletMap) => void
  /**
   * Stops tracking and releases the observer.
   * @returns {void}
   */
  stop: () => void
}

/**
 * Keeps a Leaflet instance's cached container size in step with the element it is mounted on. Leaflet
 * measures its container when the map is created and afterwards only on a window resize, so a map whose
 * container grows for any other reason keeps painting the tile grid at the old size and leaves the rest
 * of the container on Leaflet's blank background. Teardown is owned here.
 * @param {() => void} [onResize] - Extra work to run after each recompute, such as recentering.
 * @returns {UseMapAutoResizeReturn} The observe/stop lifecycle hooks.
 */
export const useMapAutoResize = (onResize?: () => void): UseMapAutoResizeReturn => {
  const observedMap = shallowRef<LeafletMap | undefined>()
  const container = shallowRef<HTMLElement | undefined>()

  const { stop } = useResizeObserver(container, () => {
    // The re-measure has to happen every frame, but the `moveend` Leaflet fires along with it drives
    // heavier bookkeeping (grid overlay and scale control rebuilds), so that one event alone is coalesced.
    observedMap.value?.invalidateSize({ animate: false, debounceMoveend: true })
    onResize?.()
  })

  const observe = (map: LeafletMap): void => {
    observedMap.value = map
    container.value = map.getContainer()
  }

  return { observe, stop }
}
