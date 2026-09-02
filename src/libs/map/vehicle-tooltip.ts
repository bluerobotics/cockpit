import { type DisplayUnitPreferences, formatValueWithUnit } from '@/libs/units'
import type { WaypointCoordinates } from '@/types/mission'

/** What the vehicle marker reads back, as the map that draws it resolved each part. */
export interface VehicleTooltipState {
  /** Where the vehicle is, or undefined while no position has arrived. */
  coordinates?: WaypointCoordinates
  /** Speed over ground in m/s, or undefined when the vehicle does not report one. */
  groundVelocityInMetersPerSecond?: number
  /** Heading in degrees clockwise from north. */
  headingInDegrees: number
  /** Whether the vehicle is armed. */
  isArmed: boolean
  /** How long ago the last heartbeat arrived, already written out. */
  timeAgoSeenText: string
}

/**
 * Writes the vehicle marker's tooltip, in the units the user picked. Both maps draw the same marker, so they read
 * it back through here rather than each building the same block and drifting apart on which units it states.
 * @param {VehicleTooltipState} state - What the map knows about the vehicle
 * @param {DisplayUnitPreferences} preferences - The units picked for each quantity
 * @returns {string} The tooltip's HTML content
 */
export const vehicleTooltipContent = (state: VehicleTooltipState, preferences: DisplayUnitPreferences): string => {
  const velocity =
    state.groundVelocityInMetersPerSecond === undefined
      ? 'N/A'
      : formatValueWithUnit(state.groundVelocityInMetersPerSecond, 'm/s', preferences, 2)
  const heading = formatValueWithUnit(state.headingInDegrees, 'deg', preferences, 2)
  const latitude = state.coordinates?.[0].toFixed(6)
  const longitude = state.coordinates?.[1].toFixed(6)

  return `
    <p>Coordinates: ${latitude}, ${longitude}</p>
    <p>Velocity: ${velocity}</p>
    <p>Heading: ${heading}</p>
    <p>${state.isArmed ? 'Armed' : 'Disarmed'}</p>
    <p>Last seen: ${state.timeAgoSeenText}</p>
  `
}
