import { JoystickModel } from '@/libs/joystick/manager'
import { CockpitAction, MAVLinkAxis } from '@/libs/joystick/protocols'
import { type GamepadToCockpitStdMapping, type ProtocolControllerMapping, JoystickProtocol } from '@/types/joystick'

// TODO: Adjust mapping for PS5 controller
export const cockpitStandardToProtocols: ProtocolControllerMapping = {
  name: 'Cockpit Standard Gamepad to Protocols',
  axesCorrespondencies: [
    { protocol: JoystickProtocol.MAVLink, value: MAVLinkAxis.Y },
    { protocol: JoystickProtocol.MAVLink, value: MAVLinkAxis.X },
    { protocol: JoystickProtocol.MAVLink, value: MAVLinkAxis.R },
    { protocol: JoystickProtocol.MAVLink, value: MAVLinkAxis.Z },
  ],
  axesMins: [-1000, 1000, -1000, 1000],
  axesMaxs: [1000, -1000, 1000, 0],
  buttonsCorrespondencies: [
    { protocol: JoystickProtocol.MAVLink, value: 0 },
    { protocol: JoystickProtocol.MAVLink, value: 1 },
    { protocol: JoystickProtocol.MAVLink, value: 2 },
    { protocol: JoystickProtocol.MAVLink, value: 3 },
    { protocol: JoystickProtocol.CockpitAction, value: CockpitAction.GO_TO_PREVIOUS_VIEW },
    { protocol: JoystickProtocol.CockpitAction, value: CockpitAction.GO_TO_NEXT_VIEW },
    { protocol: JoystickProtocol.MAVLink, value: 9 },
    { protocol: JoystickProtocol.MAVLink, value: 10 },
    { protocol: JoystickProtocol.MAVLink, value: 4 },
    { protocol: JoystickProtocol.MAVLink, value: 6 },
    { protocol: JoystickProtocol.MAVLink, value: 7 },
    { protocol: JoystickProtocol.MAVLink, value: 8 },
    { protocol: JoystickProtocol.MAVLink, value: 11 },
    { protocol: JoystickProtocol.MAVLink, value: 12 },
    { protocol: JoystickProtocol.MAVLink, value: 13 },
    { protocol: JoystickProtocol.MAVLink, value: 14 },
    { protocol: JoystickProtocol.MAVLink, value: 5 },
    { protocol: JoystickProtocol.CockpitAction, value: CockpitAction.TOGGLE_FULL_SCREEN },
  ],
}

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
  [JoystickModel.XboxOneS_Bluetooth]: {
    name: 'Xbox One S',
    axes: [0, 1, 2, 3],
    buttons: [0, 1, 2, 3, 4, 11, 6, 7, 8, 9, 5, 11, 12, 13, 14, 15, 16, 17],
  },
  [JoystickModel.XboxController_Bluetooth]: {
    name: 'Xbox Controller (bluetooth)',
    axes: [0, 1, 2, 3],
    buttons: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
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
  [JoystickModel.Unknown]: {
    name: 'Standard gamepad',
    axes: [0, 1, 2, 3, 4, 5, 6, 7],
    buttons: [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
      31,
    ],
  },
}
