import { expect, test } from 'vitest'

import {
  type DisplayUnitPreferences,
  convertValue,
  DistanceDisplayUnit,
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

test('the MAVLink definition still states the units we read them from', () => {
  expect(mavlinkDefinition.messageField('ATTITUDE', 'roll')?.units).toBe('rad')
  expect(mavlinkDefinition.messageField('GLOBAL_POSITION_INT', 'lat')?.units).toBe('degE7')
  expect(mavlinkDefinition.messageField('SCALED_PRESSURE2', 'temperature')?.units).toBe('cdegC')
})
