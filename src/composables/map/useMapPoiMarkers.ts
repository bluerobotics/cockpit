import L, { type LatLngTuple, type LeafletEvent, type LeafletMouseEvent, type Map, type Marker } from 'leaflet'
import { type Ref, type ShallowRef, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'

import { usePointsOfInterest } from '@/composables/usePointsOfInterest'
import {
  getPoiIconSignature,
  getPoiMarkerColor,
  getPoiMarkerOpacity,
  getPoiTooltipHtml,
  poiPinRotation,
} from '@/libs/utils-poi'
import type { ResolvedPointOfInterest } from '@/types/mission'

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
   * Whether markers can be dragged to move the underlying PoI. Defaults to true. Live-tracked PoIs are
   * never draggable regardless of this flag, since their position is owned by the data lake.
   */
  draggable?: boolean
  /**
   * Called when a marker is left-clicked, with the up-to-date PoI and the originating event.
   */
  onClick?: (poi: ResolvedPointOfInterest, event: MouseEvent) => void
  /**
   * Called when a marker is right-clicked, with the up-to-date PoI and the originating event.
   */
  onContextMenu?: (poi: ResolvedPointOfInterest, event: MouseEvent) => void
}

/**
 * Reactive handles to the PoI markers managed on a given map.
 */
export interface UseMapPoiMarkersReturn {
  /**
   * Markers currently on the map, keyed by PoI id.
   */
  markers: ShallowRef<Record<string, Marker>>
  /**
   * Id of the PoI currently flagged as the active GoTo target, or null when none.
   */
  gotoTargetId: Ref<string | null>
  /**
   * Flags a PoI as the active GoTo target (or clears it with null), updating the pulsating marker style.
   * @param {string | null} poiId - The PoI to highlight, or null to clear the current target.
   * @returns {void}
   */
  setGotoTarget: (poiId: string | null) => void
}

/**
 * Mirrors the resolved points of interest as Leaflet markers on the given map, keeping them in sync as PoIs
 * are added, edited, moved or removed, and exposing GoTo-target highlighting. Coordinates come from the data
 * lake (see {@link usePointsOfInterest}), so live-tracked PoIs follow their source and are not draggable.
 * Markers are torn down automatically when the owning component unmounts.
 * @param {ShallowRef<Map | undefined>} map - The Leaflet map to draw on; markers (re)draw once it becomes available.
 * @param {UseMapPoiMarkersOptions} options - Rendering classes and interaction callbacks.
 * @returns {UseMapPoiMarkersReturn} The reactive marker registry and GoTo-target controls.
 */
export const useMapPoiMarkers = (
  map: ShallowRef<Map | undefined>,
  options: UseMapPoiMarkersOptions
): UseMapPoiMarkersReturn => {
  const { resolvedPointsOfInterest, movePointOfInterest } = usePointsOfInterest()
  const markers = shallowRef<Record<string, Marker>>({})
  const gotoTargetId = ref<string | null>(null)
  const draggable = options.draggable ?? true

  // Snapshot of the rendering inputs each marker was last drawn with, keyed by PoI id. Lets syncMarkers skip
  // markers whose data hasn't changed, instead of rebuilding every marker's icon (and Leaflet Draggable
  // instance) whenever any single PoI in the list is edited or moved. A plain record (rather than an ES Map)
  // to avoid shadowing the Leaflet `Map` type already imported in this file.
  const lastRenderedSignatures: Record<string, string> = {}
  // Icon-only signature per PoI, so a live-tracked PoI merely moving doesn't rebuild its icon (and DOM
  // element), which would cancel in-progress clicks on frequently-updated markers.
  const iconSignatures: Record<string, string> = {}
  // Last heading written onto each marker, so a live-tracked PoI merely moving does not re-query the
  // heading element.
  const lastAppliedHeadings: Record<string, number> = {}
  const poiSignature = (poi: ResolvedPointOfInterest): string =>
    JSON.stringify([
      poi.coordinates,
      getPoiMarkerColor(poi),
      getPoiMarkerOpacity(poi),
      poi.icon,
      poi.name,
      poi.description,
      poi.isLiveTracked,
      poi.resolvedHeading,
    ])

  // The map ref can momentarily hold a template-ref DOM element before the Leaflet instance is
  // assigned (consumers reuse the same ref name for the container and the map), so guard on the API.
  const isMapReady = (instance: Map | undefined): instance is Map =>
    !!instance && typeof instance.getContainer === 'function' && !!instance.getContainer()

  // A POI with a heading grows a white tip, the corner of the same teardrop pin the off-screen edge
  // arrows use, turned to point where the POI faces. The pin sits behind the marker and has the
  // marker's circle punched out of it, so only the corner shows and its base is that circle's own
  // curve rather than a chord. Styled inline because the marker DOM is shared by every map surface
  // while the `.poi-marker-*` rules are per-surface.
  const headingTipHtml = (heading: number | null): string => {
    if (heading === null) return ''
    const circleCutout = 'radial-gradient(circle at center, transparent 15.5px, #000 16px)'
    return `<div class="poi-marker-heading" style="position: absolute; width: 32px; height: 32px; z-index: 0;
      background-color: rgba(255, 255, 255, 0.9); border-radius: 50% 50% 50% 0;
      transform: rotate(${poiPinRotation(heading)}deg);
      -webkit-mask-image: ${circleCutout}; mask-image: ${circleCutout};
      filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.4));"></div>`
  }

  // The glyph turns with the heading too, so an icon that does have a front (an arrow, a boat) faces
  // the same way as the tip.
  const glyphRotationStyle = (heading: number | null): string =>
    heading === null ? '' : ` transform: rotate(${heading}deg);`

  const poiIconConfig = (poi: ResolvedPointOfInterest): L.DivIconOptions => {
    const glyphStyle = `color: rgba(255, 255, 255, 0.7); position: relative; z-index: 2;${glyphRotationStyle(
      poi.resolvedHeading
    )}`
    return {
      html: `
    <div class="poi-marker-container">
      ${headingTipHtml(poi.resolvedHeading)}
      <div class="poi-marker-background" style="background-color: ${getPoiMarkerColor(poi)}80;"></div>
      <i class="v-icon notranslate mdi poi-marker-glyph ${poi.icon}" style="${glyphStyle}"></i>
    </div>
  `,
      className: options.iconClassName,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    }
  }

  // Both parts a heading turns, kept together so the icon rebuild and the in-place update below can
  // never disagree on where the marker points.
  const applyHeadingRotation = (markerElement: HTMLElement | undefined, heading: number): void => {
    const tip = markerElement?.querySelector('.poi-marker-heading') as HTMLElement | null
    if (tip) tip.style.transform = `rotate(${poiPinRotation(heading)}deg)`
    const glyph = markerElement?.querySelector('.poi-marker-glyph') as HTMLElement | null
    if (glyph) glyph.style.transform = `rotate(${heading}deg)`
  }

  const applyGotoTargetStyle = (poiId: string, active: boolean): void => {
    const bg = markers.value[poiId]?.getElement()?.querySelector('.poi-marker-background') as HTMLElement | null
    bg?.classList.toggle('poi-marker-goto-target', active)
  }

  const setGotoTarget = (poiId: string | null): void => {
    gotoTargetId.value = poiId
  }

  watch(gotoTargetId, (newId, oldId) => {
    if (oldId && oldId !== newId) applyGotoTargetStyle(oldId, false)
    if (newId) applyGotoTargetStyle(newId, true)
  })

  const addMarker = (poi: ResolvedPointOfInterest): void => {
    if (!isMapReady(map.value)) return

    const marker = L.marker(poi.coordinates as LatLngTuple, {
      icon: L.divIcon(poiIconConfig(poi)),
      draggable: draggable && !poi.isLiveTracked,
      opacity: getPoiMarkerOpacity(poi),
    }).addTo(map.value)

    marker.bindTooltip(getPoiTooltipHtml(poi, poi.coordinates), {
      permanent: false,
      direction: 'top',
      offset: [0, -20],
      className: options.tooltipClassName,
    })

    marker.on('drag', (event: LeafletEvent) => {
      const coords = event.target.getLatLng()
      marker.getTooltip()?.setContent(getPoiTooltipHtml(poi, [coords.lat, coords.lng]))
    })

    marker.on('dragend', (event: LeafletEvent) => {
      const coords = event.target.getLatLng()
      movePointOfInterest(poi.id, [coords.lat, coords.lng])
    })

    marker.on('click', (event: LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(event)
      const freshPoi = resolvedPointsOfInterest.value.find((p) => p.id === poi.id)
      if (!freshPoi) {
        console.warn('POI not found:', poi.id)
        return
      }
      options.onClick?.(freshPoi, event.originalEvent)
    })

    marker.on('contextmenu', (event: LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(event)
      event.originalEvent.stopPropagation()
      event.originalEvent.preventDefault()
      const freshPoi = resolvedPointsOfInterest.value.find((p) => p.id === poi.id)
      if (!freshPoi) {
        console.warn('POI not found:', poi.id)
        return
      }
      options.onContextMenu?.(freshPoi, event.originalEvent)
    })

    markers.value[poi.id] = marker
    lastRenderedSignatures[poi.id] = poiSignature(poi)
    iconSignatures[poi.id] = getPoiIconSignature(poi)
    if (poi.resolvedHeading !== null) lastAppliedHeadings[poi.id] = poi.resolvedHeading

    if (gotoTargetId.value === poi.id) applyGotoTargetStyle(poi.id, true)
  }

  const updateMarker = (poi: ResolvedPointOfInterest): void => {
    const marker = markers.value[poi.id]
    if (!isMapReady(map.value) || !marker) return

    // Skip markers whose data hasn't changed since last render, so editing or moving one PoI doesn't
    // rebuild every other marker's icon and tear down its Leaflet Draggable instance mid-interaction.
    const signature = poiSignature(poi)
    if (lastRenderedSignatures[poi.id] === signature) return
    lastRenderedSignatures[poi.id] = signature

    marker.setLatLng(poi.coordinates as LatLngTuple)

    // Keep draggability in sync: a PoI edited into a live expression must stop being draggable (and
    // vice-versa), since dragging would overwrite its coordinates with a static position.
    if (draggable && !poi.isLiveTracked) marker.dragging?.enable()
    else marker.dragging?.disable()

    marker.setOpacity(getPoiMarkerOpacity(poi))

    // Only rebuild the icon when its appearance changes. setIcon replaces the marker's DOM element,
    // so both the goto-target class and any in-progress click would otherwise be lost.
    const iconSignature = getPoiIconSignature(poi)
    if (iconSignatures[poi.id] !== iconSignature) {
      marker.setIcon(L.divIcon(poiIconConfig(poi)))
      iconSignatures[poi.id] = iconSignature
      if (gotoTargetId.value === poi.id) applyGotoTargetStyle(poi.id, true)
    }

    // A live heading changes as often as a live position, so it is turned in place rather than through
    // the icon rebuild above, which would recreate the marker's DOM element on every update.
    if (poi.resolvedHeading !== null && lastAppliedHeadings[poi.id] !== poi.resolvedHeading) {
      applyHeadingRotation(marker.getElement(), poi.resolvedHeading)
      lastAppliedHeadings[poi.id] = poi.resolvedHeading
    } else if (poi.resolvedHeading === null) {
      delete lastAppliedHeadings[poi.id]
    }

    marker.getTooltip()?.setContent(getPoiTooltipHtml(poi, poi.coordinates))
  }

  const removeMarker = (poiId: string): void => {
    if (!markers.value[poiId]) return
    markers.value[poiId].remove()
    delete markers.value[poiId]
    delete lastRenderedSignatures[poiId]
    delete iconSignatures[poiId]
    delete lastAppliedHeadings[poiId]
    if (gotoTargetId.value === poiId) gotoTargetId.value = null
  }

  const syncMarkers = (pois: ResolvedPointOfInterest[]): void => {
    const liveIds = new Set(pois.map((p) => p.id))
    Object.keys(markers.value).forEach((id) => {
      if (!liveIds.has(id)) removeMarker(id)
    })
    pois.forEach((poi) => (markers.value[poi.id] ? updateMarker(poi) : addMarker(poi)))
  }

  watch(
    resolvedPointsOfInterest,
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
      if (isMapReady(instance)) syncMarkers(resolvedPointsOfInterest.value)
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    Object.values(markers.value).forEach((marker) => marker.remove())
    markers.value = {}
    Object.keys(lastRenderedSignatures).forEach((id) => delete lastRenderedSignatures[id])
    Object.keys(iconSignatures).forEach((id) => delete iconSignatures[id])
    Object.keys(lastAppliedHeadings).forEach((id) => delete lastAppliedHeadings[id])
  })

  return { markers, gotoTargetId, setGotoTarget }
}
