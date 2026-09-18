import { type Ref, onMounted, onUnmounted, ref } from 'vue'

import {
  getAllDataLakeVariablesInfo,
  getDataLakeVariableData,
  getDataLakeVariableLastUpdateTimestamp,
  listenDataLakeVariable,
  unlistenDataLakeVariable,
} from '@/libs/actions/data-lake'
import {
  isRangefinderDistanceVariableId,
  rangefinderOrientationVariableId,
  selectRangefinderVariableId,
} from '@/libs/data-sources/rangefinder'

const staleTimeoutMs = 3000
const selectionIntervalMs = 1000

/**
 * Distance to the bottom measured by the vehicle's downward-facing rangefinder, discovered from the DISTANCE_SENSOR
 * messages in the data lake so that sensors published by the autopilot and by companion computer drivers both work.
 * @returns {{ distanceInMeters: Ref<number | undefined> }} Last reading, undefined while none measures the bottom
 */
export function useRangefinderDistance(): {
  /** @type {Ref<number | undefined>} */
  distanceInMeters: Ref<number | undefined>
} {
  const distanceInMeters = ref<number | undefined>(undefined)
  let subscribedVariableId: string | undefined
  let distanceListenerId: string | undefined
  let selectionInterval: ReturnType<typeof setInterval> | undefined

  const isPublishing = (variableId: string): boolean => {
    const lastUpdate = getDataLakeVariableLastUpdateTimestamp(variableId)
    return lastUpdate !== undefined && performance.now() - lastUpdate < staleTimeoutMs
  }

  const updateDistance = (reading: string | number | boolean): void => {
    if (typeof reading !== 'number' || reading <= 0) return
    // DISTANCE_SENSOR reports centimeters
    distanceInMeters.value = reading / 100
  }

  // Notifying on timestamp change brings in the distances repeating the previous one, which the data lake does not
  // treat as a value change and which are all a sonar sends while the vehicle rests on the bottom
  const subscribeToDistance = (variableId: string | undefined): void => {
    if (variableId === subscribedVariableId) return
    if (subscribedVariableId !== undefined && distanceListenerId !== undefined) {
      unlistenDataLakeVariable(subscribedVariableId, distanceListenerId)
    }
    // A reading from another sensor, or from before a dropout, is not the current distance
    distanceInMeters.value = undefined
    subscribedVariableId = variableId
    distanceListenerId = undefined
    if (variableId === undefined) return
    distanceListenerId = listenDataLakeVariable(variableId, updateDistance, { notifyOnTimestampChange: true })
  }

  // The data lake keeps the last reading of a rangefinder that was disconnected, so the update timestamps are what
  // tell which sensors are still measuring. They are polled because a sensor going silent raises no event, and the
  // timestamp is used instead of the value, which is constant when parked on the bottom or out of the sensor range.
  const selectRangefinder = (): void => {
    const candidates = Object.keys(getAllDataLakeVariablesInfo())
      .filter(isRangefinderDistanceVariableId)
      .map((variableId) => {
        const orientation = getDataLakeVariableData(rangefinderOrientationVariableId(variableId))
        return {
          variableId,
          isPublishing: isPublishing(variableId),
          orientation: typeof orientation === 'string' ? orientation : undefined,
        }
      })

    subscribeToDistance(selectRangefinderVariableId(candidates))
  }

  onMounted(() => {
    selectRangefinder()
    selectionInterval = setInterval(selectRangefinder, selectionIntervalMs)
  })

  onUnmounted(() => {
    clearInterval(selectionInterval)
    subscribeToDistance(undefined)
  })

  return { distanceInMeters }
}
