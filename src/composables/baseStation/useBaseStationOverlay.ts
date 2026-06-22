import L from 'leaflet'
import { type Ref, type ShallowRef, onBeforeUnmount, shallowRef, watch } from 'vue'

import { useBaseStation } from '@/composables/baseStation/useBaseStation'
import { openSnackbar } from '@/composables/snackbar'
import { createCellIdHeatLayer, mobileHeatmapRadiusFraction } from '@/libs/baseStation/cellIdHeatLayer'
import {
  bboxContains,
  bboxEquals,
  bboxIntersects,
  leafletBoundsToCoverageBbox,
  overpassBboxAround,
  trimCacheEntries,
} from '@/libs/baseStation/coverageBbox'
import {
  aimingArcLatLngs,
  bearingFromCenter,
  bearingHandlePosition,
  sectorPolygonLatLngs,
} from '@/libs/baseStation/geometry'
import {
  filterOpenCellIdSites,
  mergeOpenCellIdSites,
  mergeOverpassTowers,
  openCellIdOperatorLabel,
  overpassRangeMeters,
} from '@/libs/baseStation/mobileCoverage'
import {
  type OpenCellIdSite,
  fetchOpenCellIdSites,
  isOpenCellIdInvalidApiKeyError,
} from '@/libs/baseStation/openCellId'
import {
  type OverpassTower,
  fetchOverpassTowers,
  fitLabelToArc,
  openCellIdLabelParts,
  operatorColor,
  overpassBeamwidth,
  overpassBearing,
  overpassLabelParts,
} from '@/libs/baseStation/overpass'
import { isElectron } from '@/libs/utils'
import {
  type BaseStationConfig,
  type CachedMobileCoverageEntry,
  type CoverageBbox,
  AntennaType,
  BaseStationCommsType,
  effectiveAntennaRangeMeters,
  MOBILE_COVERAGE_FETCH_DROP_MIME,
  MobileCoverageDisplayMode,
  MobileCoverageProvider,
} from '@/types/baseStation'
import type { WaypointCoordinates } from '@/types/mission'

// Concentric coverage rings with decreasing radius. Stacking them at the same per-layer opacity
// produces a smooth radial fade that mimics the pattern published in BR's directional antenna
// guide while keeping the brightest band where the signal is strongest.
const COVERAGE_GRADIENT_STEPS = 12
const COVERAGE_STEP_OPACITY = 0.045

/* eslint-disable jsdoc/require-jsdoc -- Inline label spec; field names are self-describing. */
type OsmCoverageLabelSpec = {
  id: string
  center: WaypointCoordinates
  rangeMeters: number
  bearing: number | null
  beamwidth: number
  labelParts: string[]
  color: string
}
/* eslint-enable jsdoc/require-jsdoc */

const OSM_COVERAGE_FILL_OPACITY = 0.12
const OSM_COVERAGE_STROKE_OPACITY = 0.75
const OPENCELLID_RING_FILL_OPACITY = 0.08
const OSM_LABEL_FONT_SIZE_PX = 10
const OSM_LABEL_RIM_INSET = 0.92
const OSM_TOP_ARC_START_DEG = 300
const OSM_TOP_ARC_END_DEG = 60

/* eslint-disable jsdoc/require-jsdoc -- Composable return shape; field names are self-describing. */
type BaseStationOverlayApi = { openConfigPanel: () => void }
/* eslint-enable jsdoc/require-jsdoc */

const escapeMarkerLabel = (label: string): string =>
  label
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const baseStationMarkerHtml = (label: string, color: string): string => `
  <div class="base-station-marker-container">
    <div class="base-station-marker-background" style="background-color: ${color.slice(0, 7)}cc"></div>
    <i class="v-icon notranslate mdi mdi-radio-tower" style="color: white; position: relative; z-index: 2; font-size: 16px;"></i>
    ${label ? `<div class="base-station-marker-label">${escapeMarkerLabel(label)}</div>` : ''}
  </div>
`

/**
 * Renders the base-station marker, antenna coverage and tether circle on a Leaflet map and
 * keeps them in sync with the {@link useBaseStation} state. Mounting and unmounting are
 * handled automatically.
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
  const coverageLayer = shallowRef<L.LayerGroup | undefined>()
  const tetherLayer = shallowRef<L.Circle | undefined>()
  const bearingHandle = shallowRef<L.Marker | undefined>()
  const bearingLine = shallowRef<L.Polyline | undefined>()
  const aimingArc = shallowRef<L.Polyline | undefined>()
  const mobileCoverageLayer = shallowRef<L.Layer | undefined>()
  const cachedOpenCellIdSites = shallowRef<OpenCellIdSite[] | null>(null)
  const cachedOverpassTowers = shallowRef<OverpassTower[] | null>(null)

  let mobileCoverageController: AbortController | null = null
  let mobileCoverageTargetToolController: AbortController | null = null
  let mobileCoverageDebounce: ReturnType<typeof setTimeout> | null = null
  let detachMapDropHandlers: (() => void) | null = null
  let detachTargetToolHandlers: (() => void) | null = null
  let osmLabelOverlayEl: HTMLDivElement | null = null
  let osmLabelSvgEl: SVGSVGElement | null = null
  let osmLabelCleanup: (() => void) | null = null
  let lastMarkerLabel: string | null = null
  let lastMarkerColor: string | null = null

  const openConfigPanel = (): void => {
    store.configPanelOpen = true
  }

  const attachMapDropHandlers = (): void => {
    if (!map.value) return
    detachMapDropHandlers?.()
    const container = map.value.getContainer()
    const onDragOver = (event: DragEvent): void => {
      if (!event.dataTransfer?.types.includes(MOBILE_COVERAGE_FETCH_DROP_MIME)) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    }
    const onDrop = (event: DragEvent): void => {
      if (!event.dataTransfer?.types.includes(MOBILE_COVERAGE_FETCH_DROP_MIME) || !map.value) return
      event.preventDefault()
      const rect = container.getBoundingClientRect()
      const point = L.point(event.clientX - rect.left, event.clientY - rect.top)
      const latLng = map.value.containerPointToLatLng(point)
      void fetchAndAppendMobileCoverage([latLng.lat, latLng.lng])
    }
    container.addEventListener('dragover', onDragOver)
    container.addEventListener('drop', onDrop)
    detachMapDropHandlers = () => {
      container.removeEventListener('dragover', onDragOver)
      container.removeEventListener('drop', onDrop)
      detachMapDropHandlers = null
    }
  }

  // SVG-as-cursor: mdi-crosshairs-gps glyph on a transparent canvas so the cursor visually
  // matches the toolbar icon while the operator is picking a point.
  const TARGET_CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="white" stroke="black" stroke-width="0.5" d="M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8M3.05,13H1V11H3.05C3.5,6.83 6.83,3.5 11,3.05V1H13V3.05C17.17,3.5 20.5,6.83 20.95,11H23V13H20.95C20.5,17.17 17.17,20.5 13,20.95V23H11V20.95C6.83,20.5 3.5,17.17 3.05,13M12,5A7,7 0 0,0 5,12A7,7 0 0,0 12,19A7,7 0 0,0 19,12A7,7 0 0,0 12,5Z"/></svg>`
  const TARGET_CURSOR_URL = `url('data:image/svg+xml;utf8,${encodeURIComponent(TARGET_CURSOR_SVG)}') 12 12, crosshair`

  const attachTargetToolHandlers = (): void => {
    if (!map.value) return
    detachTargetToolHandlers?.()
    const container = map.value.getContainer()
    const previousCursor = container.style.cursor
    container.style.cursor = TARGET_CURSOR_URL
    const onMapClick = (event: L.LeafletMouseEvent): void => {
      store.mobileCoverageTargetToolActive = false
      void fetchAndAppendMobileCoverage([event.latlng.lat, event.latlng.lng])
    }
    map.value.on('click', onMapClick)
    detachTargetToolHandlers = () => {
      container.style.cursor = previousCursor
      map.value?.off('click', onMapClick)
      detachTargetToolHandlers = null
    }
  }

  const removeLayer = (layer: L.Layer | undefined): void => {
    if (layer && map.value) map.value.removeLayer(layer)
  }

  const clearLoadedMobileCoverageData = (): void => {
    cachedOpenCellIdSites.value = null
    cachedOverpassTowers.value = null
    store.availableOsmOperators = []
    store.availableOpenCellIdOperators = []
    store.config.mobileCoverage.openCellIdOperator = ''
  }

  const openCellIdEntryForPosition = (
    position: WaypointCoordinates
  ): CachedMobileCoverageEntry<OpenCellIdSite> | undefined =>
    store.mobileCoverageCache.openCellId.find((entry) => bboxContains(entry.bbox, position))

  const overpassEntryForPosition = (
    position: WaypointCoordinates
  ): CachedMobileCoverageEntry<OverpassTower> | undefined =>
    store.mobileCoverageCache.osmOverpass.find((entry) => bboxContains(entry.bbox, position))

  const loadOpenCellIdSitesFromStorage = (position: WaypointCoordinates): boolean => {
    // Drop empty entries that cover this position — leftover from rate-limited fetches that
    // returned 0 sites (was previously the H1 bug where empty caches blocked re-fetching).
    const positionalEntry = openCellIdEntryForPosition(position)
    if (positionalEntry && positionalEntry.data.length === 0) {
      store.mobileCoverageCache.openCellId = store.mobileCoverageCache.openCellId.filter(
        (cachedEntry) => !bboxEquals(cachedEntry.bbox, positionalEntry.bbox)
      )
    }
    // Union *every* cached entry so drag-target appends — whose bboxes don't necessarily
    // contain the base station — still light up after a restart.
    const merged = store.mobileCoverageCache.openCellId.reduce<OpenCellIdSite[] | null>(
      (acc, entry) => mergeOpenCellIdSites(acc, entry.data),
      null
    )
    cachedOpenCellIdSites.value = merged && merged.length > 0 ? merged : null
    const operators = merged
      ? [
          ...new Set(merged.map((site) => openCellIdOperatorLabel(site)).filter((label): label is string => !!label)),
        ].sort()
      : []
    store.availableOpenCellIdOperators = operators
    if (
      store.config.mobileCoverage.openCellIdOperator &&
      !operators.includes(store.config.mobileCoverage.openCellIdOperator)
    ) {
      store.config.mobileCoverage.openCellIdOperator = ''
    }
    // Return the positional check so `fetchMobileCoverageData` only skips the fetch when the
    // base station itself is already covered, regardless of how much side data we have.
    return openCellIdEntryForPosition(position) !== undefined
  }

  const loadOverpassTowersFromStorage = (position: WaypointCoordinates): boolean => {
    const merged = store.mobileCoverageCache.osmOverpass.reduce<OverpassTower[] | null>(
      (acc, entry) => mergeOverpassTowers(acc, entry.data),
      null
    )
    cachedOverpassTowers.value = merged && merged.length > 0 ? merged : null
    store.availableOsmOperators = merged
      ? [...new Set(merged.map((tower) => tower.operator).filter((operator): operator is string => !!operator))].sort()
      : []
    return overpassEntryForPosition(position) !== undefined
  }

  const resetVisibleMobileCoverageData = async (): Promise<void> => {
    if (!map.value) return
    mobileCoverageController?.abort()
    mobileCoverageController = null
    if (mobileCoverageDebounce) {
      clearTimeout(mobileCoverageDebounce)
      mobileCoverageDebounce = null
    }
    const visibleArea = leafletBoundsToCoverageBbox(map.value.getBounds())
    const openCellIdBefore = store.mobileCoverageCache.openCellId.length
    const overpassBefore = store.mobileCoverageCache.osmOverpass.length
    store.mobileCoverageCache.openCellId = store.mobileCoverageCache.openCellId.filter(
      (entry) => !bboxIntersects(entry.bbox, visibleArea)
    )
    store.mobileCoverageCache.osmOverpass = store.mobileCoverageCache.osmOverpass.filter(
      (entry) => !bboxIntersects(entry.bbox, visibleArea)
    )
    const removedEntries =
      openCellIdBefore -
      store.mobileCoverageCache.openCellId.length +
      (overpassBefore - store.mobileCoverageCache.osmOverpass.length)
    clearLoadedMobileCoverageData()
    if (store.config.position) {
      if (store.config.mobileCoverage.provider === MobileCoverageProvider.OpenCellID) {
        loadOpenCellIdSitesFromStorage(store.config.position)
      } else if (store.config.mobileCoverage.provider === MobileCoverageProvider.OSMOverpass) {
        loadOverpassTowersFromStorage(store.config.position)
      }
    }
    teardownMobileCoverageData()
    await renderMobileCoverage(store.config)
    openSnackbar({
      variant: 'info',
      message:
        removedEntries > 0
          ? `Reset ${removedEntries} cached mobile coverage area${removedEntries === 1 ? '' : 's'} in view.`
          : 'No cached mobile coverage data was stored for the current view.',
      duration: 3000,
    })
  }

  const storeOpenCellIdSites = (bbox: CoverageBbox, sites: OpenCellIdSite[]): void => {
    cachedOpenCellIdSites.value = sites
    const operators = [
      ...new Set(sites.map((site) => openCellIdOperatorLabel(site)).filter((label): label is string => !!label)),
    ].sort()
    store.availableOpenCellIdOperators = operators
    if (
      store.config.mobileCoverage.openCellIdOperator &&
      !operators.includes(store.config.mobileCoverage.openCellIdOperator)
    ) {
      store.config.mobileCoverage.openCellIdOperator = ''
    }
    if (sites.length === 0) {
      store.mobileCoverageCache.openCellId = store.mobileCoverageCache.openCellId.filter(
        (entry) => !bboxEquals(entry.bbox, bbox)
      )
      return
    }
    store.mobileCoverageCache.openCellId = trimCacheEntries([
      {
        bbox,
        fetchedAtMs: Date.now(),
        data: sites,
      },
      ...store.mobileCoverageCache.openCellId.filter((entry) => !bboxEquals(entry.bbox, bbox)),
    ])
  }

  const storeOverpassTowers = (bbox: CoverageBbox, towers: OverpassTower[]): void => {
    cachedOverpassTowers.value = towers
    store.availableOsmOperators = [
      ...new Set(towers.map((tower) => tower.operator).filter((operator): operator is string => !!operator)),
    ].sort()
    store.mobileCoverageCache.osmOverpass = trimCacheEntries([
      {
        bbox,
        fetchedAtMs: Date.now(),
        data: towers,
      },
      ...store.mobileCoverageCache.osmOverpass.filter((entry) => !bboxEquals(entry.bbox, bbox)),
    ])
  }

  const appendOpenCellIdSites = (bbox: CoverageBbox, sites: OpenCellIdSite[]): void => {
    const entry = store.mobileCoverageCache.openCellId.find((cachedEntry) => bboxEquals(cachedEntry.bbox, bbox))
    const mergedEntrySites = mergeOpenCellIdSites(entry?.data ?? null, sites)
    const mergedLoadedSites = mergeOpenCellIdSites(cachedOpenCellIdSites.value, sites)
    cachedOpenCellIdSites.value = mergedLoadedSites
    const operators = [
      ...new Set(
        mergedLoadedSites.map((site) => openCellIdOperatorLabel(site)).filter((label): label is string => !!label)
      ),
    ].sort()
    store.availableOpenCellIdOperators = operators
    if (
      store.config.mobileCoverage.openCellIdOperator &&
      !operators.includes(store.config.mobileCoverage.openCellIdOperator)
    ) {
      store.config.mobileCoverage.openCellIdOperator = ''
    }
    store.mobileCoverageCache.openCellId = trimCacheEntries([
      {
        bbox,
        fetchedAtMs: Date.now(),
        data: mergedEntrySites,
      },
      ...store.mobileCoverageCache.openCellId.filter((cachedEntry) => !bboxEquals(cachedEntry.bbox, bbox)),
    ])
  }

  const appendOverpassTowers = (bbox: CoverageBbox, towers: OverpassTower[]): void => {
    const entry = store.mobileCoverageCache.osmOverpass.find((cachedEntry) => bboxEquals(cachedEntry.bbox, bbox))
    const mergedEntryTowers = mergeOverpassTowers(entry?.data ?? null, towers)
    const mergedLoadedTowers = mergeOverpassTowers(cachedOverpassTowers.value, towers)
    cachedOverpassTowers.value = mergedLoadedTowers
    store.availableOsmOperators = [
      ...new Set(
        mergedLoadedTowers.map((tower) => tower.operator).filter((operator): operator is string => !!operator)
      ),
    ].sort()
    store.mobileCoverageCache.osmOverpass = trimCacheEntries([
      {
        bbox,
        fetchedAtMs: Date.now(),
        data: mergedEntryTowers,
      },
      ...store.mobileCoverageCache.osmOverpass.filter((cachedEntry) => !bboxEquals(cachedEntry.bbox, bbox)),
    ])
  }

  const buildMarkerIcon = (label: string, color: string): L.DivIcon =>
    L.divIcon({
      className: 'base-station-marker-icon',
      html: baseStationMarkerHtml(label, color),
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    })

  const buildBearingHandleIcon = (): L.DivIcon =>
    L.divIcon({
      className: 'base-station-bearing-handle',
      html: '<div class="base-station-bearing-handle-dot"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    })

  const ensureMarker = (config: BaseStationConfig): void => {
    if (!map.value || !config.position) return
    const markerLabel = config.name.trim()
    if (marker.value) {
      marker.value.setLatLng(config.position)
      // setIcon during a drag rebuilds the DOM element Leaflet is tracking and stops the drag
      // after the first few pixels, so only rebuild when the icon definition actually changed.
      if (markerLabel !== lastMarkerLabel || config.coverageColor !== lastMarkerColor) {
        marker.value.setIcon(buildMarkerIcon(markerLabel, config.coverageColor))
        lastMarkerLabel = markerLabel
        lastMarkerColor = config.coverageColor
      }
      return
    }
    const m = L.marker(config.position, {
      icon: buildMarkerIcon(markerLabel, config.coverageColor),
      draggable: true,
      zIndexOffset: 600,
      // The marker owns its own right-click popup; don't propagate to the map context menu.
      bubblingMouseEvents: false,
    })
    lastMarkerLabel = markerLabel
    lastMarkerColor = config.coverageColor
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

  const ensureOsmLabelOverlay = (): void => {
    if (!map.value || osmLabelOverlayEl) return
    const container = map.value.getContainer()
    osmLabelOverlayEl = document.createElement('div')
    osmLabelOverlayEl.style.position = 'absolute'
    osmLabelOverlayEl.style.top = '0'
    osmLabelOverlayEl.style.left = '0'
    osmLabelOverlayEl.style.width = '100%'
    osmLabelOverlayEl.style.height = '100%'
    osmLabelOverlayEl.style.pointerEvents = 'none'
    osmLabelOverlayEl.style.zIndex = '620'

    osmLabelSvgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    osmLabelSvgEl.setAttribute('width', '100%')
    osmLabelSvgEl.setAttribute('height', '100%')
    osmLabelSvgEl.style.position = 'absolute'
    osmLabelSvgEl.style.top = '0'
    osmLabelSvgEl.style.left = '0'

    osmLabelOverlayEl.appendChild(osmLabelSvgEl)
    container.appendChild(osmLabelOverlayEl)
  }

  const teardownOsmLabelOverlay = (): void => {
    if (osmLabelCleanup) {
      osmLabelCleanup()
      osmLabelCleanup = null
    }
    if (osmLabelOverlayEl) {
      osmLabelOverlayEl.remove()
      osmLabelOverlayEl = null
    }
    osmLabelSvgEl = null
  }

  const pointOnArc = (center: L.Point, radiusPx: number, angleDeg: number): L.Point => {
    const radians = ((angleDeg - 90) * Math.PI) / 180
    return L.point(center.x + radiusPx * Math.cos(radians), center.y + radiusPx * Math.sin(radians))
  }

  const svgArcPath = (center: L.Point, radiusPx: number, startDeg: number, endDeg: number): string => {
    let normalizedEnd = endDeg
    while (normalizedEnd <= startDeg) normalizedEnd += 360
    const start = pointOnArc(center, radiusPx, startDeg)
    const end = pointOnArc(center, radiusPx, normalizedEnd)
    const largeArc = normalizedEnd - startDeg > 180 ? 1 : 0
    return `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} A ${radiusPx.toFixed(1)} ${radiusPx.toFixed(
      1
    )} 0 ${largeArc} 1 ${end.x.toFixed(1)} ${end.y.toFixed(1)}`
  }

  const renderOsmCoverageLabels = (labels: OsmCoverageLabelSpec[]): void => {
    if (!map.value || labels.length === 0) {
      teardownOsmLabelOverlay()
      return
    }
    ensureOsmLabelOverlay()
    if (!osmLabelSvgEl) return
    osmLabelSvgEl.replaceChildren()

    labels.forEach((labelSpec) => {
      const center = labelSpec.center
      const centerPoint = map.value!.latLngToContainerPoint(center)
      const radiusPoint = map.value!.latLngToContainerPoint(bearingHandlePosition(center, labelSpec.rangeMeters, 90))
      const radiusPx = centerPoint.distanceTo(radiusPoint) * OSM_LABEL_RIM_INSET
      if (radiusPx < 24) return

      const pathStart =
        labelSpec.bearing === null
          ? OSM_TOP_ARC_START_DEG
          : labelSpec.bearing - labelSpec.beamwidth / 2 + Math.min(8, labelSpec.beamwidth * 0.15)
      const pathEnd =
        labelSpec.bearing === null
          ? OSM_TOP_ARC_END_DEG
          : labelSpec.bearing + labelSpec.beamwidth / 2 - Math.min(8, labelSpec.beamwidth * 0.15)
      const angleSpan =
        labelSpec.bearing === null ? 120 : Math.max(24, labelSpec.beamwidth - Math.min(16, labelSpec.beamwidth * 0.3))
      const maxWidthPx = radiusPx * ((angleSpan * Math.PI) / 180)
      const text = fitLabelToArc(labelSpec.labelParts, maxWidthPx)

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('id', labelSpec.id)
      path.setAttribute('d', svgArcPath(centerPoint, radiusPx, pathStart, pathEnd))
      path.setAttribute('fill', 'none')
      path.setAttribute('stroke', 'none')

      const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      textEl.setAttribute('font-size', `${OSM_LABEL_FONT_SIZE_PX}`)
      textEl.setAttribute('font-family', 'sans-serif')
      textEl.setAttribute('fill', labelSpec.color)
      textEl.setAttribute('fill-opacity', `${store.config.mobileCoverage.overlayOpacity}`)
      textEl.setAttribute('stroke', 'rgba(0, 0, 0, 0.55)')
      textEl.setAttribute('stroke-width', '2')
      textEl.setAttribute('stroke-opacity', `${Math.max(0.35, store.config.mobileCoverage.overlayOpacity)}`)
      textEl.setAttribute('paint-order', 'stroke')
      textEl.setAttribute('letter-spacing', '0.2')

      const textPath = document.createElementNS('http://www.w3.org/2000/svg', 'textPath')
      textPath.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${labelSpec.id}`)
      textPath.setAttribute('href', `#${labelSpec.id}`)
      textPath.setAttribute('startOffset', '50%')
      textPath.setAttribute('text-anchor', 'middle')
      textPath.textContent = text

      textEl.appendChild(textPath)
      osmLabelSvgEl.appendChild(path)
      osmLabelSvgEl.appendChild(textEl)
    })
  }

  const renderOpenCellIdCoverageRings = (sites: OpenCellIdSite[], config: BaseStationConfig): void => {
    if (!map.value) return
    const filteredSites = filterOpenCellIdSites(sites, config.mobileCoverage.openCellIdOperator)
    if (filteredSites.length === 0) return
    const group = L.layerGroup()
    const labels: OsmCoverageLabelSpec[] = []
    filteredSites.forEach((site, index) => {
      L.circle([site.lat, site.lon], {
        radius: site.rangeMeters,
        color: config.coverageColor,
        weight: 1,
        dashArray: '5 5',
        opacity: config.mobileCoverage.overlayOpacity,
        fillColor: config.coverageColor,
        fillOpacity: OPENCELLID_RING_FILL_OPACITY * config.mobileCoverage.overlayOpacity,
        interactive: false,
      }).addTo(group)
      labels.push({
        id: `open-cell-id-label-${index}`,
        center: [site.lat, site.lon],
        rangeMeters: site.rangeMeters,
        bearing: null,
        beamwidth: 360,
        labelParts: openCellIdLabelParts(site),
        color: config.coverageColor,
      })
    })
    group.addTo(map.value)
    mobileCoverageLayer.value = group
    if (!config.mobileCoverage.showRingLabels) return
    renderOsmCoverageLabels(labels)
    const rerenderLabels = (): void => renderOsmCoverageLabels(labels)
    map.value.on('move zoom resize', rerenderLabels)
    osmLabelCleanup = () => map.value?.off('move zoom resize', rerenderLabels)
  }

  const updateCoverage = (config: BaseStationConfig): void => {
    removeLayer(coverageLayer.value)
    coverageLayer.value = undefined

    if (!map.value || !store.showCoverage || !config.position) return
    if (config.commsType !== BaseStationCommsType.RadioLink) return

    const stepStyle = {
      color: config.coverageColor,
      weight: 0,
      fillColor: config.coverageColor,
      fillOpacity: COVERAGE_STEP_OPACITY * config.coverageOpacity,
      interactive: false,
    }

    const isOmni = config.antenna.type === AntennaType.Omni
    const rangeMeters = effectiveAntennaRangeMeters(config)
    const group = L.layerGroup()

    for (let step = 1; step <= COVERAGE_GRADIENT_STEPS; step++) {
      const radius = (rangeMeters * step) / COVERAGE_GRADIENT_STEPS
      if (isOmni) {
        L.circle(config.position, { ...stepStyle, radius }).addTo(group)
        continue
      }
      const latlngs = sectorPolygonLatLngs(config.position, radius, config.antenna.bearing, config.antenna.beamwidth)
      L.polygon(latlngs, stepStyle).addTo(group)
    }

    group.addTo(map.value)
    coverageLayer.value = group
  }

  const updateTether = (config: BaseStationConfig): void => {
    removeLayer(tetherLayer.value)
    tetherLayer.value = undefined

    if (!map.value || !store.showCoverage || !config.position) return
    if (config.commsType !== BaseStationCommsType.Tethered) return

    tetherLayer.value = L.circle(config.position, {
      radius: config.tetherLengthMeters,
      color: config.coverageColor,
      weight: 1,
      opacity: config.coverageOpacity,
      fillColor: config.coverageColor,
      fillOpacity: 0.1 * config.coverageOpacity,
      dashArray: '4 4',
      interactive: false,
    }).addTo(map.value)
  }

  const updateBearingHandle = (config: BaseStationConfig): void => {
    const shouldShow =
      map.value !== undefined &&
      config.position !== null &&
      config.showSignalOnMap &&
      config.commsType === BaseStationCommsType.RadioLink &&
      config.antenna.type !== AntennaType.Omni

    if (!shouldShow) {
      removeLayer(bearingHandle.value)
      removeLayer(bearingLine.value)
      removeLayer(aimingArc.value)
      bearingHandle.value = undefined
      bearingLine.value = undefined
      aimingArc.value = undefined
      return
    }

    const rangeMeters = effectiveAntennaRangeMeters(config)
    const handleLatLng = bearingHandlePosition(config.position!, rangeMeters, config.antenna.bearing)
    const lineLatLngs = [config.position!, handleLatLng] as L.LatLngExpression[]
    const arcLatLngs = aimingArcLatLngs(config.position!, rangeMeters, config.antenna.bearing)
    const lineOpacity = 0.3 * config.coverageOpacity
    const arcOpacity = 0.25 * config.coverageOpacity

    if (bearingLine.value) {
      bearingLine.value.setLatLngs(lineLatLngs)
      bearingLine.value.setStyle({ color: config.coverageColor, opacity: lineOpacity })
    } else {
      bearingLine.value = L.polyline(lineLatLngs, {
        color: config.coverageColor,
        weight: 1,
        dashArray: '6 4',
        opacity: lineOpacity,
        interactive: false,
      }).addTo(map.value!)
    }

    if (aimingArc.value) {
      aimingArc.value.setLatLngs(arcLatLngs)
      aimingArc.value.setStyle({ color: config.coverageColor, opacity: arcOpacity })
    } else {
      aimingArc.value = L.polyline(arcLatLngs, {
        color: config.coverageColor,
        weight: 1,
        dashArray: '6 4',
        opacity: arcOpacity,
        interactive: false,
      }).addTo(map.value!)
    }

    // Update in place; recreating during drag would destroy the handle Leaflet is tracking
    // and stop the rotation after a single drag step.
    if (bearingHandle.value) {
      bearingHandle.value.setLatLng(handleLatLng)
      return
    }

    const handle = L.marker(handleLatLng, {
      icon: buildBearingHandleIcon(),
      draggable: true,
      zIndexOffset: 700,
      bubblingMouseEvents: true,
    })
    handle.on('drag', (event: L.LeafletEvent) => {
      const center = store.config.position
      if (!center) return
      const target = event.target as L.Marker
      const { lat, lng } = target.getLatLng()
      store.setBearing(bearingFromCenter(center, [lat, lng]))
    })
    handle.addTo(map.value!)
    bearingHandle.value = handle
  }

  const teardownRenderedMobileCoverage = (): void => {
    if (mobileCoverageController) {
      mobileCoverageController.abort()
      mobileCoverageController = null
    }
    if (mobileCoverageTargetToolController) {
      mobileCoverageTargetToolController.abort()
      mobileCoverageTargetToolController = null
    }
    if (mobileCoverageDebounce) {
      clearTimeout(mobileCoverageDebounce)
      mobileCoverageDebounce = null
    }
    teardownOsmLabelOverlay()
    removeLayer(mobileCoverageLayer.value)
    mobileCoverageLayer.value = undefined
  }

  const teardownMobileCoverageData = (): void => {
    teardownRenderedMobileCoverage()
    clearLoadedMobileCoverageData()
  }

  const renderOpenCellIdHeatmap = (sites: OpenCellIdSite[], config: BaseStationConfig): void => {
    if (!map.value) return
    const filteredSites = filterOpenCellIdSites(sites, config.mobileCoverage.openCellIdOperator)
    if (filteredSites.length === 0) return

    const heat = createCellIdHeatLayer({
      sites: filteredSites,
      radiusFraction: mobileHeatmapRadiusFraction(config),
      opacity: config.mobileCoverage.overlayOpacity,
    })
    heat.addTo(map.value)
    mobileCoverageLayer.value = heat
  }

  const renderOsmHeatmap = (towers: OverpassTower[], config: BaseStationConfig): void => {
    if (!map.value || towers.length === 0) return
    const selectedOperator = config.mobileCoverage.osmOperator
    const heatSites = (selectedOperator ? towers.filter((tower) => tower.operator === selectedOperator) : towers).map(
      (tower) => ({
        lat: tower.lat,
        lon: tower.lon,
        rangeMeters: overpassRangeMeters(tower.tags),
      })
    )
    if (heatSites.length === 0) return
    const heat = createCellIdHeatLayer({
      sites: heatSites,
      radiusFraction: mobileHeatmapRadiusFraction(config, 1.5),
      opacity: config.mobileCoverage.overlayOpacity,
    })
    heat.addTo(map.value)
    mobileCoverageLayer.value = heat
  }

  const renderOsmCoverage = (towers: OverpassTower[], config: BaseStationConfig): void => {
    if (!map.value || towers.length === 0) return
    const selectedOperator = config.mobileCoverage.osmOperator
    const filtered = selectedOperator ? towers.filter((t) => t.operator === selectedOperator) : towers
    if (filtered.length === 0) return

    const group = L.layerGroup()
    const labels: OsmCoverageLabelSpec[] = []

    filtered.forEach((tower) => {
      const center = [tower.lat, tower.lon] as WaypointCoordinates
      const bearing = overpassBearing(tower.tags)
      const beamwidth = overpassBeamwidth(tower.tags, bearing)
      const rangeMeters = overpassRangeMeters(tower.tags)
      const color = operatorColor(tower.operator)

      if (bearing === null || beamwidth >= 360) {
        L.circle(center, {
          radius: rangeMeters,
          color,
          weight: 1,
          dashArray: '5 5',
          opacity: OSM_COVERAGE_STROKE_OPACITY * config.mobileCoverage.overlayOpacity,
          fillColor: color,
          fillOpacity: OSM_COVERAGE_FILL_OPACITY * config.mobileCoverage.overlayOpacity,
          interactive: false,
        }).addTo(group)
      } else {
        L.polygon(sectorPolygonLatLngs(center, rangeMeters, bearing, beamwidth), {
          color,
          weight: 1,
          dashArray: '5 5',
          opacity: OSM_COVERAGE_STROKE_OPACITY * config.mobileCoverage.overlayOpacity,
          fillColor: color,
          fillOpacity: OSM_COVERAGE_FILL_OPACITY * config.mobileCoverage.overlayOpacity,
          interactive: false,
        }).addTo(group)
      }

      labels.push({
        id: `osm-coverage-label-${tower.id}`,
        center,
        rangeMeters,
        bearing,
        beamwidth,
        labelParts: overpassLabelParts(tower),
        color,
      })
    })

    group.addTo(map.value)
    mobileCoverageLayer.value = group
    if (!config.mobileCoverage.showRingLabels) return
    renderOsmCoverageLabels(labels)

    const rerenderLabels = (): void => renderOsmCoverageLabels(labels)
    map.value.on('move zoom resize', rerenderLabels)
    osmLabelCleanup = () => map.value?.off('move zoom resize', rerenderLabels)
  }

  const renderMobileCoverage = async (config: BaseStationConfig): Promise<void> => {
    teardownRenderedMobileCoverage()

    if (!map.value || !config.enabled || !config.position) return
    if (!config.showSignalOnMap) return
    if (config.commsType !== BaseStationCommsType.MobileData) return

    const provider = config.mobileCoverage.provider
    if (provider === MobileCoverageProvider.Custom) {
      const url = config.mobileCoverage.customTileUrl.trim()
      if (!url) return
      mobileCoverageLayer.value = L.tileLayer(url, { opacity: config.mobileCoverage.overlayOpacity }).addTo(map.value)
      return
    }

    if (provider === MobileCoverageProvider.OpenCellID) {
      const sites =
        cachedOpenCellIdSites.value ??
        (loadOpenCellIdSitesFromStorage(config.position) ? cachedOpenCellIdSites.value : null)
      if (!sites || sites.length === 0) return
      if (config.mobileCoverage.displayMode === MobileCoverageDisplayMode.CoverageRings) {
        renderOpenCellIdCoverageRings(sites, config)
        return
      }
      renderOpenCellIdHeatmap(sites, config)
      return
    }

    const towers =
      cachedOverpassTowers.value ?? (loadOverpassTowersFromStorage(config.position) ? cachedOverpassTowers.value : null)
    if (!towers || towers.length === 0) return
    if (config.mobileCoverage.displayMode === MobileCoverageDisplayMode.Heatmap) {
      renderOsmHeatmap(towers, config)
      return
    }
    renderOsmCoverage(towers, config)
  }

  const fetchAndAppendMobileCoverage = async (position: WaypointCoordinates): Promise<void> => {
    const provider = store.config.mobileCoverage.provider
    if (provider === MobileCoverageProvider.Custom) {
      openSnackbar({
        variant: 'info',
        message: 'Custom overlays cannot be fetched from the map target tool.',
        duration: 3500,
      })
      return
    }

    if (mobileCoverageTargetToolController) mobileCoverageTargetToolController.abort()
    const controller = new AbortController()
    mobileCoverageTargetToolController = controller
    store.mobileCoverageLoading = true
    try {
      if (provider === MobileCoverageProvider.OpenCellID) {
        const apiKey = store.config.mobileCoverage.openCellIdApiKey.trim()
        const { sites, fetchedBbox } = await fetchOpenCellIdSites(position, apiKey, controller.signal)
        if (controller.signal.aborted) return
        appendOpenCellIdSites(fetchedBbox, sites)
        store.openCellIdApiKeyStatus = apiKey ? 'valid' : 'unknown'
        if (sites.length === 0) {
          openSnackbar({
            variant: 'info',
            message: `${provider} returned no cellular data around the dropped target.`,
            duration: 4000,
          })
        } else {
          openSnackbar({
            variant: 'success',
            message: `Added ${sites.length} OpenCellID sites around the dropped target.`,
            duration: 3000,
          })
        }
      } else {
        const bbox = overpassBboxAround(position[0], position[1])
        const towers = await fetchOverpassTowers(bbox, controller.signal)
        if (controller.signal.aborted) return
        appendOverpassTowers(bbox, towers)
        if (towers.length === 0) {
          openSnackbar({
            variant: 'info',
            message: `${provider} returned no cellular data around the dropped target.`,
            duration: 4000,
          })
        } else {
          openSnackbar({
            variant: 'success',
            message: `Added ${towers.length} OSM towers around the dropped target.`,
            duration: 3000,
          })
        }
      }
      await renderMobileCoverage(store.config)
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return
      const errorMessage = (err as Error).message
      if (provider === MobileCoverageProvider.OpenCellID && store.config.mobileCoverage.openCellIdApiKey.trim()) {
        if (isOpenCellIdInvalidApiKeyError(errorMessage)) {
          store.openCellIdApiKeyStatus = 'invalid'
          openSnackbar({
            variant: 'error',
            message: 'OpenCellID API key is invalid. Check the key and try again.',
            duration: 4000,
          })
          return
        }
        store.openCellIdApiKeyStatus = 'unknown'
      }
      openSnackbar({
        variant: 'error',
        message: `Mobile coverage fetch failed: ${errorMessage}`,
        duration: 4000,
      })
    } finally {
      if (mobileCoverageTargetToolController === controller) mobileCoverageTargetToolController = null
      store.mobileCoverageLoading = false
    }
  }

  const fetchMobileCoverageData = async (config: BaseStationConfig, forceReload = false): Promise<void> => {
    if (!map.value || !config.enabled || !config.position) return
    if (config.commsType !== BaseStationCommsType.MobileData) return

    const provider = config.mobileCoverage.provider
    if (provider === MobileCoverageProvider.Custom) {
      await renderMobileCoverage(config)
      return
    }

    const controller = new AbortController()
    mobileCoverageController = controller
    store.mobileCoverageLoading = true
    try {
      if (provider === MobileCoverageProvider.OpenCellID) {
        const apiKey = config.mobileCoverage.openCellIdApiKey.trim()
        if (!apiKey) {
          store.openCellIdApiKeyStatus = 'unknown'
          if (!isElectron()) {
            openSnackbar({
              variant: 'info',
              message:
                'OpenCellID requires an API key in the web build. Add one in the base-station config to load coverage.',
              duration: 5000,
            })
            return
          }
        }
        if (!forceReload && loadOpenCellIdSitesFromStorage(config.position)) {
          await renderMobileCoverage(config)
          return
        }
        const { sites, fetchedBbox } = await fetchOpenCellIdSites(config.position, apiKey, controller.signal)
        if (controller.signal.aborted) return
        storeOpenCellIdSites(fetchedBbox, sites)
        if (apiKey) store.openCellIdApiKeyStatus = 'valid'
        if (sites.length === 0) {
          openSnackbar({
            variant: 'info',
            message: `${provider} returned no cellular data around the base station.`,
            duration: 4000,
          })
          return
        }
      } else {
        const coverageBbox = overpassBboxAround(config.position[0], config.position[1])
        if (!forceReload && loadOverpassTowersFromStorage(config.position)) {
          await renderMobileCoverage(config)
          return
        }
        const towers = await fetchOverpassTowers(coverageBbox, controller.signal)
        if (controller.signal.aborted) return
        storeOverpassTowers(coverageBbox, towers)
        if (towers.length === 0) {
          openSnackbar({
            variant: 'info',
            message: `${provider} returned no cellular data around the base station.`,
            duration: 4000,
          })
          return
        }
      }

      await renderMobileCoverage(config)
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return
      const errorMessage = (err as Error).message
      if (provider === MobileCoverageProvider.OpenCellID && config.mobileCoverage.openCellIdApiKey.trim()) {
        if (isOpenCellIdInvalidApiKeyError(errorMessage)) {
          store.openCellIdApiKeyStatus = 'invalid'
          openSnackbar({
            variant: 'error',
            message: 'OpenCellID API key is invalid. Check the key and try again.',
            duration: 4000,
          })
          return
        }
        store.openCellIdApiKeyStatus = 'unknown'
      }
      if (
        provider === MobileCoverageProvider.OpenCellID &&
        config.position &&
        loadOpenCellIdSitesFromStorage(config.position) &&
        cachedOpenCellIdSites.value?.length
      ) {
        await renderMobileCoverage(config)
        return
      }
      openSnackbar({
        variant: 'error',
        message: `Mobile coverage fetch failed: ${errorMessage}`,
        duration: 4000,
      })
    } finally {
      if (mobileCoverageController === controller) mobileCoverageController = null
      store.mobileCoverageLoading = false
    }
  }

  const refreshAll = (): void => {
    if (!map.value || !mapReady.value) return
    const config = store.config

    if (!config.enabled || !config.position) {
      removeLayer(marker.value)
      removeLayer(coverageLayer.value)
      removeLayer(tetherLayer.value)
      removeLayer(bearingHandle.value)
      removeLayer(bearingLine.value)
      removeLayer(aimingArc.value)
      teardownMobileCoverageData()
      marker.value = undefined
      coverageLayer.value = undefined
      tetherLayer.value = undefined
      bearingHandle.value = undefined
      bearingLine.value = undefined
      aimingArc.value = undefined
      lastMarkerLabel = null
      lastMarkerColor = null
      return
    }

    ensureMarker(config)
    updateCoverage(config)
    updateTether(config)
    updateBearingHandle(config)
  }

  watch([map, mapReady], refreshAll, { immediate: true })
  watch(
    [map, mapReady],
    () => {
      if (!map.value || !mapReady.value) return
      attachMapDropHandlers()
    },
    { immediate: true }
  )
  // Geometry-relevant fields only; mobile-coverage overlay has its own watcher above and
  // is intentionally excluded so live edits to API keys / opacity / labels don't rebuild
  // every Leaflet layer in the overlay.
  watch(
    () => [
      store.config.enabled,
      store.config.position?.[0],
      store.config.position?.[1],
      store.config.name,
      store.config.coverageColor,
      store.config.coverageOpacity,
      store.config.commsType,
      store.config.tetherLengthMeters,
      store.config.showSignalOnMap,
      store.config.antenna.type,
      store.config.antenna.bearing,
      store.config.antenna.beamwidth,
      store.config.antenna.range,
      store.config.baseStationAntennaHeightMeters,
      store.config.vehicleHasBlueBoatAntennaMast,
      store.showCoverage,
    ],
    refreshAll
  )

  // Debounced so live edits to API key / tile URL don't hammer the public APIs on every keystroke.
  watch(
    () => [
      mapReady.value,
      store.config.commsType,
      store.config.mobileCoverage.provider,
      store.config.mobileCoverage.openCellIdApiKey,
      store.config.mobileCoverage.customTileUrl,
      store.config.position,
    ],
    () => {
      teardownMobileCoverageData()
      mobileCoverageDebounce = setTimeout(() => void fetchMobileCoverageData(store.config), 500)
    },
    { immediate: true }
  )

  watch(
    () => store.mobileCoverageReloadToken,
    () => {
      teardownMobileCoverageData()
      mobileCoverageDebounce = setTimeout(() => void fetchMobileCoverageData(store.config, true), 100)
    }
  )

  watch(
    () => store.mobileCoverageVisibleDataResetToken,
    () => {
      void resetVisibleMobileCoverageData()
    }
  )

  // Visual-only re-render. Provider/commsType/customTileUrl/position are already covered by
  // the fetch watcher above — pulling them in here would cause a render against the empty
  // cache before the fetch completes.
  watch(
    () => [
      mapReady.value,
      store.config.mobileCoverage.displayMode,
      store.config.mobileCoverage.overlayOpacity,
      store.config.mobileCoverage.osmOperator,
      store.config.mobileCoverage.openCellIdOperator,
      store.config.mobileCoverage.showRingLabels,
      store.config.mobileCoverage.heatmapIntensity,
      store.config.coverageColor,
      store.config.showSignalOnMap,
    ],
    () => {
      void renderMobileCoverage(store.config)
    },
    { immediate: true }
  )

  watch(
    () => [mapReady.value, store.mobileCoverageTargetToolActive] as const,
    ([ready, active]) => {
      if (!ready || !map.value) return
      if (active) attachTargetToolHandlers()
      else detachTargetToolHandlers?.()
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    detachMapDropHandlers?.()
    detachTargetToolHandlers?.()
    teardownMobileCoverageData()
    removeLayer(marker.value)
    removeLayer(coverageLayer.value)
    removeLayer(tetherLayer.value)
    removeLayer(bearingHandle.value)
    removeLayer(bearingLine.value)
    removeLayer(aimingArc.value)
    marker.value = undefined
    coverageLayer.value = undefined
    tetherLayer.value = undefined
    bearingHandle.value = undefined
    bearingLine.value = undefined
    aimingArc.value = undefined
  })

  return { openConfigPanel }
}
