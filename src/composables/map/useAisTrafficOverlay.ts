import L, { type Map as LeafletMap } from 'leaflet'
import { onBeforeUnmount } from 'vue'

import type { AisVessel } from '@/libs/ais'
import { escapeHtml } from '@/libs/utils'
import { useAisTrafficStore } from '@/stores/aisTraffic'

const AIS_REFRESH_MS = 2000
const AIS_LAYER_LABEL = 'Vessel traffic (AIS)'
const VESSEL_COLOR = '#F472B6'
const KNOTS_PER_MPS = 1.943844

/**
 * Lifecycle handles a map view needs to show AIS vessel traffic.
 */
export interface UseAisTrafficOverlayReturn {
  /**
   * Binds the overlay to a Leaflet map and its layer control, and starts following the vessels.
   */
  initAisTrafficOverlay: (map: LeafletMap, layerControl?: L.Control.Layers) => void
  /**
   * Stops following and removes the vessels from the map and the layer control.
   */
  destroyAisTrafficOverlay: () => void
}

// An arrow along the heading (or course) when one is known, a dot when the vessel only reports where it is.
const vesselIcon = (vessel: AisVessel): L.DivIcon => {
  const bearing = vessel.headingDeg ?? vessel.courseDeg
  const shape =
    bearing === undefined
      ? `<circle cx="10" cy="10" r="5" fill="${VESSEL_COLOR}" stroke="#000" stroke-width="1.5"/>`
      : `<path d="M10 1 L16 18 L10 14 L4 18 Z" fill="${VESSEL_COLOR}" stroke="#000" stroke-width="1.5"/>`
  return L.divIcon({
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    html: `<svg width="20" height="20" style="transform:rotate(${bearing ?? 0}deg)">${shape}</svg>`,
  })
}

const vesselTooltip = (vessel: AisVessel): string => {
  // Names and callsigns are free text broadcast by any transmitter, so they are escaped before reaching the DOM.
  const title = escapeHtml(vessel.name ?? `MMSI ${vessel.mmsi}`)
  const details = [
    vessel.callsign ? escapeHtml(vessel.callsign) : undefined,
    vessel.speedMps !== undefined ? `${(vessel.speedMps * KNOTS_PER_MPS).toFixed(1)} kn` : undefined,
    vessel.courseDeg !== undefined ? `${Math.round(vessel.courseDeg)}°` : undefined,
    `heard ${Math.round((Date.now() - vessel.lastHeardAtMs) / 1000)} s ago`,
  ].filter(Boolean)
  return `<strong>${title}</strong><br><span style="opacity:0.7">${details.join(' &middot; ')}</span>`
}

/**
 * Draws the vessels the vehicle's AIS receiver reports, one marker per MMSI, as a layer-control overlay
 * that appears once the first vessel is heard. Polls the traffic store rather than reacting to it, so
 * a busy harbour costs one redraw every couple of seconds instead of one per report.
 * @returns {UseAisTrafficOverlayReturn} Methods to bind the overlay to a map and to tear it down.
 */
export const useAisTrafficOverlay = (): UseAisTrafficOverlayReturn => {
  const aisStore = useAisTrafficStore()
  const markers = new Map<number, L.Marker>()
  let mapRef: LeafletMap | undefined
  let controlRef: L.Control.Layers | undefined
  let group: L.LayerGroup | undefined
  let timer: ReturnType<typeof setInterval> | undefined

  const refresh = (): void => {
    const vessels = aisStore.currentVessels()
    if (!mapRef || (vessels.length === 0 && !group)) return
    if (!group) {
      group = L.layerGroup().addTo(mapRef)
      controlRef?.addOverlay(group, AIS_LAYER_LABEL)
    }
    const layer = group
    const heard = new Set(vessels.map(({ mmsi }) => mmsi))
    markers.forEach((marker, mmsi) => {
      if (heard.has(mmsi)) return
      layer.removeLayer(marker)
      markers.delete(mmsi)
    })
    vessels.forEach((vessel) => {
      const marker = markers.get(vessel.mmsi)
      if (!marker) {
        const created = L.marker([vessel.latitude, vessel.longitude], { icon: vesselIcon(vessel), keyboard: false })
        markers.set(vessel.mmsi, created.bindTooltip(vesselTooltip(vessel)).addTo(layer))
        return
      }
      marker.setLatLng([vessel.latitude, vessel.longitude]).setIcon(vesselIcon(vessel))
      marker.setTooltipContent(vesselTooltip(vessel))
    })
  }

  const destroyAisTrafficOverlay = (): void => {
    clearInterval(timer)
    timer = undefined
    if (group) {
      controlRef?.removeLayer(group)
      mapRef?.removeLayer(group)
    }
    group = undefined
    markers.clear()
    mapRef = undefined
    controlRef = undefined
  }

  const initAisTrafficOverlay = (map: LeafletMap, layerControl?: L.Control.Layers): void => {
    destroyAisTrafficOverlay()
    mapRef = map
    controlRef = layerControl
    refresh()
    timer = setInterval(refresh, AIS_REFRESH_MS)
  }

  onBeforeUnmount(destroyAisTrafficOverlay)

  return { initAisTrafficOverlay, destroyAisTrafficOverlay }
}
