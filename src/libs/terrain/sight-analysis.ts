import type { WaypointCoordinates } from '@/types/mission'

import { sampleTerrain } from './elevation-service'
import {
  type HeightGrid,
  type SightEndpoint,
  type VisibilityGrid,
  gridValueAt,
  linkClearance,
  sightStations,
} from './line-of-sight'
import { type TerrainProfileSample, type TerrainVehicleClass, legLengthM, surfaceHeight } from './mission-profile'
import { terrainZoomForSpacing } from './tiles'

/**
 * The radio link from the base station at one point of the mission.
 */
export interface LinkStation {
  /**
   * Distance along the mission, in meters.
   */
  distanceM: number
  /**
   * Leg the point lies on.
   */
  legIndex: number
  /**
   * Position of the vehicle.
   */
  coordinates: WaypointCoordinates
  /**
   * Fraction of the first Fresnel zone left clear, below 0 when the terrain blocks the straight line;
   * null when the ground in between is unknown.
   */
  fresnelRatio: number | null
}

/**
 * Whether observers see the vehicle at a point of the mission: at its planned height, only higher up, or not at all.
 */
export type PathSightKind = 'in-sight' | 'must-climb' | 'never-seen'

/**
 * A stretch of the mission where observers see the vehicle the same way.
 */
export interface PathSightStretch {
  /**
   * How the vehicle is seen there.
   */
  kind: PathSightKind
  /**
   * Leg it lies on.
   */
  legIndex: number
  /**
   * Where it begins, meters from the start.
   */
  fromM: number
  /**
   * Where it ends, meters from the start.
   */
  toM: number
}

/**
 * A stretch of the mission where something about the link or the sight of the vehicle goes wrong.
 */
export interface SightFinding {
  /**
   * What goes wrong there.
   */
  kind: 'link-blocked' | 'link-degraded' | Exclude<PathSightKind, 'in-sight'>
  /**
   * Leg it lies on.
   */
  legIndex: number
  /**
   * Where it begins, meters from the start.
   */
  fromM: number
  /**
   * Where it ends, meters from the start.
   */
  toM: number
}

/**
 * Color each kind of {@link PathSightStretch} is drawn in, matching the visibility surface on the map.
 */
export const PATH_SIGHT_COLORS: Record<PathSightKind, string> = {
  'in-sight': '#43A047',
  'must-climb': '#FF7343',
  'never-seen': '#E53935',
}

// Below 60% of the first Fresnel zone left clear, the terrain takes a noticeable share of the signal.
export const DEGRADED_FRESNEL_RATIO = 0.6
const MAX_LINK_STATIONS = 120
const MAX_GRID_CELLS = 6400

/**
 * Height of the vehicle's antenna, or of the vehicle itself, above sea level at a profile station.
 * @param {TerrainProfileSample} sample Profile station.
 * @param {TerrainVehicleClass} vehicleClass How the vehicle meets the terrain.
 * @param {number} antennaM Antenna height over the deck or the ground, for surface and ground vehicles.
 * @param {number} waterLevelM Water surface height.
 * @returns {number | null} The height, null when it cannot be told.
 */
export const vehicleSightHeightM = (
  sample: TerrainProfileSample,
  vehicleClass: TerrainVehicleClass,
  antennaM: number,
  waterLevelM: number
): number | null => {
  if (vehicleClass === 'surface') return waterLevelM + antennaM
  if (vehicleClass === 'ground') return sample.groundM === null ? null : sample.groundM + antennaM
  if (vehicleClass === 'underwater') return null
  return sample.pathAmslM
}

/**
 * Checks the radio link from the base station to the vehicle along the mission, with earth bulge and
 * the first Fresnel zone, at up to {@link MAX_LINK_STATIONS} points.
 * @param {SightEndpoint} base Base station antenna.
 * @param {TerrainProfileSample[]} samples Mission profile stations.
 * @param {(sample: TerrainProfileSample) => number | null} vehicleHeightM Vehicle antenna height at a station.
 * @param {number} frequencyMhz Radio frequency.
 * @param {number} waterLevelM Water surface height.
 * @returns {Promise<LinkStation[]>} The link at each checked point.
 */
export const radioLinkAlongPath = async (
  base: SightEndpoint,
  samples: TerrainProfileSample[],
  vehicleHeightM: (sample: TerrainProfileSample) => number | null,
  frequencyMhz: number,
  waterLevelM: number
): Promise<LinkStation[]> => {
  const stride = Math.max(1, Math.ceil(samples.length / MAX_LINK_STATIONS))
  const checked = samples.filter((_, index) => index % stride === 0 || index === samples.length - 1)
  const paths = checked.map((sample) => sightStations(base.coordinates, sample.coordinates))
  const ground = await sampleTerrain(
    paths.flat().map((station) => station.coordinates),
    { mode: 'highest' }
  )
  let offset = 0
  return checked.map((sample, index) => {
    const stations = paths[index]
    const groundM = ground.slice(offset, offset + stations.length)
    offset += stations.length
    const height = vehicleHeightM(sample)
    const clearance =
      height === null
        ? null
        : linkClearance(
            base,
            { coordinates: sample.coordinates, heightAmslM: height },
            { stations, groundM },
            frequencyMhz,
            waterLevelM
          )
    return {
      distanceM: sample.distanceM,
      legIndex: sample.legIndex,
      coordinates: sample.coordinates,
      fresnelRatio: clearance,
    }
  })
}

/**
 * A point along the mission with what is told about it, if anything.
 */
type SightPoint<K extends string> = {
  /**
   * Meters along the mission.
   */
  distanceM: number
  /**
   * Leg the point lies on.
   */
  legIndex: number
  /**
   * What is told at the point, null for nothing.
   */
  kind: K | null
}

type SightStretch<K extends string> = Omit<PathSightStretch, 'kind'> & Record<'kind', K>

/**
 * Groups consecutive points that share a kind on the same leg.
 * @param {SightPoint<K>[]} points Points in order.
 * @returns {SightStretch<K>[]} One stretch per run.
 */
const sightStretches = <K extends string>(points: SightPoint<K>[]): SightStretch<K>[] => {
  const stretches: SightStretch<K>[] = []
  let open: (typeof stretches)[number] | null = null
  points.forEach(({ distanceM, legIndex, kind }) => {
    if (open && (kind !== open.kind || legIndex !== open.legIndex)) open = null
    if (!kind) return
    if (open) {
      open.toM = distanceM
      return
    }
    open = { kind, legIndex, fromM: distanceM, toM: distanceM }
    stretches.push(open)
  })
  return stretches
}

/**
 * Stretches where the radio link is blocked or degraded.
 * @param {LinkStation[]} stations Link along the mission.
 * @returns {SightFinding[]} One finding per stretch.
 */
export const linkFindings = (stations: LinkStation[]): SightFinding[] =>
  sightStretches(
    stations.map(({ distanceM, legIndex, fresnelRatio }) => ({ distanceM, legIndex, kind: linkKind(fresnelRatio) }))
  )

const linkKind = (fresnelRatio: number | null): SightFinding['kind'] | null => {
  if (fresnelRatio === null || fresnelRatio >= DEGRADED_FRESNEL_RATIO) return null
  return fresnelRatio < 0 ? 'link-blocked' : 'link-degraded'
}

/**
 * Samples the ground over a box into a grid fine enough for the box and coarse enough to compute quickly.
 * @param {HeightGrid['bbox']} bbox Box to cover.
 * @returns {Promise<HeightGrid>} The grid, NaN where the ground is unknown.
 */
export const sampleHeightGrid = async (bbox: HeightGrid['bbox']): Promise<HeightGrid> => {
  const widthM = legLengthM([bbox.south, bbox.west], [bbox.south, bbox.east])
  const heightM = legLengthM([bbox.south, bbox.west], [bbox.north, bbox.west])
  const cellM = Math.max(10, Math.sqrt((widthM * heightM) / MAX_GRID_CELLS))
  const columns = Math.max(2, Math.round(widthM / cellM))
  const rows = Math.max(2, Math.round(heightM / cellM))
  const centers: WaypointCoordinates[] = []
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      centers.push([
        bbox.north - ((row + 0.5) / rows) * (bbox.north - bbox.south),
        bbox.west + ((column + 0.5) / columns) * (bbox.east - bbox.west),
      ])
    }
  }
  const zoom = terrainZoomForSpacing((bbox.east - bbox.west) / columns)
  const heights = await sampleTerrain(centers, { mode: 'bilinear', zoom })
  return { bbox, columns, rows, heightsM: Float32Array.from(heights, (height) => height ?? NaN) }
}

/**
 * Splits the mission into stretches by how the observers see the vehicle at its planned height.
 * @param {VisibilityGrid} grid Visibility surface.
 * @param {TerrainProfileSample[]} samples Mission profile stations.
 * @param {(sample: TerrainProfileSample) => number | null} vehicleHeightM Vehicle height above sea level at a station.
 * @param {number} waterLevelM Water surface height.
 * @returns {PathSightStretch[]} The stretches, leaving out stations whose height or ground is unknown.
 */
export const pathSight = (
  grid: VisibilityGrid,
  samples: TerrainProfileSample[],
  vehicleHeightM: (sample: TerrainProfileSample) => number | null,
  waterLevelM: number
): PathSightStretch[] =>
  sightStretches(
    samples.map((sample): SightPoint<PathSightKind> => {
      const needed = gridValueAt(grid, grid.visibleAboveSurfaceM, sample.coordinates)
      const heightM = vehicleHeightM(sample)
      const point = { distanceM: sample.distanceM, legIndex: sample.legIndex }
      if (heightM === null || sample.groundM === null) return { ...point, kind: null }
      if (Number.isNaN(needed)) return { ...point, kind: 'never-seen' }
      const aboveM = heightM - surfaceHeight(sample.groundM, waterLevelM)
      return { ...point, kind: aboveM < needed ? 'must-climb' : 'in-sight' }
    })
  )

/**
 * Colors a visibility surface for the map: clear where the vehicle is seen on the surface, warming
 * through yellow to orange as it must climb to be seen, and red where nobody in range sees it.
 * @param {VisibilityGrid} grid Visibility surface.
 * @param {number} maxAboveM Height above the surface drawn as the warmest color.
 * @param {WaypointCoordinates[]} observers Observer positions, so cells beyond every observer's range stay clear.
 * @param {number} rangeM Visual range of the observers.
 * @returns {Uint8ClampedArray} RGBA pixels, one per cell, row 0 on the north edge.
 */
export const visibilityImagePixels = (
  grid: VisibilityGrid,
  maxAboveM: number,
  observers: WaypointCoordinates[],
  rangeM: number
): Uint8ClampedArray => {
  const pixels = new Uint8ClampedArray(grid.columns * grid.rows * 4)
  const { south, west, north, east } = grid.bbox
  const inRange = (index: number): boolean => {
    const row = Math.floor(index / grid.columns)
    const center: WaypointCoordinates = [
      north - ((row + 0.5) / grid.rows) * (north - south),
      west + (((index % grid.columns) + 0.5) / grid.columns) * (east - west),
    ]
    return observers.some((observer) => legLengthM(observer, center) <= rangeM)
  }
  grid.visibleAboveSurfaceM.forEach((needed, index) => {
    const at = index * 4
    if (Number.isNaN(grid.heightsM[index])) return
    if (Number.isNaN(needed)) {
      if (inRange(index)) pixels.set([229, 57, 53, 110], at)
      return
    }
    const warmth = Math.min(1, Math.max(0, needed) / Math.max(1, maxAboveM))
    pixels.set([255, Math.round(235 - 120 * warmth), 59, Math.round(110 * warmth)], at)
  })
  return pixels
}
