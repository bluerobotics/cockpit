import { v4 as uuid4 } from 'uuid'

import { JoystickProtocol, JoystickProtocolActionsMapping, ProtocolAction } from '@/types/joystick'

/* eslint-disable-next-line jsdoc/require-jsdoc */
type AxisConfigEntry = ProtocolAction & { min: number; max: number }

export const axisConfigMapROV: Record<number, AxisConfigEntry> = {
  3: {
    id: 'axis_z',
    name: 'Axis Z',
    protocol: JoystickProtocol.MAVLinkManualControl,
    min: 1000,
    max: 0,
  },
  4: {
    id: 'axis_y',
    name: 'Axis Y',
    protocol: JoystickProtocol.MAVLinkManualControl,
    min: -1000,
    max: 1000,
  },
  5: {
    id: 'axis_x',
    name: 'Axis X',
    protocol: JoystickProtocol.MAVLinkManualControl,
    min: 1000,
    max: -1000,
  },
  6: {
    id: 'axis_r',
    name: 'Axis R',
    protocol: JoystickProtocol.MAVLinkManualControl,
    min: -1000,
    max: 1000,
  },
}

/* eslint-disable-next-line jsdoc/require-jsdoc */
export const buttonConfigMapROV: Record<number, { id: string; name: string; protocol: JoystickProtocol }> = {
  7: { id: 'no_function', name: 'Shift (modifier)', protocol: JoystickProtocol.Other },
  9: { id: 'servo_1_max_momentary', name: 'Gripper Open', protocol: JoystickProtocol.MAVLinkManualControl },
  10: { id: 'servo_1_min_momentary', name: 'Gripper Close', protocol: JoystickProtocol.MAVLinkManualControl },
  12: { id: 'camera-zoom-increase', name: 'Camera Zoom In', protocol: JoystickProtocol.CockpitAction },
  13: { id: 'camera-zoom-decrease', name: 'Camera Zoom Out', protocol: JoystickProtocol.CockpitAction },
  14: { id: 'camera-focus-increase', name: 'Camera Focus Near', protocol: JoystickProtocol.CockpitAction },
  15: { id: 'camera-focus-decrease', name: 'Camera Focus Far', protocol: JoystickProtocol.CockpitAction },
  16: { id: 'btn_auto_focus', name: 'Auto Focus', protocol: JoystickProtocol.CockpitAction },
  17: { id: 'btn_auto_wb', name: 'Auto White Balance', protocol: JoystickProtocol.CockpitAction },
  18: { id: 'gain_inc', name: 'Pilot Gain +', protocol: JoystickProtocol.MAVLinkManualControl },
  19: { id: 'gain_dec', name: 'Pilot Gain –', protocol: JoystickProtocol.MAVLinkManualControl },
  20: { id: 'Arm', name: 'Arm', protocol: JoystickProtocol.MAVLinkManualControl },
  21: { id: 'Disarm', name: 'Disarm', protocol: JoystickProtocol.MAVLinkManualControl },
  22: { id: 'mount_tilt_up', name: 'Camera Tilt Up', protocol: JoystickProtocol.MAVLinkManualControl },
  23: { id: 'mount_tilt_down', name: 'Camera Tilt Down', protocol: JoystickProtocol.MAVLinkManualControl },
  24: { id: 'mount_center', name: 'Camera Tilt Center', protocol: JoystickProtocol.MAVLinkManualControl },
  25: { id: 'lights1_brighter', name: 'Lights Brighter', protocol: JoystickProtocol.MAVLinkManualControl },
  26: { id: 'lights1_dimmer', name: 'Lights Dimmer', protocol: JoystickProtocol.MAVLinkManualControl },
  27: { id: 'trim_pitch_inc', name: 'Trim Pitch Forward', protocol: JoystickProtocol.MAVLinkManualControl },
  28: { id: 'trim_pitch_dec', name: 'Trim Pitch Backward', protocol: JoystickProtocol.MAVLinkManualControl },
  29: { id: 'trim_roll_inc', name: 'Trim Roll Right', protocol: JoystickProtocol.MAVLinkManualControl },
  30: { id: 'trim_roll_dec', name: 'Trim Roll Left', protocol: JoystickProtocol.MAVLinkManualControl },
  31: { id: 'mode_manual', name: 'Manual Mode', protocol: JoystickProtocol.MAVLinkManualControl },
  32: { id: 'mode_depth_hold', name: 'Depth-hold Mode', protocol: JoystickProtocol.MAVLinkManualControl },
  33: { id: 'mode_stabilize', name: 'Stabilize Mode', protocol: JoystickProtocol.MAVLinkManualControl },
  34: { id: 'input_hold_set', name: 'Toggle Input Hold', protocol: JoystickProtocol.MAVLinkManualControl },
  35: { id: 'roll_pitch_toggle', name: 'Roll & Pitch Toggle', protocol: JoystickProtocol.MAVLinkManualControl },
}

export const blankWizardMapping: JoystickProtocolActionsMapping = {
  name: 'Wizard Functions mapping',
  hash: uuid4(),
  axesCorrespondencies: {} as JoystickProtocolActionsMapping['axesCorrespondencies'],
  buttonsCorrespondencies: {
    regular: {},
    shift: {},
  },
}
