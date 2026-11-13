import { v4 as uuid } from 'uuid'

import { bearingBetween } from '@/libs/mission/general-estimates'
import { type Survey, type Waypoint, type WaypointCoordinates, AltitudeReferenceType } from '@/types/mission'
import type { SurveySensorGeometry } from '@/types/terrain'

import type { TerrainProfileSample, TerrainVehicleClass } from './mission-profile'
import { sensorCoverage } from './survey-sensors'
import type { GroundSampler } from './terrain-following'

/**
 * What a photo survey's images will look like over the real terrain.
 */
export interface PhotoSurveyQuality {
  /**
   * Lowest height above the ground along the survey lines, in meters.
   */
  minAglM: number
  /**
   * Highest height above the ground along the survey lines, in meters.
   */
  maxAglM: number
  /**
   * Finest ground sample distance, in centimeters per pixel.
   */
  finestGsdCm: number
  /**
   * Coarsest ground sample distance, in centimeters per pixel.
   */
  coarsestGsdCm: number
  /**
   * Side overlap where the vehicle is lowest over the ground, in percent.
   */
  lowestSideOverlapPercent: number
}

/**
 * Judges a photo survey against the terrain under it: images over a hill are both sharper and
 * narrower, so the overlap the line spacing was chosen for shrinks there.
 * @param {TerrainProfileSample[]} samples Profile stations along the survey lines.
 * @param {number} lineSpacingM Distance between survey lines.
 * @param {number} acrossDeg Camera view across the track, in degrees.
 * @param {number} imageWidthPx Camera image width, in pixels.
 * @returns {PhotoSurveyQuality | null} The quality, or null when no height above the ground is known.
 */
export const photoSurveyQuality = (
  samples: TerrainProfileSample[],
  lineSpacingM: number,
  acrossDeg: number,
  imageWidthPx: number
): PhotoSurveyQuality | null => {
  const known = samples.filter((sample) => sample.clearanceM !== null && sample.clearanceM > 0)
  if (known.length === 0 || !(acrossDeg > 0 && acrossDeg < 180) || imageWidthPx <= 0) return null
  const minAglM = Math.min(...known.map((sample) => sample.clearanceM!))
  const maxAglM = Math.max(...known.map((sample) => sample.clearanceM!))
  const footprint = (agl: number): number => 2 * agl * Math.tan((acrossDeg * Math.PI) / 360)
  const gsdCm = (agl: number): number => (footprint(agl) / imageWidthPx) * 100
  return {
    minAglM,
    maxAglM,
    finestGsdCm: gsdCm(minAglM),
    coarsestGsdCm: gsdCm(maxAglM),
    lowestSideOverlapPercent: Math.max(0, (1 - lineSpacingM / footprint(minAglM)) * 100),
  }
}

type Plane = {
  /**
   * Latitude of the plane origin, the polygon centroid.
   */
  lat0: number
  /**
   * Longitude of the plane origin.
   */
  lng0: number
  /**
   * Meters per degree of latitude.
   */
  mPerDegLat: number
  /**
   * Meters per degree of longitude at the origin.
   */
  mPerDegLng: number
  /**
   * Unit vector along the survey lines, east and north.
   */
  along: [number, number]
  /**
   * Unit vector across them.
   */
  across: [number, number]
}

const planeFor = (polygon: WaypointCoordinates[], lineBearingDeg: number): Plane => {
  const lat0 = polygon.reduce((sum, [lat]) => sum + lat, 0) / polygon.length
  const lng0 = polygon.reduce((sum, [, lng]) => sum + lng, 0) / polygon.length
  const bearing = (lineBearingDeg * Math.PI) / 180
  return {
    lat0,
    lng0,
    mPerDegLat: 110540,
    mPerDegLng: 111320 * Math.cos((lat0 * Math.PI) / 180),
    along: [Math.sin(bearing), Math.cos(bearing)],
    across: [Math.cos(bearing), -Math.sin(bearing)],
  }
}

const toPlane = (plane: Plane, [lat, lng]: WaypointCoordinates): [number, number] => {
  const x = (lng - plane.lng0) * plane.mPerDegLng
  const y = (lat - plane.lat0) * plane.mPerDegLat
  return [x * plane.along[0] + y * plane.along[1], x * plane.across[0] + y * plane.across[1]]
}

const fromPlane = (plane: Plane, u: number, v: number): WaypointCoordinates => {
  const x = u * plane.along[0] + v * plane.across[0]
  const y = u * plane.along[1] + v * plane.across[1]
  return [plane.lat0 + y / plane.mPerDegLat, plane.lng0 + x / plane.mPerDegLng]
}

// ponytail: a concave polygon is crossed from its first to its last edge, gaps included; clipping each
// line into its separate runs is the upgrade.
const lineAcross = (corners: [number, number][], v: number): [number, number] | null => {
  const crossings: number[] = []
  corners.forEach(([ua, va], index) => {
    const [ub, vb] = corners[(index + 1) % corners.length]
    if ((va - v) * (vb - v) >= 0 || va === vb) return
    crossings.push(ua + ((v - va) / (vb - va)) * (ub - ua))
  })
  return crossings.length < 2 ? null : [Math.min(...crossings), Math.max(...crossings)]
}

/**
 * Sensor and bounds for a survey spaced to cover the whole bottom.
 */
export interface CoverageSurveyOptions {
  /**
   * What the sensor sees and where it sits on the vehicle.
   */
  sensor: SurveySensorGeometry
  /**
   * Farthest slant range the sensor reads, in meters.
   */
  rangeM: number
  /**
   * Overlap to keep between neighboring strips, in percent.
   */
  overlapPercent: number
  /**
   * Height of the sensor above a bottom at the given height above sea level, in meters.
   */
  heightAboveBottom: (bottomM: number) => number
  /**
   * Spacing to use where the strip is unknown or empty, in meters.
   */
  minSpacingM: number
}

/**
 * Survey lines planned to cover the whole bottom.
 */
export interface CoverageSurvey {
  /**
   * Line ends in the order the vehicle runs them.
   */
  ends: WaypointCoordinates[]
  /**
   * Whether the lines reach across the whole area; false when it needs more lines than a survey may hold.
   */
  complete: boolean
}

type Stretch = [number, number]

type SurveyLine = {
  /**
   * Position across the area, in meters on the survey plane.
   */
  v: number
  /**
   * 1 when run along the survey bearing, -1 when run against it.
   */
  heading: number
  /**
   * Bottom the line's sensor covers, across the area.
   */
  strips: Stretch[]
}

// Most lines a re-spaced survey may hold, so a very shallow area cannot produce thousands of waypoints.
const MAX_SURVEY_LINES = 300
const DEPTH_ROWS = 120
const STATIONS_PER_ROW = 24
const CANDIDATES_PER_LINE = 240

// Bottom heights read at positions across the track, joined by straight lines and carried flat past both ends.
const interpolated = (known: [number, number][]): ((at: number) => number) => {
  const points = [...known].sort((a, b) => a[0] - b[0])
  return (at) => {
    if (at <= points[0][0]) return points[0][1]
    if (at >= points[points.length - 1][0]) return points[points.length - 1][1]
    let low = 0
    let high = points.length - 1
    while (high - low > 1) {
      const middle = (low + high) >> 1
      if (points[middle][0] <= at) low = middle
      else high = middle
    }
    const [fromAt, fromM] = points[low]
    const [toAt, toM] = points[high]
    return fromM + ((toM - fromM) * (at - fromAt)) / (toAt - fromAt)
  }
}

const coveredUpTo = (from: number, stretches: Stretch[]): number => {
  let frontier = from
  for (const [start, end] of [...stretches].sort((a, b) => a[0] - b[0])) {
    if (start > frontier + 1e-6) break
    frontier = Math.max(frontier, end)
  }
  return frontier
}

/**
 * Shallowest bottom in each of {@link DEPTH_ROWS} bands across the area, read in one batch.
 * @param {Plane} plane Survey plane.
 * @param {[number, number][]} corners Area corners on the plane.
 * @param {[number, number]} across Area extent across the lines.
 * @param {GroundSampler} sampleBottom Bottom height sampler.
 * @returns {Promise<(number | null)[]>} Bottom height per band, null where it is unknown.
 */
const bandBottoms = async (
  plane: Plane,
  corners: [number, number][],
  [vMin, vMax]: [number, number],
  sampleBottom: GroundSampler
): Promise<(number | null)[]> => {
  const bandOf = (row: number): number => vMin + ((row + 0.5) * (vMax - vMin)) / DEPTH_ROWS
  const spans = Array.from({ length: DEPTH_ROWS }, (_, row) => lineAcross(corners, bandOf(row)))
  const stations = spans.flatMap((span, row) =>
    !span
      ? []
      : Array.from({ length: STATIONS_PER_ROW }, (_, index) =>
          fromPlane(plane, span[0] + ((span[1] - span[0]) * index) / (STATIONS_PER_ROW - 1), bandOf(row))
        )
  )
  const bottoms = await sampleBottom(stations)
  let cursor = 0
  return spans.map((span) => {
    if (!span) return null
    const known = bottoms
      .slice(cursor, (cursor += STATIONS_PER_ROW))
      .filter((bottom): bottom is number => bottom !== null)
    return known.length === 0 ? null : Math.max(...known)
  })
}

/**
 * Plans survey lines that leave no gap on the bottom. Each line is placed where the strip its sensor
 * sees, over the shallowest bottom along it, joins the area already covered: lines close up over
 * shallows and spread over deep water, a strip narrows on the side where the bottom rises and widens
 * where it falls away, a one-sided or off-center sensor shifts the lines toward the side it looks at,
 * and side scan sonar fills the blind spot under each line with the next one.
 * @param {WaypointCoordinates[]} polygon Survey area corners.
 * @param {number} lineBearingDeg Direction of the survey lines, degrees clockwise from north.
 * @param {GroundSampler} sampleBottom Bottom height sampler.
 * @param {CoverageSurveyOptions} options Sensor and spacing bounds.
 * @returns {Promise<CoverageSurvey>} The lines, and whether they reach across the whole area.
 */
export const coverageSurveyLines = async (
  polygon: WaypointCoordinates[],
  lineBearingDeg: number,
  sampleBottom: GroundSampler,
  options: CoverageSurveyOptions
): Promise<CoverageSurvey> => {
  const plane = planeFor(polygon, lineBearingDeg)
  const corners = polygon.map((corner) => toPlane(plane, corner))
  const vs = corners.map(([, v]) => v)
  const [vMin, vMax] = [Math.min(...vs), Math.max(...vs)]
  const bottoms = await bandBottoms(plane, corners, [vMin, vMax], sampleBottom)
  const bandWidth = (vMax - vMin) / DEPTH_ROWS || 1
  const bandAt = (v: number): number => Math.min(DEPTH_ROWS - 1, Math.max(0, Math.floor((v - vMin) / bandWidth)))
  const known = bottoms.flatMap((bottom, band): [number, number][] =>
    bottom === null ? [] : [[vMin + (band + 0.5) * bandWidth, bottom]]
  )
  if (known.length === 0) throw new Error('the sensor reaches no known bottom under the survey')
  const bottomAt = interpolated(known)
  const trim = options.overlapPercent / 100 / 2

  // A line heading the other way sees the mirror of its strip, which narrows where the bottom rises toward it.
  const stripsOf = (v: number, heading: number): Stretch[] => {
    if (bottoms[bandAt(v)] === null) return []
    const under = bottomAt(v)
    const sensorM = under + options.heightAboveBottom(under)
    const heightAt = (acrossM: number): number => sensorM - bottomAt(v + heading * (options.sensor.offsetM + acrossM))
    return sensorCoverage(options.sensor, heightAt(0), options.rangeM, heightAt).map(([from, to]) => {
      const [start, end] = heading > 0 ? [v + from, v + to] : [v - to, v - from]
      return [start + (end - start) * trim, end - (end - start) * trim]
    })
  }

  // A strip reaches farther than this only down a slope, where a nearer line still closes the gap.
  const reaches = known.flatMap(([, bottom]) =>
    sensorCoverage(options.sensor, options.heightAboveBottom(bottom), options.rangeM).flat().map(Math.abs)
  )
  if (reaches.length === 0) throw new Error('the sensor reaches no known bottom under the survey')
  const reach = Math.max(options.minSpacingM, ...reaches)
  const lines: SurveyLine[] = []
  let pending: Stretch[] = []
  let frontier = vMin
  while (frontier < vMax && lines.length < MAX_SURVEY_LINES) {
    const heading = lines.length % 2 === 0 ? 1 : -1
    let best = { v: frontier + options.minSpacingM / 2, heading, strips: [] as Stretch[] }
    let bestFrontier = frontier
    for (let step = 0; step <= CANDIDATES_PER_LINE; step++) {
      const v = frontier - reach + (2 * reach * step) / CANDIDATES_PER_LINE
      const strips = stripsOf(v, heading)
      const reached = coveredUpTo(frontier, [...pending, ...strips])
      if (reached <= bestFrontier + 1e-3) continue
      best = { v, heading, strips }
      bestFrontier = reached
    }
    lines.push(best)
    frontier = bestFrontier > frontier ? bestFrontier : frontier + options.minSpacingM
    pending = [...pending, ...best.strips].filter(([, end]) => end > frontier)
  }

  const ends = lines.flatMap(({ v, heading, strips }) => {
    const lo = Math.max(vMin + 0.01, Math.min(...strips.map(([from]) => from), v))
    const hi = Math.min(vMax - 0.01, Math.max(...strips.map(([, to]) => to), v))
    const spans = [lo, (lo + hi) / 2, hi]
      .map((at) => lineAcross(corners, at))
      .filter((span): span is [number, number] => span !== null)
    if (spans.length === 0) return []
    const start = Math.min(...spans.map(([from]) => from))
    const end = Math.max(...spans.map(([, to]) => to))
    const [from, to] = heading > 0 ? [start, end] : [end, start]
    return [fromPlane(plane, from, v), fromPlane(plane, to, v)]
  })
  return { ends, complete: frontier >= vMax }
}

const CONTOUR_GRID = 16
// The slope only turns the lines once the bottom changes across the area by this share of the sensor's height,
// enough for the strip to change width noticeably along a line.
const CONTOUR_TURN_SHARE = 0.2
// Lines already this close to the contours are left where the user put them.
const CONTOUR_TOLERANCE_DEG = 10

const solve3 = (m: number[][], r: number[]): number[] | null => {
  const det = (a: number[][]): number =>
    a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
    a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
    a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0])
  const whole = det(m)
  if (Math.abs(whole) < 1e-9) return null
  return [0, 1, 2].map(
    (column) => det(m.map((row, index) => row.map((cell, at) => (at === column ? r[index] : cell)))) / whole
  )
}

/**
 * Bearing for survey lines over a sloping bottom: along its depth contours, so each line keeps one
 * depth and the strip one width, or the given bearing when the bottom is about flat or the lines
 * already follow it.
 * @param {WaypointCoordinates[]} polygon Survey area corners.
 * @param {number} bearingDeg Current line bearing, degrees clockwise from north.
 * @param {GroundSampler} sampleBottom Bottom height sampler.
 * @param {(bottomM: number) => number} heightAboveBottom Sensor height over a bottom height.
 * @returns {Promise<number>} Line bearing to use, degrees clockwise from north.
 */
export const contourBearing = async (
  polygon: WaypointCoordinates[],
  bearingDeg: number,
  sampleBottom: GroundSampler,
  heightAboveBottom: (bottomM: number) => number
): Promise<number> => {
  // On a plane for a northward bearing, u runs north and v east.
  const plane = planeFor(polygon, 0)
  const corners = polygon.map((corner) => toPlane(plane, corner))
  const vs = corners.map(([, v]) => v)
  const [vMin, vMax] = [Math.min(...vs), Math.max(...vs)]
  const grid = Array.from({ length: CONTOUR_GRID }, (_, row) => vMin + ((row + 0.5) * (vMax - vMin)) / CONTOUR_GRID)
  const points = grid.flatMap((v) => {
    const span = lineAcross(corners, v)
    if (!span) return []
    return grid.map((_, index): [number, number] => [span[0] + ((index + 0.5) * (span[1] - span[0])) / CONTOUR_GRID, v])
  })
  const bottoms = await sampleBottom(points.map(([u, v]) => fromPlane(plane, u, v)))
  const known = points.flatMap(([u, v], index) => (bottoms[index] === null ? [] : [{ u, v, bottom: bottoms[index]! }]))
  if (known.length < 3) return bearingDeg

  // Least-squares plane through the bottom, bottom = north * u + east * v + level.
  const sums = known.reduce(
    (total, { u, v, bottom }) =>
      total.map((value, index) => value + [u * u, u * v, u, v * v, v, 1, u * bottom, v * bottom, bottom][index]),
    Array<number>(9).fill(0)
  )
  const [uu, uv, u1, vv, v1, n, ub, vb, b1] = sums
  const fit = solve3(
    [
      [uu, uv, u1],
      [uv, vv, v1],
      [u1, v1, n],
    ],
    [ub, vb, b1]
  )
  if (!fit) return bearingDeg
  const [north, east] = fit
  const slope = Math.hypot(north, east)
  const along = known.map(({ u, v }) => (u * north + v * east) / (slope || 1))
  const change = slope * (Math.max(...along) - Math.min(...along))
  const meanHeight = known.reduce((total, { bottom }) => total + heightAboveBottom(bottom), 0) / known.length
  if (!(meanHeight > 0) || change < CONTOUR_TURN_SHARE * meanHeight) return bearingDeg

  const contour = ((Math.atan2(east, north) * 180) / Math.PI + 90 + 360) % 360
  const offset = (((contour - bearingDeg) % 180) + 180) % 180
  if (Math.min(offset, 180 - offset) <= CONTOUR_TOLERANCE_DEG) return bearingDeg
  // Of the two ways along the contour, the one nearer the current bearing keeps the survey's running direction.
  return Math.abs(((contour - bearingDeg + 540) % 360) - 180) <= 90 ? contour : (contour + 180) % 360
}

/**
 * How high a survey sensor runs above the bottom: under the hull of a vessel, at the survey
 * waypoints' depth or altitude for an ROV, whose home is on the water surface, or at the survey
 * altitude over the ground for an aircraft.
 * @param {Waypoint} template A survey waypoint.
 * @param {TerrainVehicleClass} vehicleClass Vehicle the mission is planned for.
 * @param {number} waterLevelM Water surface height.
 * @param {number} draftM Depth of the hull below the waterline.
 * @param {number | null} homeM Ground height at an aircraft's home; without it, a height relative to home is taken
 *   as height over the ground.
 * @returns {(bottomM: number) => number} Sensor height over a bottom at a given height above sea level.
 */
export const sensorHeightAboveBottom = (
  template: Waypoint,
  vehicleClass: TerrainVehicleClass,
  waterLevelM: number,
  draftM: number,
  homeM: number | null = null
): ((bottomM: number) => number) => {
  const { altitude, altitudeReferenceType } = template
  if (vehicleClass === 'air') {
    if (altitudeReferenceType === AltitudeReferenceType.RELATIVE_TO_TERRAIN) return () => altitude
    if (altitudeReferenceType !== AltitudeReferenceType.RELATIVE_TO_HOME) return (bottomM) => altitude - bottomM
    return homeM === null ? () => altitude : (bottomM) => homeM + altitude - bottomM
  }
  if (vehicleClass !== 'underwater') return (bottomM) => waterLevelM - draftM - bottomM
  if (altitudeReferenceType === AltitudeReferenceType.RELATIVE_TO_TERRAIN) return () => altitude
  if (altitudeReferenceType === AltitudeReferenceType.RELATIVE_TO_HOME)
    return (bottomM) => waterLevelM + altitude - bottomM
  return (bottomM) => altitude - bottomM
}

const LINE_BEARING_TOLERANCE_DEG = 3

/**
 * The legs of a survey path that run along its lines, leaving out the turns and the moves along the area edge.
 * @param {WaypointCoordinates[]} path Survey waypoints in running order.
 * @returns {[WaypointCoordinates, WaypointCoordinates][]} Start and end of each survey line.
 */
export const surveyLineLegs = (path: WaypointCoordinates[]): [WaypointCoordinates, WaypointCoordinates][] => {
  const legs = path.slice(1).map((end, index): [WaypointCoordinates, WaypointCoordinates] => [path[index], end])
  const lengthOf = ([[aLat, aLng], [bLat, bLng]]: [WaypointCoordinates, WaypointCoordinates]): number =>
    Math.hypot(bLat - aLat, (bLng - aLng) * Math.cos((aLat * Math.PI) / 180))
  const longest = legs.reduce<(typeof legs)[number] | undefined>(
    (best, leg) => (!best || lengthOf(leg) > lengthOf(best) ? leg : best),
    undefined
  )
  if (!longest) return []
  const lineBearing = bearingBetween(...longest) % 180
  return legs.filter((leg) => {
    const difference = Math.abs((bearingBetween(...leg) % 180) - lineBearing)
    return Math.min(difference, 180 - difference) <= LINE_BEARING_TOLERANCE_DEG
  })
}

/**
 * Bottom a sensor probably covers along one survey line.
 */
export interface SurveyFootprint {
  /**
   * Outline of the covered strip.
   */
  outline: WaypointCoordinates[]
  /**
   * Middle of the strip, where the sensor is aimed; it sits off the line by the sensor's mount and view.
   */
  focusLine: WaypointCoordinates[]
}

/**
 * What a sensor sees and how high it runs, for drawing its footprints.
 */
export type SurveyFootprintOptions = Pick<CoverageSurveyOptions, 'sensor' | 'rangeM' | 'heightAboveBottom'>

const STATIONS_PER_FOOTPRINT = 8
const ACROSS_SAMPLES = 9
// How far past the flat-bottom strip the bottom is read, for strips that widen down a slope.
const ACROSS_MARGIN = 1.5

/**
 * Bottom a sensor probably covers along survey lines, following the depth under each line.
 * @param {[WaypointCoordinates, WaypointCoordinates][]} lines Start and end of each survey line.
 * @param {GroundSampler} sampleBottom Bottom height sampler.
 * @param {SurveyFootprintOptions} options Sensor and its height above the bottom.
 * @returns {Promise<SurveyFootprint[]>} One footprint per covered strip, two per line for side scan.
 */
export const surveyFootprints = async (
  lines: [WaypointCoordinates, WaypointCoordinates][],
  sampleBottom: GroundSampler,
  { sensor, rangeM, heightAboveBottom }: SurveyFootprintOptions
): Promise<SurveyFootprint[]> => {
  const planes = lines.map(([start, end]) => planeFor([start, end], bearingBetween(start, end)))
  const stations = lines.flatMap(([start, end], line) => {
    const [u0, v0] = toPlane(planes[line], start)
    const [u1] = toPlane(planes[line], end)
    return Array.from({ length: STATIONS_PER_FOOTPRINT }, (_, index) => {
      const u = u0 + ((u1 - u0) * index) / (STATIONS_PER_FOOTPRINT - 1)
      return { line, u, v0, position: fromPlane(planes[line], u, v0) }
    })
  })
  const bottoms = await sampleBottom(stations.map(({ position }) => position))
  const flat = stations.flatMap((station, index) => {
    const bottom = bottoms[index]
    const strips = bottom === null ? [] : sensorCoverage(sensor, heightAboveBottom(bottom), rangeM)
    if (bottom === null || strips.length === 0) return []
    const width = ACROSS_MARGIN * Math.max(...strips.flat().map(Math.abs))
    const offsets = Array.from({ length: ACROSS_SAMPLES }, (_, at) => -width + (2 * width * at) / (ACROSS_SAMPLES - 1))
    return [{ ...station, bottom, offsets }]
  })
  // A second read across each station lets the strip follow a bottom that slopes across the line.
  const acrossBottoms = await sampleBottom(
    flat.flatMap(({ line, u, v0, offsets }) => offsets.map((offset) => fromPlane(planes[line], u, v0 + offset)))
  )
  const covered = flat.flatMap(({ bottom, offsets, ...station }, index) => {
    const read = offsets.flatMap((offset, at): [number, number][] => {
      const across = acrossBottoms[index * ACROSS_SAMPLES + at]
      return across === null ? [] : [[offset, across]]
    })
    const bottomAt = interpolated([[0, bottom], ...read])
    const sensorM = bottom + heightAboveBottom(bottom)
    const heightAt = (acrossM: number): number => sensorM - bottomAt(sensor.offsetM + acrossM)
    const strips = sensorCoverage(sensor, heightAt(0), rangeM, heightAt)
    return strips.length === 0 ? [] : [{ ...station, strips }]
  })
  // ponytail: stations too deep for the sensor are bridged over rather than splitting the strip in two.
  return lines.flatMap((_, line) => {
    const along = covered.filter((station) => station.line === line)
    const stripCount = Math.min(...along.map(({ strips }) => strips.length))
    if (along.length < 2) return []
    return Array.from({ length: stripCount }, (__, strip) => {
      const at = (pick: (stretch: [number, number]) => number): WaypointCoordinates[] =>
        along.map(({ u, v0, strips }) => fromPlane(planes[line], u, v0 + pick(strips[strip])))
      return {
        outline: [...at(([from]) => from), ...at(([, to]) => to).reverse()],
        focusLine: at(([from, to]) => (from + to) / 2),
      }
    })
  })
}

/**
 * A survey with its lines replaced by new ones, each line end a waypoint copied from a template.
 * @param {Survey} survey Survey to re-space.
 * @param {WaypointCoordinates[]} ends Line ends in running order, from {@link coverageSurveyLines}.
 * @param {Waypoint} template Waypoint whose altitude, frame and commands every new waypoint takes.
 * @param {boolean} turned Whether the new lines run another way, so the survey's line angle follows them.
 * @returns {Survey} The re-spaced survey.
 */
export const respacedSurvey = (
  survey: Survey,
  ends: WaypointCoordinates[],
  template: Waypoint,
  turned = false
): Survey => {
  const [[fromLat, fromLng], [toLat, toLng]] = ends
  // The line angle is measured on the map's degree grid, as the survey path is generated from it.
  const angle = ((((Math.atan2(toLng - fromLng, toLat - fromLat) * 180) / Math.PI) % 360) + 360) % 360
  return {
    ...survey,
    ...(turned ? { surveyLinesAngle: angle } : {}),
    waypoints: ends.map((coordinates) => ({ ...structuredClone(template), id: uuid(), coordinates })),
  }
}
