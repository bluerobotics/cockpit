import { v4 as uuid4 } from 'uuid'

import { actionDisplayName } from '@/libs/joystick/protocols/cockpit-actions'
import { modifierKeyActions, otherAvailableActions } from '@/libs/joystick/protocols/other'
import {
  type JoystickProtocolActionsMapping,
  type ProtocolAction,
  CockpitModifierKeyOption,
  JoystickProtocol,
} from '@/types/joystick'

import { type WizardAxisStep } from './types'

/**
 * The values an axis takes at each end of its travel.
 */
export interface AxisRange {
  /**
   * Value commanded when the axis is fully negative
   */
  min: number
  /**
   * Value commanded when the axis is fully positive
   */
  max: number
}

/**
 * A binding the wizard produced, as shown on the review screen.
 */
export interface WizardMappingRow {
  /**
   * Whether the bound input is an axis or a button
   */
  type: 'axis' | 'button'
  /**
   * Index of the bound input, in Cockpit-standard numbering
   */
  index: number
  /**
   * Input description, including the shift prefix when the binding needs the modifier
   */
  label: string
  /**
   * Name of the action the input triggers
   */
  action: string
  /**
   * Range an axis binding commands, so the review screen can show the value that reaches the vehicle
   */
  range?: AxisRange
}

/**
 * Build the mapping the wizard fills in, as a copy of the one the controller uses today so that the inputs the user
 * skips keep whatever they were bound to.
 * @param {string} name - Name to identify the resulting mapping
 * @param {JoystickProtocolActionsMapping} base - Mapping to start from, left untouched
 * @returns {JoystickProtocolActionsMapping} The base bindings under a new name and hash
 */
export const createWizardMapping = (
  name: string,
  base: JoystickProtocolActionsMapping
): JoystickProtocolActionsMapping => {
  const copy = structuredClone(base)
  return {
    name,
    hash: uuid4(),
    axesCorrespondencies: copy.axesCorrespondencies ?? {},
    buttonsCorrespondencies: {
      [CockpitModifierKeyOption.regular]: copy.buttonsCorrespondencies?.[CockpitModifierKeyOption.regular] ?? {},
      [CockpitModifierKeyOption.shift]: copy.buttonsCorrespondencies?.[CockpitModifierKeyOption.shift] ?? {},
    },
  }
}

const isBound = (action: ProtocolAction | undefined): boolean =>
  action !== undefined && action.id !== otherAvailableActions.no_function.id

/**
 * Turn the direction the user pushed into the axis range, so that pushing that way always commands the positive
 * function (ascend, forward, starboard, right) whatever way round the stick reads.
 * @param {number} deflection - Value of the axis at its largest deflection during detection
 * @param {WizardAxisStep} step - Step being mapped, which carries the scale the autopilot expects
 * @returns {AxisRange} Values the mapping should hold at each end of the axis travel
 */
const axisRangeForDeflection = (deflection: number, step: WizardAxisStep): AxisRange => {
  const chosenIsNegative = deflection < 0
  const idle = step.unipolar ? 0 : -step.fullScale
  return chosenIsNegative ? { min: step.fullScale, max: idle } : { min: idle, max: step.fullScale }
}

/**
 * Get the action already occupying an axis.
 * @param {JoystickProtocolActionsMapping} mapping - Mapping to inspect
 * @param {number} index - Index of the axis
 * @returns {ProtocolAction | undefined} The action bound to it, or undefined when the axis is free
 */
export const axisOccupant = (mapping: JoystickProtocolActionsMapping, index: number): ProtocolAction | undefined => {
  const action = mapping.axesCorrespondencies[index]?.action
  return isBound(action) ? action : undefined
}

/**
 * Get the action already occupying a button on one of the layouts.
 * @param {JoystickProtocolActionsMapping} mapping - Mapping to inspect
 * @param {CockpitModifierKeyOption} modifier - Layout the button belongs to
 * @param {number} index - Index of the button
 * @returns {ProtocolAction | undefined} The action bound to it, or undefined when the button is free
 */
export const buttonOccupant = (
  mapping: JoystickProtocolActionsMapping,
  modifier: CockpitModifierKeyOption,
  index: number
): ProtocolAction | undefined => {
  const action = mapping.buttonsCorrespondencies[modifier][index]?.action
  return isBound(action) ? action : undefined
}

/**
 * Remove every binding of an action, so remapping it never leaves the previous input still triggering it.
 * @param {JoystickProtocolActionsMapping} mapping - Mapping to edit
 * @param {string} actionId - Identifier of the action to unbind
 */
export const unbindAction = (mapping: JoystickProtocolActionsMapping, actionId: string): void => {
  Object.entries(mapping.axesCorrespondencies).forEach(([index, corr]) => {
    if (corr.action.id === actionId) delete mapping.axesCorrespondencies[Number(index)]
  })
  Object.values(CockpitModifierKeyOption).forEach((modifier) => {
    const layout = mapping.buttonsCorrespondencies[modifier]
    Object.entries(layout).forEach(([index, corr]) => {
      if (corr.action.id === actionId) delete layout[Number(index)]
    })
  })
}

/**
 * Bind an axis to the action of a step, oriented by the direction the user pushed.
 * @param {JoystickProtocolActionsMapping} mapping - Mapping to edit
 * @param {number} index - Index of the axis to bind
 * @param {WizardAxisStep} step - Step being mapped
 * @param {number} deflection - Value of the axis at its largest deflection during detection
 */
export const bindAxis = (
  mapping: JoystickProtocolActionsMapping,
  index: number,
  step: WizardAxisStep,
  deflection: number
): void => {
  unbindAction(mapping, step.action.id)
  mapping.axesCorrespondencies[index] = { action: step.action, ...axisRangeForDeflection(deflection, step) }
}

/**
 * Find the button that already acts as the shift modifier in a mapping.
 * @param {JoystickProtocolActionsMapping} mapping - Mapping to search
 * @returns {number | undefined} Index of the regular-layout button holding the modifier, or undefined when none does
 */
export const shiftButtonInMapping = (mapping: JoystickProtocolActionsMapping): number | undefined => {
  const regular = mapping.buttonsCorrespondencies[CockpitModifierKeyOption.regular]
  const entry = Object.entries(regular).find(([, binding]) => binding?.action.id === modifierKeyActions.shift.id)
  return entry === undefined ? undefined : Number(entry[0])
}

/**
 * Bind a button on one of the layouts to an action.
 * @param {JoystickProtocolActionsMapping} mapping - Mapping to edit
 * @param {CockpitModifierKeyOption} modifier - Layout the button belongs to
 * @param {number} index - Index of the button to bind
 * @param {ProtocolAction} action - Action the button should trigger
 */
export const bindButton = (
  mapping: JoystickProtocolActionsMapping,
  modifier: CockpitModifierKeyOption,
  index: number,
  action: ProtocolAction
): void => {
  unbindAction(mapping, action.id)
  mapping.buttonsCorrespondencies[modifier][index] = { action }
}

/**
 * List every binding the wizard holds, for the review screen.
 * @param {JoystickProtocolActionsMapping} mapping - Mapping to list
 * @returns {WizardMappingRow[]} Axis rows first, then the regular and shift button rows
 */
export const wizardMappingRows = (mapping: JoystickProtocolActionsMapping): WizardMappingRow[] => {
  const rows: WizardMappingRow[] = []

  Object.entries(mapping.axesCorrespondencies).forEach(([index, corr]) => {
    if (!isBound(corr.action)) return
    const { min, max } = corr
    rows.push({
      type: 'axis',
      index: Number(index),
      label: `Axis ${index}`,
      action: corr.action.name,
      range: { min, max },
    })
  })

  Object.values(CockpitModifierKeyOption).forEach((modifier) => {
    Object.entries(mapping.buttonsCorrespondencies[modifier]).forEach(([index, corr]) => {
      if (!isBound(corr.action)) return
      const prefix = modifier === CockpitModifierKeyOption.shift ? 'Shift + ' : ''
      const name =
        corr.action.protocol === JoystickProtocol.CockpitAction ? actionDisplayName(corr.action) : corr.action.name
      rows.push({ type: 'button', index: Number(index), label: `${prefix}Button ${index}`, action: name })
    })
  })

  return rows
}
