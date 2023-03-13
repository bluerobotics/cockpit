import { JoystickModel } from '@/libs/joystick/manager'
import type { MavlinkControllerMapping } from '@/libs/joystick/protocols'
import type { GamepadToCockpitStdMapping } from '@/types/joystick'

// TODO: Adjust mapping for PS5 controller
export const cockpitStandardToMavlink: MavlinkControllerMapping = {
  name: 'Cockpit Standard Gamepad to Mavlink',
  axesCorrespondencies: ['y', 'x', 'r', 'z'],
  axesMins: [-1000, 1000, -1000, 1000],
  axesMaxs: [1000, -1000, 1000, 0],
  buttons: [0, 1, 2, 3, 9, 10, undefined, undefined, 4, 6, 7, 8, 11, 12, 13, 14, 5, undefined],
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
    buttons: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 10, 12, 13, 14, 15, 16, 17],
  },
  [JoystickModel.DualShock4]: {
    name: 'DualShock4',
    axes: [0, 1, 2, 3],
    buttons: [0, 1, 2, 3, 4, 16, 6, 7, 8, 9, 11, 10, 12, 13, 14, 15, 5, 17],
  },
  [JoystickModel.XboxOneS_Bluetooth]: {
    name: 'Xbox One S',
    axes: [0, 1, 2, 3],
    buttons: [0, 1, 2, 3, 4, 11, 6, 7, 8, 9, 5, 11, 12, 13, 14, 15, 16, 17],
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
