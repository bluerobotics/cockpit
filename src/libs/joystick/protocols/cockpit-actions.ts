/* eslint-disable vue/max-len */
/* eslint-disable prettier/prettier */
/* eslint-disable max-len */
import { type ProtocolAction,JoystickProtocol } from '@/types/joystick'

/**
 * Possible functions in the MAVLink `MANUAL_CONTROL` message protocol
 */
export enum CockpitActionsFunction {
  go_to_next_view = 'go_to_next_view',
  go_to_previous_view = 'go_to_previous_view',
  toggle_full_screen = 'toggle_full_screen',
  mavlink_arm = 'mavlink_arm',
  mavlink_disarm = 'mavlink_disarm',
  toggle_bottom_bar = 'toggle_bottom_bar',
  toggle_top_bar = 'toggle_top_bar',
  start_recording_all_streams = 'start_recording_all_streams',
  stop_recording_all_streams = 'stop_recording_all_streams',
  hold_to_confirm = 'hold_to_confirm',
}

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

// Predefined actions
export const predefinedCockpitActions: { [key in CockpitActionsFunction]: CockpitAction } = {
  [CockpitActionsFunction.go_to_next_view]: new CockpitAction(CockpitActionsFunction.go_to_next_view, 'Go to next view'),
  [CockpitActionsFunction.go_to_previous_view]: new CockpitAction(CockpitActionsFunction.go_to_previous_view, 'Go to previous view'),
  [CockpitActionsFunction.toggle_full_screen]: new CockpitAction(CockpitActionsFunction.toggle_full_screen, 'Toggle full screen'),
  [CockpitActionsFunction.mavlink_arm]: new CockpitAction(CockpitActionsFunction.mavlink_arm, 'Mavlink arm'),
  [CockpitActionsFunction.mavlink_disarm]: new CockpitAction(CockpitActionsFunction.mavlink_disarm, 'Mavlink disarm'),
  [CockpitActionsFunction.toggle_bottom_bar]: new CockpitAction(CockpitActionsFunction.toggle_bottom_bar, 'Toggle bottom bar'),
  [CockpitActionsFunction.toggle_top_bar]: new CockpitAction(CockpitActionsFunction.toggle_top_bar, 'Toggle top bar'),
  [CockpitActionsFunction.start_recording_all_streams]: new CockpitAction(CockpitActionsFunction.start_recording_all_streams, 'Start recording all streams'),
  [CockpitActionsFunction.stop_recording_all_streams]: new CockpitAction(CockpitActionsFunction.stop_recording_all_streams, 'Stop recording all streams'),
  [CockpitActionsFunction.hold_to_confirm]: new CockpitAction(CockpitActionsFunction.hold_to_confirm, 'Hold to confirm'),
}

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
  availableActions: { [key in CockpitActionsFunction]: CockpitAction } = { ...predefinedCockpitActions }
  actionsCallbacks: Record<string, CallbackEntry> = {}

  registerNewAction = (action: CockpitAction): void => {
    this.availableActions[action.id] = action
  }

  unregisterAction = (id: CockpitActionsFunction): void => {
    delete this.availableActions[id]
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

export const availableCockpitActions = cockpitActionsManager.availableActions
