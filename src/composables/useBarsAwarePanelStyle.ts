import { useWindowSize } from '@vueuse/core'
import { type ComputedRef, computed } from 'vue'

import { useWidgetManagerStore } from '@/stores/widgetManager'

/**
 * Inline style that keeps a full-height side panel clear of the top and bottom bars, and lets it
 * span the whole window while the interface is in editing mode (where the bars are not reserved).
 * @param {number} [zIndex] Stacking order for the panel, for panels that need one.
 * @returns {ComputedRef<Record<string, string | number>>} Style bindable to the panel container.
 */
export const useBarsAwarePanelStyle = (zIndex?: number): ComputedRef<Record<string, string | number>> => {
  const widgetStore = useWidgetManagerStore()
  const { height: windowHeight } = useWindowSize()

  return computed(() => ({
    marginTop: widgetStore.editingMode ? '0px' : `${widgetStore.currentTopBarHeightPixels}px`,
    marginBottom: widgetStore.editingMode ? '0px' : `${widgetStore.currentBottomBarHeightPixels}px`,
    height: widgetStore.editingMode
      ? `${windowHeight.value}px`
      : `${
          windowHeight.value - widgetStore.currentTopBarHeightPixels - widgetStore.currentBottomBarHeightPixels - 1
        }px`,
    ...(zIndex === undefined ? {} : { zIndex }),
  }))
}
