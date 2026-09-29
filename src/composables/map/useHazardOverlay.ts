import * as turf from '@turf/turf'
import L, { type Map as LeafletMap } from 'leaflet'
import { computed, onBeforeUnmount, watch } from 'vue'

import { useAisTrafficOverlay } from '@/composables/map/useAisTrafficOverlay'
import { polygonRings } from '@/libs/hazards/hazard-areas'
import {
  HAZARD_AREA_SOURCE_IDS,
  HAZARD_GRID_SOURCE_IDS,
  HAZARD_SOURCE_IDS,
  HAZARD_SOURCES,
} from '@/libs/hazards/sources'
import { escapeHtml } from '@/libs/utils'
import { useHazardStore } from '@/stores/hazards'
import type { HazardArea, HazardSourceId } from '@/types/hazards'

const HAZARD_PANE = 'hazardAdvisoryPane'

// Below this on-screen width an area's label would spill over its neighbors, so it is hidden.
const MIN_LABELED_AREA_PX = 90

const AREA_FILL_OPACITY = 0.12

const AREA_TOOLTIP_MS = 10000

const TOOLTIP_CLASSES = '!whitespace-normal w-max max-w-[280px]'

const LABEL_CLASSES =
  '!bg-transparent !border-0 !shadow-none !p-0 text-[10px] font-semibold leading-tight text-center ' +
  '[text-shadow:0_0_3px_#000,0_0_2px_#000]'

/**
 * Lifecycle handles a map view needs to show the hazard advisory areas.
 */
export interface UseHazardOverlayReturn {
  /**
   * Binds the overlay to a Leaflet map and its layer control, and starts syncing the loaded areas.
   */
  initHazardOverlay: (map: LeafletMap, layerControl?: L.Control.Layers) => void
  /**
   * Stops syncing and removes every hazard layer from the map and the layer control.
   */
  destroyHazardOverlay: () => void
}

const areaBand = (area: HazardArea): string | undefined => {
  if (area.lowerLimitM === undefined && area.upperLimitM === undefined) return undefined
  const upper = area.upperLimitM !== undefined ? `${Math.round(area.upperLimitM)} m` : 'unlimited'
  return `${Math.round(area.lowerLimitM ?? 0)} m to ${upper}`
}

const areaTooltip = (area: HazardArea): string => {
  const band = areaBand(area)
  const facts = [...(band ? [`${band} above sea level`] : []), ...(area.details ?? [])]
  // Labels and details come straight from contributor-entered tags, so they are escaped before reaching the DOM.
  return [`<strong>${escapeHtml(area.label)}</strong>`, ...facts.map((fact) => `<div>${escapeHtml(fact)}</div>`)].join(
    ''
  )
}

// Every closed coastline ring is just an island, so only the named areas of the other sources are labeled.
const isLabeled = (area: HazardArea): boolean => area.kind === 'polygon' && area.sourceId !== 'coastline'

const areaLabel = (area: HazardArea): L.Tooltip => {
  const band = areaBand(area)
  const content = `<div style="color:${HAZARD_SOURCES[area.sourceId].color}">${escapeHtml(area.label)}${
    band ? `<br>${band}` : ''
  }</div>`
  // A point on the surface rather than the bounds center, which falls outside concave areas.
  const [lng, lat] = turf.pointOnFeature(turf.polygon(polygonRings(area))).geometry.coordinates
  return L.tooltip({ pane: HAZARD_PANE, direction: 'center', className: LABEL_CLASSES })
    .setLatLng([lat, lng])
    .setContent(content)
}

/**
 * Draws the loaded hazard advisory areas on a Leaflet map, one toggleable layer-control overlay per
 * source, and keeps them in sync with the hazard store, along with the vessel traffic the vehicle's AIS
 * receiver reports. Shared by the dashboard Map widget and the
 * Mission Planning view so the behavior lives in one place.
 * @returns {UseHazardOverlayReturn} Methods to bind the overlay to a map and to tear it down.
 */
export const useHazardOverlay = (): UseHazardOverlayReturn => {
  const hazardStore = useHazardStore()
  // Nearby traffic is a hazard too, and riding on this lifecycle keeps both map views free of extra wiring.
  const { initAisTrafficOverlay, destroyAisTrafficOverlay } = useAisTrafficOverlay()

  const groups = new Map<HazardSourceId, L.LayerGroup>()
  let mapRef: LeafletMap | undefined
  let controlRef: L.Control.Layers | undefined
  let renderer: L.Canvas | undefined
  let stopWatches: (() => void)[] = []
  let labels: {
    /**
     * Permanent label drawn inside the area.
     */
    tooltip: L.Tooltip
    /**
     * Bounds of the area, measured on screen to decide whether the label fits.
     */
    bounds: L.LatLngBounds
    /**
     * Source whose area the label names.
     */
    sourceId: HazardSourceId
  }[] = []

  // Rebuilding on anything less specific would redraw every path whenever an unrelated store field
  // changed; a source's areas only ever change when it is toggled or re-fetched.
  const renderSignature = computed(() =>
    HAZARD_AREA_SOURCE_IDS.map((sourceId) => {
      const enabled = hazardStore.isSourceEnabled(sourceId) ? 1 : 0
      return `${sourceId}:${enabled}:${hazardStore.results[sourceId]?.fetchedAtMs ?? 0}`
    }).join('|')
  )
  // The grid sources also follow their elevation thresholds, which change far more often than any fetch.
  const gridSignature = computed(() => {
    const { terrainClearanceMeters, shallowWaterDepthMeters } = hazardStore.settings
    const enabled = HAZARD_GRID_SOURCE_IDS.map((sourceId) => (hazardStore.isSourceEnabled(sourceId) ? 1 : 0)).join('')
    return `${enabled}:${
      hazardStore.terrainGrid?.fetchedAtMs ?? 0
    }:${terrainClearanceMeters}:${shallowWaterDepthMeters}`
  })

  const areasOf = (sourceId: HazardSourceId): HazardArea[] => {
    if (!hazardStore.isSourceEnabled(sourceId)) return []
    if (sourceId === 'terrain') return hazardStore.terrainAreas
    if (sourceId === 'shallow-water') return hazardStore.shallowAreas
    return hazardStore.results[sourceId]?.areas ?? []
  }

  const ensurePane = (): void => {
    if (!mapRef) return
    if (!mapRef.getPane(HAZARD_PANE)) {
      // Right above the base tiles, under GeoTIFF overlays and everything the operator places or flies.
      mapRef.createPane(HAZARD_PANE).style.zIndex = '220'
    }
    // Hundreds of shoreline runs as individual SVG paths stall panning, so they share one canvas.
    renderer ??= L.canvas({ pane: HAZARD_PANE, padding: 0.5 })
  }

  const removeGroup = (sourceId: HazardSourceId): void => {
    const group = groups.get(sourceId)
    if (!group) return
    controlRef?.removeLayer(group)
    mapRef?.removeLayer(group)
    groups.delete(sourceId)
  }

  const buildLayer = (area: HazardArea): L.Path | undefined => {
    const meta = HAZARD_SOURCES[area.sourceId]
    const style: L.PathOptions = {
      pane: HAZARD_PANE,
      renderer,
      color: meta.color,
      weight: 2,
      opacity: 0.9,
      dashArray: '6 4',
      attribution: meta.attribution,
    }
    if (area.kind === 'polygon') {
      if (area.coordinates.length < 3) return undefined
      return L.polygon([area.coordinates, ...(area.holes ?? [])], {
        ...style,
        fillColor: meta.color,
        fillOpacity: AREA_FILL_OPACITY,
      })
    }
    if (area.coordinates.length < 2) return undefined
    return L.polyline(area.coordinates, { ...style, fill: false })
  }

  // A tooltip trailing the pointer across a wide area would sit over the mission drawn on top of it, so it only shows
  // for a while after the pointer enters. Unlike a bound tooltip it also stays shut on clicks, which place waypoints.
  const bindEntryTooltip = (layer: L.Path, content: string): void => {
    const tooltip = L.tooltip({ direction: 'right', offset: [12, 0], className: TOOLTIP_CLASSES })
    let closeTimer: ReturnType<typeof setTimeout> | undefined
    const close = (): void => {
      clearTimeout(closeTimer)
      tooltip.remove()
    }
    layer.on('mouseover', (event: L.LeafletMouseEvent) => {
      if (!mapRef) return
      close()
      tooltip.setContent(content).setLatLng(event.latlng).openOn(mapRef)
      closeTimer = setTimeout(close, AREA_TOOLTIP_MS)
    })
    layer.on('mousemove', (event: L.LeafletMouseEvent) => {
      if (mapRef?.hasLayer(tooltip)) tooltip.setLatLng(event.latlng)
    })
    layer.on('mouseout remove', close)
  }

  // A charted rock is a few meters across, which vanishes below harbour zoom, so it also gets a dot of fixed size.
  const seamarkDot = (area: HazardArea, layer: L.Path): L.CircleMarker => {
    const color = HAZARD_SOURCES[area.sourceId].color
    const center = (layer as L.Polyline).getBounds().getCenter()
    return L.circleMarker(center, {
      pane: HAZARD_PANE,
      renderer,
      radius: 4,
      color,
      weight: 1,
      fillOpacity: 0.9,
    }).bindTooltip(areaTooltip(area), { sticky: true, className: TOOLTIP_CLASSES })
  }

  const fitLabels = (): void => {
    if (!mapRef) return
    const map = mapRef
    labels.forEach(({ tooltip, bounds }) => {
      const width =
        map.latLngToContainerPoint(bounds.getNorthEast()).x - map.latLngToContainerPoint(bounds.getSouthWest()).x
      tooltip.setOpacity(width >= MIN_LABELED_AREA_PX ? 1 : 0)
    })
  }

  // An area enclosing the whole view would only tint every tile and every glass panel over the map.
  // ponytail: judged by the area's bounding box, so a concave area can lose its fill while the view
  // still reaches outside it. Testing the view's corners against the polygon is the upgrade path.
  const fitFills = (): void => {
    if (!mapRef) return
    const view = mapRef.getBounds()
    groups.forEach((group) =>
      group.eachLayer((layer) => {
        if (!(layer instanceof L.Polygon)) return
        const fillOpacity = layer.getBounds().contains(view) ? 0 : AREA_FILL_OPACITY
        if (layer.options.fillOpacity !== fillOpacity) layer.setStyle({ fillOpacity })
      })
    )
  }

  // The canvas hands the pointer to the last-drawn shape under it, so larger areas are drawn first, or an airspace
  // spanning the view would take every hover inside it. Lines and seamark dots, sized zero here, end up on top.
  // ponytail: sized by bounding box, which overrates thin diagonal areas; true polygon area is the upgrade.
  const stackBySize = (): void => {
    const size = (layer: L.Path): number => {
      if (!(layer instanceof L.Polygon)) return 0
      const bounds = layer.getBounds()
      return (bounds.getNorth() - bounds.getSouth()) * (bounds.getEast() - bounds.getWest())
    }
    const paths: L.Path[] = []
    groups.forEach((group) => {
      if (!mapRef?.hasLayer(group)) return
      group.eachLayer((layer) => {
        if (layer instanceof L.Path) paths.push(layer)
      })
    })
    paths.sort((a, b) => size(b) - size(a)).forEach((path) => path.bringToFront())
  }

  // The grid sources are last in the layer control, so rebuilding them alone re-adds them where they already were.
  const rebuild = (sourceIds: HazardSourceId[] = HAZARD_SOURCE_IDS): void => {
    if (!mapRef) return
    ensurePane()
    labels = labels.filter((label) => !sourceIds.includes(label.sourceId))

    sourceIds.forEach((sourceId) => {
      const areas = areasOf(sourceId)
      // Leaflet remembers whether an overlay was checked only while its layer exists, so a source
      // that is merely empty keeps no entry rather than showing an unusable checkbox.
      const wasVisible = groups.has(sourceId) ? mapRef?.hasLayer(groups.get(sourceId) as L.LayerGroup) : true
      removeGroup(sourceId)
      if (areas.length === 0) return

      const group = L.layerGroup()
      areas.forEach((area) => {
        const layer = buildLayer(area)
        if (!layer) return
        if (layer instanceof L.Polygon && area.sourceId !== 'seamarks') bindEntryTooltip(layer, areaTooltip(area))
        else layer.bindTooltip(areaTooltip(area), { sticky: true, className: TOOLTIP_CLASSES })
        layer.addTo(group)
        if (area.sourceId === 'seamarks') seamarkDot(area, layer).addTo(group)
        if (!isLabeled(area)) return
        const tooltip = areaLabel(area).addTo(group)
        labels.push({ tooltip, bounds: (layer as L.Polygon).getBounds(), sourceId })
      })
      groups.set(sourceId, group)
      // Added to the map before the control knows it, or the control reports it as an operator's `overlayadd`.
      if (wasVisible) group.addTo(mapRef as LeafletMap)
      controlRef?.addOverlay(group, HAZARD_SOURCES[sourceId].label)
    })
    fitLabels()
    fitFills()
    stackBySize()
  }

  const initHazardOverlay = (map: LeafletMap, layerControl?: L.Control.Layers): void => {
    mapRef = map
    controlRef = layerControl
    rebuild()
    stopWatches = [watch(renderSignature, () => rebuild()), watch(gridSignature, () => rebuild(HAZARD_GRID_SOURCE_IDS))]
    map.on('zoomend', fitLabels)
    map.on('moveend', fitFills)
    map.on('overlayadd', stackBySize)
    initAisTrafficOverlay(map, layerControl)
  }

  const destroyHazardOverlay = (): void => {
    stopWatches.forEach((stop) => stop())
    stopWatches = []
    destroyAisTrafficOverlay()
    mapRef?.off('zoomend', fitLabels)
    mapRef?.off('moveend', fitFills)
    mapRef?.off('overlayadd', stackBySize)
    labels = []
    HAZARD_SOURCE_IDS.forEach(removeGroup)
    renderer = undefined
    mapRef = undefined
    controlRef = undefined
  }

  onBeforeUnmount(destroyHazardOverlay)

  return { initHazardOverlay, destroyHazardOverlay }
}
