import { type ComputedRef, type Ref, type WritableComputedRef, computed } from 'vue'

import {
  type DisplayUnitPreferences,
  type LengthReading,
  convertValue,
  convertValueToRawUnit,
  DistanceDisplayUnit,
  readingLengthsAs,
} from '@/libs/units'
import { round } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'

/** Conversion between the unit a value is stored in and the one the user reads and types it in. */
export interface UseUnitConversionReturn {
  /** Reads a stored value in the unit the user picked. */
  toDisplayUnit: (rawValue: number) => number
  /** Reads a limit in the unit the user picked, at the precision a field can show and step by. */
  toDisplayBound: (rawValue: number, places?: number) => number
  /** Takes a value the user typed back to the unit it is stored and sent in. */
  toRawUnit: (displayedValue: number) => number
  /** Symbol to show next to the field. */
  unit: ComputedRef<string>
}

/** A field the user types a physical value into, bound to a value stored in another unit. */
export interface UseUnitInputReturn extends UseUnitConversionReturn {
  /** What the field is bound to, in the unit the user reads, writing back in the stored unit. */
  displayedValue: WritableComputedRef<number>
}

// Feet to metres and back does not land on the number that was typed, so a field bound straight to the conversion
// would grow a tail of zeroes as it is edited, and a stored default nobody typed opens as `32.808399` in a box four
// characters wide. A tenth is finer than any of these fields is aimed to and short enough to read at a glance.
const displayedPlaces = 1

// A field cannot move between units while it is typed in, so under nautical miles it takes the unit picked for
// distances under one, which is what these fields are sized for. At one decimal a nautical mile cannot hold the
// few meters they are set to, so they stay in meters when nautical miles are kept throughout.
/**
 * The units a typed field reads and takes its value in, which under nautical miles are not the ones readouts use.
 * @param {LengthReading} [reading] - What a length measures, when it is a depth or an altitude
 * @returns {DisplayUnitPreferences} The picked units, with distances in the unit typed fields use
 */
export const fieldUnitPreferences = (reading?: LengthReading): DisplayUnitPreferences => {
  const preferences = useAppInterfaceStore().displayUnitPreferences
  if (reading !== undefined) return readingLengthsAs(preferences, reading)
  if (preferences.distance !== DistanceDisplayUnit.NauticalMiles) return preferences
  const fieldUnit =
    preferences.smallDistance === DistanceDisplayUnit.NauticalMiles
      ? DistanceDisplayUnit.Meters
      : preferences.smallDistance
  return { ...preferences, distance: fieldUnit }
}

/**
 * Converts a physical value between the unit it is stored in and the one the user picked to read it in, for the
 * fields that are set imperatively or from props rather than bound with `v-model`.
 * @param {string} rawUnit - The unit the value is stored and sent in, as MAVLink states it
 * @param {LengthReading} [reading] - What a length measures, when it is a depth or an altitude
 * @returns {UseUnitConversionReturn} The conversion both ways, and the unit to show next to the field
 */
export const useUnitConversion = (rawUnit: string, reading?: LengthReading): UseUnitConversionReturn => {
  const preferences = (): DisplayUnitPreferences => fieldUnitPreferences(reading)
  const toDisplayUnit = (rawValue: number): number =>
    round(convertValue(rawValue, rawUnit, preferences()).value, displayedPlaces)

  return {
    toDisplayUnit,
    // A `min` is also the base a number input steps from, so an unrounded one puts every whole number the user
    // types off the lattice, besides overflowing the narrow boxes these limits sit in.
    toDisplayBound: (rawValue, places = 0) => round(toDisplayUnit(rawValue), places),
    toRawUnit: (displayedValue) => convertValueToRawUnit(displayedValue, rawUnit, preferences()),
    // The unit a value converts to does not depend on the value, so any of them reads it back.
    unit: computed(() => convertValue(0, rawUnit, preferences()).unit),
  }
}

/**
 * Binds a field to a physical value stored in one unit while the user reads and types it in the unit they picked,
 * so what reaches the vehicle stays in the unit it expects no matter what is on screen. What the user types is
 * quantised to the precision the field shows, so the stored value follows the number they were left looking at.
 * @param {Ref<number>} rawValue - The value in the unit it is stored and sent in
 * @param {string} rawUnit - That unit, as MAVLink states it
 * @param {LengthReading} [reading] - What a length measures, when it is a depth or an altitude
 * @returns {UseUnitInputReturn} The value to bind the field to, the conversion both ways, and the unit to show
 */
export const useUnitInput = (rawValue: Ref<number>, rawUnit: string, reading?: LengthReading): UseUnitInputReturn => {
  const conversion = useUnitConversion(rawUnit, reading)

  const displayedValue = computed({
    get: () => conversion.toDisplayUnit(rawValue.value),
    // The getter rewrites a finer number to the precision it shows, so storing what was typed instead of what was
    // left on screen would build the mission from a figure the box never showed.
    set: (value: number) => {
      rawValue.value = conversion.toRawUnit(round(value, displayedPlaces))
    },
  })

  return { ...conversion, displayedValue }
}
