import './baseStationOverlay.css'

import * as turf from '@turf/turf'
import L from 'leaflet'
import { type Ref, type ShallowRef, onBeforeUnmount, shallowRef, watch } from 'vue'

import { useBaseStation } from '@/composables/baseStation/useBaseStation'
import { openSnackbar } from '@/composables/snackbar'
import { isElectron } from '@/libs/utils'
import {
  type BaseStationConfig,
  type CachedMobileCoverageEntry,
  type CachedOpenCellIdSite,
  type CachedOverpassTower,
  type CoverageBbox,
  AntennaType,
  BaseStationCommsType,
  effectiveAntennaRangeMeters,
  MOBILE_COVERAGE_FETCH_DROP_MIME,
  MobileCoverageDisplayMode,
  MobileCoverageProvider,
} from '@/types/baseStation'
import type { WaypointCoordinates } from '@/types/mission'

const SECTOR_ARC_STEPS = 64

// Concentric coverage rings with decreasing radius. Stacking them at the same per-layer opacity
// produces a smooth radial fade that mimics the pattern published in BR's directional antenna
// guide while keeping the brightest band where the signal is strongest.
const COVERAGE_GRADIENT_STEPS = 12
const COVERAGE_STEP_OPACITY = 0.045

const notifyOpenCellIdKeyRequired = (): void => {
  openSnackbar({
    variant: 'info',
    message:
      'OpenCellID requires a personal API key. Add one in the base-station config, or switch to OpenStreetMap coverage to load data without a key.',
    duration: 5000,
  })
}

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
const OPENCELLID_COVERAGE_HALF_SIDE_KM = 25
// Keyed browser endpoint caps at ~4 km²; standalone's no-key ajax endpoint rejects around 25 km²,
// so we use smaller tiles on Lite and larger ones on standalone.
const OPENCELLID_KEYED_TILE_HALF_SIDE_KM = 0.95
const OPENCELLID_KEYED_FOREGROUND_TILE_COUNT = 9
const OPENCELLID_LITE_TILE_HALF_SIDE_KM = 1
const OPENCELLID_STANDALONE_TILE_HALF_SIDE_KM = 2
const OPENCELLID_STANDALONE_FOREGROUND_TILE_COUNT = 1
// Keep the persisted bbox cache small; users rarely need more than the most recent few areas.
const MOBILE_COVERAGE_CACHE_MAX_ENTRIES = 8
type OpenCellIdSite = CachedOpenCellIdSite
type OverpassTower = CachedOverpassTower

const isOpenCellIdInvalidApiKeyError = (message: string): boolean =>
  /invalid.*key|api key.*invalid|missing.*key|key required|unauthorized|forbidden/i.test(message)

const overpassBboxAround = (lat: number, lng: number): CoverageBbox => ({
  south: lat - OVERPASS_BBOX_DEG,
  west: lng - OVERPASS_BBOX_DEG,
  north: lat + OVERPASS_BBOX_DEG,
  east: lng + OVERPASS_BBOX_DEG,
})

const kmToLatDegrees = (km: number): number => km / 111.32

const kmToLngDegrees = (km: number, lat: number): number => {
  const cosLat = Math.max(0.2, Math.cos((lat * Math.PI) / 180))
  return km / (111.32 * cosLat)
}

const openCellIdCoverageBboxAround = (lat: number, lng: number): CoverageBbox => ({
  south: lat - kmToLatDegrees(OPENCELLID_COVERAGE_HALF_SIDE_KM),
  west: lng - kmToLngDegrees(OPENCELLID_COVERAGE_HALF_SIDE_KM, lat),
  north: lat + kmToLatDegrees(OPENCELLID_COVERAGE_HALF_SIDE_KM),
  east: lng + kmToLngDegrees(OPENCELLID_COVERAGE_HALF_SIDE_KM, lat),
})

const bboxContains = (bbox: CoverageBbox, position: WaypointCoordinates): boolean => {
  const [lat, lng] = position
  return lat >= bbox.south && lat <= bbox.north && lng >= bbox.west && lng <= bbox.east
}

const bboxIntersects = (left: CoverageBbox, right: CoverageBbox): boolean =>
  left.west <= right.east && left.east >= right.west && left.south <= right.north && left.north >= right.south

const bboxEquals = (left: CoverageBbox, right: CoverageBbox): boolean =>
  left.south === right.south && left.west === right.west && left.north === right.north && left.east === right.east

const leafletBoundsToCoverageBbox = (bounds: L.LatLngBounds): CoverageBbox => ({
  south: bounds.getSouth(),
  west: bounds.getWest(),
  north: bounds.getNorth(),
  east: bounds.getEast(),
})

const trimCacheEntries = <T>(entries: CachedMobileCoverageEntry<T>[]): CachedMobileCoverageEntry<T>[] => {
  return entries.sort((a, b) => b.fetchedAtMs - a.fetchedAtMs).slice(0, MOBILE_COVERAGE_CACHE_MAX_ENTRIES)
}

const tiledCoverageBboxes = (area: CoverageBbox, centerLat: number, tileHalfSideKm: number): CoverageBbox[] => {
  const tileLatSize = kmToLatDegrees(tileHalfSideKm * 2)
  const tileLngSize = kmToLngDegrees(tileHalfSideKm * 2, centerLat)
  const latCount = Math.ceil((area.north - area.south) / tileLatSize)
  const lngCount = Math.ceil((area.east - area.west) / tileLngSize)
  const tiles: CoverageBbox[] = []

  for (let latIndex = 0; latIndex < latCount; latIndex++) {
    const south = area.south + latIndex * tileLatSize
    const north = Math.min(area.north, south + tileLatSize)
    for (let lngIndex = 0; lngIndex < lngCount; lngIndex++) {
      const west = area.west + lngIndex * tileLngSize
      const east = Math.min(area.east, west + tileLngSize)
      tiles.push({ south, west, north, east })
    }
  }

  return tiles
}

const bboxCenter = (bbox: CoverageBbox): WaypointCoordinates => [
  (bbox.south + bbox.north) / 2,
  (bbox.west + bbox.east) / 2,
]

const sortCoverageBboxesByDistance = (center: WaypointCoordinates, bboxes: CoverageBbox[]): CoverageBbox[] =>
  [...bboxes].sort((left, right) => {
    const [leftLat, leftLng] = bboxCenter(left)
    const [rightLat, rightLng] = bboxCenter(right)
    const leftDistance = turf.distance(turf.point([center[1], center[0]]), turf.point([leftLng, leftLat]))
    const rightDistance = turf.distance(turf.point([center[1], center[0]]), turf.point([rightLng, rightLat]))
    return leftDistance - rightDistance
  })

const unionCoverageBboxes = (bboxes: CoverageBbox[]): CoverageBbox => ({
  south: Math.min(...bboxes.map((bbox) => bbox.south)),
  west: Math.min(...bboxes.map((bbox) => bbox.west)),
  north: Math.max(...bboxes.map((bbox) => bbox.north)),
  east: Math.max(...bboxes.map((bbox) => bbox.east)),
})

const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> => {
  const settled: PromiseSettledResult<R>[] = new Array(items.length)
  let nextIndex = 0

  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++
      try {
        settled[currentIndex] = {
          status: 'fulfilled',
          value: await mapper(items[currentIndex]),
        }
      } catch (error) {
        settled[currentIndex] = {
          status: 'rejected',
          reason: error,
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  return settled
}

type OpenCellIdResponse = {
  cells?: Array<{
    lat: number
    lon: number
    range?: number
    radio?: string
    mcc?: number
    mnc?: number
    lac?: number
    cellid?: number
    samples?: number
    averageSignalStrength?: number
  }>
  error?: string
  code?: number
}

const fetchOpenCellIdTile = async (
  bbox: CoverageBbox,
  apiKey: string,
  signal: AbortSignal
): Promise<OpenCellIdSite[]> => {
  const url =
    `https://opencellid.org/cell/getInArea?key=${encodeURIComponent(apiKey)}` +
    `&BBOX=${bbox.south},${bbox.west},${bbox.north},${bbox.east}` +
    `&format=json&limit=50`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`OpenCellID HTTP ${res.status}`)
  const data = (await res.json()) as OpenCellIdResponse
  // `code: 1` ("No cells found") is HTTP 200 + an `error` field; treat as empty, not failure.
  if (data.error && data.code !== 1) throw new Error(`OpenCellID: ${data.error}`)
  return (data.cells ?? []).map<OpenCellIdSite>((c) => ({
    lat: c.lat,
    lon: c.lon,
    rangeMeters: c.range ?? 1000,
    radio: c.radio,
    mcc: c.mcc,
    mnc: c.mnc,
    lac: c.lac,
    cellId: c.cellid,
    samples: c.samples,
    averageSignalStrength: c.averageSignalStrength,
  }))
}

const fetchOpenCellIdTileInElectron = async (bbox: CoverageBbox, apiKey: string): Promise<OpenCellIdSite[]> => {
  const cells = await window.electronAPI?.fetchNearbyOpenCellIdCells({
    west: bbox.west,
    south: bbox.south,
    east: bbox.east,
    north: bbox.north,
    apiKey: apiKey || undefined,
  })
  if (!cells) throw new Error('OpenCellID standalone bridge unavailable')
  return cells.map<OpenCellIdSite>((c) => ({
    lat: c.lat,
    lon: c.lon,
    rangeMeters: c.range ?? 1000,
    radio: c.radio,
    mcc: c.mcc,
    mnc: c.mnc,
    lac: c.lac,
    cellId: c.cellId,
    samples: c.samples,
    averageSignalStrength: c.averageSignalStrength,
  }))
}

const fetchOpenCellIdSites = async (
  center: WaypointCoordinates,
  apiKey: string,
  signal: AbortSignal
): Promise<{ sites: OpenCellIdSite[]; fetchedBbox: CoverageBbox }> => {
  const [lat, lng] = center
  const coverageArea = openCellIdCoverageBboxAround(lat, lng)
  const usesApiKey = apiKey.trim().length > 0
  const tileHalfSideKm = usesApiKey
    ? OPENCELLID_KEYED_TILE_HALF_SIDE_KM
    : isElectron()
    ? OPENCELLID_STANDALONE_TILE_HALF_SIDE_KM
    : OPENCELLID_LITE_TILE_HALF_SIDE_KM
  const tiles = tiledCoverageBboxes(coverageArea, lat, tileHalfSideKm)
  const selectedTiles = usesApiKey
    ? sortCoverageBboxesByDistance(center, tiles).slice(0, OPENCELLID_KEYED_FOREGROUND_TILE_COUNT)
    : isElectron()
    ? sortCoverageBboxesByDistance(center, tiles).slice(0, OPENCELLID_STANDALONE_FOREGROUND_TILE_COUNT)
    : tiles
  const tileFetcher = isElectron()
    ? (bbox: CoverageBbox) => fetchOpenCellIdTileInElectron(bbox, apiKey)
    : (bbox: CoverageBbox) => fetchOpenCellIdTile(bbox, apiKey, signal)
  const settled = await mapWithConcurrency(selectedTiles, usesApiKey ? 4 : isElectron() ? 2 : 4, tileFetcher)
  const fulfilled = settled.filter((r): r is PromiseFulfilledResult<OpenCellIdSite[]> => r.status === 'fulfilled')
  // If every tile failed, surface the first error so the operator gets a real diagnostic
  // (invalid key, network down, …) instead of a silent empty heatmap.
  if (fulfilled.length === 0) {
    const firstReject = settled.find((r): r is PromiseRejectedResult => r.status === 'rejected')
    if (firstReject) throw firstReject.reason
  }
  const uniqueSites = new Map<string, OpenCellIdSite>()
  for (const site of fulfilled.flatMap((r) => r.value)) {
    const key = `${site.lat.toFixed(6)}:${site.lon.toFixed(6)}:${Math.round(site.rangeMeters)}`
    if (!uniqueSites.has(key)) uniqueSites.set(key, site)
  }
  return {
    sites: [...uniqueSites.values()],
    fetchedBbox: unionCoverageBboxes(selectedTiles),
  }
}

type OverpassResponse = {
  elements?: Array<{ id?: number; lat?: number; lon?: number; tags?: Record<string, string> }>
}

type OsmCoverageLabelSpec = {
  id: string
  center: WaypointCoordinates
  rangeMeters: number
  bearing: number | null
  beamwidth: number
  labelParts: string[]
  color: string
}

const OSM_DEFAULT_RANGE_METERS = 1800
const OSM_DEFAULT_DIRECTIONAL_BEAMWIDTH = 90
const OSM_COVERAGE_FILL_OPACITY = 0.12
const OSM_COVERAGE_STROKE_OPACITY = 0.75
const OPENCELLID_RING_FILL_OPACITY = 0.08
const OSM_LABEL_FONT_SIZE_PX = 10
const OSM_LABEL_CHAR_WIDTH_PX = 5.7
const OSM_LABEL_RIM_INSET = 0.92
const OSM_TOP_ARC_START_DEG = 300
const OSM_TOP_ARC_END_DEG = 60
const OSM_OPERATOR_COLORS = ['#38BDF8', '#22C55E', '#A855F7', '#F59E0B', '#EF4444', '#14B8A6']

const splitTagList = (value?: string): string[] =>
  value
    ?.split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean) ?? []

const parseTagNumber = (tags: Record<string, string>, ...keys: string[]): number | null => {
  for (const key of keys) {
    const value = tags[key]
    if (!value) continue
    const parsed = parseFloat(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

const pickTagValue = (tags: Record<string, string>, ...keys: string[]): string | null => {
  for (const key of keys) {
    const value = tags[key]?.trim()
    if (value) return value
  }
  return null
}

const formatHeightLabel = (height: string): string => (/^[\d.]+$/.test(height) ? `${height}m` : height)

const normalizeAngle = (angle: number): number => ((angle % 360) + 360) % 360

const overpassTechnologies = (tags: Record<string, string>): string[] => {
  const technologies = splitTagList(tags['technology:mobile_phone']).map((tech) => tech.toLowerCase())
  const legacyCommunication = splitTagList(tags['communication:mobile_phone'])
    .map((tech) => tech.toLowerCase())
    .filter((tech) => tech !== 'yes')
  return [...new Set([...technologies, ...legacyCommunication])]
}

const overpassTechnologyGenerations = (tags: Record<string, string>): string[] => {
  const technologies = overpassTechnologies(tags)
  const generations = technologies.flatMap((tech) => {
    if (tech.includes('nr') || tech.includes('5g')) return ['5G']
    if (tech.includes('lte')) return ['4G']
    if (tech.includes('umts') || tech.includes('wcdma') || tech.includes('hspa') || tech.includes('hsupa'))
      return ['3G']
    if (tech.includes('gsm') || tech.includes('edge') || tech.includes('gprs')) return ['2G']
    return []
  })
  return [...new Set(generations)]
}

const overpassTechnologyLabel = (tags: Record<string, string>): string | null => {
  const generations = overpassTechnologyGenerations(tags)
  if (generations.length > 0) return generations.join('/')
  const technologies = overpassTechnologies(tags)
  if (technologies.length === 0) return null
  return technologies.map((tech) => tech.toUpperCase()).join('/')
}

const overpassRangeMeters = (tags: Record<string, string>): number => {
  const technologies = overpassTechnologies(tags)
  if (technologies.length === 0) return OSM_DEFAULT_RANGE_METERS
  return Math.max(
    ...technologies.map((tech) => {
      if (tech.includes('nr') || tech.includes('5g')) return 1200
      if (tech.includes('lte')) return 1800
      if (tech.includes('umts')) return 2200
      if (tech.includes('gsm')) return 2800
      return OSM_DEFAULT_RANGE_METERS
    })
  )
}

const overpassBearing = (tags: Record<string, string>): number | null => {
  const parsed = parseTagNumber(tags, 'communications_transponder:bearing', 'antenna:direction', 'direction', 'bearing')
  return parsed === null ? null : normalizeAngle(parsed)
}

const overpassBeamwidth = (tags: Record<string, string>, bearing: number | null): number => {
  const parsed = parseTagNumber(tags, 'beamwidth', 'antenna:beamwidth')
  if (parsed !== null && parsed > 0 && parsed <= 360) return parsed
  return bearing === null ? 360 : OSM_DEFAULT_DIRECTIONAL_BEAMWIDTH
}

const overpassLabelParts = (tower: OverpassTower): string[] => {
  const parts = [tower.operator ?? 'Unknown operator']
  const technologyLabel = overpassTechnologyLabel(tower.tags)
  const manMade = pickTagValue(tower.tags, 'man_made')
  const height = pickTagValue(tower.tags, 'height')

  if (technologyLabel) parts.push(technologyLabel)
  if (manMade) parts.push(manMade)
  if (height) parts.push(formatHeightLabel(height))
  return parts
}

const fitLabelToArc = (parts: string[], maxWidthPx: number): string => {
  for (let count = parts.length; count > 0; count--) {
    const candidate = parts.slice(0, count).join(' - ')
    if (candidate.length * OSM_LABEL_CHAR_WIDTH_PX <= maxWidthPx) return candidate
  }
  const fallback = parts[0]
  const maxChars = Math.max(8, Math.floor(maxWidthPx / OSM_LABEL_CHAR_WIDTH_PX) - 1)
  return fallback.length > maxChars ? `${fallback.slice(0, maxChars)}…` : fallback
}

const openCellIdOperatorLabel = (site: OpenCellIdSite): string | null => {
  if (site.mcc === undefined || site.mnc === undefined) return null
  return `MCC ${site.mcc} / MNC ${site.mnc}`
}

const openCellIdLabelParts = (site: OpenCellIdSite): string[] => {
  const parts: string[] = []
  const operator = openCellIdOperatorLabel(site)
  if (operator) parts.push(operator)
  if (site.radio) parts.push(site.radio.toUpperCase())
  parts.push(`${Math.round(site.rangeMeters)}m`)
  if (site.cellId !== undefined) parts.push(`CID ${site.cellId}`)
  return parts
}

const filterOpenCellIdSites = (sites: OpenCellIdSite[], selectedOperator: string): OpenCellIdSite[] => {
  if (!selectedOperator) return sites
  return sites.filter((site) => openCellIdOperatorLabel(site) === selectedOperator)
}

const operatorColor = (operator: string | null): string => {
  if (!operator) return OSM_OPERATOR_COLORS[0]
  const hash = [...operator].reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return OSM_OPERATOR_COLORS[hash % OSM_OPERATOR_COLORS.length]
}

const fetchOverpassTowers = async (bbox: CoverageBbox, signal: AbortSignal): Promise<OverpassTower[]> => {
  const region = `(${bbox.south},${bbox.west},${bbox.north},${bbox.east})`
  const query =
    `[out:json][timeout:25];` +
    // Limit the overlay to mobile-phone infrastructure so the map reflects cellular coverage
    // rather than every generic communications site in the area.
    `(node["communication:mobile_phone"]${region};` +
    `node["technology:mobile_phone"]${region};);` +
    `out body;`
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: query,
    signal,
  })
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`)
  const data = (await res.json()) as OverpassResponse
  const seenIds = new Set<number>()
  return (data.elements ?? [])
    .filter(
      (e): e is { id: number; lat: number; lon: number; tags?: Record<string, string> } =>
        typeof e.id === 'number' && typeof e.lat === 'number' && typeof e.lon === 'number'
    )
    .filter((e) => {
      if (seenIds.has(e.id)) return false
      seenIds.add(e.id)
      return true
    })
    .map<OverpassTower>((e) => ({
      id: e.id,
      lat: e.lat,
      lon: e.lon,
      operator: e.tags?.operator?.trim() || null,
      tags: e.tags ?? {},
    }))
}

/* eslint-enable jsdoc/require-jsdoc */

// Slider 0% → blob radius is 5% of the cell range, slider 100% → full range. Linear blend
// between the two so the slider has visible effect at every zoom level.
const OPENCELLID_HEATMAP_MIN_RADIUS_FRACTION = 0.05
// Per-cell peak alpha contributed at the gradient center. Two cells overlapping at full alpha
// reach 1.0 thanks to the `lighter` compositing — this is what surfaces the warm hotspot tail
// of the gradient when several towers cover the same patch.
const OPENCELLID_HEATMAP_PEAK_ALPHA = 0.55
// Cool-to-warm gradient stops mapped from per-pixel density (0..1). A single cell tops out
// around mid-gradient (cyan/green); two cells overlapping bleed into yellow; three or more
// reach the red hotspot range.
const OPENCELLID_HEATMAP_GRADIENT_STOPS: ReadonlyArray<readonly [number, string]> = [
  [0.0, 'rgba(0, 0, 255, 0)'],
  [0.05, 'rgba(0, 80, 255, 0.4)'],
  [0.2, 'rgba(0, 140, 255, 0.65)'],
  [0.4, 'rgba(0, 230, 220, 0.8)'],
  [0.6, 'rgba(60, 220, 80, 0.85)'],
  [0.8, 'rgba(255, 220, 0, 0.9)'],
  [1.0, 'rgba(255, 40, 0, 0.95)'],
]
const EARTH_CIRCUMFERENCE_M = 40075016.686
const TILE_SIZE_PX = 256

/* eslint-disable jsdoc/require-jsdoc -- helper return shapes; their property names are self-describing. */
type BaseStationOverlayApi = { openConfigPanel: () => void }
type HeatmapSite = { lat: number; lon: number; rangeMeters: number }
type CellIdHeatLayerOptions = { sites: HeatmapSite[]; radiusFraction: number; opacity: number }
type CellIdHeatLayerInstance = L.Layer
/* eslint-enable jsdoc/require-jsdoc */

let cachedHeatGradientLut: Uint8ClampedArray | null = null
const heatmapGradientLut = (): Uint8ClampedArray => {
  if (cachedHeatGradientLut) return cachedHeatGradientLut
  const lutCanvas = document.createElement('canvas')
  lutCanvas.width = 1
  lutCanvas.height = 256
  const ctx = lutCanvas.getContext('2d')
  if (!ctx) throw new Error('Heatmap LUT: 2D canvas context unavailable')
  const grad = ctx.createLinearGradient(0, 0, 0, 256)
  OPENCELLID_HEATMAP_GRADIENT_STOPS.forEach(([stop, color]) => grad.addColorStop(stop, color))
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 1, 256)
  cachedHeatGradientLut = ctx.getImageData(0, 0, 1, 256).data
  return cachedHeatGradientLut
}

const metersPerPixelAt = (mapInstance: L.Map, lat: number): number => {
  const pixelsAcrossEquator = TILE_SIZE_PX * 2 ** mapInstance.getZoom()
  return (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / pixelsAcrossEquator
}

// Custom Leaflet layer that renders the OpenCellID heatmap on a single canvas, with cumulative
// alpha → cool-to-warm color mapping. Built to replace the (uninstalled) `leaflet.heat` plugin
// so we can keep per-cell radius, eliminate canvas-edge clipping, and apply layer opacity once
// without it bleeding into the color ramp.
const CellIdHeatLayer = L.Layer.extend({
  /* eslint-disable jsdoc/require-jsdoc -- Leaflet layer prototype methods, not exported API. */
  initialize(this: CellIdHeatLayerInternal, options: CellIdHeatLayerOptions) {
    this._heatOptions = { ...options }
  },
  onAdd(this: CellIdHeatLayerInternal, mapInstance: L.Map) {
    this._map = mapInstance
    const canvas = L.DomUtil.create('canvas', 'leaflet-cellid-heat-layer leaflet-zoom-hide')
    canvas.style.position = 'absolute'
    canvas.style.pointerEvents = 'none'
    canvas.style.opacity = String(this._heatOptions.opacity)
    this._canvas = canvas
    mapInstance.getPanes().overlayPane.appendChild(canvas)
    mapInstance.on('moveend resize viewreset zoomend', this._reset, this)
    this._reset()
    return this
  },
  onRemove(this: CellIdHeatLayerInternal, mapInstance: L.Map) {
    if (this._frame !== undefined) {
      cancelAnimationFrame(this._frame)
      this._frame = undefined
    }
    mapInstance.getPanes().overlayPane.removeChild(this._canvas!)
    mapInstance.off('moveend resize viewreset zoomend', this._reset, this)
    this._canvas = undefined
    this._map = undefined
    return this
  },
  _reset(this: CellIdHeatLayerInternal) {
    if (!this._map || !this._canvas) return
    const topLeft = this._map.containerPointToLayerPoint([0, 0])
    L.DomUtil.setPosition(this._canvas, topLeft)
    const size = this._map.getSize()
    if (this._canvas.width !== size.x) this._canvas.width = size.x
    if (this._canvas.height !== size.y) this._canvas.height = size.y
    this._scheduleRedraw()
  },
  _scheduleRedraw(this: CellIdHeatLayerInternal) {
    // Coalesce the costly full-canvas getImageData/putImageData sweep to one run per frame so a
    // burst of pan/zoom events doesn't repaint every pixel multiple times in the same frame.
    if (this._frame !== undefined) cancelAnimationFrame(this._frame)
    this._frame = requestAnimationFrame(() => {
      this._frame = undefined
      this._redraw()
    })
  },
  _redraw(this: CellIdHeatLayerInternal) {
    if (!this._map || !this._canvas) return
    const ctx = this._canvas.getContext('2d')
    if (!ctx) return
    const size = this._map.getSize()
    ctx.clearRect(0, 0, size.x, size.y)
    if (this._heatOptions.sites.length === 0) return
    // Stage 1: accumulate per-cell radial gradients on the alpha channel. Using `lighter`
    // makes overlapping cells brighten cumulatively → density per pixel.
    ctx.globalCompositeOperation = 'lighter'
    const mpp = metersPerPixelAt(this._map, this._map.getCenter().lat)
    this._heatOptions.sites.forEach((site) => {
      const center = this._map!.latLngToContainerPoint([site.lat, site.lon])
      const radiusPx = Math.max(2, (site.rangeMeters * this._heatOptions.radiusFraction) / mpp)
      if (
        center.x + radiusPx < 0 ||
        center.x - radiusPx > size.x ||
        center.y + radiusPx < 0 ||
        center.y - radiusPx > size.y
      ) {
        return
      }
      const radial = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radiusPx)
      radial.addColorStop(0, `rgba(255,255,255,${OPENCELLID_HEATMAP_PEAK_ALPHA})`)
      radial.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = radial
      ctx.fillRect(center.x - radiusPx, center.y - radiusPx, 2 * radiusPx, 2 * radiusPx)
    })
    // Stage 2: remap each pixel's alpha through the cool→warm gradient LUT so density turns
    // into color. The LUT also dictates the final pixel alpha so the natural radial fade is
    // preserved while hotspots get punchier.
    const lut = heatmapGradientLut()
    const img = ctx.getImageData(0, 0, size.x, size.y)
    const data = img.data
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3]
      if (a === 0) continue
      const lutIdx = a * 4
      data[i] = lut[lutIdx]
      data[i + 1] = lut[lutIdx + 1]
      data[i + 2] = lut[lutIdx + 2]
      data[i + 3] = lut[lutIdx + 3]
    }
    ctx.putImageData(img, 0, 0)
  },
  /* eslint-enable jsdoc/require-jsdoc */
})

/* eslint-disable jsdoc/require-jsdoc -- internal layer fields, kept private to this module. */
type CellIdHeatLayerInternal = L.Layer & {
  _map?: L.Map
  _canvas?: HTMLCanvasElement
  _heatOptions: CellIdHeatLayerOptions
  _frame?: number
  _reset: () => void
  _scheduleRedraw: () => void
  _redraw: () => void
}
/* eslint-enable jsdoc/require-jsdoc */

const createCellIdHeatLayer = (options: CellIdHeatLayerOptions): CellIdHeatLayerInstance => {
  const Ctor = CellIdHeatLayer as unknown as new (opts: CellIdHeatLayerOptions) => CellIdHeatLayerInstance
  return new Ctor(options)
}

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
  const coverageSteps = shallowRef<(L.Circle | L.Polygon)[]>([])
  const coverageAntennaType = shallowRef<AntennaType | undefined>()
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
    // The host can share a ref that transiently holds a DOM element instead of the map (e.g. the
    // mission-planning view's `planningMap` collides with a same-named Vue template ref), so bail
    // unless we actually hold a live Leaflet instance.
    if (!(map.value instanceof L.Map)) return
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
    if (!(map.value instanceof L.Map)) return
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

  const mergeOpenCellIdSites = (existing: OpenCellIdSite[] | null, incoming: OpenCellIdSite[]): OpenCellIdSite[] => {
    const merged = new Map<string, OpenCellIdSite>()
    ;[...(existing ?? []), ...incoming].forEach((site) => {
      const key = `${site.lat.toFixed(6)}:${site.lon.toFixed(6)}:${Math.round(site.rangeMeters)}`
      merged.set(key, site)
    })
    return [...merged.values()]
  }

  const mergeOverpassTowers = (existing: OverpassTower[] | null, incoming: OverpassTower[]): OverpassTower[] => {
    const merged = new Map<number, OverpassTower>()
    ;[...(existing ?? []), ...incoming].forEach((tower) => {
      merged.set(tower.id, tower)
    })
    return [...merged.values()]
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

  const mobileHeatmapRadiusFraction = (config: BaseStationConfig, intensityBoost = 1): number =>
    OPENCELLID_HEATMAP_MIN_RADIUS_FRACTION +
    Math.max(0, Math.min(1, config.mobileCoverage.heatmapIntensity * intensityBoost)) *
      (1 - OPENCELLID_HEATMAP_MIN_RADIUS_FRACTION)

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

    if (!(map.value instanceof L.Map) || !config.enabled || !config.position) return
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
        if (!apiKey) {
          store.openCellIdApiKeyStatus = 'unknown'
          notifyOpenCellIdKeyRequired()
          return
        }
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
          notifyOpenCellIdKeyRequired()
          return
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
    if (!mapReady.value || !(map.value instanceof L.Map)) return
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
      if (!mapReady.value) return
      attachMapDropHandlers()
    },
    { immediate: true }
  )
  watch(() => store.config, refreshAll, { deep: true })

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
    ],
    () => {
      void renderMobileCoverage(store.config)
    },
    { immediate: true }
  )

  watch(
    () => [mapReady.value, store.mobileCoverageTargetToolActive] as const,
    ([ready, active]) => {
      if (!ready || !(map.value instanceof L.Map)) return
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
