import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { CockpitMission, SavedMission, Waypoint, WaypointCoordinates } from '@/types/mission'

const THUMBNAIL_WIDTH = 320
const THUMBNAIL_HEIGHT = 240
const THUMBNAIL_PADDING = 16

/**
 * Vehicle types the mission planner can plan against, with their user-facing labels.
 * Single source for both the planner's "Planning for" selector and the library modal's
 * vehicle-type label rendering, so the two stay in sync.
 */
export const PLANNABLE_VEHICLE_TYPES: ReadonlyArray<{
  /** Human-readable label shown in the UI. */
  label: string
  /** Underlying MavType value persisted with the mission. */
  value: MavType
}> = [
  { label: 'Surface Boat', value: MavType.MAV_TYPE_SURFACE_BOAT },
  { label: 'Submarine', value: MavType.MAV_TYPE_SUBMARINE },
  { label: 'UAV', value: MavType.MAV_TYPE_QUADROTOR },
  { label: 'Ground Rover', value: MavType.MAV_TYPE_GROUND_ROVER },
]

const PLANNABLE_VEHICLE_TYPE_LABELS: Partial<Record<MavType, string>> = Object.fromEntries(
  PLANNABLE_VEHICLE_TYPES.map(({ label, value }) => [value, label])
)

/**
 * Resolves a user-facing label for a stored mission's vehicle type.
 * Falls through to a humanised MavType name so legacy missions still display something readable.
 * @param {MavType | undefined} type - The MavType value persisted with the mission.
 * @returns {string} The label to render, or 'Any' when no type was captured.
 */
export const vehicleTypeLabel = (type?: MavType): string => {
  if (!type) return 'Any'
  return (
    PLANNABLE_VEHICLE_TYPE_LABELS[type] ??
    String(type)
      .replace('MAV_TYPE_', '')
      .toLowerCase()
      .replace(/(^|_)([a-z])/g, (_m, _p1, c) => ` ${c.toUpperCase()}`)
      .trim()
  )
}

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
 * Limits applied to the placement transform inputs (scale and rotation).
 * Shared between the composable that owns the state and the template that binds the inputs.
 */
export const PLACEMENT_LIMITS = {
  /**
   * Minimum allowed scale percentage (per axis).
   */
  scaleMinPercent: 10,
  /**
   * Maximum allowed scale percentage (per axis).
   */
  scaleMaxPercent: 2000,
  /**
   * Minimum allowed rotation in degrees.
   */
  rotationMinDeg: -180,
  /**
   * Maximum allowed rotation in degrees.
   */
  rotationMaxDeg: 180,
} as const

/**
 * A 2D point in a local east/north meters frame anchored at some lat/lng origin.
 */
export type LocalMetersPoint = {
  /**
   * East offset in meters from the local-frame origin.
   */
  east: number
  /**
   * North offset in meters from the local-frame origin.
   */
  north: number
}

/**
 * Axis-aligned bounding box in a local east/north meters frame.
 */
export type LocalMetersBounds = {
  /**
   * Minimum east offset (meters).
   */
  minE: number
  /**
   * Maximum east offset (meters).
   */
  maxE: number
  /**
   * Minimum north offset (meters).
   */
  minN: number
  /**
   * Maximum north offset (meters).
   */
  maxN: number
}

/**
 * A geographic anchor as a plain `{ lat, lng }` pair so callers don't need a leaflet dependency.
 */
export type GeoAnchor = {
  /**
   * Latitude in degrees.
   */
  lat: number
  /**
   * Longitude in degrees.
   */
  lng: number
}

export const METERS_PER_DEGREE_LAT = 111320
const metersPerDegreeLng = (lat: number): number => METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180)

/**
 * Sanitises a user-entered scale percentage, falling back to 1.0 when the input is invalid.
 * @param {number} raw - Raw percentage value (e.g. 100 means no scaling).
 * @returns {number} The corresponding multiplier as a positive finite number.
 */
export const safeScalePercent = (raw: number): number => (Number.isFinite(raw) && raw > 0 ? raw / 100 : 1)

/**
 * Sanitises a user-entered rotation in degrees and converts it to radians.
 * @param {number} raw - Raw rotation in degrees.
 * @returns {number} The rotation in radians, or 0 when the input is non-finite.
 */
export const safeRotationRad = (raw: number): number => ((Number.isFinite(raw) ? raw : 0) * Math.PI) / 180

/**
 * Maps a point in the original mission local frame to a geographic coordinate, applying the
 * configured scale and rotation around `currentAnchor`.
 * @param {number} east - East offset (meters) from the original anchor.
 * @param {number} north - North offset (meters) from the original anchor.
 * @param {GeoAnchor} currentAnchor - Lat/lng anchor where the transformed point is centred.
 * @param {number} scaleXPercent - Scale-X percentage (100 = no scaling).
 * @param {number} scaleYPercent - Scale-Y percentage (100 = no scaling).
 * @param {number} rotationDeg - Clockwise rotation in degrees applied around the anchor.
 * @returns {WaypointCoordinates} The transformed coordinate as `[lat, lng]`.
 */
export const transformLocalMeters = (
  east: number,
  north: number,
  currentAnchor: GeoAnchor,
  scaleXPercent: number,
  scaleYPercent: number,
  rotationDeg: number
): WaypointCoordinates => {
  const scaleX = safeScalePercent(scaleXPercent)
  const scaleY = safeScalePercent(scaleYPercent)
  const theta = safeRotationRad(rotationDeg)
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)

  const sx = east * scaleX
  const sy = north * scaleY
  // Clockwise rotation on screen (north = +y on map).
  const rotatedEast = sx * cos + sy * sin
  const rotatedNorth = -sx * sin + sy * cos

  return [
    currentAnchor.lat + rotatedNorth / METERS_PER_DEGREE_LAT,
    currentAnchor.lng + rotatedEast / metersPerDegreeLng(currentAnchor.lat),
  ]
}

/**
 * Projects a geographic coordinate into the original mission local frame anchored at `origin`.
 * @param {WaypointCoordinates} coord - Coordinate as `[lat, lng]`.
 * @param {GeoAnchor} origin - Lat/lng origin of the local frame.
 * @returns {LocalMetersPoint} The east/north offset in meters from the origin.
 */
export const projectCoordToOriginalLocal = (coord: WaypointCoordinates, origin: GeoAnchor): LocalMetersPoint => ({
  east: (coord[1] - origin.lng) * metersPerDegreeLng(origin.lat),
  north: (coord[0] - origin.lat) * METERS_PER_DEGREE_LAT,
})

/**
 * Applies the placement transform to an original mission coordinate, returning the placed coordinate.
 * @param {WaypointCoordinates} coord - Original coordinate as `[lat, lng]`.
 * @param {GeoAnchor} originalAnchor - Lat/lng origin of the mission's local frame.
 * @param {GeoAnchor} currentAnchor - Lat/lng anchor where the placed mission is centred.
 * @param {number} scaleXPercent - Scale-X percentage (100 = no scaling).
 * @param {number} scaleYPercent - Scale-Y percentage (100 = no scaling).
 * @param {number} rotationDeg - Clockwise rotation in degrees.
 * @returns {WaypointCoordinates} The placed coordinate as `[lat, lng]`.
 */
export const transformPlacementCoord = (
  coord: WaypointCoordinates,
  originalAnchor: GeoAnchor,
  currentAnchor: GeoAnchor,
  scaleXPercent: number,
  scaleYPercent: number,
  rotationDeg: number
): WaypointCoordinates => {
  const local = projectCoordToOriginalLocal(coord, originalAnchor)
  return transformLocalMeters(local.east, local.north, currentAnchor, scaleXPercent, scaleYPercent, rotationDeg)
}

/**
 * Inverse of the rotation half of {@link transformLocalMeters}: takes a vector expressed in the
 * rotated current frame back into the original local frame, where captured corner positions live.
 * @param {number} eastRot - East offset (meters) in the rotated current frame.
 * @param {number} northRot - North offset (meters) in the rotated current frame.
 * @param {number} rotationDeg - Clockwise rotation in degrees that was applied to reach the current frame.
 * @returns {LocalMetersPoint} The same vector expressed in the original local frame.
 */
export const unrotateToOriginalLocal = (eastRot: number, northRot: number, rotationDeg: number): LocalMetersPoint => {
  const theta = safeRotationRad(rotationDeg)
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  return { east: eastRot * cos - northRot * sin, north: eastRot * sin + northRot * cos }
}

/**
 * Computes the local-frame bounding box of a mission's waypoints and survey polygons.
 * @param {CockpitMission} mission - The mission whose features should be bounded.
 * @param {GeoAnchor} origin - Lat/lng origin of the local frame.
 * @returns {LocalMetersBounds | null} The bounds, or null when the mission has no features.
 */
export const computeOriginalLocalBounds = (mission: CockpitMission, origin: GeoAnchor): LocalMetersBounds | null => {
  const waypointCoords = (mission.waypoints ?? []).map((w) => w.coordinates)
  const surveyCoords = (mission.surveys ?? []).flatMap((s) => s.polygonCoordinates ?? [])
  if (waypointCoords.length === 0 && surveyCoords.length === 0) return null
  let minE = Infinity
  let maxE = -Infinity
  let minN = Infinity
  let maxN = -Infinity
  const accumulate = (c: WaypointCoordinates): void => {
    const { east, north } = projectCoordToOriginalLocal(c, origin)
    if (east < minE) minE = east
    if (east > maxE) maxE = east
    if (north < minN) minN = north
    if (north > maxN) maxN = north
  }
  for (const c of waypointCoords) accumulate(c)
  for (const c of surveyCoords) accumulate(c)
  return { minE, maxE, minN, maxN }
}

/**
 * Type guard for SavedMission.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value matches the SavedMission shape.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isSavedMission = (value: any): value is SavedMission => {
  if (!value || typeof value !== 'object') return false
  // `id` is intentionally not required here: exported `.cmp` files have it stripped (the importer
  // assigns a fresh uuid), so requiring it would force every round-tripped export through the
  // bare-CockpitMission fallback and lose `name`, `description`, `vehicleType`, `estimates`, and
  // the timestamps. Discriminate on the saved-mission-specific metadata instead.
  if (
    typeof value.name !== 'string' ||
    typeof value.createdAt !== 'number' ||
    typeof value.updatedAt !== 'number' ||
    !Array.isArray(value.waypoints) ||
    !value.settings ||
    !Array.isArray(value.settings.mapCenter)
  ) {
    return false
  }
  // Spot-check the first waypoint so an adversarial .cmp file with a malformed waypoints array
  // is rejected up-front instead of crashing later when we read coordinates/id off entries.
  if (value.waypoints.length > 0) {
    const wp = value.waypoints[0]
    if (!wp || typeof wp.id !== 'string' || !Array.isArray(wp.coordinates) || wp.coordinates.length < 2) {
      return false
    }
  }
  return true
}
