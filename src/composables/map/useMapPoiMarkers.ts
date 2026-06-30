import L, { type LatLngTuple, type LeafletEvent, type LeafletMouseEvent, type Map, type Marker } from 'leaflet'
import { type ShallowRef, nextTick, onBeforeUnmount, shallowRef, watch } from 'vue'

import { useMissionStore } from '@/stores/mission'
import type { PointOfInterest } from '@/types/mission'

/**
 * Rendering classes and interaction callbacks for the PoI markers of a single map.
 */
export interface UseMapPoiMarkersOptions {
  /**
   * CSS class applied to each marker's Leaflet divIcon, so each surface can keep its own marker styles.
   */
  iconClassName: string
  /**
   * CSS class applied to each marker's tooltip.
   */
  tooltipClassName: string
  /**
   * Whether markers can be dragged to move the underlying PoI. Defaults to true.
   */
  draggable?: boolean
  /**
   * Called when a marker is left-clicked, with the up-to-date PoI from the store and the originating event.
   */
  onClick?: (poi: PointOfInterest, event: MouseEvent) => void
  /**
   * Called when a marker is right-clicked, with the up-to-date PoI from the store and the originating event.
   */
  onContextMenu?: (poi: PointOfInterest, event: MouseEvent) => void
}

/**
 * Reactive handles to the PoI markers managed on a given map.
 */
export interface UseMapPoiMarkersReturn {
  /**
   * Markers currently on the map, keyed by PoI id.
   */
  markers: ShallowRef<Record<string, Marker>>
}

/**
 * Mirrors the mission store's points of interest as draggable Leaflet markers on the given map, keeping them
 * in sync as PoIs are added, edited, moved or removed. Markers are torn down automatically when the owning
 * component unmounts.
 * @param {ShallowRef<Map | undefined>} map - The Leaflet map to draw on; markers (re)draw once it becomes available.
 * @param {UseMapPoiMarkersOptions} options - Rendering classes and interaction callbacks.
 * @returns {UseMapPoiMarkersReturn} The reactive marker registry.
 */
export const useMapPoiMarkers = (
  map: ShallowRef<Map | undefined>,
  options: UseMapPoiMarkersOptions
): UseMapPoiMarkersReturn => {
  const missionStore = useMissionStore()
  const markers = shallowRef<Record<string, Marker>>({})
  const draggable = options.draggable ?? true

  // Snapshot of the fields each marker was last rendered with, keyed by PoI id. Lets syncMarkers skip
  // markers whose data hasn't changed, instead of rebuilding every marker's icon (and Leaflet Draggable
  // instance) whenever any single PoI in the store is edited or dragged. A plain record (rather than an
  // ES Map) to avoid shadowing the Leaflet `Map` type already imported in this file.
  const lastRenderedSignatures: Record<string, string> = {}
  const poiSignature = (poi: PointOfInterest): string =>
    JSON.stringify([poi.coordinates, poi.icon, poi.color, poi.name, poi.description])

  // The map ref can momentarily hold a template-ref DOM element before the Leaflet instance is
  // assigned (consumers reuse the same ref name for the container and the map), so guard on the API.
  const isMapReady = (instance: Map | undefined): instance is Map =>
    !!instance && typeof instance.getContainer === 'function' && !!instance.getContainer()

  const poiIconConfig = (poi: PointOfInterest): L.DivIconOptions => ({
    html: `
    <div class="poi-marker-container">
      <div class="poi-marker-background" style="background-color: ${poi.color}80;"></div>
      <i class="v-icon notranslate mdi ${poi.icon}" style="color: rgba(255, 255, 255, 0.7); position: relative; z-index: 2;"></i>
    </div>
  `,
    className: options.iconClassName,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  })

  const tooltipContent = (poi: PointOfInterest, coordinates: LatLngTuple): string => `
    <strong>${poi.name}</strong><br>
    ${poi.description ? poi.description + '<br>' : ''}
    Lat: ${coordinates[0].toFixed(8)}, Lng: ${coordinates[1].toFixed(8)}
  `

  const addMarker = (poi: PointOfInterest): void => {
    if (!isMapReady(map.value)) return

    const marker = L.marker(poi.coordinates as LatLngTuple, {
      icon: L.divIcon(poiIconConfig(poi)),
      draggable,
    }).addTo(map.value)

    marker.bindTooltip(tooltipContent(poi, poi.coordinates as LatLngTuple), {
      permanent: false,
      direction: 'top',
      offset: [0, -40],
      className: options.tooltipClassName,
    })

    marker.on('drag', (event: LeafletEvent) => {
      const coords = event.target.getLatLng()
      marker.getTooltip()?.setContent(tooltipContent(poi, [coords.lat, coords.lng]))
    })

    marker.on('dragend', (event: LeafletEvent) => {
      const coords = event.target.getLatLng()
      missionStore.movePointOfInterest(poi.id, [coords.lat, coords.lng])
    })

    marker.on('click', (event: LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(event)
      const freshPoi = missionStore.pointsOfInterest.find((p) => p.id === poi.id)
      if (!freshPoi) {
        console.warn('POI not found in store:', poi.id)
        return
      }
      options.onClick?.(freshPoi, event.originalEvent)
    })

    marker.on('contextmenu', (event: LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(event)
      event.originalEvent.stopPropagation()
      event.originalEvent.preventDefault()
      const freshPoi = missionStore.pointsOfInterest.find((p) => p.id === poi.id)
      if (!freshPoi) {
        console.warn('POI not found in store:', poi.id)
        return
      }
      options.onContextMenu?.(freshPoi, event.originalEvent)
    })

    markers.value[poi.id] = marker
    lastRenderedSignatures[poi.id] = poiSignature(poi)
  }

  const updateMarker = (poi: PointOfInterest): void => {
    const marker = markers.value[poi.id]
    if (!isMapReady(map.value) || !marker) return

    // Skip markers whose data hasn't changed since last render, so editing or dragging one PoI doesn't
    // rebuild every other marker's icon and tear down its Leaflet Draggable instance mid-interaction.
    const signature = poiSignature(poi)
    if (lastRenderedSignatures[poi.id] === signature) return
    lastRenderedSignatures[poi.id] = signature

    marker.setLatLng(poi.coordinates as LatLngTuple)
    marker.setIcon(L.divIcon(poiIconConfig(poi)))
    marker.getTooltip()?.setContent(tooltipContent(poi, poi.coordinates as LatLngTuple))
  }

  const removeMarker = (poiId: string): void => {
    if (!markers.value[poiId]) return
    markers.value[poiId].remove()
    delete markers.value[poiId]
    delete lastRenderedSignatures[poiId]
  }

  const syncMarkers = (pois: PointOfInterest[]): void => {
    const liveIds = new Set(pois.map((p) => p.id))
    Object.keys(markers.value).forEach((id) => {
      if (!liveIds.has(id)) removeMarker(id)
    })
    pois.forEach((poi) => (markers.value[poi.id] ? updateMarker(poi) : addMarker(poi)))
  }

  watch(
    () => missionStore.pointsOfInterest,
    async (pois) => {
      if (!isMapReady(map.value)) {
        await nextTick()
        if (!isMapReady(map.value)) return
      }
      syncMarkers(pois)
    },
    { deep: true, immediate: true }
  )

  // Draw any PoIs that loaded before the map instance was ready.
  watch(
    map,
    (instance) => {
      if (isMapReady(instance)) syncMarkers(missionStore.pointsOfInterest)
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    Object.values(markers.value).forEach((marker) => marker.remove())
    markers.value = {}
    Object.keys(lastRenderedSignatures).forEach((id) => delete lastRenderedSignatures[id])
  })

  return { markers }
}
