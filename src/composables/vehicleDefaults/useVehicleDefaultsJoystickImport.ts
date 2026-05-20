import { type InjectionKey, computed, inject, ref } from 'vue'

import { openSnackbar } from '@/composables/snackbar'
import { OtherProtocol } from '@/libs/joystick/protocols/other'
import { cloneMapping } from '@/migration/default-profile-importer'
import { useControllerStore } from '@/stores/controller'

import {
  type VehicleDefaultsEvaluationBundle,
  buildJoystickImportRows,
  useVehicleDefaultsEvaluation,
} from './vehicleDefaultsImportShared'

/**
 * Joystick defaults import state and actions, shared by the manual modal and auto wizard.
 * @param {VehicleDefaultsEvaluationBundle} [evaluationBundle] - Optional shared evaluation from the auto wizard
 * @returns {VehicleDefaultsJoystickImport} Joystick import state and handlers
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useVehicleDefaultsJoystickImport = (evaluationBundle?: VehicleDefaultsEvaluationBundle) => {
  const controllerStore = useControllerStore()
  const bundle = evaluationBundle ?? useVehicleDefaultsEvaluation()
  const { evaluation, isCurrentMappingBlank, refreshEvaluation } = bundle

  const selectedJoystickRowIds = ref<string[]>([])

  const joystickImportRows = computed(() => {
    const defaultMapping = evaluation.value?.joystick.defaultMapping
    if (!defaultMapping) return []
    return buildJoystickImportRows(controllerStore.protocolMapping, defaultMapping)
  })

  const hasImportOffer = computed(() => joystickImportRows.value.length > 0)

  const selectedJoystickRows = computed(() =>
    joystickImportRows.value.filter((row) => selectedJoystickRowIds.value.includes(row.id))
  )

  const selectedJoystickRowsCount = computed(() => selectedJoystickRows.value.length)

  const defaultMappingAxisCount = computed(() => {
    const map = evaluation.value?.joystick.defaultMapping
    if (!map) return 0
    return Object.values(map.axesCorrespondencies).filter((axis) => axis.action.id !== OtherProtocol.no_function).length
  })

  const selectAllJoystickRows = (): void => {
    selectedJoystickRowIds.value = joystickImportRows.value.map((row) => row.id)
  }

  const selectNoneJoystickRows = (): void => {
    selectedJoystickRowIds.value = []
  }

  const refresh = (): void => {
    refreshEvaluation()
    selectAllJoystickRows()
  }

  const applyImport = (): boolean => {
    const defaultMapping = evaluation.value?.joystick.defaultMapping
    if (!defaultMapping || selectedJoystickRowsCount.value === 0) return false

    const nextMapping = cloneMapping(controllerStore.protocolMapping)
    const defaultClone = cloneMapping(defaultMapping)
    for (const row of selectedJoystickRows.value) {
      if (row.axisKey !== undefined) {
        nextMapping.axesCorrespondencies[row.axisKey as unknown as keyof typeof nextMapping.axesCorrespondencies] =
          defaultClone.axesCorrespondencies[row.axisKey as unknown as keyof typeof defaultClone.axesCorrespondencies]
        continue
      }
      if (row.modifier === undefined || row.buttonKey === undefined) continue
      nextMapping.buttonsCorrespondencies[row.modifier as keyof typeof nextMapping.buttonsCorrespondencies][
        row.buttonKey as unknown as number
      ] =
        defaultClone.buttonsCorrespondencies[row.modifier as keyof typeof defaultClone.buttonsCorrespondencies][
          row.buttonKey as unknown as number
        ]
    }
    controllerStore.protocolMapping = nextMapping

    openSnackbar({
      message: `Imported ${selectedJoystickRowsCount.value} default joystick binding(s) for ${evaluation.value?.vehicleTypeName}.`,
      variant: 'success',
      duration: 5000,
    })
    return true
  }

  return {
    evaluation,
    isCurrentMappingBlank,
    selectedJoystickRowIds,
    joystickImportRows,
    hasImportOffer,
    selectedJoystickRowsCount,
    defaultMappingAxisCount,
    refresh,
    selectAllJoystickRows,
    selectNoneJoystickRows,
    applyImport,
  }
}

export type VehicleDefaultsJoystickImport = ReturnType<typeof useVehicleDefaultsJoystickImport>

export const vehicleDefaultsJoystickImportKey: InjectionKey<VehicleDefaultsJoystickImport> = Symbol(
  'vehicleDefaultsJoystickImport'
)

/**
 * Injects joystick defaults import state provided by a parent modal.
 * @returns {VehicleDefaultsJoystickImport} Shared joystick import state
 */
export const useVehicleDefaultsJoystickImportInject = (): VehicleDefaultsJoystickImport => {
  const context = inject(vehicleDefaultsJoystickImportKey)
  if (!context) {
    throw new Error('useVehicleDefaultsJoystickImportInject must be used within a vehicle defaults joystick provider')
  }
  return context
}
