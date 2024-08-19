/* eslint-disable prettier/prettier */
/* eslint-disable vue/max-len */
/* eslint-disable max-len */
/* eslint-disable jsdoc/require-jsdoc */
import { capitalize } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { sendManualControl } from '@/libs/communication/mavlink'
import { modifierKeyActions, otherAvailableActions } from '@/libs/joystick/protocols/other'
import { round, scale } from '@/libs/utils'
import type { ArduPilot } from '@/libs/vehicle/ardupilot/ardupilot'
import { type JoystickProtocolActionsMapping, type JoystickState, type ProtocolAction, JoystickAxis, JoystickButton, JoystickProtocol } from '@/types/joystick'

/**
 * Possible axes in the MAVLink `MANUAL_CONTROL` message protocol
 */
export enum MAVLinkAxisFunction {
  X = 'axis_x',
  Y = 'axis_y',
  Z = 'axis_z',
  R = 'axis_r',
  S = 'axis_s',
  T = 'axis_t',
}

/**
 * Possible functions in the MAVLink `MANUAL_CONTROL` message protocol
 */
export enum MAVLinkButtonFunction {
  disabled = 'Disabled', // 0
  shift = 'Shift', // 1
  arm_toggle = 'Arm toggle', // 2
  arm = 'Arm', // 3
  disarm = 'Disarm', // 4
  mode_manual = 'Mode manual', // 5
  mode_stabilize = 'Mode stabilize', // 6
  mode_depth_hold = 'Mode depth hold', // 7
  mode_poshold = 'Mode poshold', // 8
  mode_auto = 'Mode auto', // 9
  mode_circle = 'Mode circle', // 10
  mode_guided = 'Mode guided', // 11
  mode_acro = 'Mode acro', // 12
  mode_surftrak = 'Mode surftrak', // 13
  mount_center = 'Mount center', // 21
  mount_tilt_up = 'Mount tilt up', // 22
  mount_tilt_down = 'Mount tilt down', // 23
  camera_trigger = 'Camera trigger', // 24
  camera_source_toggle = 'Camera source toggle', // 25
  mount_pan_right = 'Mount pan right', // 26
  mount_pan_left = 'Mount pan left', // 27
  lights1_cycle = 'Lights1 cycle', // 31
  lights1_brighter = 'Lights1 brighter', // 32
  lights1_dimmer = 'Lights1 dimmer', // 33
  lights2_cycle = 'Lights2 cycle', // 34
  lights2_brighter = 'Lights2 brighter', // 35
  lights2_dimmer = 'Lights2 dimmer', // 36
  gain_toggle = 'Gain toggle', // 41
  gain_inc = 'Gain inc', // 42
  gain_dec = 'Gain dec', // 43
  trim_roll_inc = 'Trim roll inc', // 44
  trim_roll_dec = 'Trim roll dec', // 45
  trim_pitch_inc = 'Trim pitch inc', // 46
  trim_pitch_dec = 'Trim pitch dec', // 47
  input_hold_set = 'Input hold set', // 48
  roll_pitch_toggle = 'Roll pitch toggle', // 49
  relay1_on = 'Relay 1 on', // 51
  relay1_off = 'Relay 1 off', // 52
  relay1_toggle = 'Relay 1 toggle', // 53
  relay2_on = 'Relay 2 on', // 54
  relay2_off = 'Relay 2 off', // 55
  relay2_toggle = 'Relay 2 toggle', // 56
  relay3_on = 'Relay 3 on', // 57
  relay3_off = 'Relay 3 off', // 58
  relay3_toggle = 'Relay 3 toggle', // 59
  servo1_inc = 'Servo 1 inc', // 61
  servo1_dec = 'Servo 1 dec', // 62
  servo1_min = 'Servo 1 min', // 63
  servo1_max = 'Servo 1 max', // 64
  servo1_center = 'Servo 1 center', // 65
  servo2_inc = 'Servo 2 inc', // 66
  servo2_dec = 'Servo 2 dec', // 67
  servo2_min = 'Servo 2 min', // 68
  servo2_max = 'Servo 2 max', // 69
  servo2_center = 'Servo 2 center', // 70
  servo3_inc = 'Servo 3 inc', // 71
  servo3_dec = 'Servo 3 dec', // 72
  servo3_min = 'Servo 3 min', // 73
  servo3_max = 'Servo 3 max', // 74
  servo3_center = 'Servo 3 center', // 75
  servo1_min_momentary = 'Servo 1 min momentary', // 76
  servo1_max_momentary = 'Servo 1 max momentary', // 77
  servo1_min_toggle = 'Servo 1 min toggle', // 78
  servo1_max_toggle = 'Servo 1 max toggle', // 79
  servo2_min_momentary = 'Servo 2 min momentary', // 80
  servo2_max_momentary = 'Servo 2 max momentary', // 81
  servo2_min_toggle = 'Servo 2 min toggle', // 82
  servo2_max_toggle = 'Servo 2 max toggle', // 83
  servo3_min_momentary = 'Servo 3 min momentary', // 84
  servo3_max_momentary = 'Servo 3 max momentary', // 85
  servo3_min_toggle = 'Servo 3 min toggle', // 86
  servo3_max_toggle = 'Servo 3 max toggle', // 87
  custom1 = 'Custom 1', // 91
  custom2 = 'Custom 2', // 92
  custom3 = 'Custom 3', // 93
  custom4 = 'Custom 4', // 94
  custom5 = 'Custom 5', // 95
  custom6 = 'Custom 6', // 96
  relay4_on = 'Relay 4 on', // 101
  relay4_off = 'Relay 4 off', // 102
  relay4_toggle = 'Relay 4 toggle', // 103
  relay1_momentary = 'Relay 1 momentary', // 104
  relay2_momentary = 'Relay 2 momentary', // 105
  relay3_momentary = 'Relay 3 momentary', // 106
  relay4_momentary = 'Relay 4 momentary', // 107
  script_1 = 'Script 1', // 108
  script_2 = 'Script 2', // 109
  script_3 = 'Script 3', // 110
  script_4 = 'Script 4', // 111
}

export enum MAVLinkManualControlButton {
  R0 = 'BTN0_FUNCTION',
  S0 = 'BTN0_SFUNCTION',
  R1 = 'BTN1_FUNCTION',
  S1 = 'BTN1_SFUNCTION',
  R2 = 'BTN2_FUNCTION',
  S2 = 'BTN2_SFUNCTION',
  R3 = 'BTN3_FUNCTION',
  S3 = 'BTN3_SFUNCTION',
  R4 = 'BTN4_FUNCTION',
  S4 = 'BTN4_SFUNCTION',
  R5 = 'BTN5_FUNCTION',
  S5 = 'BTN5_SFUNCTION',
  R6 = 'BTN6_FUNCTION',
  S6 = 'BTN6_SFUNCTION',
  R7 = 'BTN7_FUNCTION',
  S7 = 'BTN7_SFUNCTION',
  R8 = 'BTN8_FUNCTION',
  S8 = 'BTN8_SFUNCTION',
  R9 = 'BTN9_FUNCTION',
  S9 = 'BTN9_SFUNCTION',
  R10 = 'BTN10_FUNCTION',
  S10 = 'BTN10_SFUNCTION',
  R11 = 'BTN11_FUNCTION',
  S11 = 'BTN11_SFUNCTION',
  R12 = 'BTN12_FUNCTION',
  S12 = 'BTN12_SFUNCTION',
  R13 = 'BTN13_FUNCTION',
  S13 = 'BTN13_SFUNCTION',
  R14 = 'BTN14_FUNCTION',
  S14 = 'BTN14_SFUNCTION',
  R15 = 'BTN15_FUNCTION',
  S15 = 'BTN15_SFUNCTION',
  R16 = 'BTN16_FUNCTION',
  S16 = 'BTN16_SFUNCTION',
  R17 = 'BTN17_FUNCTION',
  S17 = 'BTN17_SFUNCTION',
  R18 = 'BTN18_FUNCTION',
  S18 = 'BTN18_SFUNCTION',
  R19 = 'BTN19_FUNCTION',
  S19 = 'BTN19_SFUNCTION',
  R20 = 'BTN20_FUNCTION',
  S20 = 'BTN20_SFUNCTION',
  R21 = 'BTN21_FUNCTION',
  S21 = 'BTN21_SFUNCTION',
  R22 = 'BTN22_FUNCTION',
  S22 = 'BTN22_SFUNCTION',
  R23 = 'BTN23_FUNCTION',
  S23 = 'BTN23_SFUNCTION',
  R24 = 'BTN24_FUNCTION',
  S24 = 'BTN24_SFUNCTION',
  R25 = 'BTN25_FUNCTION',
  S25 = 'BTN25_SFUNCTION',
  R26 = 'BTN26_FUNCTION',
  S26 = 'BTN26_SFUNCTION',
  R27 = 'BTN27_FUNCTION',
  S27 = 'BTN27_SFUNCTION',
  R28 = 'BTN28_FUNCTION',
  S28 = 'BTN28_SFUNCTION',
  R29 = 'BTN29_FUNCTION',
  S29 = 'BTN29_SFUNCTION',
  R30 = 'BTN30_FUNCTION',
  S30 = 'BTN30_SFUNCTION',
  R31 = 'BTN31_FUNCTION',
  S31 = 'BTN31_SFUNCTION',
}

const { showDialog } = useInteractionDialog()

const manualControlButtonFromParameterName = (name: string): MAVLinkManualControlButton | undefined => {
  const button = Object.entries(MAVLinkManualControlButton).find((entry) => entry[1] === name)?.[0]
  return button === undefined ? button : button as MAVLinkManualControlButton
}

/**
 * An axis action meant to be used with MAVLink's `MANUAL_CONTROL` message
 */
export class MAVLinkManualControlAxisAction implements ProtocolAction {
  readonly protocol = JoystickProtocol.MAVLinkManualControl
  /**
   * Create an axis input
   * @param {MAVLinkAxisFunction} id Axis identification
   * @param {string} name Axis human-readable name
   */
  constructor(public id: MAVLinkAxisFunction, public name: string) { }
}

/**
 * A button action meant to be used with MAVLink's `MANUAL_CONTROL` message
 */
export class MAVLinkManualControlButtonAction implements ProtocolAction {
  readonly protocol = JoystickProtocol.MAVLinkManualControl
  /**
   * Create a button input
   * @param {MAVLinkButtonFunction} id Button identification
   * @param {string} name Button human-readable name
   */
  constructor(public id: MAVLinkButtonFunction, public name: string) { }
}

// Available axis actions
export const mavlinkManualControlAxes: { [key in MAVLinkAxisFunction]: MAVLinkManualControlAxisAction } = {
  [MAVLinkAxisFunction.X]: new MAVLinkManualControlAxisAction(MAVLinkAxisFunction.X, 'Axis X'),
  [MAVLinkAxisFunction.Y]: new MAVLinkManualControlAxisAction(MAVLinkAxisFunction.Y, 'Axis Y'),
  [MAVLinkAxisFunction.Z]: new MAVLinkManualControlAxisAction(MAVLinkAxisFunction.Z, 'Axis Z'),
  [MAVLinkAxisFunction.R]: new MAVLinkManualControlAxisAction(MAVLinkAxisFunction.R, 'Axis R'),
  [MAVLinkAxisFunction.S]: new MAVLinkManualControlAxisAction(MAVLinkAxisFunction.S, 'Axis S'),
  [MAVLinkAxisFunction.T]: new MAVLinkManualControlAxisAction(MAVLinkAxisFunction.T, 'Axis T'),
}

// Available button actions
const mavlinkManualControlButtonFunctions: { [key in MAVLinkButtonFunction]: MAVLinkManualControlButtonAction } = {
  [MAVLinkButtonFunction.disabled]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.disabled, 'Disabled'),
  [MAVLinkButtonFunction.shift]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.shift, 'Shift'),
  [MAVLinkButtonFunction.arm_toggle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.arm_toggle, 'Arm toggle'),
  [MAVLinkButtonFunction.arm]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.arm, 'Arm'),
  [MAVLinkButtonFunction.disarm]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.disarm, 'Disarm'),
  [MAVLinkButtonFunction.mode_manual]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.mode_manual, 'Mode manual'),
  [MAVLinkButtonFunction.mode_stabilize]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.mode_stabilize, 'Mode stabilize'),
  [MAVLinkButtonFunction.mode_depth_hold]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.mode_depth_hold, 'Mode depth hold'),
  [MAVLinkButtonFunction.mode_poshold]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.mode_poshold, 'Mode poshold'),
  [MAVLinkButtonFunction.mode_auto]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.mode_auto, 'Mode auto'),
  [MAVLinkButtonFunction.mode_circle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.mode_circle, 'Mode circle'),
  [MAVLinkButtonFunction.mode_guided]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.mode_guided, 'Mode guided'),
  [MAVLinkButtonFunction.mode_acro]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.mode_acro, 'Mode acro'),
  [MAVLinkButtonFunction.mode_surftrak]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.mode_surftrak, 'Mode surftrak'),
  [MAVLinkButtonFunction.mount_center]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.mount_center, 'Mount center'),
  [MAVLinkButtonFunction.mount_tilt_up]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.mount_tilt_up, 'Mount tilt up'),
  [MAVLinkButtonFunction.mount_tilt_down]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.mount_tilt_down, 'Mount tilt down'),
  [MAVLinkButtonFunction.camera_trigger]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.camera_trigger, 'Camera trigger'),
  [MAVLinkButtonFunction.camera_source_toggle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.camera_source_toggle, 'Camera source toggle'),
  [MAVLinkButtonFunction.mount_pan_right]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.mount_pan_right, 'Mount pan right'),
  [MAVLinkButtonFunction.mount_pan_left]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.mount_pan_left, 'Mount pan left'),
  [MAVLinkButtonFunction.lights1_cycle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.lights1_cycle, 'Lights1 cycle'),
  [MAVLinkButtonFunction.lights1_brighter]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.lights1_brighter, 'Lights1 brighter'),
  [MAVLinkButtonFunction.lights1_dimmer]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.lights1_dimmer, 'Lights1 dimmer'),
  [MAVLinkButtonFunction.lights2_cycle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.lights2_cycle, 'Lights2 cycle'),
  [MAVLinkButtonFunction.lights2_brighter]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.lights2_brighter, 'Lights2 brighter'),
  [MAVLinkButtonFunction.lights2_dimmer]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.lights2_dimmer, 'Lights2 dimmer'),
  [MAVLinkButtonFunction.gain_toggle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.gain_toggle, 'Gain toggle'),
  [MAVLinkButtonFunction.gain_inc]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.gain_inc, 'Gain inc'),
  [MAVLinkButtonFunction.gain_dec]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.gain_dec, 'Gain dec'),
  [MAVLinkButtonFunction.trim_roll_inc]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.trim_roll_inc, 'Trim roll inc'),
  [MAVLinkButtonFunction.trim_roll_dec]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.trim_roll_dec, 'Trim roll dec'),
  [MAVLinkButtonFunction.trim_pitch_inc]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.trim_pitch_inc, 'Trim pitch inc'),
  [MAVLinkButtonFunction.trim_pitch_dec]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.trim_pitch_dec, 'Trim pitch dec'),
  [MAVLinkButtonFunction.input_hold_set]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.input_hold_set, 'Input hold set'),
  [MAVLinkButtonFunction.roll_pitch_toggle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.roll_pitch_toggle, 'Roll pitch toggle'),
  [MAVLinkButtonFunction.relay1_on]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay1_on, 'Relay 1 on'),
  [MAVLinkButtonFunction.relay1_off]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay1_off, 'Relay 1 off'),
  [MAVLinkButtonFunction.relay1_toggle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay1_toggle, 'Relay 1 toggle'),
  [MAVLinkButtonFunction.relay2_on]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay2_on, 'Relay 2 on'),
  [MAVLinkButtonFunction.relay2_off]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay2_off, 'Relay 2 off'),
  [MAVLinkButtonFunction.relay2_toggle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay2_toggle, 'Relay 2 toggle'),
  [MAVLinkButtonFunction.relay3_on]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay3_on, 'Relay 3 on'),
  [MAVLinkButtonFunction.relay3_off]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay3_off, 'Relay 3 off'),
  [MAVLinkButtonFunction.relay3_toggle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay3_toggle, 'Relay 3 toggle'),
  [MAVLinkButtonFunction.servo1_inc]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo1_inc, 'Servo 1 inc'),
  [MAVLinkButtonFunction.servo1_dec]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo1_dec, 'Servo 1 dec'),
  [MAVLinkButtonFunction.servo1_min]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo1_min, 'Servo 1 min'),
  [MAVLinkButtonFunction.servo1_max]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo1_max, 'Servo 1 max'),
  [MAVLinkButtonFunction.servo1_center]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo1_center, 'Servo 1 center'),
  [MAVLinkButtonFunction.servo2_inc]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo2_inc, 'Servo 2 inc'),
  [MAVLinkButtonFunction.servo2_dec]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo2_dec, 'Servo 2 dec'),
  [MAVLinkButtonFunction.servo2_min]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo2_min, 'Servo 2 min'),
  [MAVLinkButtonFunction.servo2_max]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo2_max, 'Servo 2 max'),
  [MAVLinkButtonFunction.servo2_center]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo2_center, 'Servo 2 center'),
  [MAVLinkButtonFunction.servo3_inc]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo3_inc, 'Servo 3 inc'),
  [MAVLinkButtonFunction.servo3_dec]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo3_dec, 'Servo 3 dec'),
  [MAVLinkButtonFunction.servo3_min]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo3_min, 'Servo 3 min'),
  [MAVLinkButtonFunction.servo3_max]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo3_max, 'Servo 3 max'),
  [MAVLinkButtonFunction.servo3_center]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo3_center, 'Servo 3 center'),
  [MAVLinkButtonFunction.servo1_min_momentary]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo1_min_momentary, 'Servo 1 min momentary'),
  [MAVLinkButtonFunction.servo1_max_momentary]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo1_max_momentary, 'Servo 1 max momentary'),
  [MAVLinkButtonFunction.servo1_min_toggle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo1_min_toggle, 'Servo 1 min toggle'),
  [MAVLinkButtonFunction.servo1_max_toggle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo1_max_toggle, 'Servo 1 max toggle'),
  [MAVLinkButtonFunction.servo2_min_momentary]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo2_min_momentary, 'Servo 2 min momentary'),
  [MAVLinkButtonFunction.servo2_max_momentary]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo2_max_momentary, 'Servo 2 max momentary'),
  [MAVLinkButtonFunction.servo2_min_toggle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo2_min_toggle, 'Servo 2 min toggle'),
  [MAVLinkButtonFunction.servo2_max_toggle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo2_max_toggle, 'Servo 2 max toggle'),
  [MAVLinkButtonFunction.servo3_min_momentary]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo3_min_momentary, 'Servo 3 min momentary'),
  [MAVLinkButtonFunction.servo3_max_momentary]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo3_max_momentary, 'Servo 3 max momentary'),
  [MAVLinkButtonFunction.servo3_min_toggle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo3_min_toggle, 'Servo 3 min toggle'),
  [MAVLinkButtonFunction.servo3_max_toggle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo3_max_toggle, 'Servo 3 max toggle'),
  [MAVLinkButtonFunction.custom1]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.custom1, 'Custom 1'),
  [MAVLinkButtonFunction.custom2]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.custom2, 'Custom 2'),
  [MAVLinkButtonFunction.custom3]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.custom3, 'Custom 3'),
  [MAVLinkButtonFunction.custom4]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.custom4, 'Custom 4'),
  [MAVLinkButtonFunction.custom5]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.custom5, 'Custom 5'),
  [MAVLinkButtonFunction.custom6]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.custom6, 'Custom 6'),
  [MAVLinkButtonFunction.relay4_on]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay4_on, 'Relay 4 on'),
  [MAVLinkButtonFunction.relay4_off]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay4_off, 'Relay 4 off'),
  [MAVLinkButtonFunction.relay4_toggle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay4_toggle, 'Relay 4 toggle'),
  [MAVLinkButtonFunction.relay1_momentary]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay1_momentary, 'Relay 1 momentary'),
  [MAVLinkButtonFunction.relay2_momentary]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay2_momentary, 'Relay 2 momentary'),
  [MAVLinkButtonFunction.relay3_momentary]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay3_momentary, 'Relay 3 momentary'),
  [MAVLinkButtonFunction.relay4_momentary]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay4_momentary, 'Relay 4 momentary'),
  [MAVLinkButtonFunction.script_1]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.script_1, 'Script 1'),
  [MAVLinkButtonFunction.script_2]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.script_2, 'Script 2'),
  [MAVLinkButtonFunction.script_3]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.script_3, 'Script 3'),
  [MAVLinkButtonFunction.script_4]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.script_4, 'Script 4'),
}

// Exclude shift key so it's not mapped by user, as it's automatically handled by Cockpit backend.
export const { [MAVLinkButtonFunction.shift]: _, ...availableMavlinkManualControlButtonFunctions } = mavlinkManualControlButtonFunctions

export class MavlinkManualControlState {
  public static readonly BUTTONS_PER_BITFIELD = 16
  x = 0
  y = 0
  z = 0
  r = 0
  s = 0
  t = 0
  buttons = 0
  buttons2 = 0
  target = 1
}

export class MavlinkManualControlManager {
  joystickState: JoystickState
  currentActionsMapping: JoystickProtocolActionsMapping
  activeButtonsActions: ProtocolAction[]
  manualControlState: MavlinkManualControlState | undefined = undefined
  lastValidActionsMapping: JoystickProtocolActionsMapping
  parametersTable: { title: string; value: number }[] = []
  vehicleButtonParameterTable: { title: string; value: number }[] = []
  currentVehicleParameters: { [key in string]: number } = {}
  vehicleTotalParametersCount: number | undefined = undefined
  public vehicle: ArduPilot | undefined

  constructor() {
    setInterval(() => {
      this.remapActionsToVehicleButtonParameters()
    }, 1000)
  }

  setVehicle(vehicle: ArduPilot): void {
    // Set vehicle instance
    this.vehicle = vehicle

    // Update interval parameters when they are available
    this.vehicle.onParameter.add(([newParameter, parametersCount]) => {
      const newVehicleParameters = { ...this.currentVehicleParameters, ...{ [newParameter.name]: newParameter.value } }
      this.currentVehicleParameters = newVehicleParameters
      this.vehicleTotalParametersCount = parametersCount
    })

    this.vehicle.requestParametersList()
    this.updateVehicleButtonsParameters()
  }

  sendManualControl(): void {
    if (!this.manualControlState) return
    sendManualControl(this.manualControlState, this.vehicle?.systemId ?? 1)
  }

  updateControllerData = (state: JoystickState, protocolActionsMapping: JoystickProtocolActionsMapping, activeButtonsActions: ProtocolAction[]): void => {
    this.joystickState = state
    this.currentActionsMapping = protocolActionsMapping
    this.activeButtonsActions = activeButtonsActions

    // Update our mapping with the changes made by the user.
    // Act over the vehicle (by changing it's buttons parameters) if needed.
    this.upadteManualControlState()
  }

  upadteManualControlState(): void {
    // Return if insuficient joystick data
    if (!this.joystickState || !this.currentActionsMapping || !this.activeButtonsActions) return

    // Instantiate manual control state if not already done
    if (!this.manualControlState) {
      this.manualControlState = new MavlinkManualControlState()
    }

    let buttons_int = 0
    let buttons2_int = 0

    // If insuficient vehicle data, do not send buttons values (preventing dangerous manual control messages)
    if (this.currentVehicleParameters && this.vehicleButtonParameterTable) {
      const buttonParametersNamedObject: { [key in number]: string } = {}
      this.vehicleButtonParameterTable.forEach((entry) => (buttonParametersNamedObject[entry.value] = entry.title))
      const currentRegularButtonParameters = Object.entries(this.currentVehicleParameters)
        .filter(([k]) => k.includes('BTN') && !k.includes('S'))
        .map((btn) => ({ button: btn[0], actionId: buttonParametersNamedObject[btn[1]] }))
      const currentShiftButtonParameters = Object.entries(this.currentVehicleParameters)
        .filter(([k]) => k.includes('BTN') && k.includes('S'))
        .map((btn) => ({ button: btn[0], actionId: buttonParametersNamedObject[btn[1]] }))

      const activeMavlinkManualControlActions = this.activeButtonsActions.filter((a) => a.protocol === JoystickProtocol.MAVLinkManualControl).map((action) => action.id)
      const regularVehicleButtonsToActivate = currentRegularButtonParameters
        .filter((entry) => activeMavlinkManualControlActions.includes(entry.actionId as MAVLinkButtonFunction))
        .map((entry) => manualControlButtonFromParameterName(entry.button))
      const shiftVehicleButtonsToActivate = currentShiftButtonParameters
        .filter((entry) => activeMavlinkManualControlActions.includes(entry.actionId as MAVLinkButtonFunction))
        .map((entry) => manualControlButtonFromParameterName(entry.button))

      const useShift = this.activeButtonsActions.map((a) => a.id).includes(modifierKeyActions.shift.id)
      const shiftButton = currentRegularButtonParameters.find((v) => v.actionId === MAVLinkButtonFunction.shift)

      if (useShift && shiftButton === undefined) return

      const vehicleButtonsToActivate = useShift ? shiftVehicleButtonsToActivate.concat([manualControlButtonFromParameterName(shiftButton!.button)]) : regularVehicleButtonsToActivate

      // Calculate buttons value
      for (let i = 0; i < MavlinkManualControlState.BUTTONS_PER_BITFIELD; i++) {
        let buttonState = 0
        vehicleButtonsToActivate.forEach((btn) => {
          if (btn !== undefined && Number(btn.replace('R', '').replace('S', '')) === i) {
            buttonState = 1
          }
        })
        buttons_int += buttonState * 2 ** i
      }

      // Calculate buttons2 value
      for (let i = 16; i < 2 * MavlinkManualControlState.BUTTONS_PER_BITFIELD; i++) {
        let buttonState = 0
        vehicleButtonsToActivate.forEach((btn) => {
          if (btn !== undefined && Number(btn.replace('R', '').replace('S', '')) === i) {
            buttonState = 1
          }
        })
        buttons2_int += buttonState * 2 ** (i - 16)
      }
    }

    // Calculate axes values
    const xCorrespondency = Object.entries(this.currentActionsMapping.axesCorrespondencies).find((entry) => entry[1].action.protocol === JoystickProtocol.MAVLinkManualControl && entry[1].action.id === mavlinkManualControlAxes.axis_x.id)
    const yCorrespondency = Object.entries(this.currentActionsMapping.axesCorrespondencies).find((entry) => entry[1].action.protocol === JoystickProtocol.MAVLinkManualControl && entry[1].action.id === mavlinkManualControlAxes.axis_y.id)
    const zCorrespondency = Object.entries(this.currentActionsMapping.axesCorrespondencies).find((entry) => entry[1].action.protocol === JoystickProtocol.MAVLinkManualControl && entry[1].action.id === mavlinkManualControlAxes.axis_z.id)
    const rCorrespondency = Object.entries(this.currentActionsMapping.axesCorrespondencies).find((entry) => entry[1].action.protocol === JoystickProtocol.MAVLinkManualControl && entry[1].action.id === mavlinkManualControlAxes.axis_r.id)
    const sCorrespondency = Object.entries(this.currentActionsMapping.axesCorrespondencies).find((entry) => entry[1].action.protocol === JoystickProtocol.MAVLinkManualControl && entry[1].action.id === mavlinkManualControlAxes.axis_s.id)
    const tCorrespondency = Object.entries(this.currentActionsMapping.axesCorrespondencies).find((entry) => entry[1].action.protocol === JoystickProtocol.MAVLinkManualControl && entry[1].action.id === mavlinkManualControlAxes.axis_t.id)

    // Populate MAVLink Manual Control state of axes and buttons
    this.manualControlState.x = xCorrespondency === undefined ? 0 : round(scale(this.joystickState.axes[xCorrespondency[0] as unknown as JoystickAxis] ?? 0, -1, 1, xCorrespondency[1].min, xCorrespondency[1].max), 0)
    this.manualControlState.y = yCorrespondency === undefined ? 0 : round(scale(this.joystickState.axes[yCorrespondency[0] as unknown as JoystickAxis] ?? 0, -1, 1, yCorrespondency[1].min, yCorrespondency[1].max), 0)
    this.manualControlState.z = zCorrespondency === undefined ? 0 : round(scale(this.joystickState.axes[zCorrespondency[0] as unknown as JoystickAxis] ?? 0, -1, 1, zCorrespondency[1].min, zCorrespondency[1].max), 0)
    this.manualControlState.r = rCorrespondency === undefined ? 0 : round(scale(this.joystickState.axes[rCorrespondency[0] as unknown as JoystickAxis] ?? 0, -1, 1, rCorrespondency[1].min, rCorrespondency[1].max), 0)
    this.manualControlState.s = sCorrespondency === undefined ? 0 : round(scale(this.joystickState.axes[sCorrespondency[0] as unknown as JoystickAxis] ?? 0, -1, 1, sCorrespondency[1].min, sCorrespondency[1].max), 0)
    this.manualControlState.t = tCorrespondency === undefined ? 0 : round(scale(this.joystickState.axes[tCorrespondency[0] as unknown as JoystickAxis] ?? 0, -1, 1, tCorrespondency[1].min, tCorrespondency[1].max), 0)
    this.manualControlState.buttons = buttons_int
    this.manualControlState.buttons2 = buttons2_int
  }

  updateVehicleButtonsParameters = (): void => {
    if (!this.vehicle) return

    const updatedParameterTable = {}
    for (const category of Object.values(this.vehicle.metadata())) {
      for (const [name, parameter] of Object.entries(category)) {
        if (!isNaN(Number(parameter))) {
          continue
        }
        const newParameterTable = { ...this.parametersTable, ...{ [name]: parameter } }
        Object.assign(updatedParameterTable, newParameterTable)
      }
    }
    Object.assign(this.parametersTable, updatedParameterTable)


    this.vehicleButtonParameterTable.splice(0)
    // @ts-ignore: This type is huge. Needs refactoring typing here.
    if (this.parametersTable['BTN0_FUNCTION'] && this.parametersTable['BTN0_FUNCTION']['Values']) {
      // @ts-ignore: This type is huge. Needs refactoring typing here.
      Object.entries(this.parametersTable['BTN0_FUNCTION']['Values']).forEach((param) => {
        const rawText = param[1] as string
        const formatedText = capitalize(rawText).replace(new RegExp('_', 'g'), ' ')
        this.vehicleButtonParameterTable.push({ title: formatedText as string, value: Number(param[0]) })
      })
    }
  }

  remapActionsToVehicleButtonParameters = (): void => {
    // TODO: Refactor this routine to reuse all methods for regular and shift
    if (!this.vehicle || !this.currentActionsMapping || !this.currentVehicleParameters || !this.vehicleButtonParameterTable || !this.vehicleTotalParametersCount) return
    // Do not proceed with remapping unless we already have all parameters downloaded
    // This prevents us from thinking some function is not mapped in the vehicle when in fact we just didn't download it yet
    const allParametersDownloaded = Object.entries(this.currentVehicleParameters).length >= this.vehicleTotalParametersCount
    if (!allParametersDownloaded) {
      return
    }

    const buttonParametersNamedObject: { [key in number]: string } = {}
    this.vehicleButtonParameterTable.forEach((entry) => (buttonParametersNamedObject[entry.value] = entry.title))
    const currentRegularButtonParameters = Object.entries(this.currentVehicleParameters)
      .filter(([k]) => k.includes('BTN') && k.includes('FUNCTION') && !k.includes('S'))
      .map((btn) => ({ button: btn[0], actionId: buttonParametersNamedObject[btn[1]] }))
    const currentShiftButtonParameters = Object.entries(this.currentVehicleParameters)
      .filter(([k]) => k.includes('BTN') && k.includes('FUNCTION') && k.includes('S'))
      .map((btn) => ({ button: btn[0], actionId: buttonParametersNamedObject[btn[1]] }))

    // Do not use buttons system if the vehicle has no button parameters
    if (currentRegularButtonParameters.length === 0) return

    // Re-use shift button if already mapped. Otherwise use R0 and S0.
    const regularShiftFunction = currentRegularButtonParameters.find((v) => v.actionId === MAVLinkButtonFunction.shift)
    const shiftActionValue = this.vehicleButtonParameterTable.find((e) => e.title === MAVLinkButtonFunction.shift)
    if (regularShiftFunction === undefined) {
      // Map shift to R0
      this.vehicle.setParameter({ id: MAVLinkManualControlButton.R0, value: shiftActionValue!.value })

      // Map shift to S0
      this.vehicle.setParameter({ id: MAVLinkManualControlButton.S0, value: shiftActionValue!.value })
    } else {
      const sFunction = regularShiftFunction.button.replace('FUNCTION', 'SFUNCTION')
      this.vehicle.setParameter({ id: sFunction, value: shiftActionValue!.value })
    }

    const currentMappedActionsInRegularButtons = currentRegularButtonParameters.map((v) => v.actionId)
    const currentMappedActionsInShiftButtons = currentShiftButtonParameters.map((v) => v.actionId)

    const wantedRegularMavlinkActions = Object.entries(this.currentActionsMapping.buttonsCorrespondencies.regular)
      .filter((entry) => entry[1].action.protocol === JoystickProtocol.MAVLinkManualControl)
      .map((corr) => corr[1].action.id)
    const wantedUnmappedRegularMavlinkActions = wantedRegularMavlinkActions
      .filter((actionId) => !currentMappedActionsInRegularButtons.includes(actionId))
    const wantedShiftMavlinkActions = Object.entries(this.currentActionsMapping.buttonsCorrespondencies.shift)
      .filter((entry) => entry[1].action.protocol === JoystickProtocol.MAVLinkManualControl)
      .map((corr) => corr[1].action.id)
    const wantedUnmappedShiftMavlinkActions = wantedShiftMavlinkActions
      .filter((actionId) => !currentMappedActionsInShiftButtons.includes(actionId))

    const disabledVehicleRegularButtons = currentRegularButtonParameters.filter((v) => v.actionId === 'Disabled')
    const disabledVehicleShiftButtons = currentShiftButtonParameters.filter((v) => v.actionId === 'Disabled')

    const remainingUnmappedRegularMavlinkActions: string[] = []
    let indexRegularButtonToUse = 0
    wantedUnmappedRegularMavlinkActions.forEach((actionId) => {
      if (indexRegularButtonToUse >= disabledVehicleRegularButtons.length) {
        remainingUnmappedRegularMavlinkActions.push(actionId)
      } else {
        const mavlinkActionValue = this.vehicleButtonParameterTable.find((e) => e.title === actionId)
        if (mavlinkActionValue === undefined) return
        this.vehicle?.setParameter({ id: disabledVehicleRegularButtons[indexRegularButtonToUse].button, value: mavlinkActionValue.value })
      }
      indexRegularButtonToUse++
    })

    const remainingUnmappedShiftMavlinkActions: string[] = []
    let indexShiftButtonToUse = 0
    wantedUnmappedShiftMavlinkActions.forEach((actionId) => {
      if (indexShiftButtonToUse >= disabledVehicleShiftButtons.length) {
        remainingUnmappedShiftMavlinkActions.push(actionId)
      } else {
        const mavlinkActionValue = this.vehicleButtonParameterTable.find((e) => e.title === actionId)
        if (mavlinkActionValue === undefined) return
        this.vehicle?.setParameter({ id: disabledVehicleShiftButtons[indexShiftButtonToUse].button, value: mavlinkActionValue.value })
      }
      indexShiftButtonToUse++
    })

    const unnecessaryVehicleRegularButtons = currentRegularButtonParameters.filter((v) => v.actionId !== MAVLinkButtonFunction.shift && !wantedRegularMavlinkActions.includes(v.actionId))
    const unnecessaryVehicleShiftButtons = currentShiftButtonParameters.filter((v) => v.actionId !== MAVLinkButtonFunction.shift && !wantedShiftMavlinkActions.includes(v.actionId))

    const finallyRemainedUnmappedRegularMavlinkActions: string[] = []
    indexRegularButtonToUse = 0
    remainingUnmappedRegularMavlinkActions.forEach((actionId) => {
      if (indexRegularButtonToUse >= unnecessaryVehicleRegularButtons.length) {
        finallyRemainedUnmappedRegularMavlinkActions.push(actionId)
      } else {
        const mavlinkActionValue = this.vehicleButtonParameterTable.find((e) => e.title === actionId)
        if (mavlinkActionValue === undefined) return
        this.vehicle?.setParameter({ id: unnecessaryVehicleRegularButtons[unnecessaryVehicleRegularButtons.length - 1].button, value: mavlinkActionValue.value })
      }
      indexRegularButtonToUse++
    })

    const finallyRemainedUnmappedShiftMavlinkActions: string[] = []
    indexShiftButtonToUse = 0
    remainingUnmappedShiftMavlinkActions.forEach((actionId) => {
      if (indexShiftButtonToUse >= unnecessaryVehicleShiftButtons.length) {
        finallyRemainedUnmappedShiftMavlinkActions.push(actionId)
      } else {
        const mavlinkActionValue = this.vehicleButtonParameterTable.find((e) => e.title === actionId)
        if (mavlinkActionValue === undefined) return
        this.vehicle?.setParameter({ id: unnecessaryVehicleShiftButtons[unnecessaryVehicleShiftButtons.length - 1].button, value: mavlinkActionValue.value })
      }
      indexShiftButtonToUse++
    })

    // There are no spots left to map the remaining ones, so we throw a warning and un-map them from the joystick.
    finallyRemainedUnmappedRegularMavlinkActions.forEach((actionId) => {
      const buttonAction = Object.entries(this.currentActionsMapping.buttonsCorrespondencies.regular).find((v) => v[1].action.id === actionId)
      if (buttonAction === undefined) return
      showDialog({
        maxWidth: 600,
        message: `There are no spots left in the vehicle for the MAVLink Manual Control function ${actionId}.
        Consider mapping this function to a shift button.`,
        variant: 'error',
        timer: 6000,
      })
      this.currentActionsMapping.buttonsCorrespondencies.regular[Number(buttonAction[0]) as JoystickButton].action = otherAvailableActions.no_function
    })

    finallyRemainedUnmappedShiftMavlinkActions.forEach((actionId) => {
      const buttonAction = Object.entries(this.currentActionsMapping.buttonsCorrespondencies.shift).find((v) => v[1].action.id === actionId)
      if (buttonAction === undefined) return
      showDialog({
        maxWidth: 600,
        message: `There are no spots left in the vehicle for the MAVLink Manual Control function ${actionId}.
        Consider mapping this function to a shift button.`,
        variant: 'error',
        timer: 6000,
      })
      this.currentActionsMapping.buttonsCorrespondencies.shift[Number(buttonAction[0]) as JoystickButton].action = otherAvailableActions.no_function
    })
  }
}

