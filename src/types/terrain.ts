import type { VehicleFileMeta } from '@/composables/useVehicleFileStorage'
import type { TerrainVehicleClass } from '@/libs/terrain/mission-profile'
import type { GeoBbox } from '@/types/general'
import type { WaypointCoordinates } from '@/types/mission'

/**
 * A measured terrain dataset kept in the mission library, as the library lists it without reading the file.
 * The file itself holds the measurements; the id is the key it is stored under, so it is not repeated here.
 */
export interface TerrainDatasetMeta extends VehicleFileMeta {
  /**
   * What the operator called the dataset.
   */
  name: string
  /**
   * Mission the measurements were taken over, when they came from one.
   */
  missionName?: string
  /**
   * Id of that mission in the library, so its card can show the measurements are there.
   */
  missionId?: string
  /**
   * How many measured cells the file holds.
   */
  pointCount: number
  /**
   * Area the measurements cover.
   */
  bounds: GeoBbox
  /**
   * Lowest measured height, meters above sea level.
   */
  minHeightM: number
  /**
   * Highest measured height, meters above sea level.
   */
  maxHeightM: number
  /**
   * How the vehicle met the terrain, which is what decides whether the dataset reads as depths or heights.
   */
  vehicleClass: TerrainVehicleClass
  /**
   * Median difference from the internet model, positive where the real ground is higher, null with nothing
   * to compare against.
   */
  modelOffsetM: number | null
}

/**
 * Elevation models Cockpit can read the ground from.
 */
export type TerrainSourceId = 'tilezen' | 'copernicus' | 'custom'

/**
 * Models the depths under water can be read from, `auto` for the most detailed one in each area, or `none` for
 * the terrain source's own.
 */
export type BathymetrySourceId =
  | 'auto'
  | 'chs'
  | 'noaa'
  | 'emodnet'
  | 'ausseabed'
  | 'gmrt'
  | 'gebco'
  | 'tilezen'
  | 'none'

/**
 * How a sample is read from the four model points surrounding it.
 */
export type TerrainSampleMode = 'nearest' | 'bilinear' | 'highest'

/**
 * A person or antenna the mission is watched or flown from.
 */
export type TerrainObserver = {
  /**
   * Position as [latitude, longitude].
   */
  position: WaypointCoordinates
  /**
   * Eye or antenna height above the ground, in meters.
   */
  heightAboveGroundM: number
}

/**
 * Camera used by a photo survey, for ground sample distance and overlap.
 */
export type TerrainSurveyCamera = {
  /**
   * Camera from the catalog, or `custom` for the one described by the sensor, lens and image width.
   */
  id: string
  /**
   * Sensor width of the custom camera, in millimeters.
   */
  sensorWidthMm: number
  /**
   * Lens focal length of the custom camera, in millimeters.
   */
  focalLengthMm: number
  /**
   * Image width of the custom camera, in pixels.
   */
  imageWidthPx: number
  /**
   * Side overlap the survey should keep between neighboring lines, in percent.
   */
  targetSideOverlapPercent: number
  /**
   * How far the camera sees through the water, in meters.
   */
  visibilityM: number
}

/**
 * Which way a survey sensor looks from the vehicle.
 */
export type SurveySensorFacing = 'down' | 'forward' | 'port' | 'starboard' | 'both-sides'

/**
 * How a survey sensor sits on the vehicle and what it sees of the bottom.
 */
export type SurveySensorGeometry = {
  /**
   * Sonars see a fan of slant ranges, cameras a rectilinear image.
   */
  kind: 'sonar' | 'camera'
  /**
   * Which way the sensor looks.
   */
  facing: SurveySensorFacing
  /**
   * Beam width across the track, in degrees: the full fan for down and forward, the beam height for the sides.
   */
  acrossDeg: number
  /**
   * Vertical beam of a forward-looking sensor, in degrees.
   */
  verticalDeg: number
  /**
   * Tilt of the beam center below the horizon, in degrees, for forward and side looking sensors.
   */
  tiltDeg: number
  /**
   * Sideways offset of the sensor from the vehicle centerline, in meters, positive to starboard.
   */
  offsetM: number
}

/**
 * Sensor a marine survey is spaced for.
 */
export type TerrainSurveySensor = {
  /**
   * Sensor from the catalog, or `custom` for the one described by {@link custom}.
   */
  id: string
  /**
   * Geometry of the custom echo sounder.
   */
  custom: Omit<SurveySensorGeometry, 'kind'>
  /**
   * Range the sonar is set to, in meters.
   */
  rangeM: number
  /**
   * Overlap the survey should keep between neighboring swaths, in percent.
   */
  overlapPercent: number
}

/**
 * Terrain database and terrain-aware planning settings.
 */
export type TerrainSettings = {
  /**
   * Elevation model to read the ground from.
   */
  sourceId: TerrainSourceId
  /**
   * Model the depths are read from wherever the terrain source reads sea level or below.
   */
  bathymetrySourceId: BathymetrySourceId
  /**
   * Terrarium-encoded tile URL template with `{z}`, `{x}` and `{y}`, for the custom source.
   */
  customUrlTemplate: string
  /**
   * Deepest zoom the custom source publishes.
   */
  customMaxZoom: number
  /**
   * Height above the ground an aircraft must keep along the whole path, in meters.
   */
  minimumClearanceM: number
  /**
   * Water a vessel must keep under its keel along the whole path, in meters.
   */
  minimumUnderKeelM: number
  /**
   * Depth of the hull below the waterline, in meters.
   */
  vesselDraftM: number
  /**
   * Water level relative to the model's sea level, in meters, for tides and lakes.
   */
  waterLevelOffsetM: number
  /**
   * Tide station the predictions are read from, as the tide service's `source/id`, or empty for the one nearest the
   * mission.
   */
  tideStationId: string
  /**
   * Expected difference between high and low tide, in meters, outlined on the profile while no tide predictions are loaded.
   */
  tideRangeM: number
  /**
   * Whether the mission is checked against the terrain before upload, asking to confirm when anything is found.
   */
  checkTerrainOnUpload: boolean
  /**
   * Whether terrain-following waypoints are converted to sea-level altitudes at upload.
   */
  resolveTerrainOnUpload: boolean
  /**
   * How far a resolved terrain-following path may stray from the requested height, in meters.
   */
  terrainFollowToleranceM: number
  /**
   * Whether region-of-interest commands left at zero altitude are aimed at the ground at upload.
   */
  aimRoiAtGround: boolean
  /**
   * Whether Cockpit answers the vehicle's terrain data requests.
   */
  serveTerrainToVehicle: boolean
  /**
   * Whether measured terrain is in use at all; off, nothing is recorded or used, and what was recorded is kept.
   */
  measuredTerrainEnabled: boolean
  /**
   * Whether rangefinder and sonar readings are recorded as measured terrain.
   */
  recordMeasuredTerrain: boolean
  /**
   * Whether recorded measurements replace the model where they exist.
   */
  useMeasuredTerrain: boolean
  /**
   * Camera used to judge photo survey resolution and overlap, and that marine surveys can be re-spaced for.
   */
  camera: TerrainSurveyCamera
  /**
   * Echo sounder marine surveys can be re-spaced for.
   */
  surveySensor: TerrainSurveySensor
  /**
   * Radio link frequency, in megahertz, for the line of sight check.
   */
  radioFrequencyMhz: number
  /**
   * People watching the vehicle, for the visual line of sight surface.
   */
  visualObservers: TerrainObserver[]
  /**
   * Farthest an observer is expected to see the vehicle, in meters.
   */
  visualRangeM: number
  /**
   * Cloud base above the observers, in meters, above which the vehicle is out of sight; 0 for clear sky.
   */
  cloudBaseM: number
}
