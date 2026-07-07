import * as turf from '@turf/turf'
import type L from 'leaflet'

import type { CachedMobileCoverageEntry, CoverageBbox } from '@/types/baseStation'
import type { WaypointCoordinates } from '@/types/mission'

/** OSM Overpass has no per-call area cap, so a single ~11 km half-side bbox is enough. */
export const OVERPASS_BBOX_DEG = 0.1

/** Half-side of the OpenCellID coverage bounding box around the base station. */
export const OPENCELLID_COVERAGE_HALF_SIDE_KM = 25

/** Keep the persisted bbox cache small; users rarely need more than the most recent few areas. */
export const MOBILE_COVERAGE_CACHE_MAX_ENTRIES = 8

export const kmToLatDegrees = (km: number): number => km / 111.32

export const kmToLngDegrees = (km: number, lat: number): number => {
  const cosLat = Math.max(0.2, Math.cos((lat * Math.PI) / 180))
  return km / (111.32 * cosLat)
}

/**
 * Square-ish Overpass bbox centered on the given coordinate.
 * @param {number} lat Center latitude.
 * @param {number} lng Center longitude.
 * @returns {CoverageBbox} Bounding box.
 */
export const overpassBboxAround = (lat: number, lng: number): CoverageBbox => ({
  south: lat - OVERPASS_BBOX_DEG,
  west: lng - OVERPASS_BBOX_DEG,
  north: lat + OVERPASS_BBOX_DEG,
  east: lng + OVERPASS_BBOX_DEG,
})

/**
 * OpenCellID coverage bbox sized via {@link OPENCELLID_COVERAGE_HALF_SIDE_KM}.
 * @param {number} lat Center latitude.
 * @param {number} lng Center longitude.
 * @returns {CoverageBbox} Bounding box.
 */
export const openCellIdCoverageBboxAround = (lat: number, lng: number): CoverageBbox => ({
  south: lat - kmToLatDegrees(OPENCELLID_COVERAGE_HALF_SIDE_KM),
  west: lng - kmToLngDegrees(OPENCELLID_COVERAGE_HALF_SIDE_KM, lat),
  north: lat + kmToLatDegrees(OPENCELLID_COVERAGE_HALF_SIDE_KM),
  east: lng + kmToLngDegrees(OPENCELLID_COVERAGE_HALF_SIDE_KM, lat),
})

export const bboxContains = (bbox: CoverageBbox, position: WaypointCoordinates): boolean => {
  const [lat, lng] = position
  return lat >= bbox.south && lat <= bbox.north && lng >= bbox.west && lng <= bbox.east
}

export const bboxIntersects = (left: CoverageBbox, right: CoverageBbox): boolean =>
  left.west <= right.east && left.east >= right.west && left.south <= right.north && left.north >= right.south

export const bboxEquals = (left: CoverageBbox, right: CoverageBbox): boolean =>
  left.south === right.south && left.west === right.west && left.north === right.north && left.east === right.east

export const leafletBoundsToCoverageBbox = (bounds: L.LatLngBounds): CoverageBbox => ({
  south: bounds.getSouth(),
  west: bounds.getWest(),
  north: bounds.getNorth(),
  east: bounds.getEast(),
})

/**
 * Sort by `fetchedAtMs` (newest first) and clip to {@link MOBILE_COVERAGE_CACHE_MAX_ENTRIES}.
 * @param {CachedMobileCoverageEntry<T>[]} entries Cache entries to trim.
 * @returns {CachedMobileCoverageEntry<T>[]} Newest entries up to the cache cap.
 */
export const trimCacheEntries = <T>(entries: CachedMobileCoverageEntry<T>[]): CachedMobileCoverageEntry<T>[] => {
  return entries.sort((a, b) => b.fetchedAtMs - a.fetchedAtMs).slice(0, MOBILE_COVERAGE_CACHE_MAX_ENTRIES)
}

/**
 * Slice an area into uniform tiles of size `tileHalfSideKm * 2`.
 * @param {CoverageBbox} area Outer area.
 * @param {number} centerLat Reference latitude (controls longitude scaling).
 * @param {number} tileHalfSideKm Tile half-side, in kilometers.
 * @returns {CoverageBbox[]} Tile bboxes covering the area.
 */
export const tiledCoverageBboxes = (area: CoverageBbox, centerLat: number, tileHalfSideKm: number): CoverageBbox[] => {
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

export const bboxCenter = (bbox: CoverageBbox): WaypointCoordinates => [
  (bbox.south + bbox.north) / 2,
  (bbox.west + bbox.east) / 2,
]

export const sortCoverageBboxesByDistance = (center: WaypointCoordinates, bboxes: CoverageBbox[]): CoverageBbox[] =>
  [...bboxes].sort((left, right) => {
    const [leftLat, leftLng] = bboxCenter(left)
    const [rightLat, rightLng] = bboxCenter(right)
    const leftDistance = turf.distance(turf.point([center[1], center[0]]), turf.point([leftLng, leftLat]))
    const rightDistance = turf.distance(turf.point([center[1], center[0]]), turf.point([rightLng, rightLat]))
    return leftDistance - rightDistance
  })

export const unionCoverageBboxes = (bboxes: CoverageBbox[]): CoverageBbox => ({
  south: Math.min(...bboxes.map((bbox) => bbox.south)),
  west: Math.min(...bboxes.map((bbox) => bbox.west)),
  north: Math.max(...bboxes.map((bbox) => bbox.north)),
  east: Math.max(...bboxes.map((bbox) => bbox.east)),
})
