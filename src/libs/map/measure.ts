import * as turf from '@turf/turf'
import { t } from 'ttag'

import { bearingBetween, calculateHaversineDistance, polygonAreaSquareMeters } from '@/libs/mission/general-estimates'
import { type PathStation, type TerrainProfileSample, surfaceHeight } from '@/libs/terrain/mission-profile'
import type { WaypointCoordinates } from '@/types/mission'

/**
 * A point of a measurement, with what it was snapped to.
 */
export interface MeasureVertex {
  /**
   * Position as [latitude, longitude].
   */
  coordinates: WaypointCoordinates
  /**
   * Name of the map object it was snapped to, such as "Home" or a point of interest's name.
   */
  label?: string
  /**
   * Height above sea level, null while unknown.
   */
  heightAmslM: number | null
}

/**
 * One straight segment of a measured line.
 */
export interface MeasureSegment {
  /**
   * Great-circle length, in meters.
   */
  distanceM: number
  /**
   * True bearing from its start to its end, in degrees clockwise from north.
   */
  bearingDeg: number
  /**
   * Length counting the height difference between its ends, null when either height is unknown.
   */
  slantM: number | null
}

/**
 * What a measured line adds up to.
 */
export interface PolylineStats {
  /**
   * Each segment, in order.
   */
  segments: MeasureSegment[]
  /**
   * Distance from the first vertex to each vertex, in meters.
   */
  cumulativeM: number[]
  /**
   * Whole length, in meters.
   */
  totalM: number
  /**
   * Whole length counting height differences, null when any height is unknown.
   */
  totalSlantM: number | null
}

/**
 * Straight-line distance between two points at different heights.
 * @param {number} horizontalM Distance over the ground, in meters.
 * @param {number} verticalM Height or depth difference, in meters.
 * @returns {number} The slant range, in meters.
 */
export const slantRange = (horizontalM: number, verticalM: number): number => Math.hypot(horizontalM, verticalM)

/**
 * Lengths, bearings and running totals of a measured line.
 * @param {MeasureVertex[]} vertices The line's points, in order.
 * @returns {PolylineStats} The line's statistics.
 */
export const polylineStats = (vertices: MeasureVertex[]): PolylineStats => {
  const segments = vertices.slice(1).map((to, index): MeasureSegment => {
    const from = vertices[index]
    const distanceM = calculateHaversineDistance(from.coordinates, to.coordinates)
    const heightsKnown = from.heightAmslM !== null && to.heightAmslM !== null
    return {
      distanceM,
      bearingDeg: bearingBetween(from.coordinates, to.coordinates),
      slantM: heightsKnown ? slantRange(distanceM, to.heightAmslM! - from.heightAmslM!) : null,
    }
  })
  const cumulativeM = [0]
  segments.forEach((segment) => cumulativeM.push(cumulativeM.at(-1)! + segment.distanceM))
  const slants = segments.map((segment) => segment.slantM)
  const totalSlantM = slants.includes(null) ? null : slants.reduce<number>((sum, slant) => sum + slant!, 0)
  return { segments, cumulativeM, totalM: cumulativeM.at(-1)!, totalSlantM }
}

/**
 * What a measured polygon encloses.
 */
export interface PolygonStats {
  /**
   * Enclosed area, in square meters.
   */
  areaM2: number
  /**
   * Length around it, in meters.
   */
  perimeterM: number
}

/**
 * Area and perimeter of a polygon, with the area worked out as for a survey.
 * @param {WaypointCoordinates[]} corners The polygon's corners, open: the closing edge is implicit.
 * @returns {PolygonStats} Its area and perimeter.
 */
export const polygonStats = (corners: WaypointCoordinates[]): PolygonStats => {
  const perimeterM = corners.reduce(
    (sum, corner, index) => sum + calculateHaversineDistance(corner, corners[(index + 1) % corners.length]),
    0
  )
  return { areaM2: polygonAreaSquareMeters(corners), perimeterM: corners.length < 3 ? 0 : perimeterM }
}

/**
 * How long a distance takes at a speed, as an operator would say it.
 * @param {number} distanceM Distance, in meters.
 * @param {number} speedMps Speed, in meters per second.
 * @returns {string | null} Such as "about 4 min", or null when the speed is not positive.
 */
export const formatTravelTime = (distanceM: number, speedMps: number): string | null => {
  if (!(speedMps > 0) || !Number.isFinite(distanceM)) return null
  const minutes = Math.round(distanceM / speedMps / 60)
  if (minutes < 1) return t`under a minute`
  if (minutes < 60) return t`about ${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? t`about ${hours} h` : t`about ${hours} h ${rest} min`
}

/**
 * How far a tethered vehicle is from the end of its tether.
 */
export interface TetherReach {
  /**
   * Straight-line distance from the base station, counting depth or altitude, in meters.
   */
  slantM: number
  /**
   * Share of the tether that distance takes, 1 at full length.
   */
  ratio: number
  /**
   * Tether left, negative when the point lies beyond it, in meters.
   */
  marginM: number
}

// Past this share of the tether the vehicle is close enough to the end for the operator to be warned.
export const TETHER_WARNING_RATIO = 0.9

/**
 * How much of a tether reaching a point takes.
 * @param {WaypointCoordinates} base Where the tether is paid out from.
 * @param {WaypointCoordinates} point Where the vehicle is or would be.
 * @param {number} verticalM Depth or altitude of the vehicle relative to the base station, in meters.
 * @param {number} lengthM Tether length, in meters.
 * @returns {TetherReach} The distance and what is left.
 */
export const tetherReach = (
  base: WaypointCoordinates,
  point: WaypointCoordinates,
  verticalM: number,
  lengthM: number
): TetherReach => {
  const slantM = slantRange(calculateHaversineDistance(base, point), verticalM)
  return { slantM, ratio: lengthM > 0 ? slantM / lengthM : Infinity, marginM: lengthM - slantM }
}

/**
 * A map object a measurement can snap to.
 */
export interface SnapTarget {
  /**
   * Where it is.
   */
  coordinates: WaypointCoordinates
  /**
   * Name read back on the measurement.
   */
  label: string
}

/**
 * The nearest of some map objects to a point, when close enough.
 * @param {T[]} targets Objects to snap to.
 * @param {WaypointCoordinates} point Where the pointer is.
 * @param {number} toleranceM Farthest an object may be, in meters.
 * @returns {T | undefined} The nearest object, or undefined when none is close enough.
 */
export const nearestSnapTarget = <T extends SnapTarget>(
  targets: T[],
  point: WaypointCoordinates,
  toleranceM: number
): T | undefined => {
  let nearest: T | undefined
  let nearestM = toleranceM
  targets.forEach((target) => {
    const distanceM = calculateHaversineDistance(point, target.coordinates)
    if (distanceM > nearestM) return
    nearest = target
    nearestM = distanceM
  })
  return nearest
}

/**
 * Where a point lands on one of several lines.
 */
export interface PointOnLines {
  /**
   * The point on the line.
   */
  coordinates: WaypointCoordinates
  /**
   * Which of the lines it lies on.
   */
  lineIndex: number
}

/**
 * The nearest point on some lines, such as coastlines or area edges, when close enough.
 * @param {WaypointCoordinates[][]} lines Lines as vertex lists; rings are closed by repeating their first vertex.
 * @param {WaypointCoordinates} point Where the pointer is.
 * @param {number} toleranceM Farthest the line may be, in meters.
 * @returns {PointOnLines | undefined} The point and its line, or undefined when no line is close enough.
 */
export const nearestPointOnLines = (
  lines: WaypointCoordinates[][],
  point: WaypointCoordinates,
  toleranceM: number
): PointOnLines | undefined => {
  const pointer = turf.point([point[1], point[0]])
  let nearest: PointOnLines | undefined
  let nearestM = toleranceM
  lines.forEach((line, lineIndex) => {
    if (line.length < 2) return
    const found = turf.nearestPointOnLine(turf.lineString(line.map(([lat, lng]) => [lng, lat])), pointer, {
      units: 'meters',
    })
    const distanceM = found.properties.dist ?? Infinity
    if (distanceM > nearestM) return
    const [lng, lat] = found.geometry.coordinates
    nearest = { coordinates: [lat, lng], lineIndex }
    nearestM = distanceM
  })
  return nearest
}

/**
 * A point on screen, in pixels.
 */
export interface ScreenPoint {
  /** Distance from the left, in pixels. */
  x: number
  /** Distance from the top, in pixels. */
  y: number
}

/**
 * A box on screen, in pixels, such as a `DOMRect`.
 */
export interface ScreenBox {
  /** Its left edge. */
  left: number
  /** Its top edge. */
  top: number
  /** Its right edge. */
  right: number
  /** Its bottom edge. */
  bottom: number
}

/**
 * Whether a straight line on screen passes through a box, clipping it to the box the Liang-Barsky way.
 * @param {ScreenPoint} from One end of the line.
 * @param {ScreenPoint} to The other end.
 * @param {ScreenBox} box The box.
 * @returns {boolean} True when any part of the line lies inside the box.
 */
export const segmentCrossesBox = (from: ScreenPoint, to: ScreenPoint, box: ScreenBox): boolean => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const edges: [number, number][] = [
    [-dx, from.x - box.left],
    [dx, box.right - from.x],
    [-dy, from.y - box.top],
    [dy, box.bottom - from.y],
  ]
  let enter = 0
  let exit = 1
  for (const [direction, room] of edges) {
    if (direction === 0) {
      if (room < 0) return false
      continue
    }
    const at = room / direction
    if (direction < 0) enter = Math.max(enter, at)
    else exit = Math.min(exit, at)
    if (enter > exit) return false
  }
  return true
}

/**
 * How steep the ground is along a profile.
 */
export interface ProfileSlope {
  /**
   * Height of the last known station minus the first, in meters.
   */
  heightDifferenceM: number
  /**
   * Steepest slope between neighboring stations, in degrees.
   */
  maxSlopeDeg: number
  /**
   * That same slope as a grade, in percent.
   */
  maxGradePercent: number
}

/**
 * Height difference and steepest slope of the ground along a profile, skipping stations whose ground is unknown.
 * @param {number[]} distancesM Distance of each station along the line, ascending, in meters.
 * @param {(number | null)[]} groundM Ground height at each station, null where unknown.
 * @returns {ProfileSlope | null} The slope, or null with fewer than two known stations.
 */
export const profileSlope = (distancesM: number[], groundM: (number | null)[]): ProfileSlope | null => {
  const known = distancesM.flatMap((distanceM, index) => {
    const heightM = groundM[index]
    return heightM === null ? [] : [{ distanceM, groundM: heightM }]
  })
  if (known.length < 2) return null
  let maxGrade = 0
  known.slice(1).forEach((station, index) => {
    const run = station.distanceM - known[index].distanceM
    if (run <= 0) return
    maxGrade = Math.max(maxGrade, Math.abs(station.groundM - known[index].groundM) / run)
  })
  return {
    heightDifferenceM: known.at(-1)!.groundM - known[0].groundM,
    maxSlopeDeg: (Math.atan(maxGrade) * 180) / Math.PI,
    maxGradePercent: maxGrade * 100,
  }
}

// A point not snapped to anything is read as someone standing there with a radio in hand.
export const UNSNAPPED_SIGHT_HEIGHT_M = 2

/**
 * Height of each corner of a measured line, falling back to {@link UNSNAPPED_SIGHT_HEIGHT_M} over the surface for a
 * corner whose own height is unknown.
 * @param {PathStation[]} stations Stations of the line, from {@link densifyPath} over its corners.
 * @param {(number | null)[]} groundM Ground height at each station, null where unknown.
 * @param {(number | null)[]} cornerHeightsM Known height of each corner, null where it has none.
 * @param {number} waterLevelM Water surface height.
 * @returns {(number | null)[]} Height of each corner above sea level, null where neither it nor the ground is known.
 */
export const measureCornerHeights = (
  stations: PathStation[],
  groundM: (number | null)[],
  cornerHeightsM: (number | null)[],
  waterLevelM: number
): (number | null)[] =>
  cornerHeightsM.map((heightM, corner) => {
    if (heightM !== null) return heightM
    const station = corner === 0 ? 0 : stations.findIndex((s) => s.legIndex === corner - 1 && s.legFraction === 1)
    const ground = groundM[station] ?? null
    return ground === null ? null : surfaceHeight(ground, waterLevelM) + UNSNAPPED_SIGHT_HEIGHT_M
  })

/**
 * Terrain profile of a measured line, its straight run between corner heights drawn as the path.
 * @param {PathStation[]} stations Stations of the line.
 * @param {(number | null)[]} groundM Ground height at each station, null where unknown.
 * @param {(number | null)[]} cornerHeightsM Height of each corner, from {@link measureCornerHeights}.
 * @param {number} waterLevelM Water surface height.
 * @returns {TerrainProfileSample[]} One sample per station.
 */
export const measureProfileSamples = (
  stations: PathStation[],
  groundM: (number | null)[],
  cornerHeightsM: (number | null)[],
  waterLevelM: number
): TerrainProfileSample[] =>
  stations.map((station, index) => {
    const from = cornerHeightsM[station.legIndex]
    const to = cornerHeightsM[station.legIndex + 1]
    const pathAmslM = from == null || to == null ? null : from + (to - from) * station.legFraction
    const ground = groundM[index] ?? null
    const clearanceM = pathAmslM === null || ground === null ? null : pathAmslM - surfaceHeight(ground, waterLevelM)
    return { ...station, groundM: ground, groundHighM: ground, pathAmslM, clearanceM }
  })
