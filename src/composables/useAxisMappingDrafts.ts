import { computed, onUnmounted, ref, watch } from 'vue'

import { openSnackbar } from '@/composables/snackbar'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import {
  type AxisRangeIssue,
  findAxisRangeIssues,
  findOffDefaultAxisEndpoints,
  getDefaultAxisCorrespondence,
} from '@/libs/joystick/default-mappings'
import { otherAvailableActions } from '@/libs/joystick/protocols/other'
import { useControllerStore } from '@/stores/controller'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import type { AxisCorrespondence, JoystickAxis } from '@/types/joystick'

const noFunctionId = otherAvailableActions.no_function.id

/** A pending axis range that needs a second look, and the vehicle default it was compared to */
export interface AxisRangeReview {
  /** Vehicle type the default belongs to */
  vehicleType: MavType
  /** Vehicle default for the axis' function */
  defaultMapping: AxisCorrespondence
  /** What is wrong with the pending range */
  issues: AxisRangeIssue[]
  /** Endpoints of the pending range that cause the issues */
  offEndpoints: ('min' | 'max')[]
}

const isSameMapping = (a: AxisCorrespondence, b: AxisCorrespondence): boolean =>
  a.action.id === b.action.id && a.min === b.min && a.max === b.max

/**
 * Holds unsaved edits to the joystick axis mapping, so a function or range change only reaches the vehicle once
 * the user saves that axis.
 * @returns {object} Draft state and the handlers to edit, save and revert an axis
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useAxisMappingDrafts = () => {
  const controllerStore = useControllerStore()
  const mainVehicleStore = useMainVehicleStore()

  const drafts = ref<Partial<Record<JoystickAxis, AxisCorrespondence>>>({})

  const hasDirtyAxes = computed(() => Object.keys(drafts.value).length > 0)

  const discardDrafts = (reason: string): void => {
    if (!hasDirtyAxes.value) return
    drafts.value = {}
    openSnackbar({ message: `Unsaved axis changes were discarded because ${reason}.`, variant: 'warning' })
  }

  // An import or a sync replaces the mapping whole, so the pending edits no longer describe what they would change.
  watch(
    () => controllerStore.protocolMapping,
    () => discardDrafts('the joystick mapping was replaced')
  )

  onUnmounted(() => discardDrafts('the joystick configuration was closed'))

  const savedMapping = (axis: JoystickAxis): AxisCorrespondence =>
    controllerStore.protocolMapping.axesCorrespondencies[axis]

  const axisMapping = (axis: JoystickAxis): AxisCorrespondence => drafts.value[axis] ?? savedMapping(axis)

  const isAxisDirty = (axis: JoystickAxis): boolean => drafts.value[axis] !== undefined

  const axes = (): JoystickAxis[] =>
    Object.keys(controllerStore.protocolMapping.axesCorrespondencies).map(Number) as JoystickAxis[]

  const isReleaseOf = (axis: JoystickAxis, actionId: string): boolean => {
    const draft = drafts.value[axis]
    const saved = savedMapping(axis)
    return (
      !!draft &&
      saved.action.id === actionId &&
      isSameMapping(draft, { ...saved, action: otherAvailableActions.no_function })
    )
  }

  const restoreReleasedAxes = (actionId: string): void => {
    if (actionId === noFunctionId || axes().some((axis) => drafts.value[axis]?.action.id === actionId)) return
    axes()
      .filter((axis) => isReleaseOf(axis, actionId))
      .forEach((axis) => delete drafts.value[axis])
  }

  const editAxis = (axis: JoystickAxis, change: Partial<AxisCorrespondence>): void => {
    const previousActionId = axisMapping(axis).action.id
    const next = { ...axisMapping(axis), ...change }
    if (isSameMapping(next, savedMapping(axis))) {
      delete drafts.value[axis]
    } else {
      drafts.value[axis] = next
    }

    const actionId = axisMapping(axis).action.id
    if (actionId === previousActionId) return
    restoreReleasedAxes(previousActionId)
    if (actionId === noFunctionId) return
    // A function drives a single axis, so taking it releases the axis holding it, as an edit of its own to be saved.
    axes()
      .filter((other) => other !== axis && axisMapping(other).action.id === actionId)
      .forEach((other) => editAxis(other, { action: otherAvailableActions.no_function }))
  }

  /**
   * The saved axis still holding the function this axis is about to take, which has to be saved first.
   * @param {JoystickAxis} axis - The axis being saved
   * @returns {JoystickAxis | undefined} The axis blocking the save, if any
   */
  const blockingAxis = (axis: JoystickAxis): JoystickAxis | undefined => {
    const actionId = axisMapping(axis).action.id
    if (actionId === noFunctionId) return undefined
    return axes().find((other) => other !== axis && savedMapping(other).action.id === actionId)
  }

  const canSaveAxis = (axis: JoystickAxis): boolean => {
    const { min, max } = axisMapping(axis)
    return isAxisDirty(axis) && Number.isFinite(min) && Number.isFinite(max) && blockingAxis(axis) === undefined
  }

  const rangeCheckVehicleType = computed(
    () => mainVehicleStore.vehicleType ?? mainVehicleStore.lastConnectedVehicleType ?? undefined
  )

  /**
   * What is wrong with the axis' pending range for the vehicle (the last one connected, when none is), next to the
   * default it should be compared to.
   * @param {JoystickAxis} axis - The axis being saved
   * @returns {AxisRangeReview | undefined} The default and the issues found, or undefined when the range is fine or
   * there is no default to compare to
   */
  const rangeIssues = (axis: JoystickAxis): AxisRangeReview | undefined => {
    const vehicleType = rangeCheckVehicleType.value
    if (!vehicleType) return undefined
    const mapping = axisMapping(axis)
    const defaultMapping = getDefaultAxisCorrespondence(vehicleType, mapping.action.id)
    if (!defaultMapping) return undefined
    const issues = findAxisRangeIssues(mapping, defaultMapping)
    if (issues.length === 0) return undefined
    return {
      vehicleType,
      defaultMapping,
      issues,
      offEndpoints: findOffDefaultAxisEndpoints(mapping, defaultMapping),
    }
  }

  const saveAxis = (axis: JoystickAxis, range?: Pick<AxisCorrespondence, 'min' | 'max'>): void => {
    const draft = drafts.value[axis]
    if (!draft) return
    controllerStore.protocolMapping.axesCorrespondencies[axis] = { ...draft, ...range, action: { ...draft.action } }
    delete drafts.value[axis]
  }

  const revertAxis = (axis: JoystickAxis): void => {
    const draft = drafts.value[axis]
    if (!draft) return
    delete drafts.value[axis]
    restoreReleasedAxes(draft.action.id)
  }

  return {
    axisMapping,
    isAxisDirty,
    editAxis,
    blockingAxis,
    canSaveAxis,
    rangeCheckVehicleType,
    rangeIssues,
    saveAxis,
    revertAxis,
  }
}
