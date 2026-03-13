import type { Map } from 'leaflet'
import { type ShallowRef, shallowRef } from 'vue'

const mapLayer = shallowRef<Map | undefined>()

// Composable to access the map layer instance
export const useMapLayer = (): {
  /**
   * Map layer reference
   */
  mapLayer: ShallowRef<Map | undefined>
} => {
  return {
    mapLayer,
  }
}

// Set the map layer reference
export const setMapLayer = (map: Map | undefined): void => {
  mapLayer.value = map
}
