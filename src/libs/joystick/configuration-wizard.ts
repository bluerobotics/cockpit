import { v4 as uuid4 } from 'uuid'

import {
  JoystickAxisActionCorrespondency,
  JoystickButtonActionCorrespondency,
  JoystickProtocol,
  JoystickProtocolActionsMapping,
} from '@/types/joystick'

/**
 * Standard axis profile using Blue Robotics recommended default mappings for ROV controllers.
 */
export const axisConfigMapROV: JoystickAxisActionCorrespondency = {
  3: {
    action: { id: 'axis_z', name: 'Axis Z', protocol: JoystickProtocol.MAVLinkManualControl },
    min: 1000,
    max: 0,
  },
  4: {
    action: { id: 'axis_y', name: 'Axis Y', protocol: JoystickProtocol.MAVLinkManualControl },
    min: -1000,
    max: 1000,
  },
  5: {
    action: { id: 'axis_x', name: 'Axis X', protocol: JoystickProtocol.MAVLinkManualControl },
    min: 1000,
    max: -1000,
  },
  6: {
    action: { id: 'axis_r', name: 'Axis R', protocol: JoystickProtocol.MAVLinkManualControl },
    min: -1000,
    max: 1000,
  },
}

/**
 * Standard button profile using Blue Robotics recommended default mappings for ROV controllers.
 */
export const buttonConfigMapROV: JoystickButtonActionCorrespondency = {
  7: { action: { id: 'no_function', name: 'Shift (modifier)', protocol: JoystickProtocol.Other } },
  9: { action: { id: 'servo_1_max_momentary', name: 'Gripper Open', protocol: JoystickProtocol.MAVLinkManualControl } },
  10: {
    action: { id: 'servo_1_min_momentary', name: 'Gripper Close', protocol: JoystickProtocol.MAVLinkManualControl },
  },
  12: { action: { id: 'camera-zoom-increase', name: 'Camera Zoom In', protocol: JoystickProtocol.CockpitAction } },
  13: { action: { id: 'camera-zoom-decrease', name: 'Camera Zoom Out', protocol: JoystickProtocol.CockpitAction } },
  14: { action: { id: 'camera-focus-increase', name: 'Camera Focus Near', protocol: JoystickProtocol.CockpitAction } },
  15: { action: { id: 'camera-focus-decrease', name: 'Camera Focus Far', protocol: JoystickProtocol.CockpitAction } },
  16: { action: { id: 'btn_auto_focus', name: 'Auto Focus', protocol: JoystickProtocol.CockpitAction } },
  17: { action: { id: 'btn_auto_wb', name: 'Auto White Balance', protocol: JoystickProtocol.CockpitAction } },
  18: { action: { id: 'gain_inc', name: 'Pilot Gain +', protocol: JoystickProtocol.MAVLinkManualControl } },
  19: { action: { id: 'gain_dec', name: 'Pilot Gain –', protocol: JoystickProtocol.MAVLinkManualControl } },
  20: { action: { id: 'Arm', name: 'Arm', protocol: JoystickProtocol.MAVLinkManualControl } },
  21: { action: { id: 'Disarm', name: 'Disarm', protocol: JoystickProtocol.MAVLinkManualControl } },
  22: { action: { id: 'mount_tilt_up', name: 'Camera Tilt Up', protocol: JoystickProtocol.MAVLinkManualControl } },
  23: { action: { id: 'mount_tilt_down', name: 'Camera Tilt Down', protocol: JoystickProtocol.MAVLinkManualControl } },
  24: { action: { id: 'mount_center', name: 'Camera Tilt Center', protocol: JoystickProtocol.MAVLinkManualControl } },
  25: { action: { id: 'lights1_brighter', name: 'Lights Brighter', protocol: JoystickProtocol.MAVLinkManualControl } },
  26: { action: { id: 'lights1_dimmer', name: 'Lights Dimmer', protocol: JoystickProtocol.MAVLinkManualControl } },
  27: { action: { id: 'trim_pitch_inc', name: 'Trim Pitch Forward', protocol: JoystickProtocol.MAVLinkManualControl } },
  28: {
    action: { id: 'trim_pitch_dec', name: 'Trim Pitch Backward', protocol: JoystickProtocol.MAVLinkManualControl },
  },
  29: { action: { id: 'trim_roll_inc', name: 'Trim Roll Right', protocol: JoystickProtocol.MAVLinkManualControl } },
  30: { action: { id: 'trim_roll_dec', name: 'Trim Roll Left', protocol: JoystickProtocol.MAVLinkManualControl } },
  31: { action: { id: 'mode_manual', name: 'Manual Mode', protocol: JoystickProtocol.MAVLinkManualControl } },
  32: { action: { id: 'mode_depth_hold', name: 'Depth-hold Mode', protocol: JoystickProtocol.MAVLinkManualControl } },
  33: { action: { id: 'mode_stabilize', name: 'Stabilize Mode', protocol: JoystickProtocol.MAVLinkManualControl } },
  34: { action: { id: 'input_hold_set', name: 'Toggle Input Hold', protocol: JoystickProtocol.MAVLinkManualControl } },
  35: {
    action: { id: 'roll_pitch_toggle', name: 'Roll & Pitch Toggle', protocol: JoystickProtocol.MAVLinkManualControl },
  },
}

/**
 * Basic blank mapping to be used as a starting point in the joystick configuration wizard.
 */
export const blankWizardMapping: JoystickProtocolActionsMapping = {
  name: 'Wizard Functions mapping',
  hash: uuid4(),
  axesCorrespondencies: {} as JoystickProtocolActionsMapping['axesCorrespondencies'],
  buttonsCorrespondencies: {
    regular: {},
    shift: {},
  },
}
