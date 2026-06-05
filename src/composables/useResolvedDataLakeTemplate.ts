import { type MaybeRefOrGetter, computed, onUnmounted, ref, toValue, watch } from 'vue'

import { listenDataLakeVariable, unlistenDataLakeVariable } from '@/libs/actions/data-lake'
import { findDataLakeVariablesIdsInString, replaceDataLakeInputsInString } from '@/libs/utils-data-lake'

/**
 * Resolve a string containing mustache-style data lake placeholders
 * (e.g. '/mavlink/{{autopilotSystemId}}/1/AHRS2/altitude') reactively.
 * Re-resolves when the template itself changes or when any of the referenced
 * data lake variables update.
 * @param {MaybeRefOrGetter<string | undefined>} template - The template string
 * @returns {ReturnType<typeof computed<string | undefined>>} The resolved string
 */
export function useResolvedDataLakeTemplate(
  template: MaybeRefOrGetter<string | undefined>
): ReturnType<typeof computed<string | undefined>> {
  // Bumped by each referenced variable's listener to force re-resolution.
  const tick = ref(0)
  let subscriptions: {
    /** ID of the data lake variable being listened to. */
    variableId: string
    /** Listener handle returned by `listenDataLakeVariable` for later cleanup. */
    listenerId: string
  }[] = []

  const clearSubscriptions = (): void => {
    subscriptions.forEach(({ variableId, listenerId }) => {
      unlistenDataLakeVariable(variableId, listenerId)
    })
    subscriptions = []
  }

  const resubscribe = (currentTemplate: string | undefined): void => {
    clearSubscriptions()
    if (!currentTemplate) return

    const referencedIds = Array.from(new Set(findDataLakeVariablesIdsInString(currentTemplate)))
    referencedIds.forEach((variableId) => {
      const listenerId = listenDataLakeVariable(variableId, () => {
        tick.value++
      })
      subscriptions.push({ variableId, listenerId })
    })
  }

  watch(() => toValue(template), resubscribe, { immediate: true })

  onUnmounted(clearSubscriptions)

  return computed(() => {
    void tick.value
    const value = toValue(template)
    if (!value) return undefined
    return replaceDataLakeInputsInString(value)
  })
}
