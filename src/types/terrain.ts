import type { WaypointCoordinates } from '@/types/mission'

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
   * Expected difference between high and low tide, in meters, outlined on the profile.
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
