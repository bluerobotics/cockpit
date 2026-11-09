import type { TerrainProfileSample, TerrainVehicleClass } from './mission-profile'
import type { UploadPathPoint } from './mission-terrain'

/**
 * Drawing coordinates of a terrain profile chart, in a viewBox of {@link PROFILE_CHART_WIDTH} by {@link PROFILE_CHART_HEIGHT}.
 */
export interface ProfileChartGeometry {
  /**
   * Filled area under the ground or seabed.
   */
  groundArea: string
  /**
   * Seabed drawn raised towards the surface where the water is possibly shallow, empty when there is none.
   */
  raisedSeabedArea: string
  /**
   * Band of the model's uncertainty around the ground, from the highest point down, empty for vessels.
   */
  uncertaintyBand: string
  /**
   * Filled water, between the seabed and the surface, empty when there is none.
   */
  waterArea: string
  /**
   * The water surface a vessel's chart is read against, empty for other vehicles.
   */
  waterLine: string
  /**
   * Band between the expected low and high tide, empty when no tide range is outlined.
   */
  tideBand: string
  /**
   * The expected low and high tide lines, empty when no tide range is outlined.
   */
  tideLines: string
  /**
   * The vehicle's planned path, or its keel for vessels.
   */
  vehicleLine: string
  /**
   * The path an upload sends, empty when none is given.
   */
  uploadLine: string
  /**
   * The model's ground along the whole path, empty without model heights.
   */
  modelLine: string
  /**
   * The model's ground only where measurements replace it, empty where none do.
   */
  replacedModelLine: string
  /**
   * Water over the stretches marked as over water, its seabed sloping down from each shore; empty where none are.
   */
  waterBodyArea: string
  /**
   * Lowest height drawn, meters above sea level.
   */
  minM: number
  /**
   * Highest height drawn.
   */
  maxM: number
}

/**
 * A shaded stretch of the chart.
 */
export interface ProfileChartBand {
  /**
   * Start, meters from the start of the path.
   */
  fromM: number
  /**
   * End, meters from the start of the path.
   */
  toM: number
  /**
   * Shade color.
   */
  color: string
  /**
   * Whether the stretch is shaded stronger, for the finding being pointed at.
   */
  highlighted?: boolean
}

/**
 * A stretch of possibly shallow water.
 */
export interface ProfileChartShallows {
  /**
   * Start, meters from the start of the path.
   */
  fromM: number
  /**
   * End, meters from the start of the path.
   */
  toM: number
  /**
   * Whether the model reads land there that may be water, so the seabed is drawn raised to the low tide.
   */
  raised: boolean
  /**
   * Why the stretch is flagged, shown on its marker.
   */
  description: string
}

/**
 * A stretch the chart marks with a warning triangle.
 */
export interface ProfileChartWarning extends Omit<ProfileChartShallows, 'raised'> {
  /**
   * Heading read from the triangle.
   */
  title: string
}

/**
 * What the chart is drawn for, besides the profile stations.
 */
export interface ProfileChartOptions {
  /**
   * How the vehicle meets the terrain.
   */
  vehicleClass: TerrainVehicleClass
  /**
   * Model uncertainty, drawn as a band around the ground of aircraft and ground vehicles.
   */
  uncertaintyM: number
  /**
   * Water surface height.
   */
  waterLevelM: number
  /**
   * Hull depth below the waterline.
   */
  draftM: number
  /**
   * Expected difference between low and high tide to outline around a vessel's water level, 0 for none.
   */
  tideRangeM?: number
  /**
   * Stretches of possibly shallow water.
   */
  shallows?: ProfileChartShallows[]
  /**
   * Model ground at each station, without recorded measurements.
   */
  modelGroundM?: (number | null)[]
  /**
   * Whether each station is over water, null where unknown.
   */
  overWater?: (boolean | null)[]
  /**
   * Height range to draw, instead of the one the profile spans.
   */
  range?: [number, number]
  /**
   * The path an upload sends, when it differs from the planned one.
   */
  uploadPath?: Pick<UploadPathPoint, 'distanceM' | 'amslM'>[]
}

export const PROFILE_CHART_WIDTH = 1000
export const PROFILE_CHART_HEIGHT = 160

const line = (points: [number, number][]): string =>
  points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join('')

// Share of the chart height kept clear above the highest point, under the waypoint numbers.
const LABEL_ROW_SHARE = 0.15

// A vessel's chart is about the water under it, so land is cut off this far above the highest tide.
const MARINE_HEADROOM_M = 3
const LAND_CHART_MAX_DEPTH_M = 5
// Water is raised to this share of the chart height where its shores allow, so it shows on a chart spanning mountains.
const WATER_SURFACE_SHARE = 0.06
// Share of the chart width a shore takes to slope down to the deepest water drawn.
const WATER_SHORE_SHARE = 0.02

const heightRange = (values: number[], floorM?: number): [number, number] => {
  const known = values.filter(Number.isFinite)
  if (known.length === 0) return [0, 1]
  const min = Math.min(...known)
  const max = Math.max(...known)
  const padding = Math.max(2, (max - min) * 0.08)
  const low = floorM !== undefined && min >= floorM ? Math.max(floorM, min - padding) : min - padding
  const labelRowM = ((max - low) * LABEL_ROW_SHARE) / (1 - LABEL_ROW_SHARE)
  return [low, max + Math.max(padding, labelRowM)]
}

const within = (stretches: ProfileChartShallows[], distanceM: number): boolean =>
  stretches.some(({ fromM, toM }) => distanceM >= fromM && distanceM <= toM)

/**
 * Heights a profile station is drawn at.
 */
interface DrawnHeights {
  /**
   * Ground or seabed.
   */
  groundM: number
  /**
   * Highest model point around the station.
   */
  highM: number
  /**
   * The vehicle's path, or its keel for vessels.
   */
  vehicleM: number
}

const chartRange = (
  samples: TerrainProfileSample[],
  options: ProfileChartOptions,
  drawn: (sample: TerrainProfileSample) => DrawnHeights,
  tideM: number,
  hasWater: boolean,
  modelM: number[]
): [number, number] => {
  const { vehicleClass, uncertaintyM, waterLevelM } = options
  const air = vehicleClass === 'air'
  const marine = vehicleClass === 'surface' || vehicleClass === 'underwater'
  // An aircraft never goes under the water, so the seabed does not stretch its chart below sea level.
  const low = (groundM: number): number => {
    if (air) return Math.max(groundM, waterLevelM)
    return marine ? groundM : groundM - uncertaintyM
  }
  const high = (highM: number): number =>
    marine ? Math.min(highM, waterLevelM + tideM + MARINE_HEADROOM_M) : highM + uncertaintyM
  const water = hasWater || marine ? [waterLevelM - tideM, waterLevelM + tideM] : []
  const values = [
    ...samples.flatMap((sample) => {
      const { groundM, highM, vehicleM } = drawn(sample)
      return [low(groundM), high(highM), vehicleM]
    }),
    ...modelM.map(low),
    ...water,
    ...(options.uploadPath ?? []).map(({ amslM }) => amslM),
  ]
  if (marine) return heightRange(values)
  // Aircraft and ground vehicles never go deep, so a deep model pit, often missing data, does not squash their chart.
  const deepestM = waterLevelM - LAND_CHART_MAX_DEPTH_M
  return heightRange(
    values.map((value) => Math.max(value, deepestM)),
    deepestM
  )
}

const waterLines = (
  y: (heightM: number) => number,
  waterLevelM: number,
  tideM: number,
  hasSurface: boolean
): Pick<ProfileChartGeometry, 'waterLine' | 'tideBand' | 'tideLines'> => {
  if (!hasSurface) return { waterLine: '', tideBand: '', tideLines: '' }
  const across = (heightM: number): [number, number][] => [
    [0, y(heightM)],
    [PROFILE_CHART_WIDTH, y(heightM)],
  ]
  const highTide = line(across(waterLevelM + tideM))
  const lowTide = line(across(waterLevelM - tideM).reverse())
  const tides = tideM > 0
  return {
    waterLine: line(across(waterLevelM)),
    tideBand: tides ? `${highTide}${lowTide.replace('M', 'L')}Z` : '',
    tideLines: tides ? `${highTide}${lowTide}` : '',
  }
}

/**
 * The water a chart draws over the stretches marked as over water.
 */
interface WaterBodies {
  /**
   * Highest the seabed is drawn at each station over water, sloping down from each shore.
   */
  seabedCaps: Map<TerrainProfileSample, number>
  /**
   * The water, between a flat surface and the seabed.
   */
  area: string
}

// The model is coarse along shores and often reads land over mapped water, so the seabed slopes down from each
// shore and the model's own depth is only kept where it is deeper. A shore lies half way to the last station on
// land; water running off either end of the chart has no shore there.
const waterBodies = (
  samples: TerrainProfileSample[],
  overWater: (boolean | null)[],
  waterLevelM: number,
  groundM: (sample: TerrainProfileSample) => number,
  x: (distanceM: number) => number,
  y: (heightM: number) => number,
  [minM, maxM]: [number, number]
): WaterBodies => {
  const lengthM = samples.at(-1)?.distanceM || 1
  const last = samples.length - 1
  const raisedSurfaceM = minM + (maxM - minM) * WATER_SURFACE_SHARE
  // Every stretch shares one surface, as the same sea or lake, no higher than the lowest land any of them meets.
  const shoresM = samples
    .filter((_, index) => overWater[index] !== true && (overWater[index - 1] === true || overWater[index + 1] === true))
    .map(groundM)
    .filter(Number.isFinite)
  const surfaceM = Math.max(waterLevelM, Math.min(raisedSurfaceM, ...shoresM))
  const seabedCaps = new Map<TerrainProfileSample, number>()
  const areas = samples.map((sample, start) => {
    if (overWater[start] !== true || overWater[start - 1] === true) return ''
    let end = start
    while (overWater[end + 1] === true) end++
    const fromM = start === 0 ? -Infinity : (samples[start - 1].distanceM + sample.distanceM) / 2
    const toM = end === last ? Infinity : (samples[end].distanceM + samples[end + 1].distanceM) / 2
    const [leftM, rightM] = [Math.max(fromM, 0), Math.min(toM, lengthM)]
    const shoreM = Math.min(lengthM * WATER_SHORE_SHARE, (rightM - leftM) / 3)
    const seabed = samples.slice(start, end + 1).map((station): [number, number] => {
      const depthShare = Math.min(1, (station.distanceM - fromM) / shoreM, (toM - station.distanceM) / shoreM)
      const capM = surfaceM - (surfaceM - minM) * depthShare
      seabedCaps.set(station, capM)
      const stationGroundM = groundM(station)
      return [x(station.distanceM), y(Number.isFinite(stationGroundM) ? Math.min(stationGroundM, capM) : capM)]
    })
    const surface: [number, number][] = [
      [x(leftM), y(surfaceM)],
      [x(rightM), y(surfaceM)],
    ]
    return `${line([...surface, ...seabed.reverse()])}Z`
  })
  return { seabedCaps, area: areas.join('') }
}

let selfChecked = false

const checkModelLinesOnce = (): void => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (selfChecked || !import.meta.env.DEV || typeof assert !== 'function') return
  selfChecked = true
  const groundM = [-5, -5, -6, -5, -5, -5, -5, -7]
  const samples = groundM.map(
    (ground, index) => ({ distanceM: index * 10, groundM: ground, groundHighM: ground } as TerrainProfileSample)
  )
  const { modelLine, replacedModelLine } = profileChartGeometry(samples, {
    vehicleClass: 'surface',
    uncertaintyM: 0,
    waterLevelM: 0,
    draftM: 0,
    modelGroundM: [-5, -5, -5, -5, -5, null, -5, -5],
  })
  assert(modelLine.match(/M/g)?.length === 2, 'The model line breaks where the model has no height')
  assert(replacedModelLine.match(/M/g)?.length === 2, 'Each replaced stretch is its own run of the model line')
  assert(replacedModelLine.match(/[ML]/g)?.length === 5, 'A replaced station draws to its neighbors')
  const pit = groundM.map(
    (_, index) =>
      ({ distanceM: index * 10, groundM: 800, groundHighM: index === 4 ? -2000 : 800 } as TerrainProfileSample)
  )
  const { minM } = profileChartGeometry(pit, { vehicleClass: 'air', uncertaintyM: 0, waterLevelM: 0, draftM: 0 })
  assert(minM === -LAND_CHART_MAX_DEPTH_M, 'A deep pit stretches an aircraft chart no lower than the shallow-water cap')
  const { waterBodyArea, groundArea } = profileChartGeometry(pit, {
    vehicleClass: 'air',
    uncertaintyM: 0,
    waterLevelM: 0,
    draftM: 0,
    overWater: [true, true, false, null, true, true, true, false],
  })
  assert(waterBodyArea.match(/M/g)?.length === 2, 'Each run of stations over water is one body of water')
  assert(waterBodyArea.startsWith('M0.0,'), 'Water running off the chart starts at its edge')
  assert(groundArea.includes('L714.3,160.0'), 'Land the model reads in the middle of mapped water is drawn under it')
}

let spacingChecked = false

/**
 * Picks which of a row of labels to show so none overlap, keeping the first and the last.
 * @param {number[]} positionsPx Label centers along the row, ascending, in pixels.
 * @param {number} minGapPx Closest two shown labels may be, center to center, in pixels.
 * @returns {boolean[]} Whether each label is shown.
 */
export const spacedLabels = (positionsPx: number[], minGapPx: number): boolean[] => {
  let lastPx = -Infinity
  const shown = positionsPx.map((px) => {
    if (px - lastPx < minGapPx) return false
    lastPx = px
    return true
  })
  const last = positionsPx.length - 1
  if (last > 0 && !shown[last]) {
    for (let index = last - 1; index > 0 && positionsPx[last] - positionsPx[index] < minGapPx; index--) {
      shown[index] = false
    }
    shown[last] = true
  }
  // @ts-ignore: import.meta.env does not exist in the types
  if (!spacingChecked && import.meta.env.DEV && typeof assert === 'function') {
    spacingChecked = true
    const crowded = spacedLabels([0, 10, 20, 30, 100, 104], 15).join()
    assert(crowded === 'true,false,true,false,false,true', 'Crowded labels thin out and the last one stays')
  }
  return shown
}

/**
 * Builds the chart's shapes from a profile.
 * @param {TerrainProfileSample[]} samples Profile stations, in order.
 * @param {ProfileChartOptions} options Vehicle, water and what else to draw.
 * @returns {ProfileChartGeometry} The shapes and the height range they span.
 */
export const profileChartGeometry = (
  samples: TerrainProfileSample[],
  options: ProfileChartOptions
): ProfileChartGeometry => {
  checkModelLinesOnce()
  const { vehicleClass, uncertaintyM, waterLevelM, draftM, shallows = [] } = options
  const marine = vehicleClass === 'surface' || vehicleClass === 'underwater'
  const tideM = marine ? (options.tideRangeM ?? 0) / 2 : 0
  const raised = shallows.filter((stretch) => stretch.raised)
  // The seabed of possibly shallow water is drawn no higher than the low tide, or the keel when no tide
  // range is outlined, so the model's land there never reaches the surface.
  const shoalTopM = waterLevelM - Math.max(tideM, draftM)
  const capped = (heightM: number | null, distanceM: number): number => {
    if (heightM === null) return NaN
    return within(shallows, distanceM) ? Math.min(heightM, shoalTopM) : heightM
  }
  const drawn = (sample: TerrainProfileSample): DrawnHeights => {
    return {
      groundM: capped(sample.groundM, sample.distanceM),
      highM: capped(sample.groundHighM, sample.distanceM),
      vehicleM: (vehicleClass === 'surface' ? waterLevelM - draftM : sample.pathAmslM) ?? NaN,
    }
  }
  const hasWater = samples.some((sample) => sample.groundM !== null && sample.groundM < waterLevelM)
  const { modelGroundM = [] } = options
  const modelM = samples.map((sample, index) => capped(modelGroundM[index] ?? null, sample.distanceM))
  const [minM, maxM] = options.range ?? chartRange(samples, options, drawn, tideM, hasWater, modelM)

  const lengthM = samples.at(-1)?.distanceM || 1
  const x = (distanceM: number): number => (distanceM / lengthM) * PROFILE_CHART_WIDTH
  const y = (heightM: number): number =>
    PROFILE_CHART_HEIGHT - ((heightM - minM) / (maxM - minM)) * PROFILE_CHART_HEIGHT
  const bottom = (points: [number, number][]): string =>
    points.length === 0
      ? ''
      : `${line(points)}L${points.at(-1)![0]},${PROFILE_CHART_HEIGHT}L${points[0][0]},${PROFILE_CHART_HEIGHT}Z`

  const water = waterBodies(
    samples,
    marine ? [] : options.overWater ?? [],
    waterLevelM,
    (sample) => drawn(sample).groundM,
    x,
    y,
    [minM, maxM]
  )
  const seabedCap = (sample: TerrainProfileSample): number => water.seabedCaps.get(sample) ?? Infinity
  const shownGroundM = (sample: TerrainProfileSample): number => Math.min(drawn(sample).groundM, seabedCap(sample))
  const known = samples.filter((sample) => sample.groundM !== null && sample.groundHighM !== null)
  const groundPoint = (sample: TerrainProfileSample): [number, number] => [x(sample.distanceM), y(shownGroundM(sample))]
  // The map, not the model, says where the water is, so the model's error is not drawn over it.
  const bandM = (sample: TerrainProfileSample): number => (water.seabedCaps.has(sample) ? 0 : uncertaintyM)
  const upper = known.map((sample): [number, number] => [
    x(sample.distanceM),
    y(Math.min(sample.groundHighM!, seabedCap(sample)) + bandM(sample)),
  ])
  const lower = known
    .map((sample): [number, number] => [x(sample.distanceM), y(shownGroundM(sample) - bandM(sample))])
    .reverse()
  const surface = known.map((sample): [number, number] => [x(sample.distanceM), y(waterLevelM)])
  const seabed = known
    .map((sample): [number, number] => [x(sample.distanceM), y(Math.min(shownGroundM(sample), waterLevelM))])
    .reverse()
  // Each shoal runs from the station before it to the one after, so its sides slope up from the real seabed.
  const shoals = raised.map(({ fromM, toM }) => {
    const first = known.findIndex((sample) => sample.distanceM >= fromM)
    const after = known.findIndex((sample) => sample.distanceM > toM)
    const end = after === -1 ? known.length : after + 1
    return first === -1 ? '' : bottom(known.slice(Math.max(0, first - 1), end).map(groundPoint))
  })
  const vehicle = samples
    .map((sample) => [sample.distanceM, drawn(sample).vehicleM] as const)
    .filter(([, heightM]) => Number.isFinite(heightM))
    .map(([distanceM, heightM]): [number, number] => [x(distanceM), y(heightM)])
  const modelPath = (shown: (index: number) => boolean): string =>
    samples
      .map((sample, index) => {
        if (!shown(index)) return ''
        const command = index > 0 && shown(index - 1) ? 'L' : 'M'
        return `${command}${x(sample.distanceM).toFixed(1)},${y(modelM[index]).toFixed(1)}`
      })
      .join('')
  const hasModel = (index: number): boolean => Number.isFinite(modelM[index])
  const replaced = (index: number): boolean => {
    const groundM = samples[index]?.groundM
    const modelGround = modelGroundM[index]
    return groundM != null && modelGround != null && Math.abs(groundM - modelGround) > 0.01
  }
  // A measured cell can span a single station, so each replaced one draws to its neighbors to stay visible.
  const nearReplaced = (index: number): boolean =>
    hasModel(index) && (replaced(index - 1) || replaced(index) || replaced(index + 1))
  return {
    groundArea: bottom(known.map(groundPoint)),
    raisedSeabedArea: shoals.join(''),
    uncertaintyBand: !marine && upper.length ? `${line([...upper, ...lower])}Z` : '',
    waterArea: hasWater && known.length ? `${line([...surface, ...seabed])}Z` : '',
    ...waterLines(y, waterLevelM, tideM, marine),
    vehicleLine: line(vehicle),
    uploadLine: line(
      (options.uploadPath ?? []).map(({ distanceM, amslM }): [number, number] => [x(distanceM), y(amslM)])
    ),
    modelLine: modelPath(hasModel),
    replacedModelLine: modelPath(nearReplaced),
    waterBodyArea: water.area,
    minM,
    maxM,
  }
}

/**
 * Profile stations with one path point moved up or down, for previewing a height change. Both of its legs
 * interpolate linearly from their ends, so each station shifts by its share of the change.
 * @param {TerrainProfileSample[]} samples Profile stations, in order.
 * @param {number} pointIndex Path point being moved.
 * @param {number} changeM How far it moves, in meters.
 * @returns {TerrainProfileSample[]} The stations, with the path heights on the point's two legs shifted.
 */
export const withPointShifted = (
  samples: TerrainProfileSample[],
  pointIndex: number,
  changeM: number
): TerrainProfileSample[] =>
  samples.map((sample) => {
    let share = 0
    if (sample.legIndex === pointIndex - 1) share = sample.legFraction
    else if (sample.legIndex === pointIndex) share = 1 - sample.legFraction
    if (share === 0 || sample.pathAmslM === null) return sample
    return { ...sample, pathAmslM: sample.pathAmslM + changeM * share }
  })

/**
 * The station nearest a fraction of the way along the profile.
 * @param {TerrainProfileSample[]} samples Profile stations, in order.
 * @param {number} fraction 0 at the start, 1 at the end.
 * @returns {TerrainProfileSample | undefined} The station, undefined for an empty profile.
 */
export const sampleAtFraction = (
  samples: TerrainProfileSample[],
  fraction: number
): TerrainProfileSample | undefined => {
  const target = fraction * (samples.at(-1)?.distanceM ?? 0)
  let low = 0
  let high = samples.length - 1
  while (low < high) {
    const middle = (low + high) >> 1
    if (samples[middle].distanceM < target) low = middle + 1
    else high = middle
  }
  const previous = samples[low - 1]
  if (previous && Math.abs(previous.distanceM - target) < Math.abs(samples[low].distanceM - target)) return previous
  return samples[low]
}
