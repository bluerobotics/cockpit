import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { availableCockpitActions } from '@/libs/joystick/protocols/cockpit-actions'
import {
  availableMavlinkManualControlButtonFunctions,
  mavlinkManualControlAxes,
} from '@/libs/joystick/protocols/mavlink-manual-control'
import { modifierKeyActions, otherAvailableActions } from '@/libs/joystick/protocols/other'
import { getVehicleModeAction } from '@/libs/vehicle/ardupilot/common'
import { RoverMode } from '@/libs/vehicle/ardupilot/types/modes'
import { Type as VehicleType } from '@/libs/vehicle/vehicle'
import {
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

export const blankMapping: JoystickProtocolActionsMapping = {
  name: 'Custom mapping',
  hash: '00000000-0000-0000-0000-000000000002',
  axesCorrespondencies: {
    [JoystickAxis.A0]: { action: otherAvailableActions.no_function, min: -1000, max: 1000 },
    [JoystickAxis.A1]: { action: otherAvailableActions.no_function, min: -1000, max: 1000 },
    [JoystickAxis.A2]: { action: otherAvailableActions.no_function, min: -1000, max: 1000 },
    [JoystickAxis.A3]: { action: otherAvailableActions.no_function, min: -1000, max: 1000 },
  },
  buttonsCorrespondencies: {
    [CockpitModifierKeyOption.regular]: Object.fromEntries(
      Array.from({ length: 18 }, (_, i) => [i, { action: otherAvailableActions.no_function }])
    ),
    [CockpitModifierKeyOption.shift]: Object.fromEntries(
      Array.from({ length: 18 }, (_, i) => [i, { action: otherAvailableActions.no_function }])
    ),
  },
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
        [JoystickButton.B17]: { action: otherAvailableActions.no_function },
      },
      [CockpitModifierKeyOption.shift]: {
        [JoystickButton.B0]: { action: otherAvailableActions.no_function },
        [JoystickButton.B1]: { action: otherAvailableActions.no_function },
        [JoystickButton.B2]: { action: availableMavlinkManualControlButtonFunctions['Mode poshold'] },
        [JoystickButton.B3]: { action: availableMavlinkManualControlButtonFunctions['Mode acro'] },
        [JoystickButton.B4]: { action: otherAvailableActions.no_function },
        [JoystickButton.B5]: { action: otherAvailableActions.no_function },
        [JoystickButton.B6]: { action: availableMavlinkManualControlButtonFunctions['Actuator 1 min'] },
        [JoystickButton.B7]: { action: availableMavlinkManualControlButtonFunctions['Actuator 1 max'] },
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
        [JoystickButton.B0]: { action: getVehicleModeAction(VehicleType.Rover, RoverMode.LOITER) },
        [JoystickButton.B1]: { action: getVehicleModeAction(VehicleType.Rover, RoverMode.MANUAL) },
        [JoystickButton.B2]: { action: getVehicleModeAction(VehicleType.Rover, RoverMode.AUTO) },
        [JoystickButton.B3]: { action: getVehicleModeAction(VehicleType.Rover, RoverMode.ACRO) },
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
