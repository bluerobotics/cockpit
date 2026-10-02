import { useResizeObserver } from '@vueuse/core'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { shallowRef } from 'vue'

/**
 * Handles exposed by the map auto-resize composable.
 */
export interface UseMapAutoResizeReturn {
  /**
   * Starts tracking the size of the given map's container.
   * @param {MapLibreMap} map - The map instance whose container should be tracked.
   * @returns {void}
   */
  observe: (map: MapLibreMap) => void
  /**
   * Stops tracking and releases the observer.
   * @returns {void}
   */
  stop: () => void
}

/**
 * Keeps a map instance's drawing buffer in step with the element it is mounted on. The map measures its container
 * when it is created and afterwards only on a window resize, so a map whose container grows for any other reason
 * keeps drawing at the old size and leaves the rest of the container blank. Teardown is owned here.
 * @param {() => void} [onResize] - Extra work to run after each recompute, such as recentering.
 * @returns {UseMapAutoResizeReturn} The observe/stop lifecycle hooks.
 */
export const useMapAutoResize = (onResize?: () => void): UseMapAutoResizeReturn => {
  const observedMap = shallowRef<MapLibreMap | undefined>()
  const container = shallowRef<HTMLElement | undefined>()

  const { stop } = useResizeObserver(container, () => {
    observedMap.value?.resize()
    onResize?.()
  })

  const observe = (map: MapLibreMap): void => {
    observedMap.value = map
    container.value = map.getContainer()
  }

  return { observe, stop }
}
