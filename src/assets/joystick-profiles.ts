import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { JoystickModel } from '@/libs/joystick/manager'
import { availableCockpitActions } from '@/libs/joystick/protocols/cockpit-actions'
import {
  availableMavlinkManualControlButtonFunctions,
  mavlinkManualControlAxes,
} from '@/libs/joystick/protocols/mavlink-manual-control'
import { modifierKeyActions, otherAvailableActions } from '@/libs/joystick/protocols/other'
import {
  type GamepadToCockpitStdMapping,
  type JoystickProtocolActionsMapping,
  CockpitModifierKeyOption,
  JoystickAxis,
  JoystickButton,
} from '@/types/joystick'

export const defaultRovMappingHash = '10b0075a-27a7-4800-ba95-f35fd722d1df'
export const defaultBoatMappingHash = 'd3427f20-ba28-4cf7-ae24-ec740dd6dce0'
export const defaultMavMappingHash = 'dd654387-18fc-4674-89a6-4dc4d0bc8240'

export const defaultProtocolMappingVehicleCorrespondency = {
  [MavType.MAV_TYPE_SUBMARINE]: defaultRovMappingHash,
  [MavType.MAV_TYPE_SURFACE_BOAT]: defaultBoatMappingHash,
  [MavType.MAV_TYPE_QUADROTOR]: defaultMavMappingHash,
}

// TODO: Adjust mapping for PS5 controller
export const cockpitStandardToProtocols: JoystickProtocolActionsMapping[] = [
  {
    name: 'ROV functions mapping',
    hash: defaultRovMappingHash,
    axesCorrespondencies: {
      [JoystickAxis.A0]: { action: mavlinkManualControlAxes.axis_y, min: -1000, max: +1000 },
      [JoystickAxis.A1]: { action: mavlinkManualControlAxes.axis_x, min: +1000, max: -1000 },
      [JoystickAxis.A2]: { action: mavlinkManualControlAxes.axis_r, min: -1000, max: +1000 },
      [JoystickAxis.A3]: { action: mavlinkManualControlAxes.axis_z, min: +1000, max: 0 },
    },
    buttonsCorrespondencies: {
      [CockpitModifierKeyOption.regular]: {
        [JoystickButton.B0]: { action: modifierKeyActions.shift },
        [JoystickButton.B1]: { action: availableMavlinkManualControlButtonFunctions['Mode manual'] },
        [JoystickButton.B2]: { action: availableMavlinkManualControlButtonFunctions['Mode depth hold'] },
        [JoystickButton.B3]: { action: availableMavlinkManualControlButtonFunctions['Mode stabilize'] },
        [JoystickButton.B4]: { action: availableCockpitActions.go_to_previous_view },
        [JoystickButton.B5]: { action: availableCockpitActions.go_to_next_view },
        [JoystickButton.B6]: { action: availableMavlinkManualControlButtonFunctions['Mount tilt down'] },
        [JoystickButton.B7]: { action: availableMavlinkManualControlButtonFunctions['Mount tilt up'] },
        [JoystickButton.B8]: { action: availableMavlinkManualControlButtonFunctions['Disarm'] },
        [JoystickButton.B9]: { action: availableMavlinkManualControlButtonFunctions['Arm'] },
        [JoystickButton.B10]: { action: availableMavlinkManualControlButtonFunctions['Mount center'] },
        [JoystickButton.B11]: { action: availableMavlinkManualControlButtonFunctions['Input hold set'] },
        [JoystickButton.B12]: { action: availableMavlinkManualControlButtonFunctions['Gain inc'] },
        [JoystickButton.B13]: { action: availableMavlinkManualControlButtonFunctions['Gain dec'] },
        [JoystickButton.B14]: { action: availableMavlinkManualControlButtonFunctions['Lights1 dimmer'] },
        [JoystickButton.B15]: { action: availableMavlinkManualControlButtonFunctions['Lights1 brighter'] },
        [JoystickButton.B16]: { action: availableCockpitActions.toggle_bottom_bar },
        [JoystickButton.B17]: { action: availableMavlinkManualControlButtonFunctions['Roll pitch toggle'] },
      },
      [CockpitModifierKeyOption.shift]: {
        [JoystickButton.B0]: { action: otherAvailableActions.no_function },
        [JoystickButton.B1]: { action: otherAvailableActions.no_function },
        [JoystickButton.B2]: { action: availableMavlinkManualControlButtonFunctions['Mode poshold'] },
        [JoystickButton.B3]: { action: availableMavlinkManualControlButtonFunctions['Mode acro'] },
        [JoystickButton.B4]: { action: otherAvailableActions.no_function },
        [JoystickButton.B5]: { action: otherAvailableActions.no_function },
        [JoystickButton.B6]: { action: availableMavlinkManualControlButtonFunctions['Servo 1 min'] },
        [JoystickButton.B7]: { action: availableMavlinkManualControlButtonFunctions['Servo 1 max'] },
        [JoystickButton.B8]: { action: otherAvailableActions.no_function },
        [JoystickButton.B9]: { action: otherAvailableActions.no_function },
        [JoystickButton.B10]: { action: availableMavlinkManualControlButtonFunctions['Relay 1 toggle'] },
        [JoystickButton.B11]: { action: otherAvailableActions.no_function },
        [JoystickButton.B12]: { action: availableMavlinkManualControlButtonFunctions['Trim pitch inc'] },
        [JoystickButton.B13]: { action: availableMavlinkManualControlButtonFunctions['Trim pitch dec'] },
        [JoystickButton.B14]: { action: availableMavlinkManualControlButtonFunctions['Trim roll dec'] },
        [JoystickButton.B15]: { action: availableMavlinkManualControlButtonFunctions['Trim roll inc'] },
        [JoystickButton.B16]: { action: availableCockpitActions.toggle_top_bar },
        [JoystickButton.B17]: { action: otherAvailableActions.no_function },
      },
    },
  },
  {
    name: 'Boat functions mapping',
    hash: defaultBoatMappingHash,
    axesCorrespondencies: {
      [JoystickAxis.A0]: { action: mavlinkManualControlAxes.axis_y, min: -1000, max: +1000 },
      [JoystickAxis.A1]: { action: mavlinkManualControlAxes.axis_x, min: +1000, max: -1000 },
      [JoystickAxis.A2]: { action: mavlinkManualControlAxes.axis_r, min: -1000, max: +1000 },
      [JoystickAxis.A3]: { action: mavlinkManualControlAxes.axis_z, min: +1000, max: -1000 },
    },
    buttonsCorrespondencies: {
      [CockpitModifierKeyOption.regular]: {
        [JoystickButton.B0]: { action: modifierKeyActions.shift },
        [JoystickButton.B1]: { action: otherAvailableActions.no_function },
        [JoystickButton.B2]: { action: otherAvailableActions.no_function },
        [JoystickButton.B3]: { action: otherAvailableActions.no_function },
        [JoystickButton.B4]: { action: availableCockpitActions.go_to_previous_view },
        [JoystickButton.B5]: { action: availableCockpitActions.go_to_next_view },
        [JoystickButton.B6]: { action: otherAvailableActions.no_function },
        [JoystickButton.B7]: { action: otherAvailableActions.no_function },
        [JoystickButton.B8]: { action: availableCockpitActions.mavlink_disarm },
        [JoystickButton.B9]: { action: availableCockpitActions.mavlink_arm },
        [JoystickButton.B10]: { action: otherAvailableActions.no_function },
        [JoystickButton.B11]: { action: otherAvailableActions.no_function },
        [JoystickButton.B12]: { action: otherAvailableActions.no_function },
        [JoystickButton.B13]: { action: otherAvailableActions.no_function },
        [JoystickButton.B14]: { action: otherAvailableActions.no_function },
        [JoystickButton.B15]: { action: availableCockpitActions.toggle_top_bar },
        [JoystickButton.B16]: { action: availableCockpitActions.toggle_bottom_bar },
        [JoystickButton.B17]: { action: otherAvailableActions.no_function },
      },
      [CockpitModifierKeyOption.shift]: {
        [JoystickButton.B0]: { action: otherAvailableActions.no_function },
        [JoystickButton.B1]: { action: otherAvailableActions.no_function },
        [JoystickButton.B2]: { action: otherAvailableActions.no_function },
        [JoystickButton.B3]: { action: otherAvailableActions.no_function },
        [JoystickButton.B4]: { action: otherAvailableActions.no_function },
        [JoystickButton.B5]: { action: otherAvailableActions.no_function },
        [JoystickButton.B6]: { action: otherAvailableActions.no_function },
        [JoystickButton.B7]: { action: otherAvailableActions.no_function },
        [JoystickButton.B8]: { action: otherAvailableActions.no_function },
        [JoystickButton.B9]: { action: otherAvailableActions.no_function },
        [JoystickButton.B10]: { action: otherAvailableActions.no_function },
        [JoystickButton.B11]: { action: otherAvailableActions.no_function },
        [JoystickButton.B12]: { action: otherAvailableActions.no_function },
        [JoystickButton.B13]: { action: otherAvailableActions.no_function },
        [JoystickButton.B14]: { action: otherAvailableActions.no_function },
        [JoystickButton.B15]: { action: otherAvailableActions.no_function },
        [JoystickButton.B16]: { action: otherAvailableActions.no_function },
        [JoystickButton.B17]: { action: otherAvailableActions.no_function },
      },
    },
  },
  {
    name: 'MAV functions mapping',
    hash: defaultMavMappingHash,
    axesCorrespondencies: {
      [JoystickAxis.A0]: { action: mavlinkManualControlAxes.axis_r, min: -1000, max: +1000 },
      [JoystickAxis.A1]: { action: mavlinkManualControlAxes.axis_z, min: +1000, max: 0 },
      [JoystickAxis.A2]: { action: mavlinkManualControlAxes.axis_y, min: -1000, max: +1000 },
      [JoystickAxis.A3]: { action: mavlinkManualControlAxes.axis_x, min: +1000, max: -1000 },
    },
    buttonsCorrespondencies: {
      [CockpitModifierKeyOption.regular]: {
        [JoystickButton.B0]: { action: availableCockpitActions.mavlink_disarm },
        [JoystickButton.B1]: { action: availableCockpitActions.mavlink_arm },
        [JoystickButton.B2]: { action: otherAvailableActions.no_function },
        [JoystickButton.B3]: { action: otherAvailableActions.no_function },
        [JoystickButton.B4]: { action: availableCockpitActions.go_to_previous_view },
        [JoystickButton.B5]: { action: availableCockpitActions.go_to_next_view },
        [JoystickButton.B6]: { action: otherAvailableActions.no_function },
        [JoystickButton.B7]: { action: otherAvailableActions.no_function },
        [JoystickButton.B8]: { action: otherAvailableActions.no_function },
        [JoystickButton.B9]: { action: otherAvailableActions.no_function },
        [JoystickButton.B10]: { action: otherAvailableActions.no_function },
        [JoystickButton.B11]: { action: otherAvailableActions.no_function },
        [JoystickButton.B12]: { action: otherAvailableActions.no_function },
        [JoystickButton.B13]: { action: modifierKeyActions.shift },
        [JoystickButton.B14]: { action: otherAvailableActions.no_function },
        [JoystickButton.B15]: { action: availableCockpitActions.toggle_top_bar },
        [JoystickButton.B16]: { action: availableCockpitActions.toggle_bottom_bar },
        [JoystickButton.B17]: { action: otherAvailableActions.no_function },
      },
      [CockpitModifierKeyOption.shift]: {
        [JoystickButton.B0]: { action: otherAvailableActions.no_function },
        [JoystickButton.B1]: { action: otherAvailableActions.no_function },
        [JoystickButton.B2]: { action: otherAvailableActions.no_function },
        [JoystickButton.B3]: { action: otherAvailableActions.no_function },
        [JoystickButton.B4]: { action: otherAvailableActions.no_function },
        [JoystickButton.B5]: { action: otherAvailableActions.no_function },
        [JoystickButton.B6]: { action: otherAvailableActions.no_function },
        [JoystickButton.B7]: { action: otherAvailableActions.no_function },
        [JoystickButton.B8]: { action: otherAvailableActions.no_function },
        [JoystickButton.B9]: { action: otherAvailableActions.no_function },
        [JoystickButton.B10]: { action: otherAvailableActions.no_function },
        [JoystickButton.B11]: { action: otherAvailableActions.no_function },
        [JoystickButton.B12]: { action: otherAvailableActions.no_function },
        [JoystickButton.B13]: { action: otherAvailableActions.no_function },
        [JoystickButton.B14]: { action: otherAvailableActions.no_function },
        [JoystickButton.B15]: { action: otherAvailableActions.no_function },
        [JoystickButton.B16]: { action: otherAvailableActions.no_function },
        [JoystickButton.B17]: { action: otherAvailableActions.no_function },
      },
    },
  },
]

/**
 * Follows the standard controller in the Gamepad API: https://www.w3.org/TR/gamepad/#dfn-standard-gamepad
 * buttons[0] Bottom button in right cluster
 * buttons[1] Right button in right cluster
 * buttons[2] Left button in right cluster
 * buttons[3] Top button in right cluster
 * buttons[4] Top left front button
 * buttons[5] Top right front button
 * buttons[6] Bottom left front button
 * buttons[7] Bottom right front button
 * buttons[8] Left button in center cluster
 * buttons[9] Right button in center cluster
 * buttons[10] Left stick pressed button
 * buttons[11] Right stick pressed button
 * buttons[12] Top button in left cluster
 * buttons[13] Bottom button in left cluster
 * buttons[14] Left button in left cluster
 * buttons[15] Right button in left cluster
 * buttons[16] Center button in center cluster
 * buttons[17-31]	Extra non-standard buttons
 * axes[0] Horizontal axis for left stick (negative left/positive right)
 * axes[1] Vertical axis for left stick (negative up/positive down)
 * axes[2] Horizontal axis for right stick (negative left/positive right)
 * axes[3] Vertical axis for right stick (negative up/positive down)
 * axes[4-7] Extra non-standard axes
 */
export const availableGamepadToCockpitMaps: { [key in JoystickModel]: GamepadToCockpitStdMapping } = {
  [JoystickModel.DualSense]: {
    name: 'DualSense',
    axes: [0, 1, 2, 3],
    buttons: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
  },
  [JoystickModel.DualShock4]: {
    name: 'DualShock4',
    axes: [0, 1, 2, 3],
    buttons: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
  },
  [JoystickModel.IpegaPG9023]: {
    name: 'Ipega9023',
    axes: [0, 1, 2, 3],
    buttons: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
  },
  [JoystickModel.XboxOne_Wireless]: {
    name: 'Xbox One S',
    axes: [0, 1, 2, 3],
    buttons: [0, 1, 2, 3, 4, 11, 6, 7, 8, 9, 5, 11, 12, 13, 14, 15, 16, 17],
  },
  [JoystickModel.XboxOneS_Bluetooth]: {
    name: 'Xbox One S',
    axes: [0, 1, 2, 3],
    buttons: [0, 1, 2, 3, 4, 11, 6, 7, 8, 9, 5, 11, 12, 13, 14, 15, 16, 17],
  },
  [JoystickModel.XboxController_Bluetooth]: {
    name: 'Xbox Controller (bluetooth)',
    axes: [0, 1, 2, 3],
    buttons: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 16],
  },
  [JoystickModel.XboxController_Wired]: {
    name: 'Xbox Controller (wired)',
    axes: [0, 1, 2, 3],
    buttons: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
  },
  [JoystickModel.XboxController_360]: {
    name: JoystickModel.XboxController_360,
    axes: [0, 1, 2, 3],
    buttons: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
  },
  [JoystickModel.LogitechExtreme3DPro]: {
    name: JoystickModel.XboxController_360,
    axes: [0, 1, 5, 6, 7, 2, 3, 8, 9, 4],
    buttons: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  },
  [JoystickModel.Unknown]: {
    name: 'Standard gamepad',
    axes: [0, 1, 2, 3, 4, 5, 6, 7],
    buttons: [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
      31,
    ],
  },
}
