/**
 * Possible distance units.
 * Meters is the default unit, from which all other units are converted.
 */
export enum DistanceDisplayUnit {
  Meters = 'meters',
  Feet = 'feet',
}

export const unitPrettyName = {
  [DistanceDisplayUnit.Meters]: 'Meters',
  [DistanceDisplayUnit.Feet]: 'Feet',
}

export const unitAbbreviation = {
  [DistanceDisplayUnit.Meters]: 'm',
  [DistanceDisplayUnit.Feet]: 'ft',
}
