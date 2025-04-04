import { v4 as uuid } from 'uuid'
import { createApp } from 'vue'
import VueDraggableResizable from 'vue-draggable-resizable'

import FloatingComponentWrapper from '@/components/common/FloatingComponentWrapper.vue'
import vuetify from '@/plugins/vuetify'
import { useAppInterfaceStore } from '@/stores/appInterface'

/**
 * Interface for a floating component instance
 */
interface FloatingComponentInstance {
  /** The Vue app instance */
  app: ReturnType<typeof createApp>
  /** The DOM element where the app is mounted */
  mountPoint: HTMLElement
  /** Optional callback to call when the window is closed */
  onCloseCallback?: () => void
  /** The ID of the floating component */
  id: string
}

/**
 * Options for opening a floating component
 */
interface FloatingComponentOptions {
  /** Title to display in the floating window header */
  title?: string
  /** Callback to call when the window is closed */
  onClose?: () => void
  /** Initial width of the window */
  width?: number
  /** Initial height of the window */
  height?: number
  /** Minimum width of the window */
  minWidth?: number
  /** Minimum height of the window */
  minHeight?: number
  /** Z-index of the window */
  zIndex?: number
}

// Store for all floating component instances by ID
const floatingComponents = new Map<string, FloatingComponentInstance>()

/**
 * Checks if a specific floating component is currently open
 * @param id - ID of the floating component to check
 * @returns True if the component is open, false otherwise
 */
export const isFloatingComponentOpen = (id: string): boolean => {
  return floatingComponents.has(id)
}

/**
 * Opens a component in a floating window
 * @param id - Unique identifier for this floating component instance
 * @param component - The Vue component to render in the floating window
 * @param componentProps - Props to pass to the component
 * @param options - Additional options for the floating window
 * @returns A function to close the floating window
 */
export const openFloatingComponent = (
  id: string,
  component: any,
  componentProps: Record<string, any> = {},
  options: FloatingComponentOptions = {}
): (() => void) => {
  console.log(`Opening floating component ${id}`)

  // If already open, update props/options and return the existing close function
  if (floatingComponents.has(id)) {
    // Update the callback if provided
    if (options.onClose) {
      floatingComponents.get(id)!.onCloseCallback = options.onClose
    }
    return () => closeFloatingComponent(id)
  }

  // Create a mount point for the component
  const mountPoint = document.createElement('div')
  mountPoint.id = `floating-component-${id}-${uuid()}`
  document.body.appendChild(mountPoint)

  // Create a new Vue app with the FloatingComponentWrapper
  const app = createApp(FloatingComponentWrapper, {
    componentToRender: component,
    componentProps,
    title: options.title || 'Floating Window',
    onClose: () => {
      closeFloatingComponent(id)
    },
    width: options.width,
    height: options.height,
    minWidth: options.minWidth,
    minHeight: options.minHeight,
    zIndex: options.zIndex,
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
  console.log(`Mounted floating component ${id} to ${mountPoint.id}`)

  // Store reference to the instance
  floatingComponents.set(id, {
    app,
    mountPoint,
    onCloseCallback: options.onClose,
    id,
  })

  // Return a function to close the component
  return () => closeFloatingComponent(id)
}

/**
 * Closes a specific floating component if it's open
 * @param id - ID of the floating component to close
 */
export const closeFloatingComponent = (id: string): void => {
  if (!floatingComponents.has(id)) return

  const instance = floatingComponents.get(id)!

  // Get the callback before cleaning up
  const onCloseCallback = instance.onCloseCallback

  // Unmount the app and remove the mount point
  instance.app.unmount()
  instance.mountPoint.remove()

  // Clear the reference
  floatingComponents.delete(id)

  // Call the callback if it exists
  if (onCloseCallback) {
    onCloseCallback()
  }
}

/**
 * Closes all open floating components
 */
export const closeAllFloatingComponents = (): void => {
  const ids = Array.from(floatingComponents.keys())
  ids.forEach((id) => closeFloatingComponent(id))
}
