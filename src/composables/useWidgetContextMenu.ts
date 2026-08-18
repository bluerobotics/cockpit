import { onBeforeUnmount, watch } from 'vue'

import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { ContextMenuItem } from '@/types/user-interface'

/**
 * Lets a widget contribute items to the context menu the WidgetHugger shows on right-click. The getter is
 * reactive, so labels and actions that depend on widget state stay in sync, and the registration is cleared
 * when the widget unmounts.
 * @param {string} widgetHash - Hash of the owning widget, used to key its entry in the widget-manager vars.
 * @param {() => ContextMenuItem[]} items - Reactive getter returning the current menu items.
 * @returns {void}
 */
export const useWidgetContextMenu = (widgetHash: string, items: () => ContextMenuItem[]): void => {
  const widgetStore = useWidgetManagerStore()

  watch(items, (currentItems) => (widgetStore.widgetManagerVars(widgetHash).contextMenuItems = currentItems), {
    immediate: true,
    deep: true,
  })

  onBeforeUnmount(() => {
    widgetStore.widgetManagerVars(widgetHash).contextMenuItems = []
  })
}
