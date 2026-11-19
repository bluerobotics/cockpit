import * as turf from '@turf/turf'
import { t } from 'ttag'

import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { bboxContains, coversPoint, paddedBbox, polygonRings } from '@/libs/hazards/hazard-areas'
import { waypointAltitudesAmsl } from '@/libs/hazards/hazard-checks'
import type { GeoBbox } from '@/types/general'
import type { HazardArea, HazardCoverage } from '@/types/hazards'
import { type Waypoint, type WaypointCoordinates, AltitudeReferenceType } from '@/types/mission'

/**
 * How a vehicle meets the terrain: over it, on the water above it, under the water, or on it.
 */
export type TerrainVehicleClass = 'air' | 'surface' | 'underwater' | 'ground'

/**
 * A point the vehicle passes through, as the profile reads it.
 */
export type ProfilePoint = Pick<Waypoint, 'coordinates' | 'altitude' | 'altitudeReferenceType'> & {
  /**
   * Index of the mission waypoint, or null for the home position the mission starts from.
   */
  waypointIndex: number | null
}

/**
 * A position along the path, between two of its points.
 */
export interface PathStation {
  /**
   * Position as [latitude, longitude].
   */
  coordinates: WaypointCoordinates
  /**
   * Distance from the start of the path, in meters.
   */
  distanceM: number
  /**
   * Leg the station lies on, leg `n` running from point `n` to point `n + 1`.
   */
  legIndex: number
  /**
   * Fraction of the way along that leg, 0 to 1.
   */
  legFraction: number
}

/**
 * One station of the terrain profile.
 */
export interface TerrainProfileSample extends PathStation {
  /**
   * Interpolated ground or seabed height, meters above sea level, or null when unknown.
   */
  groundM: number | null
  /**
   * Highest model point around the station, the one clearance is judged against.
   */
  groundHighM: number | null
  /**
   * Planned vehicle altitude above sea level, or null when it cannot be derived.
   */
  pathAmslM: number | null
  /**
   * Height above the ground for aircraft, water under the keel for vessels, height above the
   * seabed for submarines; null for ground vehicles and unknown ground.
   */
  clearanceM: number | null
}

/**
 * What a run of profile stations has in common.
 */
export type TerrainFindingKind =
  | 'collision'
  | 'low-clearance'
  | 'uncertain-clearance'
  | 'aground'
  | 'low-under-keel'
  | 'crosses-land'
  | 'possible-shallows'
  | 'unmapped-shallows'
  | 'reaches-coastline'
  | 'above-surface'
  | 'unknown-ground'

/**
 * A stretch of the path where the vehicle meets the terrain in the same way.
 */
export interface TerrainFinding {
  /**
   * What happens there.
   */
  kind: TerrainFindingKind
  /**
   * Leg it lies on.
   */
  legIndex: number
  /**
   * Distance from the start of the path where it begins, in meters.
   */
  fromM: number
  /**
   * Distance from the start of the path where it ends, in meters.
   */
  toM: number
  /**
   * Smallest clearance over the stretch, in meters, when known.
   */
  worstClearanceM: number | null
  /**
   * Position of that smallest clearance.
   */
  worstAt: WaypointCoordinates
}

/**
 * Everything the profile needs besides the heights themselves.
 */
export interface TerrainProfileContext {
  /**
   * How the vehicle meets the terrain.
   */
  vehicleClass: TerrainVehicleClass
  /**
   * Water surface height, meters above the model's sea level.
   */
  waterLevelM: number
  /**
   * Clearance an aircraft or submarine must keep, in meters.
   */
  minimumClearanceM: number
  /**
   * Water a vessel must keep under its keel, in meters.
   */
  minimumUnderKeelM: number
  /**
   * Depth of the hull below the waterline, in meters.
   */
  draftM: number
  /**
   * Typical vertical error of the model, in meters.
   */
  uncertaintyM: number
  /**
   * Water the coastline map shows, where a vessel's model reading of land is taken as possible shallows instead.
   */
  mappedWater?: HazardArea[]
  /**
   * Area the coastline map is loaded over, null while none is. Elsewhere a vessel's model reading of land is taken
   * as possible shallows too; omitted when the coastline is not used, so the model's land is land.
   */
  coastlineCoverage?: HazardCoverage | null
  /**
   * Coastline runs as loaded, in their OSM direction with the land on the left, reaching past the coverage.
   */
  coastline?: HazardArea[]
}

/**
 * The terrain under a whole mission, and where the vehicle comes too close to it.
 */
export interface TerrainProfile {
  /**
   * Stations along the path, in order.
   */
  samples: TerrainProfileSample[]
  /**
   * Altitude of each point above sea level, in the order of the points.
   */
  pointAmslM: (number | undefined)[]
  /**
   * Stretches where the vehicle meets the terrain in a way worth reporting.
   */
  findings: TerrainFinding[]
  /**
   * Length of the whole path, in meters.
   */
  lengthM: number
}

/**
 * How a vehicle type meets the terrain.
 * @param {MavType | undefined} vehicleType MAVLink vehicle type, undefined when not known.
 * @returns {TerrainVehicleClass} The class; anything not on or in the water is judged as an aircraft.
 */
export const terrainVehicleClass = (vehicleType: MavType | undefined): TerrainVehicleClass => {
  if (vehicleType === MavType.MAV_TYPE_SURFACE_BOAT) return 'surface'
  if (vehicleType === MavType.MAV_TYPE_SUBMARINE) return 'underwater'
  if (vehicleType === MavType.MAV_TYPE_GROUND_ROVER) return 'ground'
  return 'air'
}

/**
 * What an aircraft flies over: the ground, or the water surface where the ground lies below it.
 * @param {number} groundM Model height.
 * @param {number} waterLevelM Water surface height.
 * @returns {number} The surface height.
 */
export const surfaceHeight = (groundM: number, waterLevelM: number): number => Math.max(groundM, waterLevelM)

const toPosition = ([lat, lng]: WaypointCoordinates): [number, number] => [lng, lat]

/**
 * Length of a straight leg.
 * @param {WaypointCoordinates} from Start.
 * @param {WaypointCoordinates} to End.
 * @returns {number} Distance in meters.
 */
export const legLengthM = (from: WaypointCoordinates, to: WaypointCoordinates): number =>
  turf.distance(toPosition(from), toPosition(to), { units: 'meters' })

/**
 * Splits a path into evenly spaced stations, always keeping its corners.
 * @param {WaypointCoordinates[]} points Path corners, in order.
 * @param {number} spacingM Largest distance between stations, in meters.
 * @returns {PathStation[]} The stations, starting on the first corner and ending on the last.
 */
export const densifyPath = (points: WaypointCoordinates[], spacingM: number): PathStation[] => {
  if (points.length === 0) return []
  const stations: PathStation[] = [{ coordinates: points[0], distanceM: 0, legIndex: 0, legFraction: 0 }]
  let travelled = 0
  for (let leg = 0; leg < points.length - 1; leg++) {
    const [fromLat, fromLng] = points[leg]
    const [toLat, toLng] = points[leg + 1]
    const length = legLengthM(points[leg], points[leg + 1])
    const steps = Math.max(1, Math.ceil(length / spacingM))
    for (let step = 1; step <= steps; step++) {
      const fraction = step / steps
      stations.push({
        coordinates: [fromLat + (toLat - fromLat) * fraction, fromLng + (toLng - fromLng) * fraction],
        distanceM: travelled + length * fraction,
        legIndex: leg,
        legFraction: fraction,
      })
    }
    travelled += length
  }
  return stations
}

/**
 * Stations placed again on their path after its corners moved, each at the same share of its leg.
 * @param {T[]} stations Stations sampled from the path, in order.
 * @param {WaypointCoordinates[]} points The path's corners now.
 * @returns {T[]} The moved stations, or the same ones when the path gained or lost corners since.
 */
export const followPathCorners = <T extends PathStation>(stations: T[], points: WaypointCoordinates[]): T[] => {
  if (stations.at(-1)?.legIndex !== points.length - 2) return stations
  return stations.map((station) => {
    const [fromLat, fromLng] = points[station.legIndex]
    const [toLat, toLng] = points[station.legIndex + 1]
    const fraction = station.legFraction
    return { ...station, coordinates: [fromLat + (toLat - fromLat) * fraction, fromLng + (toLng - fromLng) * fraction] }
  })
}

/**
 * Spacing that keeps a profile detailed without sampling a long survey a million times.
 * @param {number} lengthM Path length in meters.
 * @returns {number} Station spacing in meters.
 */
export const profileSpacingM = (lengthM: number): number => Math.max(10, lengthM / 2000)

/**
 * Altitude of every point above sea level, reading terrain-relative points against the surface the
 * vehicle actually keeps clear of.
 * @param {ProfilePoint[]} points Path points.
 * @param {(number | null)[]} groundAtPointsM Ground under each point.
 * @param {TerrainProfileContext} context Vehicle and water level.
 * @returns {(number | undefined)[]} Altitudes above sea level, undefined where unknown.
 */
export const pointAltitudesAmsl = (
  points: ProfilePoint[],
  groundAtPointsM: (number | null)[],
  context: TerrainProfileContext
): (number | undefined)[] => {
  const surfaces = groundAtPointsM.map((ground) =>
    ground === null || context.vehicleClass !== 'air' ? ground : surfaceHeight(ground, context.waterLevelM)
  )
  const homeIndex = points.findIndex((point) => point.waypointIndex === null)
  const homeGround = homeIndex >= 0 ? surfaces[homeIndex] : null
  // Home sits on whichever is higher, the ground or the water, for every kind of vehicle.
  const homeAmsl = homeGround === null ? null : surfaceHeight(homeGround, context.waterLevelM)
  return waypointAltitudesAmsl(points, surfaces, homeAmsl).map((altitude, index) =>
    points[index].waypointIndex === null ? homeAmsl ?? undefined : altitude
  )
}

const pathAltitudeAt = (
  station: PathStation,
  groundM: number | null,
  points: ProfilePoint[],
  pointAmslM: (number | undefined)[],
  groundAtPointsM: (number | null)[],
  context: TerrainProfileContext
): number | null => {
  if (context.vehicleClass === 'surface') return context.waterLevelM
  if (context.vehicleClass === 'ground') return groundM
  const { legIndex, legFraction } = station
  const from = pointAmslM[legIndex]
  const to = pointAmslM[Math.min(points.length - 1, legIndex + 1)]
  if (from === undefined || to === undefined) return null
  const destination = points[Math.min(points.length - 1, legIndex + 1)]
  // The autopilot flies a leg in its destination's frame, so a terrain-relative destination makes
  // the vehicle hold a height over the ground rather than a straight line through the air.
  if (destination.altitudeReferenceType !== AltitudeReferenceType.RELATIVE_TO_TERRAIN) {
    return from + (to - from) * legFraction
  }
  const startGround = groundAtPointsM[legIndex]
  if (groundM === null || startGround === null) return null
  const surface = (height: number): number =>
    context.vehicleClass === 'air' ? surfaceHeight(height, context.waterLevelM) : height
  const startAgl = from - surface(startGround)
  const agl = startAgl + (destination.altitude - startAgl) * legFraction
  return surface(groundM) + agl
}

const clearanceAt = (
  pathAmslM: number | null,
  groundHighM: number | null,
  context: TerrainProfileContext
): number | null => {
  if (groundHighM === null || context.vehicleClass === 'ground') return null
  if (context.vehicleClass === 'surface') return context.waterLevelM - groundHighM - context.draftM
  if (pathAmslM === null) return null
  if (context.vehicleClass === 'air') return pathAmslM - surfaceHeight(groundHighM, context.waterLevelM)
  return pathAmslM - groundHighM
}

const vesselKindAt = (
  clearanceM: number | null,
  groundHighM: number,
  context: TerrainProfileContext
): TerrainFindingKind | null => {
  if (groundHighM > context.waterLevelM) return 'crosses-land'
  if (clearanceM === null) return null
  if (clearanceM < 0) return 'aground'
  return clearanceM < context.minimumUnderKeelM ? 'low-under-keel' : null
}

/**
 * A coastline water face, ready for point tests.
 */
interface PreparedWater {
  /**
   * Bounds of the face, to skip it cheaply for points outside.
   */
  bbox: GeoBbox
  /**
   * The face as a polygon.
   */
  polygon: ReturnType<typeof turf.polygon>
}

// Coastline faces hold tens of thousands of vertices and are tested against many stations, so each is prepared once.
const preparedWater = new WeakMap<HazardArea, PreparedWater>()

// ponytail: one point-in-polygon test per station the model reads as land, which grows with the coastline's vertex
// count; rasterize the faces into a grid mask if region-sized coastlines make the live check slow.
/**
 * Whether a point lies on water the coastline map shows.
 * @param {HazardArea[]} water Water faces of the coastline.
 * @param {WaypointCoordinates} point `[latitude, longitude]` to test.
 * @returns {boolean} True when a face holds the point.
 */
const isMappedWater = (water: HazardArea[], point: WaypointCoordinates): boolean => {
  const target = turf.point([point[1], point[0]])
  return water.some((area) => {
    let face = preparedWater.get(area)
    if (!face) {
      face = { bbox: paddedBbox(area.coordinates, 0), polygon: turf.polygon(polygonRings(area)) }
      preparedWater.set(area, face)
    }
    return bboxContains(face.bbox, point) && turf.booleanPointInPolygon(target, face.polygon)
  })
}

/**
 * Why land the model reads at a point may be shallow water instead: the coastline map shows water there, or is
 * not loaded over it. Land the model reads on water is usually its coarse cells averaging in the shore, or a shoal
 * it rounds up, so it is a warning to check a chart rather than land.
 * @param {TerrainProfileContext} context Context of the check.
 * @param {WaypointCoordinates} point `[latitude, longitude]` the model reads as land.
 * @param {boolean} landBeyond Whether the path reached land on the coastline map just before leaving it, from {@link landBeyondCoastline}.
 * @returns {'mapped' | 'unmapped' | null} Why it may be water, null when the coastline confirms the land or is not used.
 */
export const possibleShallowsReason = (
  context: TerrainProfileContext,
  point: WaypointCoordinates,
  landBeyond = false
): 'mapped' | 'unmapped' | null => {
  if (context.vehicleClass === 'air') return null
  if (isMappedWater(context.mappedWater ?? [], point)) return 'mapped'
  const { coastlineCoverage } = context
  if (coastlineCoverage === undefined || landBeyond) return null
  return coastlineCoverage && coversPoint(coastlineCoverage, point) ? null : 'unmapped'
}

/**
 * A point where a path crosses the coastline line.
 */
export interface CoastlineCrossing {
  /**
   * Distance from the start of the path, in meters.
   */
  distanceM: number
  /**
   * Where the path crosses it.
   */
  coordinates: WaypointCoordinates
  /**
   * Leg the crossing lies on.
   */
  legIndex: number
  /**
   * Whether the path goes onto land there, which is on the coastline's left.
   */
  intoLand: boolean
}

type CoastSegment = [aLat: number, aLng: number, bLat: number, bLng: number]

const coastSegments = new WeakMap<HazardArea, CoastSegment[]>()

const segmentsOf = (run: HazardArea): CoastSegment[] => {
  let segments = coastSegments.get(run)
  if (!segments) {
    const points = run.kind === 'polygon' ? [...run.coordinates, run.coordinates[0]] : run.coordinates
    segments = points.slice(1).map(([lat, lng], index): CoastSegment => [...points[index], lat, lng])
    coastSegments.set(run, segments)
  }
  return segments
}

type SegmentCrossing = {
  /** How far along the step the crossing lies, from 0 at its start to 1 at its end. */
  fraction: number
  /** Whether the step crosses from water onto land. */
  intoLand: boolean
}

// Where the step from `from` to `to` crosses a coastline segment, as a fraction of the step, in the
// latitude and longitude plane, which keeps the side a point lies on.
const crossingOf = (
  [fromLat, fromLng]: WaypointCoordinates,
  [toLat, toLng]: WaypointCoordinates,
  [aLat, aLng, bLat, bLng]: CoastSegment
): SegmentCrossing | null => {
  const [stepLng, stepLat, coastLng, coastLat] = [toLng - fromLng, toLat - fromLat, bLng - aLng, bLat - aLat]
  const denominator = stepLng * coastLat - stepLat * coastLng
  if (denominator === 0) return null
  const [offsetLng, offsetLat] = [aLng - fromLng, aLat - fromLat]
  const fraction = (offsetLng * coastLat - offsetLat * coastLng) / denominator
  const along = (offsetLng * stepLat - offsetLat * stepLng) / denominator
  if (fraction < 0 || fraction >= 1 || along < 0 || along >= 1) return null
  return { fraction, intoLand: coastLng * (toLat - aLat) - coastLat * (toLng - aLng) > 0 }
}

/**
 * Where a marine vehicle's path crosses the loaded coastline line, which reaches past the area the coastline
 * divides into land and water.
 * @param {PathStation[]} stations Stations along a path, in order.
 * @param {TerrainProfileContext} context Context of the check.
 * @returns {CoastlineCrossing[]} The crossings, in path order.
 */
const coastlineCrossings = (stations: PathStation[], context: TerrainProfileContext): CoastlineCrossing[] => {
  const marine = context.vehicleClass === 'surface' || context.vehicleClass === 'underwater'
  if (!marine || !context.coastline?.length || stations.length < 2) return []
  const box = paddedBbox(
    stations.map(({ coordinates }) => coordinates),
    0
  )
  // ponytail: every step is tested against every coastline segment inside the path's box; index the segments
  // (turf's rbush) if a long mission along a detailed shore makes the live check slow.
  const near = context.coastline
    .flatMap(segmentsOf)
    .filter(
      ([aLat, aLng, bLat, bLng]) =>
        Math.max(aLat, bLat) >= box.south &&
        Math.min(aLat, bLat) <= box.north &&
        Math.max(aLng, bLng) >= box.west &&
        Math.min(aLng, bLng) <= box.east
    )
  return stations.slice(1).flatMap((to, index) => {
    const from = stations[index]
    return near
      .map((segment) => crossingOf(from.coordinates, to.coordinates, segment))
      .filter((crossing): crossing is NonNullable<typeof crossing> => crossing !== null)
      .sort((a, b) => a.fraction - b.fraction)
      .map(({ fraction, intoLand }) => ({
        distanceM: from.distanceM + (to.distanceM - from.distanceM) * fraction,
        coordinates: [
          from.coordinates[0] + (to.coordinates[0] - from.coordinates[0]) * fraction,
          from.coordinates[1] + (to.coordinates[1] - from.coordinates[1]) * fraction,
        ] as WaypointCoordinates,
        legIndex: to.legIndex,
        intoLand,
      }))
  })
}

/**
 * What is known about the side of the coastline a path is on, at one point along it.
 */
interface SideEvidence {
  /**
   * Distance from the start of the path, in meters.
   */
  distanceM: number
  /**
   * Whether the path is on land just before the point.
   */
  landBefore: boolean
  /**
   * Whether the path is on land just after the point.
   */
  landAfter: boolean
}

/**
 * For each station past the edge of the loaded coastline, whether it is on land. It takes the side of the nearest
 * thing known along the path: a crossing of the coastline line, or a station the loaded coastline covers.
 * @param {PathStation[]} stations Stations along a path, in order.
 * @param {TerrainProfileContext} context Context of the check.
 * @param {CoastlineCrossing[]} crossings Crossings of the coastline line, from {@link coastlineCrossings}.
 * @returns {boolean[]} One flag per station, false for stations the coastline covers.
 */
export const landBeyondCoastline = (
  stations: PathStation[],
  context: TerrainProfileContext,
  crossings = coastlineCrossings(stations, context)
): boolean[] => {
  const coverage = context.coastlineCoverage
  if (!coverage || context.vehicleClass === 'air') return stations.map(() => false)
  const covered = stations.map(({ coordinates }) => coversPoint(coverage, coordinates))
  // Only the covered stations bordering a stretch past the edge are tested against the coastline faces.
  const bordering = stations.flatMap(({ distanceM, coordinates }, index) => {
    if (!covered[index] || (covered[index - 1] !== false && covered[index + 1] !== false)) return []
    const land = !isMappedWater(context.mappedWater ?? [], coordinates)
    return [{ distanceM, landBefore: land, landAfter: land }]
  })
  const evidence: SideEvidence[] = [
    ...bordering,
    ...crossings.map(({ distanceM, intoLand }) => ({ distanceM, landBefore: !intoLand, landAfter: intoLand })),
  ].sort((a, b) => a.distanceM - b.distanceM)
  let upcoming = 0
  return stations.map(({ distanceM }, index) => {
    while (upcoming < evidence.length && evidence[upcoming].distanceM <= distanceM) upcoming++
    const before = evidence[upcoming - 1]
    const after = evidence[upcoming]
    if (covered[index] || (!before && !after)) return false
    if (!after || (before && distanceM - before.distanceM <= after.distanceM - distanceM)) return before.landAfter
    return after.landBefore
  })
}

const SHALLOWS_KINDS = { mapped: 'possible-shallows', unmapped: 'unmapped-shallows' } as const

const possibleShallowsAt = (
  sample: TerrainProfileSample,
  context: TerrainProfileContext,
  landBeyond: boolean
): TerrainFindingKind | null => {
  const groundHighM = sample.groundHighM ?? -Infinity
  if (groundHighM <= context.waterLevelM) return null
  const reason = possibleShallowsReason(context, sample.coordinates, landBeyond)
  if (!reason) return null
  // Mapped water the model reads within its own error of the surface says nothing about the depth there.
  return groundHighM <= context.waterLevelM + context.uncertaintyM ? 'unknown-ground' : SHALLOWS_KINDS[reason]
}

const kindAt = (
  sample: TerrainProfileSample,
  context: TerrainProfileContext,
  landBeyond: boolean
): TerrainFindingKind | null => {
  const { clearanceM, groundHighM, pathAmslM } = sample
  if (context.vehicleClass === 'ground') return null
  if (groundHighM === null) return 'unknown-ground'
  const shallows = possibleShallowsAt(sample, context, landBeyond)
  if (shallows) return shallows
  if (context.vehicleClass === 'surface') return vesselKindAt(clearanceM, groundHighM, context)
  if (context.vehicleClass === 'underwater' && pathAmslM !== null && pathAmslM > context.waterLevelM) {
    return 'above-surface'
  }
  if (clearanceM === null) return null
  if (clearanceM < 0) return 'collision'
  if (clearanceM < context.minimumClearanceM) return 'low-clearance'
  return clearanceM < context.minimumClearanceM + context.uncertaintyM ? 'uncertain-clearance' : null
}

// An aircraft leaving home is near the ground by necessity until it climbs through the minimum, so
// only terrain above its path counts there.
const takeoffEndM = (
  points: ProfilePoint[],
  samples: TerrainProfileSample[],
  context: TerrainProfileContext,
  homeAmslM?: number
): number => {
  if (context.vehicleClass !== 'air' || points[0]?.waypointIndex !== null || homeAmslM === undefined) return 0
  const floorM = homeAmslM + context.minimumClearanceM + context.uncertaintyM
  const climbed = samples.find((sample) => sample.legIndex > 0 || (sample.pathAmslM ?? -Infinity) >= floorM)
  return climbed?.distanceM ?? Infinity
}

/**
 * Groups consecutive stations that meet the terrain the same way on the same leg.
 * @param {TerrainProfileSample[]} samples Profile stations.
 * @param {TerrainProfileContext} context Vehicle and thresholds.
 * @param {number} climbOutM Distance before which the clearance minimums do not apply, as the vehicle is still taking off.
 * @returns {TerrainFinding[]} One finding per stretch.
 */
const profileFindings = (
  samples: TerrainProfileSample[],
  context: TerrainProfileContext,
  climbOutM = 0
): TerrainFinding[] => {
  const findings: TerrainFinding[] = []
  let open: TerrainFinding | null = null
  const crossings = coastlineCrossings(samples, context)
  const landBeyond = landBeyondCoastline(samples, context, crossings)
  samples.forEach((sample, index) => {
    const raw = kindAt(sample, context, landBeyond[index])
    const takingOff = sample.distanceM < climbOutM && (raw === 'low-clearance' || raw === 'uncertain-clearance')
    const kind = takingOff ? null : raw
    if (open && (kind !== open.kind || sample.legIndex !== open.legIndex)) open = null
    if (!kind) return
    if (!open) {
      open = {
        kind,
        legIndex: sample.legIndex,
        fromM: sample.distanceM,
        toM: sample.distanceM,
        worstClearanceM: sample.clearanceM,
        worstAt: sample.coordinates,
      }
      findings.push(open)
      return
    }
    open.toM = sample.distanceM
    if (sample.clearanceM !== null && (open.worstClearanceM === null || sample.clearanceM < open.worstClearanceM)) {
      open.worstClearanceM = sample.clearanceM
      open.worstAt = sample.coordinates
    }
  })
  const shoreline = crossings
    .filter(({ intoLand }) => intoLand)
    .map(({ distanceM, coordinates, legIndex }) => ({
      kind: 'reaches-coastline' as const,
      legIndex,
      fromM: distanceM,
      toM: distanceM,
      worstClearanceM: null,
      worstAt: coordinates,
    }))
  return [...findings, ...shoreline].sort((a, b) => a.fromM - b.fromM)
}

/**
 * Builds the terrain profile of a path from heights sampled along it.
 * @param {ProfilePoint[]} points Path points, in order.
 * @param {PathStation[]} stations Stations along the path, from {@link densifyPath}.
 * @param {(number | null)[]} groundM Interpolated ground at each station.
 * @param {(number | null)[]} groundHighM Highest model point around each station.
 * @param {(number | null)[]} groundAtPointsM Interpolated ground under each point.
 * @param {TerrainProfileContext} context Vehicle, water level and thresholds.
 * @returns {TerrainProfile} The profile and its findings.
 */
export const buildTerrainProfile = (
  points: ProfilePoint[],
  stations: PathStation[],
  groundM: (number | null)[],
  groundHighM: (number | null)[],
  groundAtPointsM: (number | null)[],
  context: TerrainProfileContext
): TerrainProfile => {
  const pointAmslM = pointAltitudesAmsl(points, groundAtPointsM, context)
  const conservativeSamples = stations.map((station, index): TerrainProfileSample => {
    const pathAmslM = pathAltitudeAt(station, groundM[index], points, pointAmslM, groundAtPointsM, context)
    return {
      ...station,
      groundM: groundM[index],
      groundHighM: groundHighM[index],
      pathAmslM,
      clearanceM: clearanceAt(pathAmslM, groundHighM[index], context),
    }
  })
  const climbOutM = takeoffEndM(points, conservativeSamples, context, pointAmslM[0])
  // Home stands on the interpolated ground, which the highest surrounding model point would put underground.
  const samples = conservativeSamples.map((sample) =>
    sample.distanceM < climbOutM
      ? { ...sample, clearanceM: clearanceAt(sample.pathAmslM, sample.groundM, context) }
      : sample
  )
  return {
    samples,
    pointAmslM,
    findings: profileFindings(samples, context, climbOutM),
    lengthM: stations.at(-1)?.distanceM ?? 0,
  }
}

/**
 * Name of a leg as the operator reads it on the map.
 * @param {ProfilePoint[]} points Path points.
 * @param {number} legIndex Leg to name.
 * @returns {string} Such as "home to waypoint 1" or "waypoint 3 to 4".
 */
export const legLabel = (points: ProfilePoint[], legIndex: number): string => {
  const from = points[legIndex]?.waypointIndex
  const to = points[legIndex + 1]?.waypointIndex
  if (from === null || from === undefined) {
    const destination = (to ?? 0) + 1
    return t`home to waypoint ${destination}`
  }
  const origin = from + 1
  const destination = (to ?? from) + 1
  return t`waypoint ${origin} to ${destination}`
}
