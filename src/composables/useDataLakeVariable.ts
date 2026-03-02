import { type MaybeRefOrGetter, type Ref, onUnmounted, ref, toValue, watch } from 'vue'

import { getDataLakeVariableData, listenDataLakeVariable, unlistenDataLakeVariable } from '@/libs/actions/data-lake'

type DataLakeValue = string | number | boolean

/**
 * Subscribe to a data lake variable reactively.
 * Automatically resubscribes when the variable ID changes and cleans up on unmount.
 * @param {MaybeRefOrGetter<string | undefined>} variableId - The data lake variable ID (string, ref, or getter)
 * @returns {{ value: Ref<DataLakeValue | undefined> }} Reactive ref with the latest value
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
} {
  const value = ref<DataLakeValue | undefined>(undefined) as Ref<DataLakeValue | undefined>
  let currentListenerId: string | undefined
  let currentVariableId: string | undefined

  const subscribe = (id: string | undefined): void => {
    if (currentListenerId && currentVariableId) {
      unlistenDataLakeVariable(currentVariableId, currentListenerId)
      currentListenerId = undefined
    }

    currentVariableId = id
    if (!id) {
      value.value = undefined
      return
    }

    const initialValue = getDataLakeVariableData(id)
    if (initialValue !== undefined) {
      value.value = initialValue
    }

    currentListenerId = listenDataLakeVariable(id, (raw) => {
      value.value = raw
    })
  }

  watch(
    () => toValue(variableId),
    (newId) => subscribe(newId),
    { immediate: true }
  )

  onUnmounted(() => {
    if (currentListenerId && currentVariableId) {
      unlistenDataLakeVariable(currentVariableId, currentListenerId)
    }
  })

  return { value }
}
