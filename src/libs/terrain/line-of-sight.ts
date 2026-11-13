import type { WaypointCoordinates } from '@/types/mission'

import { type PathStation, densifyPath, legLengthM, surfaceHeight } from './mission-profile'
import type { TerrainTileBounds } from './tiles'

const EARTH_RADIUS_M = 6371000
// Effective earth radius factors: standard atmosphere for radio, the usual survey value for sight.
const RADIO_K = 4 / 3
const VISUAL_K = 7 / 6
const SPEED_OF_LIGHT_M_PER_US = 299.792458

/**
 * A point a link or a sight line runs between.
 */
export interface SightEndpoint {
  /**
   * Position as [latitude, longitude].
   */
  coordinates: WaypointCoordinates
  /**
   * Antenna or eye height above sea level, in meters.
   */
  heightAmslM: number
}

/**
 * Heights of the ground between two points, as sampled along {@link sightStations}.
 */
type SightProfile = {
  /**
   * Stations along the line, ends included.
   */
  stations: PathStation[]
  /**
   * Ground height at each station, null where unknown.
   */
  groundM: (number | null)[]
}

/**
 * Stations to sample between two points for a sight or radio line.
 * @param {WaypointCoordinates} from Start.
 * @param {WaypointCoordinates} to End.
 * @param {number} maxStations Most stations to use.
 * @returns {PathStation[]} The stations, ends included.
 */
export const sightStations = (from: WaypointCoordinates, to: WaypointCoordinates, maxStations = 60): PathStation[] =>
  densifyPath([from, to], Math.max(30, legLengthM(from, to) / maxStations))

/**
 * Radius of the first Fresnel zone at a point of a radio path.
 * @param {number} fromM Distance to one end, in meters.
 * @param {number} toM Distance to the other end, in meters.
 * @param {number} frequencyMhz Link frequency in megahertz.
 * @returns {number} Radius in meters.
 */
const fresnelRadiusM = (fromM: number, toM: number, frequencyMhz: number): number => {
  const wavelength = SPEED_OF_LIGHT_M_PER_US / frequencyMhz
  return Math.sqrt((wavelength * fromM * toM) / Math.max(1, fromM + toM))
}

const bulgeM = (fromM: number, toM: number, k: number): number => (fromM * toM) / (2 * k * EARTH_RADIUS_M)

/**
 * Judges a radio path over the terrain, with the earth's curvature and the first Fresnel zone.
 * @param {SightEndpoint} from One antenna.
 * @param {SightEndpoint} to The other antenna.
 * @param {SightProfile} profile Ground between them.
 * @param {number} frequencyMhz Link frequency.
 * @param {number} waterLevelM Water surface height.
 * @returns {number | null} Smallest clearance between the straight line and the terrain, as a fraction of the first
 * Fresnel zone radius there: below 0 the terrain blocks the line, below 0.6 the link is degraded. Null when the ground
 * is unknown somewhere.
 */
export const linkClearance = (
  from: SightEndpoint,
  to: SightEndpoint,
  { stations, groundM }: SightProfile,
  frequencyMhz: number,
  waterLevelM: number
): number | null => {
  const total = stations.at(-1)?.distanceM ?? 0
  let worst = Infinity
  for (let index = 1; index < stations.length - 1; index++) {
    const ground = groundM[index]
    if (ground === null) return null
    const fromM = stations[index].distanceM
    const toM = total - fromM
    const line = from.heightAmslM + (to.heightAmslM - from.heightAmslM) * (fromM / total)
    const obstacle = surfaceHeight(ground, waterLevelM) + bulgeM(fromM, toM, RADIO_K)
    worst = Math.min(worst, (line - obstacle) / fresnelRadiusM(fromM, toM, frequencyMhz))
  }
  return worst
}

/**
 * Lowest altitude at which a target is seen from an observer, over the ground sampled between them.
 * @param {SightEndpoint} observer The eye.
 * @param {number} targetGroundM Surface height at the target.
 * @param {number[]} distancesM Distances of the samples between them, ascending, target last.
 * @param {number[]} surfacesM Surface height at each sample.
 * @returns {number} The altitude above sea level, never below the target's surface.
 */
const lowestVisibleAltitudeM = (
  observer: SightEndpoint,
  targetGroundM: number,
  distancesM: number[],
  surfacesM: number[]
): number => {
  const total = distancesM[distancesM.length - 1]
  let steepest = -Infinity
  for (let index = 0; index < distancesM.length - 1; index++) {
    const distance = distancesM[index]
    if (distance <= 0) continue
    const apparent = surfacesM[index] - (distance * distance) / (2 * VISUAL_K * EARTH_RADIUS_M)
    steepest = Math.max(steepest, (apparent - observer.heightAmslM) / distance)
  }
  if (steepest === -Infinity) return targetGroundM
  const needed = observer.heightAmslM + steepest * total + (total * total) / (2 * VISUAL_K * EARTH_RADIUS_M)
  return Math.max(targetGroundM, needed)
}

/**
 * A grid of ground heights over an area, row 0 on the north edge.
 */
export interface HeightGrid {
  /**
   * Area covered.
   */
  bbox: TerrainTileBounds
  /**
   * Samples per row.
   */
  columns: number
  /**
   * Rows of samples.
   */
  rows: number
  /**
   * Height of each sample, row-major, NaN where unknown.
   */
  heightsM: Float32Array
}

/**
 * The lowest altitude at which every point of an area is seen by at least one observer.
 */
export interface VisibilityGrid extends HeightGrid {
  /**
   * Height above the surface the vehicle must reach to be seen, row-major; NaN where no observer
   * sees it within range or below the cloud base.
   */
  visibleAboveSurfaceM: Float32Array
}

/**
 * Center of a grid cell.
 * @param {HeightGrid} grid Grid to read.
 * @param {number} column Cell column.
 * @param {number} row Cell row.
 * @returns {WaypointCoordinates} The center as [latitude, longitude].
 */
const gridCellCenter = (grid: HeightGrid, column: number, row: number): WaypointCoordinates => [
  grid.bbox.north - ((row + 0.5) / grid.rows) * (grid.bbox.north - grid.bbox.south),
  grid.bbox.west + ((column + 0.5) / grid.columns) * (grid.bbox.east - grid.bbox.west),
]

/**
 * Reads a grid by bilinear interpolation.
 * @param {HeightGrid} grid Grid to read.
 * @param {Float32Array} values Values of the grid, row-major.
 * @param {WaypointCoordinates} coordinates Position to read.
 * @returns {number} The interpolated value, NaN outside the grid or next to an unknown sample.
 */
export const gridValueAt = (grid: HeightGrid, values: Float32Array, [lat, lng]: WaypointCoordinates): number => {
  const { bbox, columns, rows } = grid
  const x = ((lng - bbox.west) / (bbox.east - bbox.west)) * columns - 0.5
  const y = ((bbox.north - lat) / (bbox.north - bbox.south)) * rows - 0.5
  if (x < -0.5 || y < -0.5 || x > columns - 0.5 || y > rows - 0.5) return NaN
  const x0 = Math.max(0, Math.min(columns - 1, Math.floor(x)))
  const y0 = Math.max(0, Math.min(rows - 1, Math.floor(y)))
  const x1 = Math.min(columns - 1, x0 + 1)
  const y1 = Math.min(rows - 1, y0 + 1)
  const fx = Math.max(0, Math.min(1, x - x0))
  const fy = Math.max(0, Math.min(1, y - y0))
  const top = values[y0 * columns + x0] * (1 - fx) + values[y0 * columns + x1] * fx
  const bottom = values[y1 * columns + x0] * (1 - fx) + values[y1 * columns + x1] * fx
  return top * (1 - fy) + bottom * fy
}

// Marches one sight line over the grid itself, so the whole surface costs one grid sample rather than one per ray.
const observerVisibleAltitudeM = (
  grid: HeightGrid,
  surfaces: Float32Array,
  observer: SightEndpoint,
  target: WaypointCoordinates,
  targetSurfaceM: number,
  cellM: number
): number => {
  const distance = legLengthM(observer.coordinates, target)
  const steps = Math.max(1, Math.ceil(distance / Math.max(1, cellM)))
  const distances: number[] = []
  const heights: number[] = []
  for (let step = 1; step <= steps; step++) {
    const fraction = step / steps
    const at: WaypointCoordinates = [
      observer.coordinates[0] + (target[0] - observer.coordinates[0]) * fraction,
      observer.coordinates[1] + (target[1] - observer.coordinates[1]) * fraction,
    ]
    distances.push(distance * fraction)
    const height = gridValueAt(grid, surfaces, at)
    heights.push(Number.isNaN(height) ? targetSurfaceM : height)
  }
  return lowestVisibleAltitudeM(observer, targetSurfaceM, distances, heights)
}

/**
 * Computes, for every cell of a ground grid, how high a vehicle must be to stay in sight of at least
 * one observer: the visual line of sight surface.
 * @param {HeightGrid} grid Ground heights over the area.
 * @param {SightEndpoint[]} observers Eyes, above sea level.
 * @param {number} rangeM Farthest an observer sees the vehicle.
 * @param {number} waterLevelM Water surface height.
 * @param {number} cloudBaseAboveObserverM Cloud base above each observer's eye, 0 for clear sky.
 * @returns {VisibilityGrid} The surface.
 */
export const visibilitySurface = (
  grid: HeightGrid,
  observers: SightEndpoint[],
  rangeM: number,
  waterLevelM: number,
  cloudBaseAboveObserverM = 0
): VisibilityGrid => {
  const surfaces = grid.heightsM.map((height) => (Number.isNaN(height) ? NaN : surfaceHeight(height, waterLevelM)))
  const visible = new Float32Array(grid.columns * grid.rows).fill(NaN)
  const cellM = legLengthM(gridCellCenter(grid, 0, 0), gridCellCenter(grid, 1, 0))
  for (let row = 0; row < grid.rows; row++) {
    for (let column = 0; column < grid.columns; column++) {
      const index = row * grid.columns + column
      const targetSurface = surfaces[index]
      if (Number.isNaN(targetSurface)) continue
      const target = gridCellCenter(grid, column, row)
      const seenAt = observers.map((observer) => {
        if (legLengthM(observer.coordinates, target) > rangeM) return Infinity
        const needed = observerVisibleAltitudeM(grid, surfaces, observer, target, targetSurface, cellM)
        const ceiling = cloudBaseAboveObserverM > 0 ? observer.heightAmslM + cloudBaseAboveObserverM : Infinity
        return needed <= ceiling ? needed : Infinity
      })
      const best = Math.min(Infinity, ...seenAt)
      if (best !== Infinity) visible[index] = best - targetSurface
    }
  }
  return { ...grid, visibleAboveSurfaceM: visible }
}

let selfChecked = false

/**
 * Development self-check of the sight geometry, run once where bootstrap installed `assert`.
 */
export const checkLineOfSightOnce = (): void => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (selfChecked || !import.meta.env.DEV || typeof assert !== 'function') return
  selfChecked = true
  const eye: SightEndpoint = { coordinates: [0, 0], heightAmslM: 2 }
  assert(lowestVisibleAltitudeM(eye, 0, [500, 1000], [0, 0]) < 1, 'Flat ground hides nothing at a kilometer')
  const behindWall = lowestVisibleAltitudeM(eye, 0, [500, 1000], [50, 0])
  assert(Math.abs(behindWall - 98) < 1, 'A 50 m wall halfway hides everything below about 98 m')
  assert(Math.abs(fresnelRadiusM(5000, 5000, 900) - 28.9) < 0.5, 'Fresnel radius at 900 MHz over 10 km is about 29 m')
}
