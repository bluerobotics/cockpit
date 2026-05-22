import './baseStationOverlay.css'

import * as turf from '@turf/turf'
import L from 'leaflet'
import { type Ref, type ShallowRef, onBeforeUnmount, shallowRef, watch } from 'vue'

import { useBaseStation } from '@/composables/baseStation/useBaseStation'
import { openSnackbar } from '@/composables/snackbar'
import {
  type BaseStationConfig,
  AntennaType,
  BaseStationCommsType,
  effectiveAntennaRangeMeters,
  MobileCoverageProvider,
} from '@/types/baseStation'
import type { WaypointCoordinates } from '@/types/mission'

/* eslint-disable jsdoc/require-jsdoc -- `leaflet.heat` ships no typings; this is a minimal augmentation. */
declare module 'leaflet' {
  type HeatLatLngTuple = [number, number, number]
  interface HeatMapOptions {
    minOpacity?: number
    maxZoom?: number
    max?: number
    radius?: number
    blur?: number
    gradient?: Record<number, string>
  }
  interface HeatLayer extends Layer {
    setOptions(options: HeatMapOptions): HeatLayer
    addLatLng(latlng: LatLng | HeatLatLngTuple): HeatLayer
    setLatLngs(latlngs: Array<LatLng | HeatLatLngTuple>): HeatLayer
  }
  function heatLayer(latlngs: Array<LatLng | HeatLatLngTuple>, options?: HeatMapOptions): HeatLayer
}
/* eslint-enable jsdoc/require-jsdoc */

// `leaflet.heat` is a UMD-style plugin: its IIFE assigns `L.HeatLayer = …` against whatever
// `L` it finds on the scope chain — i.e. `window.L`. With ESM imports leaflet doesn't auto-
// publish to the global, so the plugin's IIFE silently no-ops and `L.heatLayer` ends up
// undefined. Expose `L` on `window` first, then load the plugin lazily on first use.
let heatLayerLoader: Promise<void> | null = null
const ensureHeatLayer = (): Promise<void> => {
  if (heatLayerLoader) return heatLayerLoader
  heatLayerLoader = (async () => {
    Object.assign(window, { L })
    await import('leaflet.heat')
  })()
  return heatLayerLoader
}

const SECTOR_ARC_STEPS = 64

// Concentric coverage rings with decreasing radius. Stacking them at the same per-layer opacity
// produces a smooth radial fade that mimics the pattern published in BR's directional antenna
// guide while keeping the brightest band where the signal is strongest.
const COVERAGE_GRADIENT_STEPS = 12
const COVERAGE_STEP_OPACITY = 0.045

const sectorPolygonLatLngs = (
  center: WaypointCoordinates,
  rangeMeters: number,
  bearingDeg: number,
  beamwidthDeg: number
): L.LatLngExpression[] => {
  const halfBeam = beamwidthDeg / 2
  const startBearing = bearingDeg - halfBeam
  const endBearing = bearingDeg + halfBeam
  const rangeKm = rangeMeters / 1000
  const turfCenter = turf.point([center[1], center[0]])

  const arc = turf.lineArc(turfCenter, rangeKm, startBearing, endBearing, { steps: SECTOR_ARC_STEPS })
  const arcPoints = arc.geometry.coordinates.map(([lng, lat]) => [lat, lng] as L.LatLngExpression)
  return [center as L.LatLngExpression, ...arcPoints, center as L.LatLngExpression]
}

const bearingHandlePosition = (
  center: WaypointCoordinates,
  rangeMeters: number,
  bearingDeg: number
): WaypointCoordinates => {
  const dest = turf.destination(turf.point([center[1], center[0]]), rangeMeters / 1000, bearingDeg, {
    units: 'kilometers',
  })
  const [lng, lat] = dest.geometry.coordinates
  return [lat, lng]
}

// 180° front-facing arc at the antenna's max range, used to preview where the signal will land
// as the operator rotates the antenna.
const aimingArcLatLngs = (
  center: WaypointCoordinates,
  rangeMeters: number,
  bearingDeg: number
): L.LatLngExpression[] => {
  const turfCenter = turf.point([center[1], center[0]])
  const arc = turf.lineArc(turfCenter, rangeMeters / 1000, bearingDeg - 90, bearingDeg + 90, {
    steps: SECTOR_ARC_STEPS,
  })
  return arc.geometry.coordinates.map(([lng, lat]) => [lat, lng] as L.LatLngExpression)
}

const bearingFromCenter = (center: WaypointCoordinates, point: WaypointCoordinates): number => {
  return turf.bearing(turf.point([center[1], center[0]]), turf.point([point[1], point[0]]))
}

/* eslint-disable jsdoc/require-jsdoc -- Inline transport DTOs; field meanings follow upstream docs. */

// OSM Overpass has no per-call area cap, so we use a single ~11 km half-side bbox.
const OVERPASS_BBOX_DEG = 0.1
// OpenCellID's getInArea caps at 4 km² per call (`code: 3` otherwise), so we tile a 3×3 grid
// of small boxes around the base station — ~5 km × 5 km of total coverage in 9 parallel calls.
const OPENCELLID_TILE_HALF_DEG = 0.0075
const OPENCELLID_TILES_PER_SIDE = 3
// `range` is reported in meters; this anchor (~5 km) maps a typical urban tower reach to
// full intensity in the heatmap.
const OPENCELLID_RANGE_NORMALIZER_M = 5000

type CoverageBbox = { south: number; west: number; north: number; east: number }

const overpassBboxAround = (lat: number, lng: number): CoverageBbox => ({
  south: lat - OVERPASS_BBOX_DEG,
  west: lng - OVERPASS_BBOX_DEG,
  north: lat + OVERPASS_BBOX_DEG,
  east: lng + OVERPASS_BBOX_DEG,
})

type OpenCellIdResponse = {
  cells?: Array<{ lat: number; lon: number; range?: number }>
  error?: string
  code?: number
}

const fetchOpenCellIdTile = async (
  bbox: CoverageBbox,
  apiKey: string,
  signal: AbortSignal
): Promise<L.HeatLatLngTuple[]> => {
  const url =
    `https://opencellid.org/cell/getInArea?key=${encodeURIComponent(apiKey)}` +
    `&BBOX=${bbox.south},${bbox.west},${bbox.north},${bbox.east}` +
    `&format=json&radio=LTE,NR&limit=1000`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`OpenCellID HTTP ${res.status}`)
  const data = (await res.json()) as OpenCellIdResponse
  // `code: 1` ("No cells found") is HTTP 200 + an `error` field; treat as empty, not failure.
  if (data.error && data.code !== 1) throw new Error(`OpenCellID: ${data.error}`)
  return (data.cells ?? []).map<L.HeatLatLngTuple>((c) => [
    c.lat,
    c.lon,
    Math.min(1, (c.range ?? 1000) / OPENCELLID_RANGE_NORMALIZER_M),
  ])
}

const fetchOpenCellIdPoints = async (
  center: WaypointCoordinates,
  apiKey: string,
  signal: AbortSignal
): Promise<L.HeatLatLngTuple[]> => {
  const [lat, lng] = center
  const tileEdge = OPENCELLID_TILE_HALF_DEG * 2
  const offsetBase = (OPENCELLID_TILES_PER_SIDE - 1) / 2
  const tiles: CoverageBbox[] = []
  for (let i = 0; i < OPENCELLID_TILES_PER_SIDE; i++) {
    for (let j = 0; j < OPENCELLID_TILES_PER_SIDE; j++) {
      const cLat = lat + (i - offsetBase) * tileEdge
      const cLng = lng + (j - offsetBase) * tileEdge
      tiles.push({
        south: cLat - OPENCELLID_TILE_HALF_DEG,
        west: cLng - OPENCELLID_TILE_HALF_DEG,
        north: cLat + OPENCELLID_TILE_HALF_DEG,
        east: cLng + OPENCELLID_TILE_HALF_DEG,
      })
    }
  }
  const settled = await Promise.allSettled(tiles.map((b) => fetchOpenCellIdTile(b, apiKey, signal)))
  const fulfilled = settled.filter((r): r is PromiseFulfilledResult<L.HeatLatLngTuple[]> => r.status === 'fulfilled')
  // If every tile failed, surface the first error so the operator gets a real diagnostic
  // (invalid key, network down, …) instead of a silent empty heatmap.
  if (fulfilled.length === 0) {
    const firstReject = settled.find((r): r is PromiseRejectedResult => r.status === 'rejected')
    if (firstReject) throw firstReject.reason
  }
  return fulfilled.flatMap((r) => r.value)
}

type OverpassResponse = {
  elements?: Array<{ lat?: number; lon?: number; tags?: Record<string, string> }>
}

type OverpassTower = { lat: number; lon: number; operator: string | null }

const fetchOverpassTowers = async (bbox: CoverageBbox, signal: AbortSignal): Promise<OverpassTower[]> => {
  const region = `(${bbox.south},${bbox.west},${bbox.north},${bbox.east})`
  const query =
    `[out:json][timeout:25];` +
    `(node["man_made"="communications_tower"]${region};` +
    `node["tower:type"="communication"]${region};);` +
    // `out body` (= `out;`) is required to keep node lat/lon. `out tags;` drops coords.
    `out body;`
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: query,
    signal,
  })
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`)
  const data = (await res.json()) as OverpassResponse
  return (data.elements ?? [])
    .filter(
      (e): e is { lat: number; lon: number; tags?: Record<string, string> } =>
        typeof e.lat === 'number' && typeof e.lon === 'number'
    )
    .map<OverpassTower>((e) => ({ lat: e.lat, lon: e.lon, operator: e.tags?.operator?.trim() || null }))
}

// Real cellular sites have ~1-3 km of usable urban coverage; pick a middle value and let the
// heatmap pixel radius track this in real meters as the operator zooms in/out.
const HEAT_COVERAGE_METERS = 1500
const HEAT_RADIUS_MIN_PX = 30
const HEAT_RADIUS_MAX_PX = 140
// Equator meters-per-pixel at zoom 0. Halves with each zoom level; multiplied by cos(lat) to
// account for the Mercator projection narrowing toward the poles.
const METERS_PER_PIXEL_AT_Z0 = 156543.03392

type HeatRadius = { radius: number; blur: number }
type BaseStationOverlayApi = { openConfigPanel: () => void }
/* eslint-enable jsdoc/require-jsdoc */

const heatRadiusForMap = (mapInstance: L.Map): HeatRadius => {
  const center = mapInstance.getCenter()
  const metersPerPixel = (METERS_PER_PIXEL_AT_Z0 * Math.cos((center.lat * Math.PI) / 180)) / 2 ** mapInstance.getZoom()
  const ideal = HEAT_COVERAGE_METERS / metersPerPixel
  const radius = Math.max(HEAT_RADIUS_MIN_PX, Math.min(HEAT_RADIUS_MAX_PX, ideal))
  return { radius, blur: radius * 0.6 }
}

const baseStationMarkerHtml = (label: string): string => `
  <div class="base-station-marker-container">
    <div class="base-station-marker-background"></div>
    <i class="v-icon notranslate mdi mdi-radio-tower" style="color: white; position: relative; z-index: 2; font-size: 16px;"></i>
    <div class="base-station-marker-label">${label}</div>
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
  const coverageSteps = shallowRef<(L.Circle | L.Polygon)[]>([])
  const coverageAntennaType = shallowRef<AntennaType | undefined>()
  const tetherLayer = shallowRef<L.Circle | undefined>()
  const bearingHandle = shallowRef<L.Marker | undefined>()
  const bearingLine = shallowRef<L.Polyline | undefined>()
  const aimingArc = shallowRef<L.Polyline | undefined>()
  const mobileCoverageLayer = shallowRef<L.Layer | undefined>()

  let mobileCoverageController: AbortController | null = null
  let mobileCoverageDebounce: ReturnType<typeof setTimeout> | null = null
  let heatZoomCleanup: (() => void) | null = null

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

  const buildBearingHandleIcon = (): L.DivIcon =>
    L.divIcon({
      className: 'base-station-bearing-handle',
      html: '<div class="base-station-bearing-handle-dot"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    })

  const ensureMarker = (config: BaseStationConfig): void => {
    if (!map.value || !config.position) return
    if (marker.value) {
      marker.value.setLatLng(config.position)
      applyMarkerColor(config.coverageColor)
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
    applyMarkerColor(config.coverageColor)
  }

  // Marker stays fully visible regardless of the opacity slider — only the coverage and
  // bearing/arc dotted lines fade with `coverageOpacity`. The trailing `cc` keeps the
  // marker's original 80% fill so the icon underneath stays legible against the map.
  const applyMarkerColor = (color: string): void => {
    const el = marker.value?.getElement()
    if (!el) return
    const bg = el.querySelector('.base-station-marker-background') as HTMLElement | null
    if (bg) bg.style.backgroundColor = `${color.slice(0, 7)}cc`
  }

  const updateCoverage = (config: BaseStationConfig): void => {
    if (!map.value || !store.showCoverage || !config.position || config.commsType !== BaseStationCommsType.RadioLink) {
      removeLayer(coverageLayer.value)
      coverageLayer.value = undefined
      coverageSteps.value = []
      coverageAntennaType.value = undefined
      return
    }

    const position = config.position
    const isOmni = config.antenna.type === AntennaType.Omni
    const rangeMeters = effectiveAntennaRangeMeters(config)
    const stepStyle = {
      color: config.coverageColor,
      weight: 0,
      fillColor: config.coverageColor,
      fillOpacity: COVERAGE_STEP_OPACITY * config.coverageOpacity,
      interactive: false,
    }
    const stepRadius = (step: number): number => (rangeMeters * step) / COVERAGE_GRADIENT_STEPS

    // Recreating every gradient layer on each config change thrashes Leaflet during a bearing
    // drag, so reuse the existing step layers in place and only rebuild when the shape changes.
    const canUpdateInPlace =
      coverageLayer.value !== undefined &&
      coverageAntennaType.value === config.antenna.type &&
      coverageSteps.value.length === COVERAGE_GRADIENT_STEPS

    if (canUpdateInPlace) {
      coverageSteps.value.forEach((layer, index) => {
        const radius = stepRadius(index + 1)
        if (isOmni) {
          const circle = layer as L.Circle
          circle.setLatLng(position)
          circle.setRadius(radius)
          circle.setStyle(stepStyle)
        } else {
          const polygon = layer as L.Polygon
          polygon.setLatLngs(sectorPolygonLatLngs(position, radius, config.antenna.bearing, config.antenna.beamwidth))
          polygon.setStyle(stepStyle)
        }
      })
      return
    }

    removeLayer(coverageLayer.value)
    const group = L.layerGroup()
    const steps: (L.Circle | L.Polygon)[] = []
    for (let step = 1; step <= COVERAGE_GRADIENT_STEPS; step++) {
      const radius = stepRadius(step)
      const layer = isOmni
        ? L.circle(position, { ...stepStyle, radius })
        : L.polygon(sectorPolygonLatLngs(position, radius, config.antenna.bearing, config.antenna.beamwidth), stepStyle)
      layer.addTo(group)
      steps.push(layer)
    }
    group.addTo(map.value)
    coverageLayer.value = group
    coverageSteps.value = steps
    coverageAntennaType.value = config.antenna.type
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

  const teardownMobileCoverage = (): void => {
    if (mobileCoverageController) {
      mobileCoverageController.abort()
      mobileCoverageController = null
    }
    if (heatZoomCleanup) {
      heatZoomCleanup()
      heatZoomCleanup = null
    }
    removeLayer(mobileCoverageLayer.value)
    mobileCoverageLayer.value = undefined
  }

  const updateMobileCoverage = async (config: BaseStationConfig): Promise<void> => {
    teardownMobileCoverage()

    if (!map.value || !config.enabled || !config.position) return
    if (config.commsType !== BaseStationCommsType.MobileData) return

    const provider = config.mobileCoverage.provider

    if (provider === MobileCoverageProvider.Custom) {
      const url = config.mobileCoverage.customTileUrl.trim()
      if (!url) return
      mobileCoverageLayer.value = L.tileLayer(url, { opacity: 0.55 }).addTo(map.value)
      return
    }

    const controller = new AbortController()
    mobileCoverageController = controller
    try {
      let points: L.HeatLatLngTuple[]
      if (provider === MobileCoverageProvider.OpenCellID) {
        const apiKey = config.mobileCoverage.openCellIdApiKey.trim()
        if (!apiKey) return
        points = await fetchOpenCellIdPoints(config.position, apiKey, controller.signal)
      } else {
        const towers = await fetchOverpassTowers(
          overpassBboxAround(config.position[0], config.position[1]),
          controller.signal
        )
        if (controller.signal.aborted) return
        // Surface the operator vocabulary actually present in the bbox so the panel can render
        // a meaningful selector (the OSM `operator` tag is region-specific).
        store.availableOsmOperators = [...new Set(towers.map((t) => t.operator).filter((o): o is string => !!o))].sort()
        const selectedOperator = config.mobileCoverage.osmOperator
        const filtered = selectedOperator ? towers.filter((t) => t.operator === selectedOperator) : towers
        points = filtered.map<L.HeatLatLngTuple>((t) => [t.lat, t.lon, 1])
      }
      if (controller.signal.aborted || !map.value) return
      if (points.length === 0) {
        openSnackbar({
          variant: 'info',
          message: `${provider} returned no cellular data around the base station.`,
          duration: 4000,
        })
        return
      }
      await ensureHeatLayer()
      if (controller.signal.aborted || !map.value) return
      const heat = L.heatLayer(points, { ...heatRadiusForMap(map.value), minOpacity: 0.25 }).addTo(map.value)
      mobileCoverageLayer.value = heat
      // Re-tune pixel radius on zoom so the visual stays anchored to ~1.5 km of real coverage.
      const onZoom = (): void => {
        if (map.value) heat.setOptions(heatRadiusForMap(map.value))
      }
      map.value.on('zoomend', onZoom)
      heatZoomCleanup = () => map.value?.off('zoomend', onZoom)
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return
      openSnackbar({
        variant: 'error',
        message: `Mobile coverage fetch failed: ${(err as Error).message}`,
        duration: 4000,
      })
    } finally {
      if (mobileCoverageController === controller) mobileCoverageController = null
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
      teardownMobileCoverage()
      marker.value = undefined
      coverageLayer.value = undefined
      tetherLayer.value = undefined
      bearingHandle.value = undefined
      bearingLine.value = undefined
      aimingArc.value = undefined
      return
    }

    ensureMarker(config)
    updateCoverage(config)
    updateTether(config)
    updateBearingHandle(config)
  }

  watch([map, mapReady], refreshAll, { immediate: true })
  watch(() => store.config, refreshAll, { deep: true })

  // Debounced so live edits to API key / tile URL don't hammer the public APIs on every keystroke.
  watch(
    () => [
      mapReady.value,
      store.config.commsType,
      store.config.mobileCoverage.provider,
      store.config.mobileCoverage.openCellIdApiKey,
      store.config.mobileCoverage.customTileUrl,
      store.config.mobileCoverage.osmOperator,
      store.config.position,
    ],
    () => {
      if (mobileCoverageDebounce) clearTimeout(mobileCoverageDebounce)
      mobileCoverageDebounce = setTimeout(() => updateMobileCoverage(store.config), 500)
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    if (mobileCoverageDebounce) {
      clearTimeout(mobileCoverageDebounce)
      mobileCoverageDebounce = null
    }
    teardownMobileCoverage()
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
