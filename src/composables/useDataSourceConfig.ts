import {
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
  computed,
  onMounted,
  onUnmounted,
  ref,
  toValue,
  watch,
} from 'vue'

import { useResolvedDataLakeTemplate } from '@/composables/useResolvedDataLakeTemplate'
import {
  DataLakeVariable,
  getAllDataLakeVariablesInfo,
  listenToDataLakeVariablesInfoChanges,
  unlistenToDataLakeVariablesInfoChanges,
} from '@/libs/actions/data-lake'
import { type DataSourceOptionKeys, isPresetVariableId } from '@/libs/data-sources/source-options'

/**
 * Manage the draft data source config while a widget config menu is open and
 * expose the resolved data lake variable ID for runtime subscription.
 * @param {object} params - Configuration parameters
 * @param {Ref<{ options: Record<string, unknown> }>} params.widget - Widget or mini-widget ref
 * @param {MaybeRefOrGetter<boolean>} params.isConfigMenuOpen - Whether the config menu is open
 * @param {DataSourceOptionKeys} params.source - Option keys and presets of the source being configured
 * @param {string} params.defaultVariableId - Default preset variable ID (templated)
 * @param {string} params.sourceName - Name of the source, used in the user action logs
 * @returns {object} Draft config state and the resolved variable ID
 */
export function useDataSourceConfig(params: {
  /** Widget (or mini-widget) reference whose `options` hold the source selection. */
  widget: Ref<{
    /** Options stored on the widget. */
    options: Record<string, unknown>
  }>
  /** Reactive flag indicating whether the widget config menu is open. */
  isConfigMenuOpen: MaybeRefOrGetter<boolean>
  /** Option keys and presets of the source being configured. */
  source: DataSourceOptionKeys
  /** Templated data lake variable ID applied when no preset has been chosen yet. */
  defaultVariableId: string
  /** Name of the source (e.g. 'altitude'), used in the user action logs. */
  sourceName: string
}): {
  /** Concrete data lake variable ID for the active source, resolved at runtime. */
  resolvedVariableId: ComputedRef<string | undefined>
  /** Draft variable ID bound to the config menu controls. */
  configVariableId: Ref<string | undefined>
  /** Draft "custom data lake variable" toggle bound to the config menu. */
  configUseCustomVariable: Ref<boolean>
  /** Numeric data lake variables available to pick as a custom source. */
  availableDataLakeNumberVariables: ComputedRef<DataLakeVariable[]>
  /** Sets the draft source and logs the selection; wire to the config control's `@update:model-value`. */
  onSourceSelected: (variableId: string | undefined) => void
  /** Sets the draft custom-variable toggle and logs it; wire to the checkbox's `@update:model-value`. */
  onUseCustomVariableToggled: (useCustomVariable: boolean | null) => void
} {
  const { variableIdKey, useCustomVariableKey, presets } = params.source
  const options = (): Record<string, unknown> => params.widget.value.options
  const storedVariableId = (): string | undefined => options()[variableIdKey] as string | undefined
  const storedUseCustomVariable = (): boolean => (options()[useCustomVariableKey] as boolean | undefined) ?? false

  const availableDataLakeVariables = ref<DataLakeVariable[]>([])
  let dataLakeVariableInfoListenerId: string | undefined

  const availableDataLakeNumberVariables = computed(() => {
    return availableDataLakeVariables.value.filter((variable) => variable.type === 'number')
  })

  const resolvedVariableId = useResolvedDataLakeTemplate(storedVariableId)

  const configVariableId = ref<string | undefined>()
  const configUseCustomVariable = ref(false)
  let configSnapshot = { variableId: params.defaultVariableId, useCustomVariable: false }

  const openConfigMenu = (): void => {
    configSnapshot = {
      variableId: storedVariableId() ?? params.defaultVariableId,
      useCustomVariable: storedUseCustomVariable(),
    }
    configVariableId.value = storedVariableId()
    configUseCustomVariable.value = storedUseCustomVariable()
  }

  const closeConfigMenu = (): void => {
    const customSelectionMissing = configUseCustomVariable.value && !configVariableId.value

    if (customSelectionMissing) {
      options()[variableIdKey] = configSnapshot.variableId
      options()[useCustomVariableKey] = configSnapshot.useCustomVariable
      return
    }

    options()[variableIdKey] = configVariableId.value ?? configSnapshot.variableId
    options()[useCustomVariableKey] = configUseCustomVariable.value
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
      if (isOpen && !wasOpen) openConfigMenu()
      if (!isOpen && wasOpen) closeConfigMenu()
    }
  )

  watch(configUseCustomVariable, (useCustomVariable, wasCustomVariable) => {
    if (useCustomVariable && !wasCustomVariable) {
      // Preserve a non-preset id (e.g. when openConfigMenu loads a persisted
      // custom selection), and only clear when the previous draft was a preset.
      if (configVariableId.value && !isPresetVariableId(presets, configVariableId.value)) {
        return
      }
      configVariableId.value = undefined
      return
    }

    if (!useCustomVariable && wasCustomVariable) {
      if (!configVariableId.value || !isPresetVariableId(presets, configVariableId.value)) {
        configVariableId.value = params.defaultVariableId
      }
    }
  })

  const onSourceSelected = (variableId: string | undefined): void => {
    configVariableId.value = variableId
    if (variableId) logUserAction(`Selected ${params.sourceName} source '${variableId}'`)
  }

  const onUseCustomVariableToggled = (useCustomVariable: boolean | null): void => {
    configUseCustomVariable.value = useCustomVariable ?? false
    logUserAction(`${useCustomVariable ? 'Enabled' : 'Disabled'} custom ${params.sourceName} data lake variable`)
  }

  return {
    resolvedVariableId,
    configVariableId,
    configUseCustomVariable,
    availableDataLakeNumberVariables,
    onSourceSelected,
    onUseCustomVariableToggled,
  }
}

/** Draft source config returned by useDataSourceConfig, as consumed by the DataSourceSelect component. */
export type DataSourceConfig = ReturnType<typeof useDataSourceConfig>
