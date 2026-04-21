import type { Map as LeafletMap } from 'leaflet'
import { type InjectionKey, type Ref, type ShallowRef, inject, provide, ref, shallowRef } from 'vue'

/**
 * Map context interface
 */
export interface MapContext {
  /**
   * The Leaflet map instance owned by the parent Map widget
   */
  map: ShallowRef<LeafletMap | undefined>
  /**
   * True once the Leaflet instance is created and ready to be used by children
   */
  mapReady: Ref<boolean>
}

const mapContextKey: InjectionKey<MapContext> = Symbol('CockpitMapContext')

/**
 * Called by a Map widget to expose its Leaflet instance to descendant components.
 * Each call creates a fresh context, so multiple Map widgets coexist without sharing state.
 * @returns {MapContext} The reactive context owned by the calling component.
 */
export const provideMapContext = (): MapContext => {
  const context: MapContext = {
    map: shallowRef<LeafletMap | undefined>(undefined),
    mapReady: ref(false),
  }
  provide(mapContextKey, context)
  return context
}

/**
 * Called by descendants of a Map widget to read its Leaflet instance reactively.
 * Resolves to the nearest ancestor that called {@link provideMapContext}.
 * @returns {MapContext} The reactive context provided by the nearest Map widget ancestor.
 */
export const useMapContext = (): MapContext => {
  const context = inject(mapContextKey)
  if (!context) {
    throw new Error('useMapContext() must be called inside a component nested under a Map widget')
  }
  return context
}
