import { v4 as uuid } from 'uuid'
import { createApp } from 'vue'
import VueDraggableResizable from 'vue-draggable-resizable'

import FloatingMAVLinkInspector from '@/components/development/FloatingMAVLinkInspector.vue'
import vuetify from '@/plugins/vuetify'
import { useAppInterfaceStore } from '@/stores/appInterface'

/**
 * Stores the reference to the currently mounted floating inspector instance
 * @type {{ app: ReturnType<typeof createApp>; mountPoint: HTMLElement } | null}
 */
let floatingInspectorInstance: {
  app: ReturnType<typeof createApp>;
  mountPoint: HTMLElement;
  onCloseCallback?: () => void;
} | null = null

/**
 * Checks if the floating MAVLink inspector is currently open
 * @returns {boolean} True if the inspector is open, false otherwise
 */
export const isFloatingMAVLinkInspectorOpen = (): boolean => {
  return floatingInspectorInstance !== null
}

/**
 * Opens a floating MAVLink inspector window that persists outside the normal component tree
 * @param {() => void} onClose - Optional callback to call when the inspector is closed
 * @returns A function to close the inspector window
 */
export const openFloatingMAVLinkInspector = (onClose?: () => void): (() => void) => {
  console.log('Opening floating MAVLink inspector')

  // If already open, return the existing close function
  if (floatingInspectorInstance) {
    // Update the callback if a new one is provided
    if (onClose) {
      floatingInspectorInstance.onCloseCallback = onClose
    }
    return () => closeFloatingMAVLinkInspector()
  }

  // Create a mount point for the inspector
  const mountPoint = document.createElement('div')
  mountPoint.id = `floating-mavlink-inspector-${uuid()}`
  document.body.appendChild(mountPoint)

  // Create a new Vue app with the FloatingMAVLinkInspector component
  const app = createApp(FloatingMAVLinkInspector, {
    onClose: () => {
      closeFloatingMAVLinkInspector()
    },
  })

  // Register necessary components
  app.component('VueDraggableResizable', VueDraggableResizable)

  // Add Vuetify to the app
  app.use(vuetify)

  // Add any global store that might be needed
  if (typeof window !== 'undefined') {
    const interfaceStore = useAppInterfaceStore()
    app.provide('appInterface', interfaceStore)
  }

  // Mount the app to the created div
  app.mount(mountPoint)
  console.log('Mounted floating MAVLink inspector to', mountPoint.id)

  // Store reference to the instance
  floatingInspectorInstance = {
    app,
    mountPoint,
    onCloseCallback: onClose
  }

  // Return a function to close the inspector
  return () => closeFloatingMAVLinkInspector()
}

/**
 * Closes the floating MAVLink inspector if it's open
 */
export const closeFloatingMAVLinkInspector = (): void => {
  if (!floatingInspectorInstance) return

  // Get the callback before cleaning up
  const onCloseCallback = floatingInspectorInstance.onCloseCallback

  // Unmount the app and remove the mount point
  floatingInspectorInstance.app.unmount()
  floatingInspectorInstance.mountPoint.remove()

  // Clear the reference
  floatingInspectorInstance = null

  // Call the callback if it exists
  if (onCloseCallback) {
    onCloseCallback()
  }
}