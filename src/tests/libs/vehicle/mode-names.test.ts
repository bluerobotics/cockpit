import { expect, test } from 'vitest'

import { defaultFlightModeNames, flightModeName } from '@/libs/vehicle/ardupilot/mode-names'
import { CopterMode, PlaneMode, RoverMode, SubMode } from '@/libs/vehicle/ardupilot/types/modes'
import { Type as VehicleType } from '@/libs/vehicle/vehicle'

const modeEnums = {
  [VehicleType.Sub]: SubMode,
  [VehicleType.Rover]: RoverMode,
  [VehicleType.Copter]: CopterMode,
  [VehicleType.Plane]: PlaneMode,
}

test('every supported mode has a default name, and every default name belongs to a mode', () => {
  Object.entries(modeEnums).forEach(([vehicleType, modeEnum]) => {
    // PRE_FLIGHT is a Cockpit internal state, so it is never shown to the user.
    const vehicleModes = Object.keys(modeEnum)
      .filter((key) => isNaN(Number(key)))
      .filter((key) => key !== 'PRE_FLIGHT')

    const namedModes = Object.keys(defaultFlightModeNames[vehicleType as VehicleType] ?? {})
    expect(namedModes.sort()).toEqual(vehicleModes.sort())
  })
})

test('flightModeName', () => {
  expect(flightModeName('ALT_HOLD', VehicleType.Sub)).toBe('Depth Hold')
  expect(flightModeName('alt_hold', VehicleType.Sub)).toBe('Depth Hold')
  expect(flightModeName('ALT_HOLD', VehicleType.Copter)).toBe('Altitude Hold')

  const customNames = { [VehicleType.Sub]: { ALT_HOLD: 'Hold Depth' } }
  expect(flightModeName('ALT_HOLD', VehicleType.Sub, customNames)).toBe('Hold Depth')
  expect(flightModeName('SURFTRAK', VehicleType.Sub, customNames)).toBe('Surface Track')

  // Modes and vehicles we know no name for keep the name the vehicle reported.
  expect(flightModeName('SOME_NEW_MODE', VehicleType.Sub)).toBe('SOME_NEW_MODE')
  expect(flightModeName('MANUAL', VehicleType.Blimp)).toBe('MANUAL')
  expect(flightModeName('MANUAL')).toBe('MANUAL')
})
