import { type MaybeRefOrGetter, type Ref, onUnmounted, ref, toValue, watch } from 'vue'

import { getDataLakeVariableData, listenDataLakeVariable, unlistenDataLakeVariable } from '@/libs/actions/data-lake'

type DataLakeValue = string | number | boolean

/**
 * Subscribe to a data lake variable reactively.
 *
 * Updates are coalesced to at most one per animation frame (latest value wins), so a variable that
 * changes faster than the display refresh - or many variables changing in the same tick - can't drive
 * more than one render per frame. The initial value is applied synchronously so the binding is never
 * blank on mount. Automatically resubscribes when the variable ID changes and cleans up on unmount.
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

  // Coalesce incoming updates to one ref write per animation frame, keeping only the latest value.
  let pendingValue: DataLakeValue | undefined
  let hasPending = false
  let rafId: number | undefined

  const flush = (): void => {
    rafId = undefined
    if (!hasPending) return
    hasPending = false
    value.value = pendingValue
  }

  const cancelPending = (): void => {
    if (rafId !== undefined) {
      cancelAnimationFrame(rafId)
      rafId = undefined
    }
    hasPending = false
  }

  const subscribe = (id: string | undefined): void => {
    if (currentListenerId && currentVariableId) {
      unlistenDataLakeVariable(currentVariableId, currentListenerId)
      currentListenerId = undefined
    }
    // Drop any frame pending for the previous variable so it can't overwrite the new one.
    cancelPending()

    currentVariableId = id
    if (!id) {
      value.value = undefined
      return
    }

    // Apply the current value synchronously so the binding isn't blank for a frame on (re)subscribe.
    const initialValue = getDataLakeVariableData(id)
    if (initialValue !== undefined) {
      value.value = initialValue
    }

    currentListenerId = listenDataLakeVariable(id, (raw) => {
      pendingValue = raw
      hasPending = true
      if (rafId === undefined) rafId = requestAnimationFrame(flush)
    })
  }

  watch(
    () => toValue(variableId),
    (newId) => subscribe(newId),
    { immediate: true }
  )

  onUnmounted(() => {
    cancelPending()
    if (currentListenerId && currentVariableId) {
      unlistenDataLakeVariable(currentVariableId, currentListenerId)
    }
  })

  return { value }
}
