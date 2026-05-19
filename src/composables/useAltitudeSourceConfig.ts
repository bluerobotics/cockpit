import { type MaybeRefOrGetter, type Ref, computed, onMounted, onUnmounted, ref, toValue, watch } from 'vue'

import { useResolvedDataLakeTemplate } from '@/composables/useResolvedDataLakeTemplate'
import {
  DataLakeVariable,
  getAllDataLakeVariablesInfo,
  listenToDataLakeVariablesInfoChanges,
  unlistenToDataLakeVariablesInfoChanges,
} from '@/libs/actions/data-lake'
import { isPresetAltitudeVariableId } from '@/libs/data-sources/altitude'

/** Altitude source selections saved when the config menu opens. */
type AltitudeConfigSnapshot = {
  /** Data lake variable ID for the active altitude source. */
  altitudeVariableId: string
  /** Whether a custom data lake variable is selected. */
  useCustomAltitudeVariable: boolean
}

type AltitudeVariableOptions = {
  /** Persisted data lake variable ID (templated for presets, concrete for custom variables). */
  altitudeVariableId?: string
  /** Whether the user has opted into picking a custom data lake variable. */
  useCustomAltitudeVariable?: boolean
}

/**
 * Merge persisted altitude options with defaults and infer custom mode when needed.
 * @param {T} defaultOptions - Default widget options
 * @param {Partial<T>} persistedOptions - Persisted widget options
 * @returns {T} Merged widget options
 */
export const mergeAltitudeVariableOptions = <T extends AltitudeVariableOptions>(
  defaultOptions: T,
  persistedOptions: Partial<T>
): T => {
  const merged = { ...defaultOptions, ...persistedOptions }

  if (merged.altitudeVariableId && !isPresetAltitudeVariableId(merged.altitudeVariableId)) {
    merged.useCustomAltitudeVariable = true
  }

  return merged
}

/**
 * Manage draft altitude source config while a widget config menu is open and
 * expose the resolved data lake variable ID for runtime subscription.
 * @param {object} params - Configuration parameters
 * @param {Ref<{ options: AltitudeVariableOptions }>} params.widget - Widget or mini-widget ref
 * @param {MaybeRefOrGetter<boolean>} params.isConfigMenuOpen - Whether the config menu is open
 * @param {string} params.defaultAltitudeVariableId - Default preset altitude variable ID (templated)
 * @returns {object} Draft config state and the resolved variable ID
 */
export function useAltitudeSourceConfig(params: {
  /** Widget (or mini-widget) reference whose `options` hold the altitude selection. */
  widget: Ref<{
    /** Altitude selection options stored on the widget. */
    options: AltitudeVariableOptions
  }>
  /** Reactive flag indicating whether the widget config menu is open. */
  isConfigMenuOpen: MaybeRefOrGetter<boolean>
  /** Templated data lake variable ID applied when no preset has been chosen yet. */
  defaultAltitudeVariableId: string
}): {
  /** Concrete data lake variable ID for the active source, resolved at runtime. */
  resolvedAltitudeVariableId: ReturnType<typeof computed<string | undefined>>
  /** Draft altitude variable ID bound to the config menu controls. */
  configAltitudeVariableId: Ref<string | undefined>
  /** Draft "custom data lake variable" toggle bound to the config menu. */
  configUseCustomAltitudeVariable: Ref<boolean>
  /** Numeric data lake variables available to pick as a custom altitude source. */
  availableDataLakeNumberVariables: ReturnType<typeof computed<DataLakeVariable[]>>
  /** Logs a user-driven altitude source selection; wire to the config control's `@update:model-value`. */
  onAltitudeSourceSelected: (variableId: string | undefined) => void
  /** Logs the custom-variable toggle; wire to the checkbox's `@update:model-value`. */
  onUseCustomAltitudeVariableToggled: (useCustomAltitudeVariable: boolean | null) => void
} {
  const availableDataLakeVariables = ref<DataLakeVariable[]>([])
  let dataLakeVariableInfoListenerId: string | undefined

  const availableDataLakeNumberVariables = computed(() => {
    return availableDataLakeVariables.value.filter((variable) => variable.type === 'number')
  })

  const resolvedAltitudeVariableId = useResolvedDataLakeTemplate(() => params.widget.value.options.altitudeVariableId)

  const configAltitudeVariableId = ref<string | undefined>()
  const configUseCustomAltitudeVariable = ref(false)
  let altitudeConfigSnapshot: AltitudeConfigSnapshot = {
    altitudeVariableId: params.defaultAltitudeVariableId,
    useCustomAltitudeVariable: false,
  }

  const openAltitudeConfigMenu = (): void => {
    altitudeConfigSnapshot = {
      altitudeVariableId: params.widget.value.options.altitudeVariableId ?? params.defaultAltitudeVariableId,
      useCustomAltitudeVariable: params.widget.value.options.useCustomAltitudeVariable ?? false,
    }
    configAltitudeVariableId.value = params.widget.value.options.altitudeVariableId
    configUseCustomAltitudeVariable.value = params.widget.value.options.useCustomAltitudeVariable ?? false
  }

  const closeAltitudeConfigMenu = (): void => {
    const customSelectionMissing = configUseCustomAltitudeVariable.value && !configAltitudeVariableId.value

    if (customSelectionMissing) {
      params.widget.value.options.altitudeVariableId = altitudeConfigSnapshot.altitudeVariableId
      params.widget.value.options.useCustomAltitudeVariable = altitudeConfigSnapshot.useCustomAltitudeVariable
      return
    }

    params.widget.value.options.altitudeVariableId =
      configAltitudeVariableId.value ?? altitudeConfigSnapshot.altitudeVariableId
    params.widget.value.options.useCustomAltitudeVariable = configUseCustomAltitudeVariable.value
  }

  onMounted(() => {
    availableDataLakeVariables.value = Object.values(getAllDataLakeVariablesInfo())
    dataLakeVariableInfoListenerId = listenToDataLakeVariablesInfoChanges((variables) => {
      availableDataLakeVariables.value = Object.values(variables)
    })
  })

  onUnmounted(() => {
    if (dataLakeVariableInfoListenerId) {
      unlistenToDataLakeVariablesInfoChanges(dataLakeVariableInfoListenerId)
    }
  })

  watch(
    () => toValue(params.isConfigMenuOpen),
    (isOpen, wasOpen) => {
      if (isOpen && !wasOpen) openAltitudeConfigMenu()
      if (!isOpen && wasOpen) closeAltitudeConfigMenu()
    }
  )

  watch(configUseCustomAltitudeVariable, (useCustomAltitudeVariable, wasCustomAltitudeVariable) => {
    if (useCustomAltitudeVariable && !wasCustomAltitudeVariable) {
      // Preserve a non-preset id (e.g. when openAltitudeConfigMenu loads a persisted
      // custom selection), and only clear when the previous draft was a preset.
      if (configAltitudeVariableId.value && !isPresetAltitudeVariableId(configAltitudeVariableId.value)) {
        return
      }
      configAltitudeVariableId.value = undefined
      return
    }

    if (!useCustomAltitudeVariable && wasCustomAltitudeVariable) {
      if (!configAltitudeVariableId.value || !isPresetAltitudeVariableId(configAltitudeVariableId.value)) {
        configAltitudeVariableId.value = params.defaultAltitudeVariableId
      }
    }
  })

  const onAltitudeSourceSelected = (variableId: string | undefined): void => {
    if (variableId) logUserAction(`Selected altitude source '${variableId}'`)
  }

  const onUseCustomAltitudeVariableToggled = (useCustomAltitudeVariable: boolean | null): void => {
    logUserAction(`${useCustomAltitudeVariable ? 'Enabled' : 'Disabled'} custom altitude data lake variable`)
  }

  return {
    resolvedAltitudeVariableId,
    configAltitudeVariableId,
    configUseCustomAltitudeVariable,
    availableDataLakeNumberVariables,
    onAltitudeSourceSelected,
    onUseCustomAltitudeVariableToggled,
  }
}
