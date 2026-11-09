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
