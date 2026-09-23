import { createUnit, Unit, unit } from 'mathjs'

// Knots and nautical miles are what marine operators ask for and mathjs knows neither. Overriding keeps a hot
// module reload from throwing on the second definition.
createUnit('nmi', { definition: unit(1852, 'm') }, { override: true })
createUnit('knot', { definition: unit(1, 'nmi/h') }, { override: true })

/**
 * Possible distance units.
 * Meters is the default unit, from which all other units are converted.
 */
export enum DistanceDisplayUnit {
  Meters = 'meters',
  Feet = 'feet',
  NauticalMiles = 'nmi',
}

/**
 * Possible units for depths and altitudes, which are never long enough to read in nautical miles.
 */
export type HeightDisplayUnit = DistanceDisplayUnit.Meters | DistanceDisplayUnit.Feet

/**
 * Possible area units.
 */
export enum AreaDisplayUnit {
  SquareMeters = 'm^2',
  SquareFeet = 'ft^2',
  SquareNauticalMiles = 'nmi^2',
}

/**
 * Possible speed units.
 */
export enum SpeedDisplayUnit {
  MetersPerSecond = 'm/s',
  KilometersPerHour = 'km/h',
  Knots = 'knot',
  MilesPerHour = 'mi/h',
}

/**
 * Possible temperature units.
 */
export enum TemperatureDisplayUnit {
  Celsius = 'degC',
  Fahrenheit = 'degF',
}

/**
 * Possible pressure units.
 */
export enum PressureDisplayUnit {
  HectoPascal = 'hPa',
  KiloPascal = 'kPa',
  Bar = 'bar',
  Psi = 'psi',
}

/**
 * Units of the quantities the user has no say over, which are read the same way no matter what.
 */
export enum FixedDisplayUnit {
  Degrees = 'deg',
  Amperes = 'A',
  Volts = 'V',
}

export type DisplayUnit =
  | DistanceDisplayUnit
  | AreaDisplayUnit
  | SpeedDisplayUnit
  | TemperatureDisplayUnit
  | PressureDisplayUnit
  | FixedDisplayUnit

/**
 * Physical quantities Cockpit knows how to convert between units of.
 * Anything measuring something else is left in the unit it arrived in.
 */
export enum UnitQuantity {
  Distance = 'distance',
  Area = 'area',
  Speed = 'speed',
  Temperature = 'temperature',
  Pressure = 'pressure',
  Angle = 'angle',
  Current = 'current',
  Voltage = 'voltage',
}

/**
 * Sets of units that go together, offered as a single choice so the user does not have to pick one by one.
 * Custom is not a choice, but what we report when the picked units match no set.
 */
export enum UnitSystem {
  Metric = 'metric',
  Imperial = 'imperial',
  Nautical = 'nautical',
  Custom = 'custom',
}

/**
 * The units the user wants to read each quantity in.
 */
export interface DisplayUnitPreferences {
  /**
   * Unit for distances
   */
  distance: DistanceDisplayUnit
  /**
   * Unit for depths
   */
  depth: HeightDisplayUnit
  /**
   * Unit for altitudes and heights
   */
  altitude: HeightDisplayUnit
  /**
   * Unit for areas
   */
  area: AreaDisplayUnit
  /**
   * Unit for distances under a nautical mile, when distances are read in nautical miles
   */
  smallDistance: DistanceDisplayUnit
  /**
   * Unit for areas under a square nautical mile, when areas are read in square nautical miles
   */
  smallArea: AreaDisplayUnit
  /**
   * Unit for speeds
   */
  speed: SpeedDisplayUnit
  /**
   * Unit for temperatures
   */
  temperature: TemperatureDisplayUnit
  /**
   * Unit for pressures
   */
  pressure: PressureDisplayUnit
}

/**
 * How a unit is named and written, and which systems of units it belongs to.
 */
interface DisplayUnitInfo {
  /**
   * Name of the unit, as spelled out in the settings
   */
  prettyName: string
  /**
   * Symbol shown next to a value
   */
  abbreviation: string
  /**
   * Systems that read this quantity in this unit
   */
  systems: UnitSystem[]
}

const metricOrNautical = [UnitSystem.Metric, UnitSystem.Nautical]

const displayUnits: Record<DisplayUnit, DisplayUnitInfo> = {
  [DistanceDisplayUnit.Meters]: { prettyName: 'Meters', abbreviation: 'm', systems: metricOrNautical },
  [DistanceDisplayUnit.Feet]: { prettyName: 'Feet', abbreviation: 'ft', systems: [UnitSystem.Imperial] },
  [DistanceDisplayUnit.NauticalMiles]: {
    prettyName: 'Nautical miles',
    abbreviation: 'nmi',
    systems: [UnitSystem.Nautical],
  },
  [AreaDisplayUnit.SquareMeters]: { prettyName: 'Square meters', abbreviation: 'm²', systems: [UnitSystem.Metric] },
  [AreaDisplayUnit.SquareFeet]: { prettyName: 'Square feet', abbreviation: 'ft²', systems: [UnitSystem.Imperial] },
  [AreaDisplayUnit.SquareNauticalMiles]: {
    prettyName: 'Square nautical miles',
    abbreviation: 'nmi²',
    systems: [UnitSystem.Nautical],
  },
  [SpeedDisplayUnit.MetersPerSecond]: {
    prettyName: 'Meters per second',
    abbreviation: 'm/s',
    systems: [UnitSystem.Metric],
  },
  [SpeedDisplayUnit.KilometersPerHour]: {
    prettyName: 'Kilometers per hour',
    abbreviation: 'km/h',
    systems: [UnitSystem.Metric],
  },
  [SpeedDisplayUnit.Knots]: { prettyName: 'Knots', abbreviation: 'kn', systems: [UnitSystem.Nautical] },
  [SpeedDisplayUnit.MilesPerHour]: {
    prettyName: 'Miles per hour',
    abbreviation: 'mph',
    systems: [UnitSystem.Imperial],
  },
  [TemperatureDisplayUnit.Celsius]: { prettyName: 'Celsius', abbreviation: '°C', systems: metricOrNautical },
  [TemperatureDisplayUnit.Fahrenheit]: { prettyName: 'Fahrenheit', abbreviation: '°F', systems: [UnitSystem.Imperial] },
  [PressureDisplayUnit.HectoPascal]: { prettyName: 'Hectopascal', abbreviation: 'hPa', systems: metricOrNautical },
  [PressureDisplayUnit.KiloPascal]: { prettyName: 'Kilopascal', abbreviation: 'kPa', systems: metricOrNautical },
  [PressureDisplayUnit.Bar]: { prettyName: 'Bar', abbreviation: 'bar', systems: metricOrNautical },
  [PressureDisplayUnit.Psi]: { prettyName: 'PSI', abbreviation: 'psi', systems: [UnitSystem.Imperial] },
  [FixedDisplayUnit.Degrees]: { prettyName: 'Degrees', abbreviation: '°', systems: [] },
  [FixedDisplayUnit.Amperes]: { prettyName: 'Amperes', abbreviation: 'A', systems: [] },
  [FixedDisplayUnit.Volts]: { prettyName: 'Volts', abbreviation: 'V', systems: [] },
}

export const unitPrettyName = Object.fromEntries(
  Object.entries(displayUnits).map(([unitName, info]) => [unitName, info.prettyName])
) as Record<DisplayUnit, string>

export const unitAbbreviation = Object.fromEntries(
  Object.entries(displayUnits).map(([unitName, info]) => [unitName, info.abbreviation])
) as Record<DisplayUnit, string>

export const unitSystems: Record<Exclude<UnitSystem, UnitSystem.Custom>, DisplayUnitPreferences> = {
  [UnitSystem.Metric]: {
    distance: DistanceDisplayUnit.Meters,
    depth: DistanceDisplayUnit.Meters,
    altitude: DistanceDisplayUnit.Meters,
    area: AreaDisplayUnit.SquareMeters,
    smallDistance: DistanceDisplayUnit.Meters,
    smallArea: AreaDisplayUnit.SquareMeters,
    speed: SpeedDisplayUnit.MetersPerSecond,
    temperature: TemperatureDisplayUnit.Celsius,
    pressure: PressureDisplayUnit.HectoPascal,
  },
  [UnitSystem.Imperial]: {
    distance: DistanceDisplayUnit.Feet,
    depth: DistanceDisplayUnit.Feet,
    altitude: DistanceDisplayUnit.Feet,
    area: AreaDisplayUnit.SquareFeet,
    smallDistance: DistanceDisplayUnit.Feet,
    smallArea: AreaDisplayUnit.SquareFeet,
    speed: SpeedDisplayUnit.MilesPerHour,
    temperature: TemperatureDisplayUnit.Fahrenheit,
    pressure: PressureDisplayUnit.Psi,
  },
  [UnitSystem.Nautical]: {
    distance: DistanceDisplayUnit.NauticalMiles,
    depth: DistanceDisplayUnit.Meters,
    altitude: DistanceDisplayUnit.Meters,
    area: AreaDisplayUnit.SquareNauticalMiles,
    smallDistance: DistanceDisplayUnit.Meters,
    smallArea: AreaDisplayUnit.SquareMeters,
    speed: SpeedDisplayUnit.Knots,
    temperature: TemperatureDisplayUnit.Celsius,
    pressure: PressureDisplayUnit.HectoPascal,
  },
}

/**
 * Names the set of units the user is reading, for whoever wants to branch on metric versus imperial.
 * @param {DisplayUnitPreferences} preferences The units picked for each quantity
 * @returns {UnitSystem} The system all the picked units belong to, or custom when they belong to none
 */
export const unitSystemFromPreferences = (preferences: DisplayUnitPreferences): UnitSystem => {
  // The units for small quantities only apply under nautical miles, so they say nothing about the system in use.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { smallDistance, smallArea, ...mainUnits } = preferences
  const pickedUnits = Object.values(mainUnits) as DisplayUnit[]
  const pickedSystems = pickedUnits.map((pickedUnit) => displayUnits[pickedUnit]?.systems ?? [])
  const shared = Object.values(UnitSystem).filter((system) => pickedSystems.every((list) => list.includes(system)))
  return shared[0] ?? UnitSystem.Custom
}

/**
 * Reads preferences stored when one distance setting also covered depths and altitudes, so whoever read those in
 * feet keeps reading them in feet.
 * @param {Partial<DisplayUnitPreferences>} stored The preferences as they were stored
 * @returns {Partial<DisplayUnitPreferences>} The same preferences, with depth and altitude following the distance
 */
export const preferencesFromSingleDistance = (
  stored: Partial<DisplayUnitPreferences>
): Partial<DisplayUnitPreferences> => {
  if (stored.distance === undefined) return stored
  const height = stored.distance === DistanceDisplayUnit.Feet ? DistanceDisplayUnit.Feet : DistanceDisplayUnit.Meters
  return { ...stored, depth: height, altitude: height }
}

/**
 * What a length measures when it is not an ordinary distance, and so is read in a unit of its own.
 */
export type LengthReading = 'depth' | 'altitude'

/**
 * Reads lengths as depths or altitudes, which the user picks a unit for apart from other distances.
 * @param {DisplayUnitPreferences} preferences The units picked for each quantity
 * @param {LengthReading} reading What the lengths measure
 * @returns {DisplayUnitPreferences} The same preferences, with distances read in the unit picked for that reading
 */
export const readingLengthsAs = (
  preferences: DisplayUnitPreferences,
  reading: LengthReading
): DisplayUnitPreferences => ({ ...preferences, distance: preferences[reading] })

/**
 * What a unit string means, once we know how to read it.
 */
interface UnitDefinition {
  /**
   * Unit the value means once scaled, which mathjs can parse only when the quantity is convertible
   */
  canonical: string
  /**
   * What the raw value is multiplied by to reach the canonical unit
   */
  scale: number
}

// The MAVLink unit strings mathjs cannot parse.
const rawUnitOverrides: Record<string, UnitDefinition> = {
  '%': { canonical: '%', scale: 1 },
  'Ah': { canonical: 'Ah', scale: 1 },
  'c%': { canonical: '%', scale: 0.01 },
  'd%': { canonical: '%', scale: 0.1 },
  'dB': { canonical: 'dB', scale: 1 },
  'deg/2': { canonical: 'deg', scale: 2 },
  'degE5': { canonical: 'deg', scale: 1e-5 },
  'degE7': { canonical: 'deg', scale: 1e-7 },
  'dpix': { canonical: 'pix', scale: 0.1 },
  'gauss': { canonical: 'gauss', scale: 1 },
  'm/s*5': { canonical: 'm/s', scale: 0.2 },
  'mAh': { canonical: 'Ah', scale: 0.001 },
  'mG': { canonical: 'gauss', scale: 0.001 },
  'mgauss': { canonical: 'gauss', scale: 0.001 },
  'pix': { canonical: 'pix', scale: 1 },
  'rpm': { canonical: 'rpm', scale: 1 },
}

const quantityReferenceUnits: Record<UnitQuantity, string> = {
  [UnitQuantity.Distance]: 'm',
  [UnitQuantity.Area]: 'm^2',
  [UnitQuantity.Speed]: 'm/s',
  [UnitQuantity.Temperature]: 'degC',
  [UnitQuantity.Pressure]: 'Pa',
  [UnitQuantity.Angle]: 'rad',
  [UnitQuantity.Current]: 'A',
  [UnitQuantity.Voltage]: 'V',
}

const fixedQuantityUnits: Record<UnitQuantity.Angle | UnitQuantity.Current | UnitQuantity.Voltage, FixedDisplayUnit> = {
  [UnitQuantity.Angle]: FixedDisplayUnit.Degrees,
  [UnitQuantity.Current]: FixedDisplayUnit.Amperes,
  [UnitQuantity.Voltage]: FixedDisplayUnit.Volts,
}

const parseUnit = (unitName: string): Unit | undefined => {
  try {
    return unit(1, unitName)
  } catch {
    return undefined
  }
}

/**
 * A unit string we made sense of, and what it takes to read a value carrying it.
 */
interface ResolvedUnit extends UnitDefinition {
  /**
   * Quantity the unit measures, or undefined when it measures nothing we convert
   */
  quantity: UnitQuantity | undefined
}

const resolvedUnitsCache = new Map<string, ResolvedUnit | undefined>()

/**
 * Works out what a raw unit means, so a value carrying it can be scaled and converted.
 * mathjs already understands most of what MAVLink states, prefixes included, and the override table
 * covers the rest.
 * @param {string} rawUnit The unit the value is stored in, as MAVLink states it
 * @returns {ResolvedUnit | undefined} The unit to scale into and the quantity it measures, or undefined if unknown
 */
const resolveUnit = (rawUnit: string): ResolvedUnit | undefined => {
  if (resolvedUnitsCache.has(rawUnit)) return resolvedUnitsCache.get(rawUnit)

  const override = rawUnitOverrides[rawUnit]
  const canonical = override?.canonical ?? rawUnit
  const parsed = parseUnit(canonical)

  let resolved: ResolvedUnit | undefined
  if (override !== undefined || parsed !== undefined) {
    const quantity = Object.values(UnitQuantity).find((candidate) => {
      return parsed?.equalBase(unit(1, quantityReferenceUnits[candidate]))
    })
    resolved = { canonical, scale: override?.scale ?? 1, quantity }
  }

  resolvedUnitsCache.set(rawUnit, resolved)
  return resolved
}

/**
 * Whether a unit string is one Cockpit can read, and so scale and convert values carrying it.
 * A unit it cannot read is not an error — the value is shown exactly as it arrived — but whoever
 * typed it in deserves to know that is what they are getting.
 * @param {string} rawUnit The unit as it was typed in, or as MAVLink states it
 * @returns {boolean} True when values carrying this unit are converted rather than passed through
 */
export const isReadableUnit = (rawUnit: string): boolean => resolveUnit(rawUnit) !== undefined

/**
 * A conversion between two units, reduced to the arithmetic that applies it.
 */
interface AffineConversion {
  /**
   * What the value is multiplied by
   */
  slope: number
  /**
   * What is added after scaling, non-zero only for the temperature scales
   */
  offset: number
}

const conversionsCache = new Map<string, AffineConversion>()

// mathjs parses both unit strings on every conversion, which the display loops redoing this per
// marker per frame cannot afford. Its conversions are affine, so two of them give the slope and
// offset every later call multiplies by instead.
const convertBetween = (value: number, from: string, to: string): number => {
  const key = `${from}>${to}`
  let conversion = conversionsCache.get(key)

  if (conversion === undefined) {
    const offset = unit(0, from).to(to).toJSON().value
    conversion = { slope: unit(1, from).to(to).toJSON().value - offset, offset }
    conversionsCache.set(key, conversion)
  }

  return value * conversion.slope + conversion.offset
}

const preferredUnit = (quantity: UnitQuantity, preferences: DisplayUnitPreferences): DisplayUnit | undefined => {
  const fixed = fixedQuantityUnits[quantity as keyof typeof fixedQuantityUnits]
  return fixed ?? preferences[quantity as keyof DisplayUnitPreferences]
}

/**
 * A value ready to be shown to the user, next to the unit it is now in.
 */
export interface ConvertedValue {
  /**
   * The value in the unit it is to be read in
   */
  value: number
  /**
   * Symbol to show next to the value
   */
  unit: string
}

/**
 * Converts a raw value into the unit the user wants to read it in.
 * Values with a unit of a quantity the user has no say over are still normalized, so a raw `cA`
 * reads as amperes, and values whose unit we cannot make sense of are passed through untouched.
 * @param {number} value The value as it was received
 * @param {string | undefined} rawUnit The unit the value is stored in, as MAVLink states it
 * @param {DisplayUnitPreferences} preferences The units picked for each quantity
 * @returns {ConvertedValue} The converted value and the unit to show next to it
 */
export const convertValue = (
  value: number,
  rawUnit: string | undefined,
  preferences: DisplayUnitPreferences
): ConvertedValue => {
  const resolved = rawUnit === undefined ? undefined : resolveUnit(rawUnit)
  if (resolved === undefined) return { value, unit: rawUnit ?? '' }

  const scaled = value * resolved.scale
  if (resolved.quantity === undefined) return { value: scaled, unit: resolved.canonical }

  // A preference that predates a quantity says nothing about it, and reading the value in the unit
  // it was sent in beats refusing to show it at all.
  const target = preferredUnit(resolved.quantity, preferences)
  if (target === undefined) return { value: scaled, unit: resolved.canonical }

  return { value: convertBetween(scaled, resolved.canonical, target), unit: unitAbbreviation[target] }
}

/**
 * Turns a value the user set in the unit they read back into the unit whoever consumes it expects.
 * The inverse of {@link convertValue}, for the inputs that command the vehicle, which have to be
 * sent in the unit the vehicle works in no matter what the user is reading.
 * @param {number} value The value as the user set it
 * @param {string} rawUnit The unit the value has to end up in
 * @param {DisplayUnitPreferences} preferences The units picked for each quantity
 * @returns {number} The value in the raw unit
 */
export const convertValueToRawUnit = (value: number, rawUnit: string, preferences: DisplayUnitPreferences): number => {
  const resolved = resolveUnit(rawUnit)
  if (resolved?.quantity === undefined) return value

  const source = preferredUnit(resolved.quantity, preferences)
  if (source === undefined) return value

  return convertBetween(value, source, resolved.canonical) / resolved.scale
}

const largerDistanceUnits: Record<HeightDisplayUnit, string> = {
  [DistanceDisplayUnit.Meters]: 'km',
  [DistanceDisplayUnit.Feet]: 'mi',
}

/**
 * The unit a quantity is read in while small, and the one it moves up to once it grows.
 */
interface UnitSteps {
  /**
   * Unit a value smaller than one of the larger unit is read in
   */
  small: DisplayUnit
  /**
   * Unit a value is read in from one of it upward
   */
  large: string
}

// Nautical miles are the larger unit themselves, and step down to whichever unit was picked for distances under one.
const distanceSteps = (preferences: DisplayUnitPreferences): UnitSteps => {
  if (preferences.distance === DistanceDisplayUnit.NauticalMiles) {
    return { small: preferences.smallDistance, large: 'nmi' }
  }
  return { small: preferences.distance, large: largerDistanceUnits[preferences.distance] }
}

/**
 * Writes a distance out the way it is read, moving up to kilometers, miles or nautical miles once the number grows.
 * @param {number} meters The distance in meters
 * @param {DisplayUnitPreferences} preferences The units picked for each quantity
 * @returns {string} The distance and its unit, ready to be shown, or a dash when there is none
 */
export const formatDistance = (meters: number, preferences: DisplayUnitPreferences): string => {
  if (!isFinite(meters)) return '—'

  const { small, large } = distanceSteps(preferences)
  const inLarge = convertBetween(meters, 'm', large)
  if (Math.abs(inLarge) >= 1) return `${inLarge.toFixed(1)} ${large}`
  // Nautical miles picked for distances under one keep them in nautical miles throughout.
  if (small === DistanceDisplayUnit.NauticalMiles) return `${inLarge.toFixed(2)} ${large}`
  return `${Math.round(convertBetween(meters, 'm', small))} ${unitAbbreviation[small]}`
}

const largerAreaUnits: Record<AreaDisplayUnit.SquareMeters | AreaDisplayUnit.SquareFeet, string> = {
  [AreaDisplayUnit.SquareMeters]: 'km^2',
  [AreaDisplayUnit.SquareFeet]: 'acre',
}

const largerAreaUnitAbbreviation: Record<string, string> = {
  'km^2': 'km²',
  'acre': 'acres',
  'nmi^2': 'nmi²',
}

// Square nautical miles are the larger unit themselves, and step down to whichever unit was picked for areas under one.
const areaSteps = (preferences: DisplayUnitPreferences): UnitSteps => {
  if (preferences.area === AreaDisplayUnit.SquareNauticalMiles) return { small: preferences.smallArea, large: 'nmi^2' }
  return { small: preferences.area, large: largerAreaUnits[preferences.area] }
}

/**
 * Writes an area out the way it is read, moving up to square kilometers, acres or square nautical miles once the
 * number grows.
 * @param {number} squareMeters The area in square meters
 * @param {DisplayUnitPreferences} preferences The units picked for each quantity
 * @returns {string} The area and its unit, ready to be shown, or a dash when there is none
 */
export const formatArea = (squareMeters: number, preferences: DisplayUnitPreferences): string => {
  if (squareMeters <= 0 || !isFinite(squareMeters)) return '—'

  const { small, large } = areaSteps(preferences)
  const inLarge = convertBetween(squareMeters, 'm^2', large)
  if (Math.abs(inLarge) >= 1 || small === AreaDisplayUnit.SquareNauticalMiles) {
    return `${inLarge.toFixed(3)} ${largerAreaUnitAbbreviation[large]}`
  }
  // Up to a whole square kilometer the count runs to six digits, which only reads with its thousands grouped.
  const inSmall = Math.round(convertBetween(squareMeters, 'm^2', small))
  return `${inSmall.toLocaleString('en-US')} ${unitAbbreviation[small]}`
}

/**
 * Writes a value out the way it is read, in the unit the user picked for it.
 * @param {number} value The value as it was received
 * @param {string | undefined} rawUnit The unit the value is stored in, as MAVLink states it
 * @param {DisplayUnitPreferences} preferences The units picked for each quantity
 * @param {number} decimals How many decimal places to keep
 * @returns {string} The value and its unit, ready to be shown
 */
export const formatValueWithUnit = (
  value: number,
  rawUnit: string | undefined,
  preferences: DisplayUnitPreferences,
  decimals = 1
): string => {
  const converted = convertValue(value, rawUnit, preferences)
  return `${converted.value.toFixed(decimals)} ${converted.unit}`.trim()
}
