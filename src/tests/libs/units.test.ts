import { expect, test } from 'vitest'

import {
  type DisplayUnitPreferences,
  convertValue,
  convertValueToRawUnit,
  DistanceDisplayUnit,
  formatDistance,
  isReadableUnit,
  SpeedDisplayUnit,
  TemperatureDisplayUnit,
  UnitSystem,
  unitSystemFromPreferences,
  unitSystems,
} from '@/libs/units'
import mavlinkDefinition from '@/libs/vehicle/mavlink/mavlink-definition'

const metric = unitSystems[UnitSystem.Metric]
const imperial = unitSystems[UnitSystem.Imperial]
const nautical = unitSystems[UnitSystem.Nautical]

test('convertValue scales the units MAVLink states but mathjs cannot parse', () => {
  expect(convertValue(-274678364, 'degE7', metric)).toEqual({ value: -27.4678364, unit: '°' })
  expect(convertValue(1000, 'm/s*5', metric).value).toBeCloseTo(200)
  expect(convertValue(2500, 'd%', metric)).toEqual({ value: 250, unit: '%' })
})

test('convertValue converts to the picked unit of each quantity', () => {
  expect(convertValue(10, 'm', imperial).value).toBeCloseTo(32.8084)
  expect(convertValue(10, 'm/s', nautical).value).toBeCloseTo(19.4384)
  expect(convertValue(10, 'm/s', imperial).value).toBeCloseTo(22.3694)
  expect(convertValue(2500, 'cdegC', imperial).value).toBeCloseTo(77)
  expect(convertValue(1013, 'hPa', imperial).value).toBeCloseTo(14.6924)
})

test('convertValue reads angles in degrees, which are not up to the user', () => {
  expect(convertValue(Math.PI, 'rad', metric).value).toBeCloseTo(180)
  expect(convertValue(4500, 'cdeg', imperial).value).toBeCloseTo(45)
  expect(convertValue(4500, 'cdeg', imperial).unit).toBe('°')
})

test('convertValue normalizes quantities the user has no say over', () => {
  // The reason the indicator presets carry hand-written multipliers today.
  expect(convertValue(1250, 'cA', metric)).toEqual({ value: 12.5, unit: 'A' })
  expect(convertValue(11500, 'mV', metric)).toEqual({ value: 11.5, unit: 'V' })
  expect(convertValue(2500, 'mAh', metric)).toEqual({ value: 2.5, unit: 'Ah' })
})

test('convertValue passes through what it cannot make sense of', () => {
  expect(convertValue(7, 'sats', metric)).toEqual({ value: 7, unit: 'sats' })
  expect(convertValue(7, undefined, metric)).toEqual({ value: 7, unit: '' })
  expect(convertValue(7, '', metric)).toEqual({ value: 7, unit: '' })

  // A preference stored before a quantity was offered says nothing about it.
  const preferencesWithoutSpeed = { ...metric, speed: undefined } as unknown as DisplayUnitPreferences
  expect(convertValue(10, 'cm/s', preferencesWithoutSpeed)).toEqual({ value: 10, unit: 'cm/s' })
})

test('unitSystemFromPreferences names the set of units in use', () => {
  expect(unitSystemFromPreferences(metric)).toBe(UnitSystem.Metric)
  expect(unitSystemFromPreferences(imperial)).toBe(UnitSystem.Imperial)
  expect(unitSystemFromPreferences(nautical)).toBe(UnitSystem.Nautical)

  // Kilometers per hour is no less metric than meters per second.
  expect(unitSystemFromPreferences({ ...metric, speed: SpeedDisplayUnit.KilometersPerHour })).toBe(UnitSystem.Metric)

  expect(unitSystemFromPreferences({ ...metric, distance: DistanceDisplayUnit.Feet })).toBe(UnitSystem.Custom)
  expect(unitSystemFromPreferences({ ...imperial, temperature: TemperatureDisplayUnit.Celsius })).toBe(
    UnitSystem.Custom
  )
})

test('isReadableUnit tells a unit we convert from one we can only pass through', () => {
  expect(isReadableUnit('cdegC')).toBe(true)
  expect(isReadableUnit('degE7')).toBe(true)
  expect(isReadableUnit('rpm')).toBe(true)

  // Spelling a unit out by hand mostly works, since mathjs takes 'celsius', 'meters/second' and
  // 'degrees', but these are the ones that quietly would not have converted.
  expect(isReadableUnit('metres')).toBe(false)
  expect(isReadableUnit('knots')).toBe(false)
  expect(isReadableUnit('percent')).toBe(false)
  expect(isReadableUnit('')).toBe(false)
})

test('convertValue reads the units Cockpit states on its own vehicle variables', () => {
  // The camera tilt, the Celsius 2 reading and the network latency. The latency is the one that has
  // to stay put: a time unit taken for a quantity we convert would read it in feet.
  expect(convertValue(45, 'deg', imperial)).toEqual({ value: 45, unit: '°' })
  expect(convertValue(25, 'degC', imperial).value).toBeCloseTo(77)
  expect(convertValue(12, 'ms', imperial)).toEqual({ value: 12, unit: 'ms' })
})

test('convertValueToRawUnit takes what the user set back to what the vehicle expects', () => {
  expect(convertValueToRawUnit(328.084, 'm', imperial)).toBeCloseTo(100)
  expect(convertValueToRawUnit(100, 'm', metric)).toBeCloseTo(100)

  // What a slider commanding an altitude in feet depends on: the round trip has to come back whole.
  expect(convertValueToRawUnit(convertValue(42, 'm', imperial).value, 'm', imperial)).toBeCloseTo(42)
})

test('convertValue keeps the offset of an affine conversion out of the scale factor', () => {
  // Reading the same pair twice is what the cached conversion factor gets wrong if the offset of a
  // temperature scale is folded into the slope.
  expect(convertValue(0, 'degC', imperial).value).toBeCloseTo(32)
  expect(convertValue(100, 'degC', imperial).value).toBeCloseTo(212)
  expect(convertValueToRawUnit(212, 'degC', imperial)).toBeCloseTo(100)
})

test('formatDistance moves up to the larger unit once the number grows', () => {
  expect(formatDistance(940, metric)).toBe('940 m')
  expect(formatDistance(2500, metric)).toBe('2.5 km')
  expect(formatDistance(1609.34, imperial)).toBe('5280 ft')
  expect(formatDistance(3218.68, imperial)).toBe('2.0 mi')
  expect(formatDistance(NaN, metric)).toBe('—')
})

test('the MAVLink definition still states the units we read them from', () => {
  expect(mavlinkDefinition.messageField('ATTITUDE', 'roll')?.units).toBe('rad')
  expect(mavlinkDefinition.messageField('GLOBAL_POSITION_INT', 'lat')?.units).toBe('degE7')
  expect(mavlinkDefinition.messageField('SCALED_PRESSURE2', 'temperature')?.units).toBe('cdegC')
})
