import { type InjectionKey, computed, inject, nextTick, ref } from 'vue'

import { openSnackbar } from '@/composables/snackbar'
import { buildViewsGroupAfterImport } from '@/migration/default-profile-importer'
import { useWidgetManagerStore } from '@/stores/widgetManager'

import { type VehicleDefaultsEvaluationBundle, useVehicleDefaultsEvaluation } from './vehicleDefaultsImportShared'

/**
 * Views-group defaults import state and actions, shared by the manual modal and auto wizard.
 * @param {VehicleDefaultsEvaluationBundle} [evaluationBundle] - Optional shared evaluation from the auto wizard
 * @returns {VehicleDefaultsViewsImport} Views import state and handlers
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useVehicleDefaultsViewsImport = (evaluationBundle?: VehicleDefaultsEvaluationBundle) => {
  const widgetStore = useWidgetManagerStore()
  const bundle = evaluationBundle ?? useVehicleDefaultsEvaluation()
  const { evaluation, isCurrentViewsGroupBlank, currentViewsCount, refreshEvaluation } = bundle

  const selectedDefaultViewNames = ref<string[]>([])
  const viewsMode = ref<'append' | 'replace'>('append')
  const replaceConfirmationVisible = ref(false)

  const hasDefaultProfile = computed(() => !!evaluation.value?.views.defaultProfile)
  /** True when the auto wizard should offer import (name-match heuristic may skip). */
  const hasImportOffer = computed(() => evaluation.value?.views.action === 'offer')

  const effectiveViewsImportMode = computed((): 'append' | 'replace' =>
    isCurrentViewsGroupBlank.value ? 'replace' : viewsMode.value
  )

  const previewViewsGroupAfterImport = computed(() => {
    const defaultProfile = evaluation.value?.views.defaultProfile
    if (!defaultProfile) return null
    return buildViewsGroupAfterImport(
      widgetStore.viewsGroup,
      defaultProfile,
      selectedDefaultViewNames.value,
      viewsMode.value,
      isCurrentViewsGroupBlank.value
    )
  })

  const viewsPreviewBeforeNames = computed(() => widgetStore.viewsGroup.views.map((view) => view.name))

  const viewsPreviewAfterNames = computed((): string[] => {
    if (selectedDefaultViewNames.value.length === 0) {
      return effectiveViewsImportMode.value === 'replace' ? [] : viewsPreviewBeforeNames.value
    }
    const profile = previewViewsGroupAfterImport.value
    if (!profile) return []
    return profile.views.map((view) => view.name)
  })

  const selectAllDefaultViews = (): void => {
    selectedDefaultViewNames.value = evaluation.value?.views.defaultProfile?.views.map((view) => view.name) ?? []
  }

  const selectNoneDefaultViews = (): void => {
    selectedDefaultViewNames.value = []
  }

  const refresh = (): void => {
    refreshEvaluation()
    selectAllDefaultViews()
    viewsMode.value = isCurrentViewsGroupBlank.value ? 'replace' : 'append'
  }

  const selectFirstViewOfCurrentGroup = (): void => {
    const firstVisible = widgetStore.viewsGroup.views.find((view) => view.visible) ?? widgetStore.viewsGroup.views[0]
    if (firstVisible) widgetStore.selectView(firstVisible)
  }

  const applyImport = (): boolean => {
    const defaultProfile = evaluation.value?.views.defaultProfile
    if (!defaultProfile || selectedDefaultViewNames.value.length === 0) return false

    const effectiveMode = effectiveViewsImportMode.value
    widgetStore.viewsGroup = buildViewsGroupAfterImport(
      widgetStore.viewsGroup,
      defaultProfile,
      selectedDefaultViewNames.value,
      viewsMode.value,
      isCurrentViewsGroupBlank.value
    )

    if (effectiveMode === 'replace') {
      nextTick(() => selectFirstViewOfCurrentGroup())
    }

    openSnackbar({
      message:
        effectiveMode === 'replace'
          ? `Imported default views for ${evaluation.value?.vehicleTypeName}.`
          : `Appended ${selectedDefaultViewNames.value.length} default view(s) for ${evaluation.value?.vehicleTypeName}.`,
      variant: 'success',
      duration: 5000,
    })
    return true
  }

  const onClickImport = (): void => {
    if (viewsMode.value === 'replace' && !isCurrentViewsGroupBlank.value) {
      replaceConfirmationVisible.value = true
      return
    }
    applyImport()
  }

  const confirmReplace = (): boolean => {
    replaceConfirmationVisible.value = false
    return applyImport()
  }

  const cancelReplace = (): void => {
    replaceConfirmationVisible.value = false
  }

  return {
    evaluation,
    isCurrentViewsGroupBlank,
    currentViewsCount,
    selectedDefaultViewNames,
    viewsMode,
    hasDefaultProfile,
    hasImportOffer,
    viewsPreviewBeforeNames,
    viewsPreviewAfterNames,
    replaceConfirmationVisible,
    refresh,
    selectAllDefaultViews,
    selectNoneDefaultViews,
    onClickImport,
    applyImport,
    confirmReplace,
    cancelReplace,
  }
}

export type VehicleDefaultsViewsImport = ReturnType<typeof useVehicleDefaultsViewsImport>

export const vehicleDefaultsViewsImportKey: InjectionKey<VehicleDefaultsViewsImport> =
  Symbol('vehicleDefaultsViewsImport')

/**
 * Injects views defaults import state provided by a parent modal.
 * @returns {VehicleDefaultsViewsImport} Shared views import state
 */
export const useVehicleDefaultsViewsImportInject = (): VehicleDefaultsViewsImport => {
  const context = inject(vehicleDefaultsViewsImportKey)
  if (!context) {
    throw new Error('useVehicleDefaultsViewsImportInject must be used within a vehicle defaults views provider')
  }
  return context
}
