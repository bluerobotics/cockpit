import * as turf from '@turf/turf'
import type { Feature, LineString, MultiLineString, Position } from 'geojson'

import type { WaypointLike } from '@/libs/geo-fence'
import { bboxContains, coversPoint, hazardAreaAt, paddedBbox, polygonRings } from '@/libs/hazards/hazard-areas'
import type { HazardAdvisory, HazardArea, HazardCoverage, HazardGridSourceId } from '@/types/hazards'
import { type Waypoint, type WaypointCoordinates, AltitudeReferenceType } from '@/types/mission'

const toPosition = ([lat, lng]: WaypointCoordinates): Position => [lng, lat]
const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`

const indicesWhere = (count: number, predicate: (index: number) => boolean): number[] =>
  Array.from({ length: count }, (_, index) => index).filter(predicate)

const legsOf = (waypoints: WaypointLike[]): Feature<LineString>[] =>
  waypoints
    .slice(1)
    .map((waypoint, index) =>
      turf.lineString([toPosition(waypoints[index].coordinates), toPosition(waypoint.coordinates)])
    )

const boundaryOf = (area: HazardArea): Feature<LineString | MultiLineString> =>
  area.kind === 'polygon' ? turf.multiLineString(polygonRings(area)) : turf.lineString(area.coordinates.map(toPosition))

// Both ends of every leg that crosses the boundary, so the operator is pointed at the leg itself.
const crossingWaypoints = (
  legs: Feature<LineString>[],
  boundary: Feature<LineString | MultiLineString>,
  skipLeg: (index: number) => boolean = () => false
): Set<number> => {
  const crossing = new Set<number>()
  const [west, south, east, north] = turf.bbox(boundary)
  legs.forEach((leg, index) => {
    // An intersection test costs far more than this box test, and most legs lie nowhere near a given area.
    const [[lngA, latA], [lngB, latB]] = leg.geometry.coordinates
    const clear =
      Math.max(lngA, lngB) < west ||
      Math.min(lngA, lngB) > east ||
      Math.max(latA, latB) < south ||
      Math.min(latA, latB) > north
    if (clear || skipLeg(index) || turf.lineIntersect(leg, boundary).features.length === 0) return
    crossing.add(index)
    crossing.add(index + 1)
  })
  return crossing
}

let selfChecked = false

/**
 * Checks a mission against loaded hazard areas, reporting waypoints that fall inside an area, legs
 * that cross one, and waypoints that pass closer than the operator's clearance margin. Where an area
 * publishes a vertical band and a waypoint's altitude is known, a waypoint above or below the band is
 * clear of it, and so is a leg with both ends on the same side.
 *
 * Absence of a warning only means nothing was found in the data that was fetched, which covers one
 * bounding box from one contributor-maintained dataset. It is never a statement that a route is safe.
 * @param {WaypointLike[]} waypoints Mission waypoints, in order.
 * @param {HazardArea[]} areas Areas to check against.
 * @param {number} clearanceM Horizontal margin, in meters, a waypoint must keep from an area.
 * @param {(number | undefined)[]} [altitudesAmslM] Altitude of each waypoint above sea level, when known.
 * @returns {HazardAdvisory[]} One advisory per area and contact kind, empty when nothing was found.
 */
export const checkMissionAgainstAreas = (
  waypoints: WaypointLike[],
  areas: HazardArea[],
  clearanceM: number,
  altitudesAmslM: (number | undefined)[] = []
): HazardAdvisory[] => {
  runSelfCheckOnce()
  if (waypoints.length === 0 || areas.length === 0) return []

  const points = waypoints.map((waypoint) => turf.point(toPosition(waypoint.coordinates)))
  const legs = legsOf(waypoints)

  const advisories: HazardAdvisory[] = []

  areas.forEach((area) => {
    if (area.coordinates.length < 2) return
    const reach = paddedBbox(area.coordinates, clearanceM)
    // Without legs only a nearby waypoint can touch the area, and the live vehicle check has no legs.
    if (legs.length === 0 && !waypoints.some((waypoint) => bboxContains(reach, waypoint.coordinates))) return

    const boundary = boundaryOf(area)
    const boundaryLines = turf.flatten(boundary).features
    const polygon =
      area.kind === 'polygon' && area.coordinates.length >= 3 ? turf.polygon(polygonRings(area)) : undefined

    // -1 below the area's band, 1 above it, 0 within it or when that cannot be established.
    const bandSide = (index: number): number => {
      const altitude = altitudesAmslM[index]
      if (altitude === undefined) return 0
      if (area.lowerLimitM !== undefined && altitude < area.lowerLimitM) return -1
      if (area.upperLimitM !== undefined && altitude > area.upperLimitM) return 1
      return 0
    }

    const inside: number[] = []
    const near: number[] = []
    // ponytail: distance is a linear scan over the area's vertices, so this is O(waypoints × vertices).
    // Fine for one view's worth of data on an operator-triggered check; a whole-coast fetch would need
    // the boundary indexed (turf's `geojson-rbush`) before this stays responsive.
    waypoints.forEach((waypoint, index) => {
      if (bandSide(index) !== 0 || !bboxContains(reach, waypoint.coordinates)) return
      if (polygon && turf.booleanPointInPolygon(points[index], polygon)) {
        inside.push(index)
        return
      }
      const isNear = boundaryLines.some(
        (line) => turf.pointToLineDistance(points[index], line, { units: 'meters' }) <= clearanceM
      )
      if (isNear) near.push(index)
    })

    const crossing = crossingWaypoints(
      legs,
      boundary,
      (index) => bandSide(index) !== 0 && bandSide(index) === bandSide(index + 1)
    )

    if (inside.length > 0) {
      advisories.push({
        id: `${area.id}:inside`,
        sourceId: area.sourceId,
        areaId: area.id,
        kind: 'inside',
        message: `${plural(inside.length, 'waypoint')} inside "${area.label}".`,
        waypointIndices: inside,
      })
    }
    if (crossing.size > 0) {
      advisories.push({
        id: `${area.id}:crossing`,
        sourceId: area.sourceId,
        areaId: area.id,
        kind: 'crossing',
        message: `The mission path crosses "${area.label}".`,
        waypointIndices: [...crossing].sort((a, b) => a - b),
      })
    }
    if (near.length > 0) {
      advisories.push({
        id: `${area.id}:proximity`,
        sourceId: area.sourceId,
        areaId: area.id,
        kind: 'proximity',
        message: `${plural(near.length, 'waypoint')} within ${clearanceM} m of "${area.label}".`,
        waypointIndices: near,
      })
    }
  })

  return advisories
}

/**
 * Checks the legs of a mission against areas traced from the elevation grid. The per-waypoint ground
 * checks cannot see these: a leg can run over a ridge or a bank while both of its ends sit clear of it.
 * @param {WaypointLike[]} waypoints Mission waypoints, in order.
 * @param {HazardArea[]} areas Areas one grid source traced.
 * @param {HazardGridSourceId} sourceId Source that traced them.
 * @param {string} description What the areas are, as it reads after "The mission path crosses".
 * @returns {HazardAdvisory[]} A single advisory naming both ends of every crossing leg, or none.
 */
export const checkPathOverAreas = (
  waypoints: WaypointLike[],
  areas: HazardArea[],
  sourceId: HazardGridSourceId,
  description: string
): HazardAdvisory[] => {
  const legs = legsOf(waypoints)
  if (legs.length === 0) return []
  const crossing = new Set<number>()
  areas.forEach((area) => crossingWaypoints(legs, boundaryOf(area)).forEach((index) => crossing.add(index)))
  if (crossing.size === 0) return []
  return [
    {
      id: `${sourceId}:crossing`,
      sourceId,
      kind: 'crossing',
      message: `The mission path crosses ${description}.`,
      waypointIndices: [...crossing].sort((a, b) => a - b),
    },
  ]
}

/**
 * Checks a mission's waypoints against the ground under them, reporting those over ground higher than
 * a threshold. Waypoints whose ground could not be sampled are skipped rather than assumed marked.
 * @param {WaypointLike[]} waypoints Mission waypoints, in order.
 * @param {(number | null)[]} terrainElevationsM Ground elevation under each waypoint, in the same order.
 * @param {number} thresholdM Elevation, in meters above sea level, above which ground is reported.
 * @returns {HazardAdvisory[]} A single advisory naming the waypoints over marked ground, or none.
 */
export const checkTerrainElevation = (
  waypoints: WaypointLike[],
  terrainElevationsM: (number | null)[],
  thresholdM: number
): HazardAdvisory[] => {
  const marked = indicesWhere(waypoints.length, (index) => (terrainElevationsM[index] ?? -Infinity) > thresholdM)
  if (marked.length === 0) return []

  return [
    {
      id: 'terrain:clearance',
      sourceId: 'terrain',
      kind: 'terrain-clearance',
      message: `${plural(marked.length, 'waypoint')} over ground higher than ${thresholdM} m.`,
      waypointIndices: marked,
    },
  ]
}

/**
 * Checks a mission's waypoints against the seabed under them, reporting those over water no deeper
 * than a depth. Land and waypoints whose seabed could not be sampled are skipped.
 * @param {WaypointLike[]} waypoints Mission waypoints, in order.
 * @param {(number | null)[]} elevationsM Seabed or ground elevation under each waypoint, in the same order.
 * @param {number} depthM Depth, in meters below sea level, down to which water is reported.
 * @returns {HazardAdvisory[]} A single advisory naming the waypoints over shallow water, or none.
 */
export const checkShallowWater = (
  waypoints: WaypointLike[],
  elevationsM: (number | null)[],
  depthM: number
): HazardAdvisory[] => {
  // Rounded like the traced grid, so a waypoint and the area drawn under it agree.
  const marked = indicesWhere(waypoints.length, (index) => {
    const depth = -Math.round(elevationsM[index] ?? Infinity)
    return depth >= 1 && depth <= depthM
  })
  if (marked.length === 0) return []

  return [
    {
      id: 'shallow-water:depth',
      sourceId: 'shallow-water',
      kind: 'shallow-water',
      message: `${plural(marked.length, 'waypoint')} over water ${depthM} m deep or less.`,
      waypointIndices: marked,
    },
  ]
}

/**
 * Reports waypoints outside an area hazard data was loaded for. The other checks stay silent there
 * because nothing was asked about it, which reads as "clear" unless it is said.
 * @param {WaypointLike[]} waypoints Mission waypoints, in order.
 * @param {HazardCoverage[]} loaded Area each enabled source with loaded data covers.
 * @returns {HazardAdvisory[]} A single advisory naming the uncovered waypoints, or none.
 */
export const checkCoverage = (waypoints: WaypointLike[], loaded: HazardCoverage[]): HazardAdvisory[] => {
  const outside = indicesWhere(waypoints.length, (index) =>
    loaded.some((coverage) => !coversPoint(coverage, waypoints[index].coordinates))
  )
  if (outside.length === 0) return []

  return [
    {
      id: 'coverage',
      kind: 'outside-coverage',
      message:
        `${plural(outside.length, 'waypoint')} outside the area hazard data was loaded for, so nothing is known ` +
        'about them. Load the data for the mission to cover them.',
      waypointIndices: outside,
    },
  ]
}

/**
 * Converts waypoint altitudes to meters above sea level, the reference airspace limits are published in.
 * @param {Pick<Waypoint, 'altitude' | 'altitudeReferenceType'>[]} waypoints Mission waypoints, in order.
 * @param {(number | null)[]} groundM Ground elevation under each waypoint, in the same order.
 * @param {number | null} homeGroundM Ground elevation at the home position, when known.
 * @returns {(number | undefined)[]} Each waypoint's altitude above sea level, undefined where its reference is unknown.
 */
export const waypointAltitudesAmsl = (
  waypoints: Pick<Waypoint, 'altitude' | 'altitudeReferenceType'>[],
  groundM: (number | null)[],
  homeGroundM: number | null
): (number | undefined)[] =>
  waypoints.map(({ altitude, altitudeReferenceType }, index) => {
    switch (altitudeReferenceType) {
      case AltitudeReferenceType.ABSOLUTE_RELATIVE_TO_MSL:
        return altitude
      case AltitudeReferenceType.RELATIVE_TO_HOME:
        return homeGroundM === null ? undefined : altitude + homeGroundM
      case AltitudeReferenceType.RELATIVE_TO_TERRAIN: {
        const ground = groundM[index]
        return ground === null || ground === undefined ? undefined : altitude + ground
      }
    }
  })

// Runs once, on the first real check of a development session. Deliberately not at import time: the
// global `assert` is installed during bootstrap and may not exist yet when this module is loaded.
const runSelfCheckOnce = (): void => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (selfChecked || !import.meta.env.DEV) return
  selfChecked = true

  const square: HazardArea = {
    id: 'self-check',
    sourceId: 'restricted-waters',
    kind: 'polygon',
    label: 'Square',
    coordinates: [
      [0, 0],
      [0, 0.01],
      [0.01, 0.01],
      [0.01, 0],
    ],
  }
  // Runs straight through the square, entering on one side and leaving on the other.
  const across = checkMissionAgainstAreas(
    [{ coordinates: [0.005, -0.01] }, { coordinates: [0.005, 0.02] }],
    [square],
    0
  )
  assert(
    across.some((advisory) => advisory.kind === 'crossing'),
    'A leg passing through an area must report a crossing'
  )
  // Both endpoints outside and far away, so the only contact is the crossing itself.
  assert(
    across.every((advisory) => advisory.kind === 'crossing'),
    'Waypoints outside an area must not be reported as inside it'
  )
  assert(
    checkMissionAgainstAreas([{ coordinates: [0.005, 0.005] }], [square], 0).some(
      (advisory) => advisory.kind === 'inside'
    ),
    'A waypoint within an area must be reported as inside'
  )
  assert(
    checkMissionAgainstAreas([{ coordinates: [0.005, 0.02] }], [square], 0).length === 0,
    'A waypoint clear of every area must raise nothing'
  )
  const holed: HazardArea = {
    ...square,
    holes: [
      [
        [0.004, 0.004],
        [0.004, 0.006],
        [0.006, 0.006],
        [0.006, 0.004],
      ],
    ],
  }
  assert(
    checkMissionAgainstAreas([{ coordinates: [0.005, 0.005] }], [holed], 0).length === 0,
    'A waypoint in a hole of an area must not be reported as inside it'
  )
  assert(hazardAreaAt([square, holed], [0.002, 0.002]) === holed, 'The smallest area under a point must be picked')
  assert(hazardAreaAt([holed], [0.005, 0.005]) === undefined, 'A point in a hole must not pick the area around it')

  assert(
    checkTerrainElevation(
      [{ coordinates: [0, 0] }, { coordinates: [0, 0] }, { coordinates: [0, 0] }],
      [5, 20, null],
      10
    )[0]?.waypointIndices.length === 1,
    'Only waypoints over known ground higher than the threshold must be reported'
  )

  const airspace: HazardArea = { ...square, sourceId: 'airspace', lowerLimitM: 100, upperLimitM: 500 }
  const legAcross: WaypointLike[] = [{ coordinates: [0.005, -0.01] }, { coordinates: [0.005, 0.02] }]
  assert(
    checkMissionAgainstAreas(legAcross, [airspace], 0, [50, 60]).length === 0,
    'A leg entirely below an airspace band must pass under it'
  )
  assert(
    checkMissionAgainstAreas(legAcross, [airspace], 0, [50, 600]).length === 1,
    'A leg climbing through an airspace band must report the crossing'
  )
  assert(
    checkMissionAgainstAreas(legAcross, [airspace], 0).length === 1,
    'Unknown altitudes must be checked as if inside the band'
  )

  assert(
    checkPathOverAreas(legAcross, [square], 'terrain', 'high ground')[0]?.waypointIndices.length === 2,
    'A leg over a traced area must be reported by both of its ends'
  )
  assert(
    checkShallowWater(legAcross, [-3, -30], 5)[0]?.waypointIndices.join() === '0',
    'Only waypoints over water no deeper than the depth must be reported'
  )
  assert(
    checkShallowWater(legAcross, [4, null], 5).length === 0,
    'Land and unknown seabed must never be reported as shallow water'
  )
  const loadedWest = { bbox: { south: 0, west: -0.02, north: 0.01, east: 0.01 } }
  assert(
    checkCoverage(legAcross, [loadedWest])[0]?.waypointIndices.join() === '1',
    'Only waypoints outside a loaded area must be reported'
  )
  assert(
    checkCoverage(legAcross, [{ ...loadedWest, clearedBboxes: [loadedWest.bbox] }])[0]?.waypointIndices.join() ===
      '0,1',
    'Waypoints in a cleared part of a loaded area must be reported'
  )

  const [amsl, relative, terrain] = waypointAltitudesAmsl(
    [
      { altitude: 10, altitudeReferenceType: AltitudeReferenceType.ABSOLUTE_RELATIVE_TO_MSL },
      { altitude: 10, altitudeReferenceType: AltitudeReferenceType.RELATIVE_TO_HOME },
      { altitude: 10, altitudeReferenceType: AltitudeReferenceType.RELATIVE_TO_TERRAIN },
    ],
    [null, null, 30],
    5
  )
  assert(amsl === 10 && relative === 15 && terrain === 40, 'Altitudes must convert to above sea level by reference')
}
