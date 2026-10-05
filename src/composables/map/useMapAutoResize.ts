import { useResizeObserver } from '@vueuse/core'
import { shallowRef } from 'vue'

import type { CockpitMap } from '@/libs/map/cesium-map'

/**
 * Handles exposed by the map auto-resize composable.
 */
export interface UseMapAutoResizeReturn {
  /**
   * Starts tracking the size of the given map's container.
   * @param {CockpitMap} map - The map instance whose container should be tracked.
   * @returns {void}
   */
  observe: (map: CockpitMap) => void
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
  const observedMap = shallowRef<CockpitMap | undefined>()
  const container = shallowRef<HTMLElement | undefined>()

  const { stop } = useResizeObserver(container, () => {
    observedMap.value?.resize()
    onResize?.()
  })

  const observe = (map: CockpitMap): void => {
    observedMap.value = map
    container.value = map.getContainer()
  }

  return { observe, stop }
}
