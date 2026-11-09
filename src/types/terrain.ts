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
}
