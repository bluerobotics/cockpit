import { type Ref, ref } from 'vue'

import { OtherProtocol } from '@/libs/joystick/protocols/other'
import {
  type DefaultsEvaluation,
  evaluateDefaults,
  isMappingBlank,
  isViewsGroupBlank,
} from '@/migration/default-profile-importer'
import { useControllerStore } from '@/stores/controller'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { JoystickProtocolActionsMapping } from '@/types/joystick'

/** One importable joystick binding shown in the defaults import UI */
export interface JoystickImportRow {
  /** Unique row identifier (axis or button slot) */
  id: string
  /** Axis index when this row describes an axis binding */
  axisKey?: string
  /** Button modifier key when this row describes a button binding */
  modifier?: string
  /** Button index when this row describes a button binding */
  buttonKey?: number
  /** Display label for the input slot (e.g. "Axis 0", "Button 3 (regular)") */
  inputLabel: string
  /** Current function name bound to this input */
  fromActionName: string
  /** Default function name that would be imported */
  toActionName: string
}

type JoystickMappingActionRef = {
  /**
   * Protocol action reference
   */
  action: {
    /**
     * Protocol action ID
     */
    id: string
    /**
     * Protocol action name
     */
    name: string
  }
}

const signed = (n: number): string => (n >= 0 ? `+${n}` : `${n}`)

/** Reactive bundle returned by {@link useVehicleDefaultsEvaluation}, shared by the auto wizard and the manual modals. */
export interface VehicleDefaultsEvaluationBundle {
  /** Current defaults evaluation for the connected vehicle, or null when no vehicle is connected */
  evaluation: Ref<DefaultsEvaluation | null>
  /** True when the user's current views group still matches the blank template */
  isCurrentViewsGroupBlank: Ref<boolean>
  /** True when the user's current joystick mapping still matches the blank template */
  isCurrentMappingBlank: Ref<boolean>
  /** Number of views currently in the user's group, used for "replace N views" copy */
  currentViewsCount: Ref<number>
  /** Re-runs the evaluation against the current stores; call when a modal opens */
  refreshEvaluation: () => void
}

/**
 * Builds the list of joystick bindings that differ from the vehicle default mapping.
 * @param {JoystickProtocolActionsMapping} currentMapping - The user's current mapping
 * @param {JoystickProtocolActionsMapping} defaultMapping - The vehicle-type default mapping
 * @returns {JoystickImportRow[]} Rows to show in the import UI
 */
export const buildJoystickImportRows = (
  currentMapping: JoystickProtocolActionsMapping,
  defaultMapping: JoystickProtocolActionsMapping
): JoystickImportRow[] => {
  const rows: JoystickImportRow[] = []

  const pushAxisDiff = (axisKey: string, defaultCorr: (typeof defaultMapping.axesCorrespondencies)[string]): void => {
    const currentCorr =
      currentMapping.axesCorrespondencies[axisKey as unknown as keyof typeof currentMapping.axesCorrespondencies]
    const defaultId = defaultCorr.action.id
    const currentId = currentCorr?.action.id ?? OtherProtocol.no_function
    if (defaultId === currentId && currentCorr) {
      if (currentCorr.min !== defaultCorr.min || currentCorr.max !== defaultCorr.max) {
        rows.push({
          id: `axis-${axisKey}`,
          axisKey,
          inputLabel: `Axis ${axisKey}`,
          fromActionName: `${currentCorr.action.name} (${signed(currentCorr.min)} / ${signed(currentCorr.max)})`,
          toActionName: `${defaultCorr.action.name} (${signed(defaultCorr.min)} / ${signed(defaultCorr.max)})`,
        })
      }
      return
    }
    if (defaultId === OtherProtocol.no_function && currentId === OtherProtocol.no_function) return
    rows.push({
      id: `axis-${axisKey}`,
      axisKey,
      inputLabel: `Axis ${axisKey}`,
      fromActionName: currentCorr?.action.name ?? 'Unassigned',
      toActionName: defaultCorr.action.name,
    })
  }

  const pushButtonDiff = (
    modKey: string,
    btnKey: string,
    defaultBtn: JoystickMappingActionRef,
    currentBtn?: JoystickMappingActionRef
  ): void => {
    const defaultId = defaultBtn.action.id
    const currentId = currentBtn?.action.id ?? OtherProtocol.no_function
    if (defaultId === currentId) return
    if (defaultId === OtherProtocol.no_function && currentId === OtherProtocol.no_function) return
    rows.push({
      id: `btn-${modKey}-${btnKey}`,
      modifier: modKey,
      buttonKey: Number(btnKey),
      inputLabel: `Button ${btnKey} (${modKey})`,
      fromActionName: currentBtn?.action.name ?? 'Unassigned',
      toActionName: defaultBtn.action.name,
    })
  }

  for (const [axisKey, defaultCorr] of Object.entries(defaultMapping.axesCorrespondencies)) {
    pushAxisDiff(axisKey, defaultCorr)
  }

  for (const [modKey, defaultButtons] of Object.entries(defaultMapping.buttonsCorrespondencies)) {
    const currentButtons =
      currentMapping.buttonsCorrespondencies[modKey as keyof typeof currentMapping.buttonsCorrespondencies]
    for (const [btnKey, defaultBtn] of Object.entries(defaultButtons)) {
      const currentBtn = currentButtons?.[btnKey as unknown as number]
      pushButtonDiff(modKey, btnKey, defaultBtn, currentBtn)
    }
  }

  return rows
}

/**
 * Loads the defaults evaluation for the connected vehicle and related UI flags.
 * @returns {VehicleDefaultsEvaluationBundle} Evaluation state and a refresh helper for when the modal opens
 */
export const useVehicleDefaultsEvaluation = (): VehicleDefaultsEvaluationBundle => {
  const widgetStore = useWidgetManagerStore()
  const controllerStore = useControllerStore()
  const mainVehicleStore = useMainVehicleStore()

  const evaluation = ref<DefaultsEvaluation | null>(null)
  const isCurrentViewsGroupBlank = ref(false)
  const isCurrentMappingBlank = ref(false)
  const currentViewsCount = ref(0)

  const refreshEvaluation = (): void => {
    const vehicleType = mainVehicleStore.vehicleType
    if (vehicleType === undefined) {
      evaluation.value = null
      return
    }
    evaluation.value = evaluateDefaults(vehicleType, widgetStore.viewsGroup, controllerStore.protocolMapping)
    isCurrentViewsGroupBlank.value = isViewsGroupBlank(widgetStore.viewsGroup)
    isCurrentMappingBlank.value = isMappingBlank(controllerStore.protocolMapping)
    currentViewsCount.value = widgetStore.viewsGroup.views.length
  }

  return { evaluation, isCurrentViewsGroupBlank, isCurrentMappingBlank, currentViewsCount, refreshEvaluation }
}
