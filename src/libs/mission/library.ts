import { CockpitMission, SavedMission, Waypoint, WaypointCoordinates } from '@/types/mission'

const THUMBNAIL_WIDTH = 320
const THUMBNAIL_HEIGHT = 240
const THUMBNAIL_PADDING = 16

const utf8ToBase64 = (input: string): string => {
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

type LatLngBounds = {
  /**
   * Minimum latitude.
   */
  minLat: number
  /**
   * Maximum latitude.
   */
  maxLat: number
  /**
   * Minimum longitude.
   */
  minLng: number
  /**
   * Maximum longitude.
   */
  maxLng: number
}

const computeBounds = (coordinates: WaypointCoordinates[]): LatLngBounds | null => {
  if (coordinates.length === 0) return null
  let minLat = coordinates[0][0]
  let maxLat = coordinates[0][0]
  let minLng = coordinates[0][1]
  let maxLng = coordinates[0][1]
  for (const [lat, lng] of coordinates) {
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
  }
  return { minLat, maxLat, minLng, maxLng }
}

/**
 * Generates a lightweight SVG thumbnail (base64 data URL) of a mission's geometry.
 * @param {CockpitMission} mission - The mission to render.
 * @returns {string} A base64 `data:image/svg+xml` URL.
 */
export const generateMissionThumbnail = (mission: CockpitMission): string => {
  const waypointCoords: WaypointCoordinates[] = (mission.waypoints ?? []).map((w) => w.coordinates)
  const surveyCoords: WaypointCoordinates[] = (mission.surveys ?? []).flatMap((s) => s.polygonCoordinates ?? [])
  const allCoords = [...waypointCoords, ...surveyCoords]

  if (allCoords.length === 0) {
    const emptySvg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${THUMBNAIL_WIDTH}" height="${THUMBNAIL_HEIGHT}" viewBox="0 0 ${THUMBNAIL_WIDTH} ${THUMBNAIL_HEIGHT}">` +
      `<rect width="100%" height="100%" fill="#1f2a37"/>` +
      `<text x="50%" y="50%" fill="#ffffff66" font-family="sans-serif" font-size="16" text-anchor="middle" dominant-baseline="middle">No path</text>` +
      `</svg>`
    return `data:image/svg+xml;base64,${utf8ToBase64(emptySvg)}`
  }

  const bounds = computeBounds(allCoords)!
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 1e-7)
  const lngSpan = Math.max(bounds.maxLng - bounds.minLng, 1e-7)
  const usableWidth = THUMBNAIL_WIDTH - THUMBNAIL_PADDING * 2
  const usableHeight = THUMBNAIL_HEIGHT - THUMBNAIL_PADDING * 2
  const scale = Math.min(usableWidth / lngSpan, usableHeight / latSpan)

  const offsetX = (THUMBNAIL_WIDTH - lngSpan * scale) / 2
  const offsetY = (THUMBNAIL_HEIGHT - latSpan * scale) / 2

  const project = ([lat, lng]: WaypointCoordinates): [number, number] => [
    offsetX + (lng - bounds.minLng) * scale,
    offsetY + (bounds.maxLat - lat) * scale,
  ]

  const surveyPolygons = (mission.surveys ?? [])
    .map((s) => {
      if (!s.polygonCoordinates?.length) return ''
      const points = s.polygonCoordinates
        .map((c) => project(c))
        .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
        .join(' ')
      return `<polygon points="${points}" fill="#3B78A833" stroke="#3B78A8" stroke-width="1.5"/>`
    })
    .join('')

  const pathPoints = waypointCoords
    .map((c) => project(c))
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ')
  const pathElement = pathPoints ? `<path d="${pathPoints}" stroke="#ffd54f" stroke-width="2.5" fill="none"/>` : ''

  const baseRadius = 3
  const endpointRadius = baseRadius * 1.25
  const waypointMarkers = waypointCoords
    .map((c) => project(c))
    .map(([x, y], i) => {
      const isEndpoint = i === 0 || i === waypointCoords.length - 1
      const fill = isEndpoint ? '#ff9800' : '#ffffff'
      const radius = isEndpoint ? endpointRadius : baseRadius
      return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(
        2
      )}" r="${radius}" fill="${fill}" stroke="#000000aa" stroke-width="0.5"/>`
    })
    .join('')

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${THUMBNAIL_WIDTH}" height="${THUMBNAIL_HEIGHT}" viewBox="0 0 ${THUMBNAIL_WIDTH} ${THUMBNAIL_HEIGHT}">` +
    `<rect width="100%" height="100%" fill="#1f2a37"/>` +
    surveyPolygons +
    pathElement +
    waypointMarkers +
    `</svg>`

  return `data:image/svg+xml;base64,${utf8ToBase64(svg)}`
}

/**
 * Centroid (average lat/lng) of the mission features. Falls back to the saved map center
 * when the mission has no waypoints or surveys.
 * @param {CockpitMission} mission - The mission whose location should be computed.
 * @returns {WaypointCoordinates} The centroid coordinates of the mission.
 */
export const computeMissionLocation = (mission: CockpitMission): WaypointCoordinates => {
  const waypointCoords: WaypointCoordinates[] = (mission.waypoints ?? []).map((w: Waypoint) => w.coordinates)
  const surveyCoords: WaypointCoordinates[] = (mission.surveys ?? []).flatMap((s) => s.polygonCoordinates ?? [])
  const allCoords = [...waypointCoords, ...surveyCoords]
  if (allCoords.length === 0) return mission.settings.mapCenter
  let sumLat = 0
  let sumLng = 0
  for (const [lat, lng] of allCoords) {
    sumLat += lat
    sumLng += lng
  }
  return [sumLat / allCoords.length, sumLng / allCoords.length]
}

/**
 * Type guard for SavedMission.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value matches the SavedMission shape.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isSavedMission = (value: any): value is SavedMission => {
  if (!value || typeof value !== 'object') return false
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number' &&
    Array.isArray(value.waypoints) &&
    value.settings &&
    Array.isArray(value.settings.mapCenter)
  )
}
