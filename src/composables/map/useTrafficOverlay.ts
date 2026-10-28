import L, { type Map as LeafletMap } from 'leaflet'
import { computed, onBeforeUnmount } from 'vue'

import {
  TRAFFIC_ICON_SIZE_PX,
  TRAFFIC_KIND_STYLES,
  trafficMarkerContent,
  trafficTooltipContent,
} from '@/libs/map/traffic-marker'
import { currentTrafficContacts } from '@/libs/traffic/traffic'
import type { DisplayUnitPreferences } from '@/libs/units'
import { useAppInterfaceStore } from '@/stores/appInterface'
import type { TrafficContact, TrafficKind } from '@/types/traffic'

const TRAFFIC_REFRESH_MS = 2000

const TRAFFIC_KINDS = Object.keys(TRAFFIC_KIND_STYLES) as TrafficKind[]

/**
 * Lifecycle handles a map view needs to show air and vessel traffic.
 */
export interface UseTrafficOverlayReturn {
  /**
   * Binds the overlay to a Leaflet map and its layer control, and starts following the contacts.
   */
  initTrafficOverlay: (map: LeafletMap, layerControl?: L.Control.Layers) => void
}

const contactIcon = (contact: TrafficContact): L.DivIcon =>
  L.divIcon({
    className: '',
    iconSize: [TRAFFIC_ICON_SIZE_PX, TRAFFIC_ICON_SIZE_PX],
    iconAnchor: [TRAFFIC_ICON_SIZE_PX / 2, TRAFFIC_ICON_SIZE_PX / 2],
    html: trafficMarkerContent(contact),
  })

/**
 * Draws the aircraft and vessels Cockpit is tracking, one marker per craft, as two layer-control overlays that
 * appear once the first contact of their kind is heard. Polls the traffic registry rather than reacting to it, so a
 * busy harbour or flight corridor costs one redraw every couple of seconds instead of one per report.
 * @returns {UseTrafficOverlayReturn} The method binding the overlay to a map, which it tears down on unmount.
 */
export const useTrafficOverlay = (): UseTrafficOverlayReturn => {
  const interfaceStore = useAppInterfaceStore()
  const unitPreferences = computed<DisplayUnitPreferences>(() => interfaceStore.displayUnitPreferences)
  const groups = new Map<TrafficKind, L.LayerGroup>()
  const markers = new Map<TrafficKind, Map<string, L.Marker>>()
  let mapRef: LeafletMap | undefined
  let controlRef: L.Control.Layers | undefined
  let timer: ReturnType<typeof setInterval> | undefined

  const refreshKind = (kind: TrafficKind): void => {
    const contacts = currentTrafficContacts(kind)
    if (!mapRef || (contacts.length === 0 && !groups.has(kind))) return

    let group = groups.get(kind)
    if (!group) {
      group = L.layerGroup().addTo(mapRef)
      groups.set(kind, group)
      controlRef?.addOverlay(group, TRAFFIC_KIND_STYLES[kind].layerLabel)
    }
    const layer = group

    const kindMarkers = markers.get(kind) ?? new Map<string, L.Marker>()
    markers.set(kind, kindMarkers)

    const heard = new Set(contacts.map(({ key }) => key))
    kindMarkers.forEach((marker, key) => {
      if (heard.has(key)) return
      layer.removeLayer(marker)
      kindMarkers.delete(key)
    })

    contacts.forEach((contact) => {
      const marker = kindMarkers.get(contact.key)
      if (!marker) {
        const created = L.marker([contact.latitude, contact.longitude], {
          icon: contactIcon(contact),
          keyboard: false,
        })
        const tooltip = L.tooltip({
          content: trafficTooltipContent(contact, unitPreferences.value),
          className: 'traffic-tooltip',
          offset: [14, 0],
        })
        kindMarkers.set(contact.key, created.bindTooltip(tooltip).addTo(layer))
        return
      }
      // Most contacts hold their position and bearing between refreshes, and both setters rewrite the marker's DOM.
      const position = L.latLng(contact.latitude, contact.longitude)
      if (!marker.getLatLng().equals(position)) marker.setLatLng(position)
      const icon = contactIcon(contact)
      if ((marker.getIcon() as L.DivIcon).options.html !== icon.options.html) marker.setIcon(icon)
      marker.setTooltipContent(trafficTooltipContent(contact, unitPreferences.value))
    })
  }

  const refresh = (): void => TRAFFIC_KINDS.forEach(refreshKind)

  const destroyTrafficOverlay = (): void => {
    clearInterval(timer)
    timer = undefined
    groups.forEach((group) => {
      controlRef?.removeLayer(group)
      mapRef?.removeLayer(group)
    })
    groups.clear()
    markers.clear()
    mapRef = undefined
    controlRef = undefined
  }

  const initTrafficOverlay = (map: LeafletMap, layerControl?: L.Control.Layers): void => {
    destroyTrafficOverlay()
    mapRef = map
    controlRef = layerControl
    refresh()
    timer = setInterval(refresh, TRAFFIC_REFRESH_MS)
  }

  onBeforeUnmount(destroyTrafficOverlay)

  return { initTrafficOverlay }
}
