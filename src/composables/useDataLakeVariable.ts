import { type ComputedRef, type MaybeRefOrGetter, type Ref, computed, onUnmounted, ref, toValue, watch } from 'vue'

import {
  getDataLakeVariableData,
  getDataLakeVariableInfo,
  listenDataLakeVariable,
  listenToDataLakeVariablesInfoChanges,
  unlistenDataLakeVariable,
  unlistenToDataLakeVariablesInfoChanges,
} from '@/libs/actions/data-lake'
import { convertValue } from '@/libs/units'
import { useAppInterfaceStore } from '@/stores/appInterface'

type DataLakeValue = string | number | boolean

/**
 * Subscribe to a data lake variable reactively.
 * Automatically resubscribes when the variable ID changes and cleans up on unmount.
 * @param {MaybeRefOrGetter<string | undefined>} variableId - The data lake variable ID (string, ref, or getter)
 * @returns {{ value: Ref<DataLakeValue | undefined>, displayValue: ComputedRef<number | undefined>, displayUnit: ComputedRef<string> }}
 * The latest value as it was received, plus that value and its unit in the units the user reads
 * @example
 * // Static variable ID
 * const { value } = useDataLakeVariable('/mavlink/1/1/SYS_STATUS/voltage_battery')
 * @example
 * // Reactive getter (resubscribes when ID changes)
 * const { value: yaw } = useDataLakeVariable(() => widget.value.options.yawVariableId)
 */
export function useDataLakeVariable(variableId: MaybeRefOrGetter<string | undefined>): {
  /** @type {Ref<DataLakeValue | undefined>} */
  value: Ref<DataLakeValue | undefined>
  /** @type {ComputedRef<number | undefined>} */
  displayValue: ComputedRef<number | undefined>
  /** @type {ComputedRef<string>} */
  displayUnit: ComputedRef<string>
} {
  const interfaceStore = useAppInterfaceStore()
  const value = ref<DataLakeValue | undefined>(undefined) as Ref<DataLakeValue | undefined>
  const rawUnit = ref<string | undefined>(undefined)
  let currentListenerId: string | undefined
  let currentVariableId: string | undefined

  const refreshUnit = (): void => {
    rawUnit.value = currentVariableId ? getDataLakeVariableInfo(currentVariableId)?.unit : undefined
  }

  const subscribe = (id: string | undefined): void => {
    if (currentListenerId && currentVariableId) {
      unlistenDataLakeVariable(currentVariableId, currentListenerId)
      currentListenerId = undefined
    }

    currentVariableId = id
    value.value = id ? getDataLakeVariableData(id) : undefined
    refreshUnit()
    if (!id) return

    currentListenerId = listenDataLakeVariable(id, (raw) => {
      value.value = raw
      // A widget can be up before the vehicle sends the message that creates its variable, and only
      // then is there a unit to read.
      if (rawUnit.value === undefined) refreshUnit()
    })
  }

  // Someone editing the unit of a variable they created has to reach the widgets already showing it,
  // which would otherwise go on scaling by the unit it had when they subscribed.
  const infoListenerId = listenToDataLakeVariablesInfoChanges(refreshUnit)

  watch(
    () => toValue(variableId),
    (newId) => subscribe(newId),
    { immediate: true }
  )

  onUnmounted(() => {
    if (currentListenerId && currentVariableId) {
      unlistenDataLakeVariable(currentVariableId, currentListenerId)
    }
    unlistenToDataLakeVariablesInfoChanges(infoListenerId)
  })

  const converted = computed(() => {
    if (typeof value.value !== 'number') return undefined
    return convertValue(value.value, rawUnit.value, interfaceStore.displayUnitPreferences)
  })

  const displayValue = computed(() => converted.value?.value)
  const displayUnit = computed(() => converted.value?.unit ?? '')

  return { value, displayValue, displayUnit }
}
