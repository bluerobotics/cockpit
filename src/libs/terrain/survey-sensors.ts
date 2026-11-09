import type { SurveySensorGeometry, TerrainSurveyCamera, TerrainSurveySensor } from '@/types/terrain'

import type { TerrainVehicleClass } from './mission-profile'

/** Id of the echo sounder or camera the user describes in the survey sensor settings. */
export const CUSTOM_SURVEY_SENSOR = 'custom'

/** Id selected when the vehicle carries no echo sounder or no camera. */
export const NO_SURVEY_SENSOR = 'none'

/**
 * How a catalog sensor is fitted to one vehicle, with the bracket sold for it.
 */
export type SurveySensorMount = {
  /**
   * Where the bracket puts the sensor and which way it looks.
   */
  bracket: string
} & (
  | {
      /**
       * What the sensor sees from that bracket.
       */
      geometry: SurveySensorGeometry
      /**
       * Farthest slant range a sonar reads, in meters.
       */
      maxRangeM?: number
    }
  | {
      /**
       * Why the sensor cannot cover a strip while running a survey line.
       */
      unsuitedReason: string
    }
)

/**
 * An echo sounder or camera from the Blue Robotics and Reef stores.
 */
export interface SurveySensorPreset {
  /**
   * Stable id, stored in the settings.
   */
  id: string
  /**
   * Product name.
   */
  label: string
  /**
   * Mount on each vehicle the sensor has a bracket for.
   */
  mounts: Partial<Record<TerrainVehicleClass, SurveySensorMount>>
}

/**
 * A camera from the Blue Robotics and Reef stores.
 */
export interface SurveyCameraPreset extends SurveySensorPreset {
  /**
   * Width of its images, in pixels.
   */
  imageWidthPx: number
}

/** Vehicle each marine class is fitted on. */
export const SURVEY_VEHICLE_NAMES: Partial<Record<TerrainVehicleClass, string>> = {
  surface: 'BlueBoat',
  underwater: 'BlueROV2',
}

// Sideways positions on the BlueBoat, from its public drawing: hull inner faces, keels and outer faces.
const BLUEBOAT_INNER_FACE_M = 0.28
const BLUEBOAT_KEEL_M = 0.37
const BLUEBOAT_OUTER_FACE_M = 0.45

const looking = (
  kind: SurveySensorGeometry['kind'],
  facing: SurveySensorGeometry['facing'],
  acrossDeg: number,
  extra: Partial<SurveySensorGeometry> = {}
): SurveySensorGeometry => ({ kind, facing, acrossDeg, verticalDeg: 0, tiltDeg: 0, offsetM: 0, ...extra })

const omniscanSideScan = (facing: 'port' | 'starboard' | 'both-sides'): SurveySensorMount => ({
  bracket: 'Omniscan 450 SS Integration Kit, on the outside of the hull and tilted 20° down',
  geometry: looking('sonar', facing, 50, {
    tiltDeg: 20,
    offsetM: { 'port': -BLUEBOAT_OUTER_FACE_M, 'starboard': BLUEBOAT_OUTER_FACE_M, 'both-sides': 0 }[facing],
  }),
  maxRangeM: 150,
})

/** Echo sounders sold for the BlueBoat and the BlueROV2, fitted with their own brackets. */
export const ECHO_SOUNDER_PRESETS: SurveySensorPreset[] = [
  {
    id: 'ping2',
    label: 'Ping2 echosounder',
    mounts: {
      surface: {
        bracket: 'Ping Integration Kit, inside the starboard hull, looking down',
        geometry: looking('sonar', 'down', 25, { offsetM: BLUEBOAT_INNER_FACE_M }),
        maxRangeM: 100,
      },
      underwater: {
        bracket: 'Included bracket under the frame, looking down',
        geometry: looking('sonar', 'down', 25),
        maxRangeM: 100,
      },
    },
  },
  {
    id: 'surveyor-240-16',
    label: 'Cerulean Surveyor 240-16 multibeam',
    mounts: {
      surface: {
        bracket: 'Surveyor Integration Kit, on the starboard hull, looking down',
        geometry: looking('sonar', 'down', 80, { offsetM: BLUEBOAT_INNER_FACE_M }),
        maxRangeM: 100,
      },
    },
  },
  {
    id: 'omniscan-450-ss-pair',
    label: 'Cerulean Omniscan 450 SS, pair',
    mounts: { surface: omniscanSideScan('both-sides') },
  },
  {
    id: 'omniscan-450-ss-starboard',
    label: 'Cerulean Omniscan 450 SS, starboard only',
    mounts: { surface: omniscanSideScan('starboard') },
  },
  {
    id: 'omniscan-450-ss-port',
    label: 'Cerulean Omniscan 450 SS, port only',
    mounts: { surface: omniscanSideScan('port') },
  },
  {
    id: 'omniscan-450-fs',
    label: 'Cerulean Omniscan 450 FS',
    mounts: {
      underwater: {
        bracket: 'Omniscan 450 FS bracket, looking forward and tilted 20° down',
        unsuitedReason: 'Its thin beam builds an image as the ROV turns, so it covers no strip along a survey line.',
      },
    },
  },
  {
    id: 'ping360',
    label: 'Ping360 scanning sonar',
    mounts: {
      underwater: {
        bracket: 'Side of the frame, scanning around the ROV',
        unsuitedReason:
          'It takes about half a minute per turn, so it maps from a hover rather than along survey lines.',
      },
    },
  },
  {
    id: 'sonoptix-echo-700',
    label: 'Sonoptix ECHO, 700 kHz',
    mounts: {
      underwater: {
        bracket: 'Roof Rack with the included bracket, looking forward and tilted 5° down',
        geometry: looking('sonar', 'forward', 120, { verticalDeg: 20, tiltDeg: 5 }),
        maxRangeM: 30,
      },
    },
  },
  {
    id: 'sonoptix-echo-400',
    label: 'Sonoptix ECHO, 400 kHz',
    mounts: {
      underwater: {
        bracket: 'Roof Rack with the included bracket, looking forward and tilted 5° down',
        geometry: looking('sonar', 'forward', 90, { verticalDeg: 20, tiltDeg: 5 }),
        maxRangeM: 200,
      },
    },
  },
]

/** Cameras sold for the BlueBoat and the BlueROV2, with their in-water view from their own brackets. */
export const IMAGING_SENSOR_PRESETS: SurveyCameraPreset[] = [
  {
    id: 'low-light-hd-camera',
    label: 'Low-Light HD USB Camera',
    imageWidthPx: 1920,
    mounts: {
      underwater: { bracket: 'Camera Tilt System, tilted straight down', geometry: looking('camera', 'down', 80) },
    },
  },
  {
    id: '4k-low-light-camera',
    label: '4K Cam Low-Light ROV Camera',
    imageWidthPx: 3840,
    mounts: {
      underwater: {
        bracket: 'Camera Tilt System at its 63° down limit',
        geometry: looking('camera', 'forward', 94, { verticalDeg: 62, tiltDeg: 63 }),
      },
    },
  },
  {
    id: 'explorehd',
    label: 'DWE exploreHD camera',
    imageWidthPx: 1920,
    mounts: {
      surface: {
        bracket: 'Hull mounting holes on the starboard keel, looking down',
        geometry: looking('camera', 'down', 82, { offsetM: BLUEBOAT_KEEL_M }),
      },
      underwater: { bracket: 'Included adjustable bracket, looking down', geometry: looking('camera', 'down', 82) },
    },
  },
  {
    id: 'marinesitu-c3',
    label: 'MarineSitu C3 stereo camera',
    imageWidthPx: 4056,
    mounts: {
      underwater: {
        bracket: 'Pivoting bracket on the bottom panel, looking down',
        geometry: looking('camera', 'down', 66.5),
      },
    },
  },
]

/**
 * The sensor a survey is spaced for, on one vehicle.
 */
export interface ResolvedSurveySensor {
  /**
   * Name shown to the user.
   */
  label: string
  /**
   * Where the sensor sits, for catalog sensors.
   */
  bracket?: string
  /**
   * What it sees, when it can cover a strip along a survey line.
   */
  geometry?: SurveySensorGeometry
  /**
   * Range used, in meters: the setting, within the sensor's maximum.
   */
  rangeM: number
  /**
   * Overlap the survey should keep between neighboring strips, in percent.
   */
  overlapPercent: number
  /**
   * Width of a camera's images, in pixels.
   */
  imageWidthPx?: number
  /**
   * Why the survey cannot be spaced for it, when it cannot.
   */
  unsuitedReason?: string
}

const resolvePreset = (
  preset: SurveySensorPreset,
  vehicleClass: TerrainVehicleClass,
  rangeM: number,
  overlapPercent: number,
  customLabel: string
): ResolvedSurveySensor => {
  const mount = preset.mounts[vehicleClass]
  if (!mount) {
    const vehicle = SURVEY_VEHICLE_NAMES[vehicleClass]
    const missing = vehicle ? `There is no ${vehicle} mount for it.` : 'It is made for the BlueBoat and the BlueROV2.'
    const unsuitedReason = `${missing} Pick another one or "${customLabel}" in the survey sensor settings.`
    return { label: preset.label, rangeM, overlapPercent, unsuitedReason }
  }
  const maxRangeM = 'geometry' in mount ? mount.maxRangeM ?? Infinity : Infinity
  return { ...mount, label: preset.label, rangeM: Math.min(rangeM, maxRangeM), overlapPercent }
}

/**
 * Finds what the selected echo sounder sees on a vehicle.
 * @param {TerrainSurveySensor} settings Selected echo sounder, its range and overlap.
 * @param {TerrainVehicleClass} vehicleClass Vehicle the mission is planned for.
 * @returns {ResolvedSurveySensor | null} The echo sounder, or why it cannot space a survey on that vehicle, or null
 *   when none is fitted.
 */
export const resolveEchoSounder = (
  settings: TerrainSurveySensor,
  vehicleClass: TerrainVehicleClass
): ResolvedSurveySensor | null => {
  if (settings.id === NO_SURVEY_SENSOR) return null
  const { rangeM, overlapPercent } = settings
  if (settings.id === CUSTOM_SURVEY_SENSOR) {
    const geometry: SurveySensorGeometry = { ...settings.custom, kind: 'sonar' }
    return { label: 'Custom echo sounder', geometry, rangeM, overlapPercent }
  }
  const preset = ECHO_SOUNDER_PRESETS.find((entry) => entry.id === settings.id) ?? ECHO_SOUNDER_PRESETS[0]
  return resolvePreset(preset, vehicleClass, rangeM, overlapPercent, 'Custom echo sounder')
}

// Light bends at a flat port, narrowing the view in water by the ratio of the refractive indices.
const WATER_REFRACTIVE_INDEX = 1.333

/**
 * Finds what the selected camera sees from a vehicle.
 * @param {TerrainSurveyCamera} camera Selected camera, its visibility and overlap.
 * @param {TerrainVehicleClass} vehicleClass Vehicle the mission is planned for.
 * @returns {ResolvedSurveySensor | null} The camera, or why it cannot space a survey on that vehicle, or null when
 *   none is fitted.
 */
export const resolveImagingSensor = (
  camera: TerrainSurveyCamera,
  vehicleClass: TerrainVehicleClass
): ResolvedSurveySensor | null => {
  if (camera.id === NO_SURVEY_SENSOR) return null
  const { visibilityM: rangeM, targetSideOverlapPercent: overlapPercent } = camera
  if (camera.id === CUSTOM_SURVEY_SENSOR) {
    const inWater = vehicleClass === 'surface' || vehicleClass === 'underwater'
    const halfTan = camera.sensorWidthMm / (2 * camera.focalLengthMm) / (inWater ? WATER_REFRACTIVE_INDEX : 1)
    const geometry = looking('camera', 'down', (2 * Math.atan(halfTan) * 180) / Math.PI)
    const range = inWater ? rangeM : Infinity
    return { label: 'Custom camera', geometry, rangeM: range, overlapPercent, imageWidthPx: camera.imageWidthPx }
  }
  const preset = IMAGING_SENSOR_PRESETS.find((entry) => entry.id === camera.id) ?? IMAGING_SENSOR_PRESETS[0]
  const resolved = resolvePreset(preset, vehicleClass, rangeM, overlapPercent, 'Custom camera')
  return { ...resolved, imageWidthPx: preset.imageWidthPx }
}

// Views flatter than this barely reach the bottom, so the footprint is capped there instead of at the horizon.
const MAX_VIEW_FROM_NADIR_DEG = 85
const toRad = (deg: number): number => (deg * Math.PI) / 180
const acrossAt = (heightM: number, fromNadirDeg: number): number =>
  heightM * Math.tan(toRad(Math.min(MAX_VIEW_FROM_NADIR_DEG, Math.max(0, fromNadirDeg))))

// Steps an edge ray is followed in across a sloping bottom, as a share of the height above it.
const EDGE_STEPS_PER_HEIGHT = 8
const MAX_EDGE_STEPS = 400
let coverageChecked = false

/**
 * Where a ray looking a given angle off the vertical reaches a bottom that rises and falls across the track, or
 * where the slant range runs out first.
 * @param {number} fromNadirDeg Ray angle from straight down, in degrees.
 * @param {number} side 1 to starboard, -1 to port.
 * @param {number} rangeM Farthest slant range, in meters.
 * @param {(acrossM: number) => number} heightAt Sensor height above the bottom at an across offset from it.
 * @returns {number} Distance across the track to the edge, in meters, never negative.
 */
const edgeOver = (
  fromNadirDeg: number,
  side: number,
  rangeM: number,
  heightAt: (acrossM: number) => number
): number => {
  const tan = Math.tan(toRad(Math.min(MAX_VIEW_FROM_NADIR_DEG, Math.max(0, fromNadirDeg))))
  // Positive once the ray has met the bottom, or the bottom is out of range or above the sensor.
  const past = (x: number): number => {
    const height = heightAt(side * x)
    return Math.max(x / tan - height, Math.hypot(x, height) - rangeM, -height)
  }
  if (tan === 0) return 0
  const step = Math.max(0.05, heightAt(0) / EDGE_STEPS_PER_HEIGHT)
  let x = 0
  let before = past(0)
  if (before >= 0) return 0
  for (let index = 0; index < MAX_EDGE_STEPS; index++) {
    const next = x + step
    const now = past(next)
    if (now >= 0) return x + (step * -before) / (now - before)
    x = next
    before = now
  }
  return x
}

/**
 * What a sensor covers of the bottom while running a straight line.
 * @param {SurveySensorGeometry} sensor The sensor.
 * @param {number} heightM Height of the sensor above the bottom under it, in meters.
 * @param {number} rangeM Farthest slant range it reads, in meters.
 * @param {(acrossM: number) => number} [heightAt] Sensor height above the bottom at an across offset from the sensor,
 *   positive to starboard, for a bottom sloping across the track: the view narrows uphill and widens downhill. Flat
 *   when left out.
 * @returns {[number, number][]} Covered stretches across the track, in meters from the vehicle centerline,
 *   positive to starboard; side scan leaves a gap under the vehicle between its two stretches.
 */
export const sensorCoverage = (
  sensor: SurveySensorGeometry,
  heightM: number,
  rangeM: number,
  heightAt?: (acrossM: number) => number
): [number, number][] => {
  checkSensorCoverageOnce()
  if (!(heightM > 0) || rangeM <= heightM) return []
  const reach = Math.sqrt(rangeM * rangeM - heightM * heightM)
  const shifted = (stretches: [number, number][]): [number, number][] =>
    stretches.filter(([from, to]) => to > from).map(([from, to]) => [from + sensor.offsetM, to + sensor.offsetM])
  const edge = (fromNadirDeg: number, side: number): number =>
    heightAt ? edgeOver(fromNadirDeg, side, rangeM, heightAt) : Math.min(reach, acrossAt(heightM, fromNadirDeg))

  if (sensor.facing === 'down') return shifted([[-edge(sensor.acrossDeg / 2, -1), edge(sensor.acrossDeg / 2, 1)]])
  if (sensor.facing === 'forward') {
    const nearSlant = heightM / Math.sin(toRad(Math.min(90, sensor.tiltDeg + sensor.verticalDeg / 2)))
    const farDepression = Math.max(90 - MAX_VIEW_FROM_NADIR_DEG, sensor.tiltDeg - sensor.verticalDeg / 2)
    const slant = Math.min(rangeM, heightM / Math.sin(toRad(farDepression)))
    if (slant <= nearSlant) return []
    // ponytail: the widest point of the fan stands in for the swept strip; a bottom that drops away ahead of the
    // vehicle is not followed.
    const halfAngle = toRad(Math.min(MAX_VIEW_FROM_NADIR_DEG, sensor.acrossDeg / 2))
    const half =
      sensor.kind === 'sonar'
        ? Math.sqrt(slant * slant - heightM * heightM) * Math.sin(halfAngle)
        : slant * Math.tan(halfAngle)
    return shifted([[-half, half]])
  }
  const nearDeg = 90 - (sensor.tiltDeg + sensor.acrossDeg / 2)
  const farDeg = 90 - (sensor.tiltDeg - sensor.acrossDeg / 2)
  const starboard: [number, number] = [edge(nearDeg, 1), edge(farDeg, 1)]
  const port: [number, number] = [-edge(farDeg, -1), -edge(nearDeg, -1)]
  return shifted(sensor.facing === 'starboard' ? [starboard] : sensor.facing === 'port' ? [port] : [port, starboard])
}

const checkSensorCoverageOnce = (): void => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (coverageChecked || !import.meta.env.DEV || typeof assert !== 'function') return
  coverageChecked = true
  const beam = looking('sonar', 'down', 90)
  const near = (a: number, b: number): boolean => Math.abs(a - b) < 0.01
  const [[flatPort, flatStarboard]] = sensorCoverage(beam, 10, 100, () => 10)
  assert(near(flatPort, -10) && near(flatStarboard, 10), 'A flat bottom gives the flat-bottom strip')
  const [[slopePort, slopeStarboard]] = sensorCoverage(beam, 10, 100, (acrossM) => 10 - 0.2 * acrossM)
  assert(near(slopePort, -12.5) && near(slopeStarboard, 25 / 3), 'A strip narrows uphill and widens downhill')
}
