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

const contactIcon = (html: string): L.DivIcon =>
  L.divIcon({
    className: '',
    iconSize: [TRAFFIC_ICON_SIZE_PX, TRAFFIC_ICON_SIZE_PX],
    iconAnchor: [TRAFFIC_ICON_SIZE_PX / 2, TRAFFIC_ICON_SIZE_PX / 2],
    html,
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
  const latestContacts = new Map<TrafficKind, Map<string, TrafficContact>>()
  let mapRef: LeafletMap | undefined
  let controlRef: L.Control.Layers | undefined
  let timer: ReturnType<typeof setInterval> | undefined
  let unmounted = false

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

    const heard = new Map(contacts.map((contact) => [contact.key, contact]))
    latestContacts.set(kind, heard)
    kindMarkers.forEach((marker, key) => {
      if (heard.has(key)) return
      layer.removeLayer(marker)
      kindMarkers.delete(key)
    })

    contacts.forEach((contact) => {
      const marker = kindMarkers.get(contact.key)
      const html = trafficMarkerContent(contact)
      if (!marker) {
        const created = L.marker([contact.latitude, contact.longitude], { icon: contactIcon(html), keyboard: false })
        // Leaflet renders a function content when the tooltip opens, so a closed tooltip costs nothing per refresh.
        const tooltip = L.tooltip({
          content: () => {
            const latest = latestContacts.get(kind)?.get(contact.key) ?? contact
            return trafficTooltipContent(latest, unitPreferences.value)
          },
          className: 'traffic-tooltip',
          offset: [14, 0],
        })
        kindMarkers.set(contact.key, created.bindTooltip(tooltip).addTo(layer))
        return
      }
      // Most contacts hold their position and bearing between refreshes, and both setters rewrite the marker's DOM.
      const position = L.latLng(contact.latitude, contact.longitude)
      if (!marker.getLatLng().equals(position)) marker.setLatLng(position)
      if ((marker.getIcon() as L.DivIcon).options.html !== html) marker.setIcon(contactIcon(html))
      if (marker.isTooltipOpen()) marker.getTooltip()?.update()
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
    latestContacts.clear()
    mapRef = undefined
    controlRef = undefined
  }

  const initTrafficOverlay = (map: LeafletMap, layerControl?: L.Control.Layers): void => {
    // Views bind after awaiting their other overlays, and may have unmounted during that wait.
    if (unmounted) return
    destroyTrafficOverlay()
    mapRef = map
    controlRef = layerControl
    refresh()
    timer = setInterval(refresh, TRAFFIC_REFRESH_MS)
  }

  onBeforeUnmount(() => {
    unmounted = true
    destroyTrafficOverlay()
  })

  return { initTrafficOverlay }
}
