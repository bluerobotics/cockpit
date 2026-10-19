import '@/styles/baseStationOverlay.css'

import { useDebounceFn } from '@vueuse/core'
import { type Ref, type ShallowRef, onBeforeUnmount, shallowRef, watch } from 'vue'

import { useBaseStation } from '@/composables/baseStation/useBaseStation'
import { openSnackbar } from '@/composables/snackbar'
import {
  type CellIdHeatLayerInstance,
  createCellIdHeatLayer,
  mobileHeatmapRadiusFraction,
} from '@/libs/baseStation/cellIdHeatLayer'
import {
  aimingArcLatLngs,
  bearingBetween,
  bearingHandlePosition,
  effectiveAntennaRangeMeters,
  sectorPolygonLatLngs,
} from '@/libs/baseStation/coverage'
import {
  bboxContains,
  bboxEquals,
  bboxIntersects,
  mapBoundsToCoverageBbox,
  overpassBboxAround,
  trimCacheEntries,
} from '@/libs/baseStation/coverageBbox'
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
import type { CockpitMap, MapPointerEvent } from '@/libs/map/cesium-map'
import { type MapMarker, divIconMarker, setDivIcon } from '@/libs/map/cesium-marker'
import { type VectorFeature, lineFeature, meterCircleRing, polygonFeature } from '@/libs/map/cesium-vectors'
import { addRasterLayer } from '@/libs/map/raster-layers'
import type { ScreenPoint } from '@/libs/map/survey-polygon-edges'
import { isMapReady } from '@/libs/map/utils-map'
import { escapeHtml, isElectron } from '@/libs/utils'
import {
  type BaseStationConfig,
  type CachedMobileCoverageEntry,
  type CoverageBbox,
  AntennaType,
  BaseStationCommsType,
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

const notifyOpenCellIdKeyRequired = (): void => {
  openSnackbar({
    variant: 'info',
    message: isElectron()
      ? 'OpenCellID requires a personal API key. Add one in the base-station config, or switch to OpenStreetMap coverage to load data without a key.'
      : 'OpenCellID coverage cannot be loaded from a browser. Switch to OpenStreetMap coverage, or install Cockpit Standalone to use OpenCellID.',
    duration: 5000,
  })
}

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

type FetchableMobileCoverageProvider = Exclude<MobileCoverageProvider, MobileCoverageProvider.Custom>

/** Whether a fetch replaces the dataset cached for a position or merges into it. */
type MobileCoveragePersistMode = 'store' | 'append'

/* eslint-disable jsdoc/require-jsdoc -- Per-provider fetch arm; field names are self-describing. */
type MobileCoverageFetcher = {
  noun: string
  loadFromStorage: (position: WaypointCoordinates) => boolean
  // Resolves with how many entries came back, or null when the fetch was aborted mid-flight.
  fetch: (position: WaypointCoordinates, signal: AbortSignal, mode: MobileCoveragePersistMode) => Promise<number | null>
}
/* eslint-enable jsdoc/require-jsdoc */

const OSM_COVERAGE_FILL_OPACITY = 0.12
const OSM_COVERAGE_STROKE_OPACITY = 0.75
const OPENCELLID_RING_FILL_OPACITY = 0.08
const OSM_LABEL_FONT_SIZE_PX = 10
const OSM_LABEL_RIM_INSET = 0.92
const OSM_TOP_ARC_START_DEG = 300
const OSM_TOP_ARC_END_DEG = 60

const baseStationMarkerHtml = (label: string, color: string): string => `
  <div class="base-station-marker-container">
    <div class="base-station-marker-background" style="background-color: ${color.slice(0, 7)}cc"></div>
    <i class="v-icon notranslate mdi mdi-radio-tower" style="color: white; position: relative; z-index: 2; font-size: 16px;"></i>
    ${label ? `<div class="base-station-marker-label">${escapeHtml(label)}</div>` : ''}
  </div>
`

let overlayInstanceCount = 0

/** Something drawn on the map, and the way to take it off. */
type RemovableDrawing = {
  /** Removes the drawing from the map. */
  remove: () => void
}

/** A coordinate and the container point it was drawn at. */
type PanOrigin = {
  /** The coordinate. */
  latLng: ReturnType<CockpitMap['getCenter']>
  /** Where it was drawn, in container pixels. */
  point: ScreenPoint
}

/** How a group of coverage shapes is stroked; every shape in it shares the stroke width and dash pattern. */
type ShapeGroupStroke = {
  /** Stroke width, in pixels, or 0 for unstroked shapes. */
  weight: number
  /** Dash pattern, in pixels. */
  dashPattern?: number[]
}

/** How one coverage shape is painted. */
type ShapePaint = {
  /** Stroke color. */
  color: string
  /** Stroke opacity. */
  opacity?: number
  /** Fill color, for areas. */
  fillColor?: string
  /** Fill opacity, for areas. */
  fillOpacity?: number
}

/** The outline of a coverage shape: an area to fill, or a line. */
type ShapeGeometry =
  | {
      /** An area. */
      kind: 'area'
      /** Its ring. */
      ring: WaypointCoordinates[]
    }
  | {
      /** A line. */
      kind: 'line'
      /** Its vertices. */
      coordinates: WaypointCoordinates[]
    }

/** A coverage shape and how it is painted. */
type PaintedShape = {
  /** The outline. */
  geometry: ShapeGeometry
  /** The paint, with its defaults filled in. */
  paint: Required<ShapePaint>
}

const areaShape = (ring: WaypointCoordinates[]): ShapeGeometry => ({ kind: 'area', ring })
const circleShape = (center: WaypointCoordinates, radiusMeters: number): ShapeGeometry =>
  areaShape(meterCircleRing(center, radiusMeters))
const lineShape = (coordinates: WaypointCoordinates[]): ShapeGeometry => ({ kind: 'line', coordinates })

const paintedShape = (geometry: ShapeGeometry, paint: ShapePaint): PaintedShape => ({
  geometry,
  paint: {
    color: paint.color,
    opacity: paint.opacity ?? 1,
    fillColor: paint.fillColor ?? paint.color,
    fillOpacity: paint.fillOpacity ?? 0.2,
  },
})

// Custom coverage overlays were always hidden past zoom 18, the tile-layer default they were first drawn with.
const customCoverageMaxZoom = 18

// The map widget can be placed several times, and the coverage data, its cache and the position
// it is fetched for are all app-wide, so a single instance fetches while the others draw from the
// shared cache: otherwise every extra map repeats the same requests to the public tower services.
const coverageDataOwner = shallowRef<symbol | null>(null)

/**
 * Renders the base-station marker, antenna coverage and tether circle on a map and
 * keeps them in sync with the {@link useBaseStation} state. Mounting and unmounting are
 * handled automatically.
 * @param {ShallowRef<CockpitMap | undefined>} map Reactive reference to the map instance.
 * @param {Ref<boolean>} mapReady Reactive flag that becomes true once the map is initialized.
 * @returns {void}
 */
export const useBaseStationOverlay = (map: ShallowRef<CockpitMap | undefined>, mapReady: Ref<boolean>): void => {
  const store = useBaseStation()

  const overlayId = Symbol('baseStationOverlay')
  const ownsCoverageData = (): boolean => coverageDataOwner.value === overlayId
  if (coverageDataOwner.value === null) coverageDataOwner.value = overlayId

  // Label arcs are referenced by SVG fragment id, which resolves document-wide, so every overlay
  // instance namespaces its ids to keep a second map's labels off the first map's geometry.
  const overlayInstanceIndex = ++overlayInstanceCount

  const marker = shallowRef<MapMarker | undefined>()
  const bearingHandle = shallowRef<MapMarker | undefined>()
  // What the mobile coverage is currently drawn as: a shape group, a raster overlay or a heatmap, each removable.
  const mobileCoverageLayer = shallowRef<RemovableDrawing | undefined>()
  // The map the shape groups were drawn on, so their teardown still reaches it once the map ref has moved on.
  let shapesMap: CockpitMap | undefined
  const cachedOpenCellIdSites = shallowRef<OpenCellIdSite[] | null>(null)
  const cachedOverpassTowers = shallowRef<OverpassTower[] | null>(null)

  // Live values while a handle is being dragged, preferred over the persisted config by
  // `refreshAll` so the overlay follows the pointer without writing (and vehicle-syncing) the
  // whole config on every drag event. The store is written once, on drag end.
  const draggedPosition = shallowRef<WaypointCoordinates | null>(null)
  const draggedBearing = shallowRef<number | null>(null)

  let mobileCoverageController: AbortController | null = null
  let mobileCoverageTargetToolController: AbortController | null = null
  let mobileCoverageDebounce: ReturnType<typeof setTimeout> | null = null
  let openCellIdKeyRequiredNotified = false
  let detachMapDropHandlers: (() => void) | null = null
  let detachTargetToolHandlers: (() => void) | null = null
  let osmLabelOverlayEl: HTMLDivElement | null = null
  let osmLabelSvgEl: SVGSVGElement | null = null
  let osmLabelCleanup: (() => void) | null = null
  let lastMarkerLabel: string | null = null
  let lastMarkerColor: string | null = null

  const shapeGroupId = (name: string): string => `coverage::base-station-${overlayInstanceIndex}-${name}`

  // Draws a group of coverage shapes (areas and lines) as one layer, painting each from its own paint.
  const setShapeGroup = (name: string, shapes: PaintedShape[], stroke: ShapeGroupStroke): void => {
    if (!map.value) return
    shapesMap = map.value
    const features: VectorFeature[] = shapes.flatMap(({ geometry, paint }) => {
      const line = { color: paint.color, opacity: paint.opacity, width: stroke.weight, dashPattern: stroke.dashPattern }
      if (geometry.kind === 'line') return stroke.weight > 0 ? [lineFeature(geometry.coordinates, line)] : []
      const area = polygonFeature(geometry.ring, { color: paint.fillColor, opacity: paint.fillOpacity })
      return stroke.weight > 0 ? [area, lineFeature([...geometry.ring, geometry.ring[0]], line)] : [area]
    })
    map.value.setVectors(shapeGroupId(name), 'coverage', features)
  }

  const removeShapeGroup = (name: string): void => {
    ;(shapesMap ?? map.value)?.removeVectors(shapeGroupId(name))
  }

  const attachMapDropHandlers = (): void => {
    if (!isMapReady(map.value)) return
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
      void fetchAndAppendMobileCoverage(map.value.unproject(map.value.pointFromClient(event)))
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
    if (!isMapReady(map.value)) return
    detachTargetToolHandlers?.()
    // The canvas container is where the map sets its own grab cursor, so the target cursor has to go there too.
    const container = map.value.getCanvasContainer()
    const previousCursor = container.style.cursor
    container.style.cursor = TARGET_CURSOR_URL
    const onMapClick = (event: MapPointerEvent): void => {
      store.mobileCoverageTargetToolActive = false
      void fetchAndAppendMobileCoverage(event.latLng)
    }
    map.value.on('click', onMapClick)
    detachTargetToolHandlers = () => {
      container.style.cursor = previousCursor
      map.value?.off('click', onMapClick)
      detachTargetToolHandlers = null
    }
  }

  const clearLoadedMobileCoverageData = (): void => {
    cachedOpenCellIdSites.value = null
    cachedOverpassTowers.value = null
    store.availableOsmOperators = []
    store.availableOpenCellIdOperators = []
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
    // returned 0 sites, and an entry with zero results must not block a re-fetch.
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
    const visibleArea = mapBoundsToCoverageBbox(map.value.getBounds())
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

  const ensureMarker = (config: BaseStationConfig): void => {
    if (!map.value || !config.position) return
    const markerLabel = config.name.trim()
    if (marker.value) {
      marker.value.setLatLng(config.position)
      // Only redraw the icon when its definition actually changed, so a drag is not handed a fresh element
      // on every step.
      if (markerLabel !== lastMarkerLabel || config.coverageColor !== lastMarkerColor) {
        setDivIcon(marker.value, { html: baseStationMarkerHtml(markerLabel, config.coverageColor), size: [24, 24] })
        lastMarkerLabel = markerLabel
        lastMarkerColor = config.coverageColor
      }
      return
    }
    const m = divIconMarker({
      className: 'base-station-marker-icon',
      html: baseStationMarkerHtml(markerLabel, config.coverageColor),
      size: [24, 24],
      draggable: true,
    })
    m.getElement().style.zIndex = '600'
    lastMarkerLabel = markerLabel
    lastMarkerColor = config.coverageColor
    m.on('drag', () => {
      draggedPosition.value = m.getLatLng()
    })
    m.on('dragend', () => {
      draggedPosition.value = null
      store.setPosition(m.getLatLng())
    })
    // The marker owns its own right-click popup; don't propagate to the map context menu.
    const element = m.getElement()
    element.addEventListener('contextmenu', (event: MouseEvent) => {
      event.stopPropagation()
      event.preventDefault()
      store.openContextPopup(event.clientX, event.clientY)
    })
    element.addEventListener('click', (event: MouseEvent) => event.stopPropagation())
    m.setLatLng(config.position).addTo(map.value)
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

  const pointOnArc = (center: ScreenPoint, radiusPx: number, angleDeg: number): ScreenPoint => {
    const radians = ((angleDeg - 90) * Math.PI) / 180
    return { x: center.x + radiusPx * Math.cos(radians), y: center.y + radiusPx * Math.sin(radians) }
  }

  const svgArcPath = (center: ScreenPoint, radiusPx: number, startDeg: number, endDeg: number): string => {
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
    const svgEl = osmLabelSvgEl
    if (!svgEl) return
    svgEl.replaceChildren()

    labels.forEach((labelSpec) => {
      const center = labelSpec.center
      const centerPoint = map.value!.project(center)
      const radiusPoint = map.value!.project(bearingHandlePosition(center, labelSpec.rangeMeters, 90))
      const radiusPx = Math.hypot(radiusPoint.x - centerPoint.x, radiusPoint.y - centerPoint.y) * OSM_LABEL_RIM_INSET
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
      svgEl.appendChild(path)
      svgEl.appendChild(textEl)
    })
  }

  // Panning translates the label layer as a whole instead of regenerating every label's SVG:
  // bound to `move`, the rebuild ran for every tower in view on each animation frame.
  const bindCoverageLabelRerender = (labels: OsmCoverageLabelSpec[]): void => {
    if (!map.value || labels.length === 0) return
    const mapInstance = map.value
    // Where the view center was drawn when the move started, which the labels are translated against.
    let panOrigin: PanOrigin | null = null
    let zooming = false
    let unbound = false

    const rebuild = (): void => {
      if (unbound) return
      panOrigin = null
      zooming = false
      if (osmLabelOverlayEl) {
        osmLabelOverlayEl.style.transform = ''
        osmLabelOverlayEl.style.visibility = ''
      }
      renderOsmCoverageLabels(labels)
    }
    const onMoveStart = (): void => {
      const latLng = mapInstance.getCenter()
      panOrigin = { latLng, point: mapInstance.project(latLng) }
    }
    const onMove = (): void => {
      if (!osmLabelOverlayEl || panOrigin === null || zooming) return
      const point = mapInstance.project(panOrigin.latLng)
      osmLabelOverlayEl.style.transform = `translate(${point.x - panOrigin.point.x}px, ${
        point.y - panOrigin.point.y
      }px)`
    }
    // A zoom rescales the rings the labels sit on, so no translation can keep them aligned;
    // they stay hidden until `moveend`, which the map fires at the end of a zoom too.
    const onZoomStart = (): void => {
      zooming = true
      if (osmLabelOverlayEl) osmLabelOverlayEl.style.visibility = 'hidden'
    }

    // A container resize arrives once per frame while the map widget is being dragged to a new size,
    // so the rebuild it triggers is coalesced to the end of the gesture.
    const debouncedRebuild = useDebounceFn(rebuild, 200)

    mapInstance.on('movestart', onMoveStart)
    mapInstance.on('move', onMove)
    mapInstance.on('zoomstart', onZoomStart)
    mapInstance.on('moveend', rebuild)
    mapInstance.on('resize', debouncedRebuild)
    osmLabelCleanup = () => {
      unbound = true
      mapInstance.off('movestart', onMoveStart)
      mapInstance.off('move', onMove)
      mapInstance.off('zoomstart', onZoomStart)
      mapInstance.off('moveend', rebuild)
      mapInstance.off('resize', debouncedRebuild)
    }
  }

  const renderOpenCellIdCoverageRings = (sites: OpenCellIdSite[], config: BaseStationConfig): void => {
    if (!map.value) return
    const filteredSites = filterOpenCellIdSites(sites, config.mobileCoverage.openCellIdOperator)
    if (filteredSites.length === 0) return
    const rings: PaintedShape[] = []
    const labels: OsmCoverageLabelSpec[] = []
    filteredSites.forEach((site, index) => {
      rings.push(
        paintedShape(circleShape([site.lat, site.lon], site.rangeMeters), {
          color: config.coverageColor,
          opacity: config.mobileCoverage.overlayOpacity,
          fillColor: config.coverageColor,
          fillOpacity: OPENCELLID_RING_FILL_OPACITY * config.mobileCoverage.overlayOpacity,
        })
      )
      labels.push({
        id: `open-cell-id-label-${overlayInstanceIndex}-${index}`,
        center: [site.lat, site.lon],
        rangeMeters: site.rangeMeters,
        bearing: null,
        beamwidth: 360,
        labelParts: openCellIdLabelParts(site),
        color: config.coverageColor,
      })
    })
    setShapeGroup('mobile', rings, { weight: 1, dashPattern: [5, 5] })
    mobileCoverageLayer.value = { remove: () => removeShapeGroup('mobile') }
    if (!config.mobileCoverage.showRingLabels) return
    renderOsmCoverageLabels(labels)
    bindCoverageLabelRerender(labels)
  }

  const updateCoverage = (config: BaseStationConfig): void => {
    if (!map.value || !store.showCoverage || !config.position || config.commsType !== BaseStationCommsType.RadioLink) {
      removeShapeGroup('coverage')
      return
    }

    const position = config.position
    const isOmni = config.antenna.type === AntennaType.Omni
    const rangeMeters = effectiveAntennaRangeMeters(config)
    const stepPaint: ShapePaint = {
      color: config.coverageColor,
      fillColor: config.coverageColor,
      fillOpacity: COVERAGE_STEP_OPACITY * config.coverageOpacity,
    }
    const stepRadius = (step: number): number => (rangeMeters * step) / COVERAGE_GRADIENT_STEPS

    // The steps are features of one source whose data is replaced in place, so a bearing drag does not rebuild
    // any layer.
    const steps: PaintedShape[] = []
    for (let step = 1; step <= COVERAGE_GRADIENT_STEPS; step++) {
      const radius = stepRadius(step)
      const shape = isOmni
        ? circleShape(position, radius)
        : areaShape(sectorPolygonLatLngs(position, radius, config.antenna.bearing, config.antenna.beamwidth))
      steps.push(paintedShape(shape, stepPaint))
    }
    setShapeGroup('coverage', steps, { weight: 0 })
  }

  const updateTether = (config: BaseStationConfig): void => {
    if (!map.value || !store.showCoverage || !config.position || config.commsType !== BaseStationCommsType.Tethered) {
      removeShapeGroup('tether')
      return
    }

    const tether = paintedShape(circleShape(config.position, config.tetherLengthMeters), {
      color: config.coverageColor,
      opacity: config.coverageOpacity,
      fillColor: config.coverageColor,
      fillOpacity: 0.1 * config.coverageOpacity,
    })
    setShapeGroup('tether', [tether], { weight: 1, dashPattern: [4, 4] })
  }

  const updateBearingHandle = (config: BaseStationConfig): void => {
    const shouldShow =
      map.value !== undefined &&
      config.position !== null &&
      config.showSignalOnMap &&
      config.commsType === BaseStationCommsType.RadioLink &&
      config.antenna.type !== AntennaType.Omni

    if (!shouldShow) {
      bearingHandle.value?.remove()
      bearingHandle.value = undefined
      removeShapeGroup('aiming')
      return
    }

    const rangeMeters = effectiveAntennaRangeMeters(config)
    const handleLatLng = bearingHandlePosition(config.position!, rangeMeters, config.antenna.bearing)
    const arcLatLngs = aimingArcLatLngs(config.position!, rangeMeters, config.antenna.bearing)
    setShapeGroup(
      'aiming',
      [
        paintedShape(lineShape([config.position!, handleLatLng]), {
          color: config.coverageColor,
          opacity: 0.3 * config.coverageOpacity,
        }),
        paintedShape(lineShape(arcLatLngs), { color: config.coverageColor, opacity: 0.25 * config.coverageOpacity }),
      ],
      { weight: 1, dashPattern: [6, 4] }
    )

    // Update in place; recreating during drag would destroy the handle being dragged
    // and stop the rotation after a single drag step.
    if (bearingHandle.value) {
      bearingHandle.value.setLatLng(handleLatLng)
      return
    }

    const handle = divIconMarker({
      className: 'base-station-bearing-handle',
      html: '<div class="base-station-bearing-handle-dot"></div>',
      size: [18, 18],
      draggable: true,
    })
    handle.getElement().style.zIndex = '700'
    handle.on('drag', () => {
      const center = store.config.position
      if (!center) return
      draggedBearing.value = bearingBetween(center, handle.getLatLng())
    })
    handle.on('dragend', () => {
      const bearing = draggedBearing.value
      draggedBearing.value = null
      if (bearing !== null) store.setBearing(bearing)
    })
    handle.setLatLng(handleLatLng).addTo(map.value!)
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
    teardownOsmLabelOverlay()
    mobileCoverageLayer.value?.remove()
    mobileCoverageLayer.value = undefined
  }

  const teardownMobileCoverageData = (): void => {
    teardownRenderedMobileCoverage()
    // The pending fetch belongs to this function, not to the render teardown above: the
    // visual-only watcher re-renders right after the fetch watcher arms the timer, and clearing
    // it from there would cancel the initial load before it ever runs.
    if (mobileCoverageDebounce) {
      clearTimeout(mobileCoverageDebounce)
      mobileCoverageDebounce = null
    }
    // Operator lists live on the singleton: a non-owner that clears them empties the panel
    // filter until the next owner fetch, and the owner does not refetch on a sibling unmount.
    if (!ownsCoverageData()) return
    clearLoadedMobileCoverageData()
  }

  const renderOpenCellIdHeatmap = (sites: OpenCellIdSite[], config: BaseStationConfig): void => {
    if (!map.value) return
    const filteredSites = filterOpenCellIdSites(sites, config.mobileCoverage.openCellIdOperator)
    if (filteredSites.length === 0) return

    const heat: CellIdHeatLayerInstance = createCellIdHeatLayer({
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

    const shapes: PaintedShape[] = []
    const labels: OsmCoverageLabelSpec[] = []

    filtered.forEach((tower) => {
      const center = [tower.lat, tower.lon] as WaypointCoordinates
      const bearing = overpassBearing(tower.tags)
      const beamwidth = overpassBeamwidth(tower.tags, bearing)
      const rangeMeters = overpassRangeMeters(tower.tags)
      const color = operatorColor(tower.operator)

      const shape =
        bearing === null || beamwidth >= 360
          ? circleShape(center, rangeMeters)
          : areaShape(sectorPolygonLatLngs(center, rangeMeters, bearing, beamwidth))
      shapes.push(
        paintedShape(shape, {
          color,
          opacity: OSM_COVERAGE_STROKE_OPACITY * config.mobileCoverage.overlayOpacity,
          fillColor: color,
          fillOpacity: OSM_COVERAGE_FILL_OPACITY * config.mobileCoverage.overlayOpacity,
        })
      )

      labels.push({
        id: `osm-coverage-label-${overlayInstanceIndex}-${tower.id}`,
        center,
        rangeMeters,
        bearing,
        beamwidth,
        labelParts: overpassLabelParts(tower),
        color,
      })
    })

    setShapeGroup('mobile', shapes, { weight: 1, dashPattern: [5, 5] })
    mobileCoverageLayer.value = { remove: () => removeShapeGroup('mobile') }
    if (!config.mobileCoverage.showRingLabels) return
    renderOsmCoverageLabels(labels)
    bindCoverageLabelRerender(labels)
  }

  const renderMobileCoverage = async (config: BaseStationConfig): Promise<void> => {
    teardownRenderedMobileCoverage()

    if (!isMapReady(map.value) || !config.enabled || !config.position) return
    if (!config.showSignalOnMap) return
    if (config.commsType !== BaseStationCommsType.MobileData) return

    const provider = config.mobileCoverage.provider
    if (provider === MobileCoverageProvider.Custom) {
      const url = config.mobileCoverage.customTileUrl.trim()
      if (!url) return
      const coverageMap = map.value
      const id = addRasterLayer(
        coverageMap,
        {
          id: `base-station-${overlayInstanceIndex}-custom`,
          label: 'Mobile coverage',
          template: url,
          subdomains: ['a', 'b', 'c'],
          maxZoom: customCoverageMaxZoom,
          maxNativeZoom: customCoverageMaxZoom,
        },
        { slot: 'coverage', visible: true }
      )
      coverageMap.setImageryOpacity(id, config.mobileCoverage.overlayOpacity)
      mobileCoverageLayer.value = { remove: () => coverageMap.removeImagery(id) }
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

  const notifyNoMobileCoverageData = (provider: MobileCoverageProvider, around: string): void => {
    openSnackbar({
      variant: 'info',
      message: `${provider} returned no cellular data around ${around}.`,
      duration: 4000,
    })
  }

  // An abort is the caller cancelling itself and an invalid key has a message of its own, so both
  // are settled here; anything else comes back for the caller to report after its own fallbacks.
  const unhandledMobileCoverageFetchError = (err: unknown, provider: MobileCoverageProvider): string | null => {
    if ((err as DOMException)?.name === 'AbortError') return null
    const errorMessage = (err as Error).message
    if (provider === MobileCoverageProvider.OpenCellID && store.openCellIdApiKey.trim()) {
      if (isOpenCellIdInvalidApiKeyError(errorMessage)) {
        store.openCellIdApiKeyStatus = 'invalid'
        openSnackbar({
          variant: 'error',
          message: 'OpenCellID API key is invalid. Check the key and try again.',
          duration: 4000,
        })
        return null
      }
      store.openCellIdApiKeyStatus = 'unknown'
    }
    return errorMessage
  }

  // The fetch, persist and count sequence differs only by provider, so the base-station refresh and
  // the map target tool both read their arm from here instead of each repeating the two branches.
  const mobileCoverageFetchers: Record<FetchableMobileCoverageProvider, MobileCoverageFetcher> = {
    [MobileCoverageProvider.OpenCellID]: {
      noun: 'OpenCellID sites',
      loadFromStorage: loadOpenCellIdSitesFromStorage,
      fetch: async (position, signal, mode) => {
        const { sites, fetchedBbox } = await fetchOpenCellIdSites(position, store.openCellIdApiKey.trim(), signal)
        if (signal.aborted) return null
        if (mode === 'append') appendOpenCellIdSites(fetchedBbox, sites)
        else storeOpenCellIdSites(fetchedBbox, sites)
        store.openCellIdApiKeyStatus = 'valid'
        return sites.length
      },
    },
    [MobileCoverageProvider.OSMOverpass]: {
      noun: 'OSM towers',
      loadFromStorage: loadOverpassTowersFromStorage,
      fetch: async (position, signal, mode) => {
        const bbox = overpassBboxAround(position[0], position[1])
        const towers = await fetchOverpassTowers(bbox, signal)
        if (signal.aborted) return null
        if (mode === 'append') appendOverpassTowers(bbox, towers)
        else storeOverpassTowers(bbox, towers)
        return towers.length
      },
    },
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

    if (provider === MobileCoverageProvider.OpenCellID && !store.openCellIdApiKey.trim()) {
      store.openCellIdApiKeyStatus = 'unknown'
      notifyOpenCellIdKeyRequired()
      return
    }

    if (mobileCoverageTargetToolController) mobileCoverageTargetToolController.abort()
    const controller = new AbortController()
    mobileCoverageTargetToolController = controller
    store.mobileCoverageLoading = true
    const fetcher = mobileCoverageFetchers[provider]
    try {
      const addedCount = await fetcher.fetch(position, controller.signal, 'append')
      if (addedCount === null) return

      if (addedCount === 0) {
        notifyNoMobileCoverageData(provider, 'the dropped target')
      } else {
        openSnackbar({
          variant: 'success',
          message: `Added ${addedCount} ${fetcher.noun} around the dropped target.`,
          duration: 3000,
        })
      }

      await renderMobileCoverage(store.config)
    } catch (err) {
      const errorMessage = unhandledMobileCoverageFetchError(err, provider)
      if (errorMessage === null) return
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

    if (provider === MobileCoverageProvider.OpenCellID && !store.openCellIdApiKey.trim()) {
      store.openCellIdApiKeyStatus = 'unknown'
      // Notify once per missing-key episode so a moving or GPS-tracked position does not
      // re-fire this snackbar on every debounced refetch.
      if (!openCellIdKeyRequiredNotified) {
        notifyOpenCellIdKeyRequired()
        openCellIdKeyRequiredNotified = true
      }
      return
    }
    openCellIdKeyRequiredNotified = false

    mobileCoverageController?.abort()
    const controller = new AbortController()
    mobileCoverageController = controller
    store.mobileCoverageLoading = true
    const fetcher = mobileCoverageFetchers[provider]
    try {
      if (!forceReload && fetcher.loadFromStorage(config.position)) {
        await renderMobileCoverage(config)
        return
      }

      const fetchedCount = await fetcher.fetch(config.position, controller.signal, 'store')
      if (fetchedCount === null) return

      if (fetchedCount === 0) {
        notifyNoMobileCoverageData(provider, 'the base station')
        return
      }

      await renderMobileCoverage(config)
    } catch (err) {
      const errorMessage = unhandledMobileCoverageFetchError(err, provider)
      if (errorMessage === null) return
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

  const removeDrawnStation = (): void => {
    marker.value?.remove()
    bearingHandle.value?.remove()
    removeShapeGroup('coverage')
    removeShapeGroup('tether')
    removeShapeGroup('aiming')
    marker.value = undefined
    bearingHandle.value = undefined
    lastMarkerLabel = null
    lastMarkerColor = null
  }

  const refreshAll = (): void => {
    if (!mapReady.value || !isMapReady(map.value)) return
    const config =
      draggedPosition.value !== null || draggedBearing.value !== null
        ? {
            ...store.config,
            position: draggedPosition.value ?? store.config.position,
            antenna: { ...store.config.antenna, bearing: draggedBearing.value ?? store.config.antenna.bearing },
          }
        : store.config

    if (!config.enabled || !config.position) {
      removeDrawnStation()
      teardownMobileCoverageData()
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
      if (!mapReady.value) return
      attachMapDropHandlers()
    },
    { immediate: true }
  )
  // Geometry-relevant fields only; mobile-coverage overlay has its own watcher above and
  // is intentionally excluded so live edits to API keys / opacity / labels don't rebuild
  // every layer in the overlay.
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
      draggedPosition.value?.[0],
      draggedPosition.value?.[1],
      draggedBearing.value,
    ],
    refreshAll
  )

  // Debounced so live edits to API key / tile URL don't hammer the public APIs on every keystroke.
  watch(
    () => [
      mapReady.value,
      store.config.commsType,
      store.config.mobileCoverage.provider,
      store.openCellIdApiKey,
      store.config.mobileCoverage.customTileUrl,
      store.config.position,
    ],
    () => {
      if (!ownsCoverageData()) return
      teardownMobileCoverageData()
      mobileCoverageDebounce = setTimeout(() => void fetchMobileCoverageData(store.config), 500)
    },
    { immediate: true }
  )

  watch(
    () => store.mobileCoverageReloadToken,
    () => {
      if (!ownsCoverageData()) return
      teardownMobileCoverageData()
      mobileCoverageDebounce = setTimeout(() => void fetchMobileCoverageData(store.config, true), 100)
    }
  )

  watch(
    () => store.mobileCoverageVisibleDataResetToken,
    () => {
      if (!ownsCoverageData()) return
      void resetVisibleMobileCoverageData()
    }
  )

  // Cache writes are the only cue the non-fetching instances get, and the instance taking over an
  // unmounted owner's turn has to catch up on whatever the config asks for that the cache lacks.
  watch([() => store.mobileCoverageCache.openCellId, () => store.mobileCoverageCache.osmOverpass], () => {
    if (ownsCoverageData()) return
    void renderMobileCoverage(store.config)
  })
  watch(coverageDataOwner, (owner) => {
    if (owner !== null) return
    coverageDataOwner.value = overlayId
    void fetchMobileCoverageData(store.config)
  })

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
      if (!ready || !isMapReady(map.value)) return
      if (active) attachTargetToolHandlers()
      else detachTargetToolHandlers?.()
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    if (ownsCoverageData()) coverageDataOwner.value = null
    detachMapDropHandlers?.()
    detachTargetToolHandlers?.()
    teardownMobileCoverageData()
    removeDrawnStation()
  })
}
