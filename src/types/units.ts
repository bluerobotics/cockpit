/**
 * Possible distance units.
 * Meters is the default unit, from which all other units are converted.
 */
export enum DistanceDisplayUnit {
  Meters = 'meters',
  Feet = 'feet',
  NauticalMiles = 'nautical-miles',
}

/**
 * Unit system type
 */
export type UnitSystem = 'imperial' | 'metric' | 'nautical'

/** Unit system selector item for UI dropdowns */
export interface UnitSystemItem {
  /** Display name of the unit system */
  title: string
  /** Identifier of the unit system */
  value: UnitSystem
}

/**
 * Converted value with unit
 */
export interface ConvertedValue {
  /**
   * The converted numeric value
   */
  value: number
  /**
   * The unit abbreviation
   */
  unit: string
}
