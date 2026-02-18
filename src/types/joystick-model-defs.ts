import { GamepadToCockpitStdMapping } from './joystick'

/**
 * Supported joystick models
 */
export enum JoystickModel {
  DualSense = 'DualSense (PS5)',
  DualShock4 = 'DualShock (PS4)',
  XboxOne_Wireless = 'Xbox One Wireless Controller',
  XboxOne_Wired = 'Xbox One Wired Controller',
  XboxOneS_Bluetooth = 'Xbox One S (bluetooth)',
  XboxController_Bluetooth = 'Xbox controller (bluetooth)',
  XboxController_Wired = 'Xbox controller (wired)',
  XboxController_360 = 'Xbox 360 controller',
  LogitechExtreme3DPro = 'Logitech Extreme 3D Pro',
  IpegaPG9023 = 'Ipega PG-9023',
  SteamDeckLCD = 'Steam Deck LCD',
  SteamDeckOLED = 'Steam Deck OLED',
  EightBitDoUltimate2C = '8BitDo Ultimate 2C',
  ThrustmasterSimTaskFarmStick = 'Thrustmaster SimTask FarmStick',
  Unknown = 'Unknown',
}

export const JoystickMapVidPid: Map<string, JoystickModel> = new Map([
  // Sony
  ['054c:0ce6', JoystickModel.DualSense],
  ['054c:09cc', JoystickModel.DualShock4],
  ['045e:02ea', JoystickModel.XboxOne_Wired],
  ['045e:02e0', JoystickModel.XboxOne_Wireless],
  ['045e:02fd', JoystickModel.XboxOneS_Bluetooth],
  ['045e:0b13', JoystickModel.XboxController_Bluetooth],
  ['045e:0b12', JoystickModel.XboxController_Wired],
  ['28de:11ff', JoystickModel.XboxController_360],
  ['046d:c215', JoystickModel.LogitechExtreme3DPro],
  ['1949:0402', JoystickModel.IpegaPG9023],
  ['28de:11ff', JoystickModel.SteamDeckLCD],
  ['28de:1205', JoystickModel.SteamDeckOLED],
  ['2dc8:301b', JoystickModel.EightBitDoUltimate2C],
  ['044f:0416', JoystickModel.ThrustmasterSimTaskFarmStick],
])

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
    name: 'Xbox One Wireless',
    axes: [0, 1, 2, 3],
    buttons: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
  },
  [JoystickModel.XboxOne_Wired]: {
    name: 'Xbox One (wired)',
    axes: [0, 1, 2, 3],
    buttons: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
  },
  [JoystickModel.XboxOneS_Bluetooth]: {
    name: 'Xbox One S (bluetooth)',
    axes: [0, 1, 2, 3],
    buttons: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
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
  [JoystickModel.SteamDeckLCD]: {
    name: 'Steam Deck LCD',
    axes: [0, 1, 2, 3],
    buttons: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
  },
  [JoystickModel.SteamDeckOLED]: {
    name: 'Steam Deck OLED',
    axes: [0, 1, 2, 3],
    buttons: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
  },
  [JoystickModel.EightBitDoUltimate2C]: {
    name: '8BitDo Ultimate 2C',
    axes: [0, 1, 2, 3, 4, 5],
    buttons: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
  },
  [JoystickModel.ThrustmasterSimTaskFarmStick]: {
    name: 'Thrustmaster SimTask FarmStick',
    axes: [0, 1, 2, 3, 4, 5, 6, 7],
    buttons: [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
      31, 32,
    ],
  },
  [JoystickModel.Unknown]: {
    name: 'Standard gamepad',
    axes: [0, 1, 2, 3, 4, 5, 6, 7],
    buttons: [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
      31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58,
      59, 60, 61, 62, 63,
    ],
  },
}
