/* eslint-disable vue/max-len */
/* eslint-disable prettier/prettier */
/* eslint-disable max-len */
import { type ArduPilotVehicleModeActionIdPattern } from '@/libs/vehicle/ardupilot/common'
import i18n from '@/plugins/i18n'
import { type ProtocolAction, JoystickProtocol } from '@/types/joystick'

/**
 * Possible functions in the MAVLink `MANUAL_CONTROL` message protocol
 */
export const CockpitActionsFunction = {
  go_to_next_view: 'go_to_next_view',
  go_to_previous_view: 'go_to_previous_view',
  toggle_full_screen: 'toggle_full_screen',
  mavlink_arm: 'mavlink_arm',
  mavlink_disarm: 'mavlink_disarm',
  toggle_bottom_bar: 'toggle_bottom_bar',
  toggle_top_bar: 'toggle_top_bar',
  start_recording_all_streams: 'start_recording_all_streams',
  stop_recording_all_streams: 'stop_recording_all_streams',
  toggle_recording_all_streams: 'toggle_recording_all_streams',
  take_snapshot: 'take_snapshot',
  hold_to_confirm: 'hold_to_confirm',
} as const

/**
 * Predefined cockpit action IDs
 */
type PredefinedCockpitActionId = (typeof CockpitActionsFunction)[keyof typeof CockpitActionsFunction]

/**
 * All valid cockpit action IDs
 */
export type CockpitActionsFunction = PredefinedCockpitActionId | ArduPilotVehicleModeActionIdPattern

/**
 * An action to be performed by Cockpit itself
 */
export class CockpitAction implements ProtocolAction {
  id: CockpitActionsFunction
  name: string
  readonly protocol = JoystickProtocol.CockpitAction

  // eslint-disable-next-line jsdoc/require-jsdoc
  constructor(id: CockpitActionsFunction, name: string) {
    this.id = id
    this.name = name
  }
}

// Getter function for dynamic translations
export const getCockpitActions = (): { [key in CockpitActionsFunction]: CockpitAction } => ({
  [CockpitActionsFunction.go_to_next_view]: new CockpitAction(CockpitActionsFunction.go_to_next_view, i18n.global.t('configuration.joystick.goToNextView')),
  [CockpitActionsFunction.go_to_previous_view]: new CockpitAction(CockpitActionsFunction.go_to_previous_view, i18n.global.t('configuration.joystick.goToPreviousView')),
  [CockpitActionsFunction.toggle_full_screen]: new CockpitAction(CockpitActionsFunction.toggle_full_screen, i18n.global.t('configuration.joystick.toggleFullScreen')),
  [CockpitActionsFunction.mavlink_arm]: new CockpitAction(CockpitActionsFunction.mavlink_arm, i18n.global.t('configuration.joystick.mavlinkArm')),
  [CockpitActionsFunction.mavlink_disarm]: new CockpitAction(CockpitActionsFunction.mavlink_disarm, i18n.global.t('configuration.joystick.mavlinkDisarm')),
  [CockpitActionsFunction.toggle_bottom_bar]: new CockpitAction(CockpitActionsFunction.toggle_bottom_bar, i18n.global.t('configuration.joystick.toggleBottomBar')),
  [CockpitActionsFunction.toggle_top_bar]: new CockpitAction(CockpitActionsFunction.toggle_top_bar, i18n.global.t('configuration.joystick.toggleTopBar')),
  [CockpitActionsFunction.start_recording_all_streams]: new CockpitAction(CockpitActionsFunction.start_recording_all_streams, i18n.global.t('configuration.joystick.startRecordingAllStreams')),
  [CockpitActionsFunction.stop_recording_all_streams]: new CockpitAction(CockpitActionsFunction.stop_recording_all_streams, i18n.global.t('configuration.joystick.stopRecordingAllStreams')),
  [CockpitActionsFunction.toggle_recording_all_streams]: new CockpitAction(CockpitActionsFunction.toggle_recording_all_streams, i18n.global.t('configuration.joystick.toggleRecordingAllStreams')),
  [CockpitActionsFunction.take_snapshot]: new CockpitAction(CockpitActionsFunction.take_snapshot, i18n.global.t('configuration.joystick.takeSnapshot')),
  [CockpitActionsFunction.hold_to_confirm]: new CockpitAction(CockpitActionsFunction.hold_to_confirm, i18n.global.t('configuration.joystick.holdToConfirm')),
})

// Predefined actions (for backward compatibility, initialized once)
export const predefinedCockpitActions: { [key in CockpitActionsFunction]: CockpitAction } = getCockpitActions()

export type CockpitActionCallback = () => void

/**
 * Callback entry
 */
interface CallbackEntry {
  /**
   * Unique ID for that callback register
   */
  action: CockpitAction
  /**
   * Callback to be called
   */
  callback: CockpitActionCallback
}

/**
 * Responsible for routing cockpit actions
 */
export class CockpitActionsManager {
  actionsCallbacks: Record<string, CallbackEntry> = {}

  // Make availableActions a getter so it always returns fresh translations
  /**
   * Get available Cockpit actions with current translations
   * @returns {object} Record of all available Cockpit actions
   */
  get availableActions(): { [key in CockpitActionsFunction]: CockpitAction } {
    return getCockpitActions()
  }

  registerNewAction = (action: CockpitAction): void => {
    // Note: This won't work with getter, but it's not commonly used
    console.warn('registerNewAction is not supported with dynamic translations')
  }

  unregisterAction = (id: CockpitActionsFunction): void => {
    // Note: This won't work with getter, but it's not commonly used
    console.warn('unregisterAction is not supported with dynamic translations')
  }

  registerActionCallback = (action: CockpitAction, callback: CockpitActionCallback): string => {
    this.actionsCallbacks[action.id] = { action, callback }
    return action.id
  }

  unregisterActionCallback = (id: string): void => {
    delete this.actionsCallbacks[id]
  }

  executeActionCallback = (id: string): void => {
    const callbackEntry = this.actionsCallbacks[id]
    if (!callbackEntry) {
      console.error(`Callback for action ${id} not found.`)
      return
    }

    console.debug(`Executing action callback for action ${id}.`)
    try {
      callbackEntry.callback()
    } catch (error) {
      console.error(`Error executing action callback for action ${id}.`, error)
    }
  }
}

export const cockpitActionsManager = new CockpitActionsManager()

export const registerNewAction = (action: CockpitAction): void => {
  cockpitActionsManager.registerNewAction(action)
  console.debug(`Registered new action ${action.name} with id (${action.id}).`)
}

export const deleteAction = (id: CockpitActionsFunction): void => {
  cockpitActionsManager.unregisterAction(id)
  console.debug(`Unregistered action with id (${id}).`)
}

export const registerActionCallback = (action: CockpitAction, callback: CockpitActionCallback): string => {
  return cockpitActionsManager.registerActionCallback(action, callback)
}

export const unregisterActionCallback = (id: string): void => {
  cockpitActionsManager.unregisterActionCallback(id)
}

export const executeActionCallback = (id: string): void => {
  cockpitActionsManager.executeActionCallback(id)
}

// Export for backward compatibility
export const availableCockpitActions = cockpitActionsManager.availableActions

// Export getter function for dynamic translations
export const getAvailableCockpitActions = (): { [key in CockpitActionsFunction]: CockpitAction } => {
  return getCockpitActions()
}

/**
 * Action configuration interface
 */
export interface ActionConfig {
  /**
   * Action ID
   */
  id: string
  /**
   * Action name
   */
  name: string
  /**
   * Action type
   */
  type: customActionTypes
  /**
   * Action configuration
   * Specific to the action type
   */
  config: any
}

/**
 * Custom action types
 */
export enum customActionTypes {
  httpRequest = 'http-request',
  mavlinkMessage = 'mavlink-message',
  javascript = 'javascript',
}
