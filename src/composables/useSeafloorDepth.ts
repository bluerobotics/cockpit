import { type MaybeRefOrGetter, type Ref, computed, onMounted, onUnmounted, ref, toValue } from 'vue'

import { useDataLakeVariable } from '@/composables/useDataLakeVariable'
import { getAllDataLakeVariablesInfo, getDataLakeVariableData } from '@/libs/actions/data-lake'
import {
  ensureCockpitTransformingFunction,
  getOldestSourceUpdateTimestamp,
} from '@/libs/actions/data-lake-transformations'
import { rawAltitudeToMeters } from '@/libs/data-sources/altitude'
import {
  isRangefinderDistanceVariableId,
  isRangefinderSeafloorDepthVariableId,
  rangefinderOrientationVariableId,
  rangefinderSeafloorDepthFunction,
  selectRangefinderVariableId,
} from '@/libs/data-sources/rangefinder'

const staleTimeoutMs = 3000
const pollIntervalMs = 1000

type SeafloorDepthOptions = {
  /** Data lake variable with the seafloor depth in meters; undefined until chosen, null when the user chose none. */
  seafloorDepthVariableId?: string | null
}

/**
 * Depth of the seafloor, read from the data lake variable a widget selects. Until the user chooses one, a
 * downward-facing rangefinder is looked for, and a compound variable adding its distance to the widget's depth is
 * created and selected, then replaced whenever the rangefinder or the depth source changes.
 * @param {object} params - Configuration parameters
 * @param {Ref<{ options: SeafloorDepthOptions }>} params.widget - Widget whose options hold the seafloor selection
 * @param {MaybeRefOrGetter<string | undefined>} params.altitudeVariableId - Concrete ID of the widget's altitude source
 * @returns {{ seafloorDepthInMeters: Ref<number | undefined> }} Seafloor depth, undefined while none is being measured
 */
export function useSeafloorDepth(params: {
  /** Widget whose `options` hold the seafloor depth selection. */
  widget: Ref<{
    /** Seafloor depth selection options stored on the widget. */
    options: SeafloorDepthOptions
  }>
  /** Concrete data lake variable ID the widget reads its altitude from. */
  altitudeVariableId: MaybeRefOrGetter<string | undefined>
}): {
  /** @type {Ref<number | undefined>} */
  seafloorDepthInMeters: Ref<number | undefined>
} {
  const options = computed(() => params.widget.value.options)
  const { value: rawSeafloorDepth } = useDataLakeVariable(() => options.value.seafloorDepthVariableId ?? undefined)
  const isSeafloorDepthCurrent = ref(false)
  let pollInterval: ReturnType<typeof setInterval> | undefined

  const isCurrent = (variableId: string): boolean => {
    const lastUpdate = getOldestSourceUpdateTimestamp(variableId)
    return lastUpdate !== undefined && performance.now() - lastUpdate < staleTimeoutMs
  }

  // The data lake keeps the last reading of a rangefinder that was disconnected, so the update timestamps are what
  // tell which sensors are still measuring. The timestamp is used instead of the value, which is constant when parked
  // on the bottom or out of the sensor range.
  const findDownwardRangefinder = (): string | undefined => {
    const candidates = Object.keys(getAllDataLakeVariablesInfo())
      .filter(isRangefinderDistanceVariableId)
      .map((variableId) => {
        const orientation = getDataLakeVariableData(rangefinderOrientationVariableId(variableId))
        return {
          variableId,
          isPublishing: isCurrent(variableId),
          orientation: typeof orientation === 'string' ? orientation : undefined,
        }
      })
    return selectRangefinderVariableId(candidates)
  }

  const selectRangefinderSeafloorDepth = (): void => {
    const selectedVariableId = options.value.seafloorDepthVariableId
    if (selectedVariableId === null) return
    if (selectedVariableId !== undefined && !isRangefinderSeafloorDepthVariableId(selectedVariableId)) return

    const altitudeVariableId = toValue(params.altitudeVariableId)
    const autopilotSystemId = getDataLakeVariableData('autopilotSystemId')
    const rangefinderVariableId = findDownwardRangefinder()
    if (altitudeVariableId === undefined || autopilotSystemId === undefined || rangefinderVariableId === undefined) {
      return
    }

    const seafloorDepthFunction = rangefinderSeafloorDepthFunction({
      rangefinderVariableId,
      altitudeVariableId,
      metersPerAltitudeUnit: rawAltitudeToMeters(altitudeVariableId, 1),
      attitudePath: `/mavlink/${autopilotSystemId}/1/ATTITUDE`,
    })
    try {
      ensureCockpitTransformingFunction(seafloorDepthFunction)
    } catch (error) {
      console.error(`Could not create the seafloor depth variable '${seafloorDepthFunction.id}'. Error: ${error}`)
      return
    }
    if (selectedVariableId !== seafloorDepthFunction.id) {
      options.value.seafloorDepthVariableId = seafloorDepthFunction.id
    }
  }

  // Polled because a sensor going silent raises no event
  const poll = (): void => {
    selectRangefinderSeafloorDepth()
    const selectedVariableId = options.value.seafloorDepthVariableId
    isSeafloorDepthCurrent.value = typeof selectedVariableId === 'string' && isCurrent(selectedVariableId)
  }

  onMounted(() => {
    poll()
    pollInterval = setInterval(poll, pollIntervalMs)
  })

  onUnmounted(() => {
    clearInterval(pollInterval)
  })

  const seafloorDepthInMeters = computed(() => {
    const depth = rawSeafloorDepth.value
    if (!isSeafloorDepthCurrent.value || typeof depth !== 'number' || !Number.isFinite(depth)) return undefined
    return depth
  })

  return { seafloorDepthInMeters }
}
