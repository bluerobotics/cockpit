import { unit } from 'mathjs'

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

/**
 * Formats a distance value (in meters) for display in the user's preferred unit, automatically
 * promoting to a larger unit (km / mi) once the value crosses the conventional threshold.
 * @param {number} meters - The distance to format, expressed in meters
 * @param {DistanceDisplayUnit} displayUnit - The user's preferred display unit
 * @returns {string} A localized string such as `"312.5 m"`, `"1.23 km"`, `"850 ft"` or `"2.41 mi"`
 */
export const formatDistance = (meters: number, displayUnit: DistanceDisplayUnit): string => {
  const distance = unit(meters, 'm')
  if (displayUnit === DistanceDisplayUnit.Feet) {
    const miles = distance.toNumber('mi')
    if (miles >= 1) return `${miles.toFixed(2)} mi`
    return `${distance.toNumber('ft').toFixed(0)} ${unitAbbreviation[DistanceDisplayUnit.Feet]}`
  }
  const kilometers = distance.toNumber('km')
  if (kilometers >= 1) return `${kilometers.toFixed(2)} km`
  return `${meters.toFixed(1)} ${unitAbbreviation[DistanceDisplayUnit.Meters]}`
}
