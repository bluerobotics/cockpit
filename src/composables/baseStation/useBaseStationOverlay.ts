import './baseStationOverlay.css'

import L from 'leaflet'
import { type Ref, type ShallowRef, onBeforeUnmount, shallowRef, watch } from 'vue'

import { useBaseStation } from '@/composables/baseStation/useBaseStation'
import type { BaseStationConfig } from '@/types/baseStation'

/* eslint-disable jsdoc/require-jsdoc -- internal helper return shape, name is self-describing. */
type BaseStationOverlayApi = { openConfigPanel: () => void }
/* eslint-enable jsdoc/require-jsdoc */

const baseStationMarkerHtml = (label: string): string => `
  <div class="base-station-marker-container">
    <div class="base-station-marker-background"></div>
    <i class="v-icon notranslate mdi mdi-radio-tower" style="color: white; position: relative; z-index: 2; font-size: 16px;"></i>
    <div class="base-station-marker-label">${label}</div>
  </div>
`

/**
 * Renders the base-station marker on a Leaflet map and keeps it in sync with the
 * {@link useBaseStation} state. Mounting and unmounting are handled automatically.
 * @param {ShallowRef<L.Map | undefined>} map Reactive reference to the Leaflet map instance.
 * @param {Ref<boolean>} mapReady Reactive flag that becomes true once the map is initialized.
 * @returns {BaseStationOverlayApi} Helpers to drive the overlay from the host view.
 */
export const useBaseStationOverlay = (
  map: ShallowRef<L.Map | undefined>,
  mapReady: Ref<boolean>
): BaseStationOverlayApi => {
  const store = useBaseStation()

  const marker = shallowRef<L.Marker | undefined>()

  const openConfigPanel = (): void => {
    store.configPanelOpen = true
  }

  const removeLayer = (layer: L.Layer | undefined): void => {
    if (layer && map.value) map.value.removeLayer(layer)
  }

  const buildMarkerIcon = (): L.DivIcon =>
    L.divIcon({
      className: 'base-station-marker-icon',
      html: baseStationMarkerHtml('Base'),
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    })

  const ensureMarker = (config: BaseStationConfig): void => {
    if (!map.value || !config.position) return
    if (marker.value) {
      marker.value.setLatLng(config.position)
      return
    }
    const m = L.marker(config.position, {
      icon: buildMarkerIcon(),
      draggable: true,
      zIndexOffset: 600,
      // The marker owns its own right-click popup; don't propagate to the map context menu.
      bubblingMouseEvents: false,
    })
    m.on('drag', (event: L.LeafletEvent) => {
      const target = event.target as L.Marker
      const { lat, lng } = target.getLatLng()
      store.setPosition([lat, lng])
    })
    m.on('contextmenu', (event: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(event)
      event.originalEvent.stopPropagation()
      event.originalEvent.preventDefault()
      store.openContextPopup(event.originalEvent.clientX, event.originalEvent.clientY)
    })
    m.addTo(map.value)
    marker.value = m
  }

  const refreshAll = (): void => {
    if (!map.value || !mapReady.value) return
    const config = store.config

    if (!config.enabled || !config.position) {
      removeLayer(marker.value)
      marker.value = undefined
      return
    }

    ensureMarker(config)
  }

  watch([map, mapReady], refreshAll, { immediate: true })
  watch(() => store.config, refreshAll, { deep: true })

  onBeforeUnmount(() => {
    removeLayer(marker.value)
    marker.value = undefined
  })

  return { openConfigPanel }
}
