import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { availableCockpitActions } from '@/libs/joystick/protocols/cockpit-actions'
import {
  availableMavlinkManualControlButtonFunctions,
  MAVLinkButtonFunction,
} from '@/libs/joystick/protocols/mavlink-manual-control'
import { modifierKeyActions } from '@/libs/joystick/protocols/other'
import { joystickCameraControls, joystickInputAxes } from '@/libs/joystick/protocols/predefined-resources'
import { getVehicleModeAction } from '@/libs/vehicle/ardupilot/common'
import { CopterMode, PlaneMode, RoverMode } from '@/libs/vehicle/ardupilot/types/modes'
import { Type as VehicleType } from '@/libs/vehicle/vehicle'

import {
  type JoystickWizardStep,
  type WizardAxisStep,
  type WizardButtonStep,
  type WizardQuestionStep,
  JoystickWizardVehicle,
} from './types'

/** Magnitude ArduPilot expects at full axis deflection in a MANUAL_CONTROL message. */
const manualControlFullScale = 1000

const mavlinkFunction = (id: Exclude<MAVLinkButtonFunction, MAVLinkButtonFunction.shift>): WizardButtonStep['action'] =>
  availableMavlinkManualControlButtonFunctions[id]

const axisStep = (step: Omit<WizardAxisStep, 'kind' | 'fullScale'>): WizardAxisStep => ({
  kind: 'axis',
  fullScale: manualControlFullScale,
  ...step,
})

const buttonStep = (step: Omit<WizardButtonStep, 'kind'>): WizardButtonStep => ({ kind: 'button', ...step })

const questionStep = (step: Omit<WizardQuestionStep, 'kind'>): WizardQuestionStep => ({
  kind: 'question',
  ...step,
})

const modeStepId = (label: string): string => `mode-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

const modeStepContent = (label: string): string => `Press the button that switches the vehicle to ${label} mode.`

// Modes reached through Cockpit, for the vehicles whose autopilot ignores the buttons of a manual control message
const modeStep = (vehicleType: VehicleType, mode: number, label: string): WizardButtonStep =>
  buttonStep({
    id: modeStepId(label),
    title: `Mode: ${label}`,
    content: modeStepContent(label),
    action: getVehicleModeAction(vehicleType, mode),
  })

// Modes reached through the autopilot's own button functions, which is how a Sub is set up from the factory
const subModeStep = (
  mode: Exclude<MAVLinkButtonFunction, MAVLinkButtonFunction.shift>,
  label: string
): WizardButtonStep =>
  buttonStep({
    id: modeStepId(label),
    title: `Mode: ${label}`,
    content: modeStepContent(label),
    action: mavlinkFunction(mode),
  })

/** Human-readable name of each wizard flow, used in the intro copy and in the saved mapping's name. */
export const wizardVehicleNames: Record<JoystickWizardVehicle, string> = {
  [JoystickWizardVehicle.Sub]: 'BlueROV / ROV',
  [JoystickWizardVehicle.Boat]: 'BlueBoat / surface boat',
  [JoystickWizardVehicle.Rover]: 'Rover',
  [JoystickWizardVehicle.Copter]: 'MAV / multirotor',
  [JoystickWizardVehicle.Plane]: 'Plane',
  [JoystickWizardVehicle.Generic]: 'Other vehicle',
}

const wizardVehicleByMavType: Partial<Record<MavType, JoystickWizardVehicle>> = {
  [MavType.MAV_TYPE_SUBMARINE]: JoystickWizardVehicle.Sub,
  [MavType.MAV_TYPE_SURFACE_BOAT]: JoystickWizardVehicle.Boat,
  [MavType.MAV_TYPE_GROUND_ROVER]: JoystickWizardVehicle.Rover,
  [MavType.MAV_TYPE_QUADROTOR]: JoystickWizardVehicle.Copter,
  [MavType.MAV_TYPE_HEXAROTOR]: JoystickWizardVehicle.Copter,
  [MavType.MAV_TYPE_OCTOROTOR]: JoystickWizardVehicle.Copter,
  [MavType.MAV_TYPE_TRICOPTER]: JoystickWizardVehicle.Copter,
  [MavType.MAV_TYPE_COAXIAL]: JoystickWizardVehicle.Copter,
  [MavType.MAV_TYPE_HELICOPTER]: JoystickWizardVehicle.Copter,
  [MavType.MAV_TYPE_DODECAROTOR]: JoystickWizardVehicle.Copter,
  [MavType.MAV_TYPE_FIXED_WING]: JoystickWizardVehicle.Plane,
  [MavType.MAV_TYPE_FLAPPING_WING]: JoystickWizardVehicle.Plane,
  [MavType.MAV_TYPE_VTOL_TILTROTOR]: JoystickWizardVehicle.Plane,
  [MavType.MAV_TYPE_VTOL_QUADROTOR]: JoystickWizardVehicle.Plane,
  [MavType.MAV_TYPE_VTOL_DUOROTOR]: JoystickWizardVehicle.Plane,
}

/**
 * Pick the wizard flow that matches a connected vehicle.
 * @param {MavType | undefined} mavType - Type the vehicle reported in its heartbeat
 * @returns {JoystickWizardVehicle} The matching flow, falling back to the generic one
 */
export const wizardVehicleFromMavType = (mavType: MavType | undefined): JoystickWizardVehicle => {
  if (mavType === undefined) return JoystickWizardVehicle.Generic
  return wizardVehicleByMavType[mavType] ?? JoystickWizardVehicle.Generic
}

const introStep: JoystickWizardStep = {
  kind: 'intro',
  id: 'intro',
  title: 'Joystick configuration wizard',
  content:
    'This guide pairs each axis and button on your controller with a function on the vehicle, one at a time, so an ' +
    'unknown gamepad can be set up without editing the mapping table by hand.',
  opposite:
    'Press any button on the controller to start. That same button advances the wizard from here on, and can still ' +
    'be mapped to a vehicle function like any other.',
}

const vehicleStep: JoystickWizardStep = {
  kind: 'vehicle',
  id: 'vehicle',
  title: 'Vehicle to map for',
  content:
    'Each vehicle brings its own set of questions, covering the controls it actually has and skipping the ones it ' +
    'does not.',
  opposite:
    'When Cockpit is connected, the vehicle it found is already selected. A mapping built for the wrong one sends ' +
    'commands the autopilot ignores, and changing this later starts the mapping over.',
}

const shiftStep = buttonStep({
  id: 'shift',
  title: 'Shift modifier',
  content:
    'Press the button to use as the shift modifier. Holding it while pressing another button reaches a second set ' +
    'of functions, doubling how much your controller can do.',
  opposite: 'Often one of the shoulder buttons. You can skip this if you do not need a second layer.',
  action: modifierKeyActions.shift,
})

const armSteps: JoystickWizardStep[] = [
  buttonStep({
    id: 'arm',
    title: 'Arm',
    content: 'Press the button that arms the vehicle.',
    opposite: 'Often Start.',
    action: availableCockpitActions.mavlink_arm,
  }),
  buttonStep({
    id: 'disarm',
    title: 'Disarm',
    content: 'Press the button that disarms the vehicle.',
    opposite: 'Often Select or Back.',
    action: availableCockpitActions.mavlink_disarm,
  }),
]

const shortcutSteps: JoystickWizardStep[] = [
  questionStep({
    id: 'shortcuts-question',
    title: 'Cockpit shortcuts',
    content: 'These switch between your views and control video recording without reaching for the keyboard.',
    opposite: 'Would you like to map buttons to Cockpit itself, rather than to the vehicle?',
    options: [
      { label: 'No', goTo: 'review' },
      { label: 'Yes', goTo: 'previous-view' },
    ],
  }),
  buttonStep({
    id: 'previous-view',
    title: 'Go to previous view',
    content: 'Press the button that switches to the previous view.',
    action: availableCockpitActions.go_to_previous_view,
  }),
  buttonStep({
    id: 'next-view',
    title: 'Go to next view',
    content: 'Press the button that switches to the next view.',
    action: availableCockpitActions.go_to_next_view,
  }),
  buttonStep({
    id: 'toggle-recording',
    title: 'Start and stop recording',
    content: 'Press the button that starts and stops recording every video stream.',
    action: availableCockpitActions.toggle_recording_all_streams,
  }),
  buttonStep({
    id: 'take-snapshot',
    title: 'Take a snapshot',
    content: 'Press the button that saves a snapshot of the video streams.',
    action: availableCockpitActions.take_snapshot,
  }),
]

const reviewStep: JoystickWizardStep = {
  kind: 'review',
  id: 'review',
  title: 'Review mapping',
}

const subSteps = (): JoystickWizardStep[] => [
  axisStep({
    id: 'heave',
    title: 'Heave (ascend and descend)',
    content: 'Move the axis for vertical thrust. The direction you push now becomes ascend, and the opposite descend.',
    opposite: 'Often the right stick, up and down.',
    action: joystickInputAxes.axis_z,
    hint: 'vertical',
    unipolar: true,
  }),
  axisStep({
    id: 'sway',
    title: 'Sway (port and starboard)',
    content: 'Move the axis that slides the vehicle sideways. The direction you push now becomes starboard.',
    opposite: 'Often the left stick, left and right.',
    action: joystickInputAxes.axis_y,
    hint: 'horizontal',
  }),
  axisStep({
    id: 'surge',
    title: 'Forward and backward',
    content: 'Move the axis that drives the vehicle along its length. The direction you push now becomes forward.',
    opposite: 'Often the left stick, up and down.',
    action: joystickInputAxes.axis_x,
    hint: 'surge',
  }),
  axisStep({
    id: 'yaw',
    title: 'Yaw (heading)',
    content: 'Move the axis that turns the vehicle. The direction you push now becomes a turn to starboard.',
    opposite: 'Often the right stick, left and right, or a twist of the stick.',
    action: joystickInputAxes.axis_r,
    hint: 'yaw',
  }),
  shiftStep,
  ...armSteps,
  subModeStep(MAVLinkButtonFunction.mode_manual, 'Manual'),
  subModeStep(MAVLinkButtonFunction.mode_stabilize, 'Stabilize'),
  subModeStep(MAVLinkButtonFunction.mode_depth_hold, 'Depth hold'),
  questionStep({
    id: 'extra-modes-question',
    title: 'More flight modes',
    content:
      'Position hold, Auto, Guided and Circle need a positioning system, and Surftrak needs a rangefinder. A ' +
      'standard vehicle without those will refuse to enter them.',
    opposite: 'Would you like to map the modes beyond Manual, Stabilize and Depth hold?',
    options: [
      { label: 'No', goTo: 'lights-brighter' },
      { label: 'Yes', goTo: 'mode-position-hold' },
    ],
  }),
  subModeStep(MAVLinkButtonFunction.mode_poshold, 'Position hold'),
  subModeStep(MAVLinkButtonFunction.mode_surftrak, 'Surftrak'),
  subModeStep(MAVLinkButtonFunction.mode_acro, 'Acro'),
  subModeStep(MAVLinkButtonFunction.mode_auto, 'Auto'),
  subModeStep(MAVLinkButtonFunction.mode_guided, 'Guided'),
  buttonStep({
    id: 'lights-brighter',
    title: 'Lights: brighter',
    content: 'Press the button that raises the brightness of the lights.',
    action: mavlinkFunction(MAVLinkButtonFunction.lights1_brighter),
  }),
  buttonStep({
    id: 'lights-dimmer',
    title: 'Lights: dimmer',
    content: 'Press the button that lowers the brightness of the lights.',
    action: mavlinkFunction(MAVLinkButtonFunction.lights1_dimmer),
  }),
  questionStep({
    id: 'lights2-question',
    title: 'Second set of lights',
    content: 'A standard BlueROV2 has one set. A second set is an optional addition wired to its own output.',
    opposite: 'Does the vehicle have a second, separately controlled set of lights?',
    options: [
      { label: 'No', goTo: 'mount-tilt-up' },
      { label: 'Yes', goTo: 'lights2-brighter' },
    ],
  }),
  buttonStep({
    id: 'lights2-brighter',
    title: 'Second lights: brighter',
    content: 'Press the button that raises the brightness of the second set of lights.',
    action: mavlinkFunction(MAVLinkButtonFunction.lights2_brighter),
  }),
  buttonStep({
    id: 'lights2-dimmer',
    title: 'Second lights: dimmer',
    content: 'Press the button that lowers the brightness of the second set of lights.',
    action: mavlinkFunction(MAVLinkButtonFunction.lights2_dimmer),
  }),
  buttonStep({
    id: 'mount-tilt-up',
    title: 'Camera mount: tilt up',
    content: 'Press the button that tilts the camera mount up.',
    action: mavlinkFunction(MAVLinkButtonFunction.mount_tilt_up),
  }),
  buttonStep({
    id: 'mount-tilt-down',
    title: 'Camera mount: tilt down',
    content: 'Press the button that tilts the camera mount down.',
    action: mavlinkFunction(MAVLinkButtonFunction.mount_tilt_down),
  }),
  buttonStep({
    id: 'mount-center',
    title: 'Camera mount: center',
    content: 'Press the button that returns the camera mount to the center.',
    action: mavlinkFunction(MAVLinkButtonFunction.mount_center),
  }),
  buttonStep({
    id: 'gain-increase',
    title: 'Pilot gain: increase',
    content: 'Press the button that raises pilot gain, making the vehicle respond more strongly to the sticks.',
    action: mavlinkFunction(MAVLinkButtonFunction.gain_inc),
  }),
  buttonStep({
    id: 'gain-decrease',
    title: 'Pilot gain: decrease',
    content: 'Press the button that lowers pilot gain, making the vehicle respond more gently to the sticks.',
    action: mavlinkFunction(MAVLinkButtonFunction.gain_dec),
  }),
  buttonStep({
    id: 'input-hold',
    title: 'Input hold',
    content:
      'Press the button that holds the current stick input, so the vehicle keeps moving without you holding the ' +
      'sticks. Returning the sticks to center releases it.',
    opposite: 'The vehicle has to be armed for this to take effect.',
    action: mavlinkFunction(MAVLinkButtonFunction.input_hold_set),
  }),
  questionStep({
    id: 'manipulator-question',
    title: 'Manipulator',
    content:
      'The gripper has to be assigned to the first actuator output on the autopilot for these buttons to reach it.',
    opposite: 'Is the vehicle fitted with a gripper or other manipulator?',
    options: [
      { label: 'No', goTo: 'camera-question' },
      { label: 'Yes', goTo: 'gripper-open' },
    ],
  }),
  buttonStep({
    id: 'gripper-open',
    title: 'Manipulator: open',
    content: 'Press and release the button that opens the gripper. It opens for as long as the button is held.',
    action: mavlinkFunction(MAVLinkButtonFunction.actuator_1_max_momentary),
  }),
  buttonStep({
    id: 'gripper-close',
    title: 'Manipulator: close',
    content: 'Press and release the button that closes the gripper. It closes for as long as the button is held.',
    action: mavlinkFunction(MAVLinkButtonFunction.actuator_1_min_momentary),
  }),
  questionStep({
    id: 'camera-question',
    title: 'Camera controls',
    content: 'The standard low-light camera does not. Cameras such as the 4K Cam do.',
    opposite: 'Does the camera support remote zoom and focus?',
    options: [
      { label: 'No', goTo: 'heavy-question' },
      { label: 'Yes', goTo: 'zoom-in' },
    ],
  }),
  buttonStep({
    id: 'zoom-in',
    title: 'Camera: zoom in',
    content: 'Press the button that zooms the camera in.',
    action: joystickCameraControls.zoom_in,
  }),
  buttonStep({
    id: 'zoom-out',
    title: 'Camera: zoom out',
    content: 'Press the button that zooms the camera out.',
    action: joystickCameraControls.zoom_out,
  }),
  buttonStep({
    id: 'focus-near',
    title: 'Camera: focus near',
    content: 'Press the button that pulls the focus closer.',
    action: joystickCameraControls.focus_near,
  }),
  buttonStep({
    id: 'focus-far',
    title: 'Camera: focus far',
    content: 'Press the button that pushes the focus further away.',
    action: joystickCameraControls.focus_far,
  }),
  questionStep({
    id: 'heavy-question',
    title: 'Roll and pitch control',
    content:
      'A BlueROV2 Heavy can. A standard six-thruster vehicle cannot, and mapping these would leave buttons that do ' +
      'nothing.',
    opposite: 'Can the vehicle control its own roll and pitch?',
    options: [
      { label: 'No', goTo: 'shortcuts-question' },
      { label: 'Yes', goTo: 'pitch' },
    ],
  }),
  axisStep({
    id: 'pitch',
    title: 'Pitch',
    content: 'Move the axis that pitches the vehicle. The direction you push now becomes nose up.',
    opposite: 'Often a hat switch or a spare stick axis.',
    action: joystickInputAxes.axis_s,
    hint: 'surge',
  }),
  axisStep({
    id: 'roll',
    title: 'Roll',
    content: 'Move the axis that rolls the vehicle. The direction you push now becomes a roll to starboard.',
    opposite: 'Often a hat switch or a spare stick axis.',
    action: joystickInputAxes.axis_t,
    hint: 'horizontal',
  }),
  buttonStep({
    id: 'trim-pitch-up',
    title: 'Trim pitch up',
    content: 'Press the button that trims the nose up, shifting where the vehicle sits with the sticks centered.',
    action: mavlinkFunction(MAVLinkButtonFunction.trim_pitch_inc),
  }),
  buttonStep({
    id: 'trim-pitch-down',
    title: 'Trim pitch down',
    content: 'Press the button that trims the nose down.',
    action: mavlinkFunction(MAVLinkButtonFunction.trim_pitch_dec),
  }),
  buttonStep({
    id: 'trim-roll-starboard',
    title: 'Trim roll to starboard',
    content: 'Press the button that trims the roll towards starboard.',
    action: mavlinkFunction(MAVLinkButtonFunction.trim_roll_inc),
  }),
  buttonStep({
    id: 'trim-roll-port',
    title: 'Trim roll to port',
    content: 'Press the button that trims the roll towards port.',
    action: mavlinkFunction(MAVLinkButtonFunction.trim_roll_dec),
  }),
  buttonStep({
    id: 'roll-pitch-toggle',
    title: 'Swap sticks to roll and pitch',
    content:
      'Press the button that makes the forward and sideways sticks command roll and pitch instead, for the times ' +
      'you need attitude control without giving up a stick.',
    action: mavlinkFunction(MAVLinkButtonFunction.roll_pitch_toggle),
  }),
]

// Rover, Copter and Plane only read the sticks of a manual control message, so their button actions run in Cockpit
const gcsDrivenSteps = (
  axes: WizardAxisStep[],
  coreModes: JoystickWizardStep[],
  extraModes: JoystickWizardStep[]
): JoystickWizardStep[] => [
  ...axes,
  shiftStep,
  ...armSteps,
  ...coreModes,
  questionStep({
    id: 'extra-modes-question',
    title: 'More modes',
    content: 'The autonomous modes need a working position estimate before the vehicle will accept them.',
    opposite: 'Would you like to map the remaining modes?',
    options: [
      { label: 'No', goTo: 'shortcuts-question' },
      { label: 'Yes', goTo: extraModes[0].id },
    ],
  }),
  ...extraModes,
]

const drivingAxes = (): WizardAxisStep[] => [
  axisStep({
    id: 'steering',
    title: 'Steering',
    content: 'Move the axis that steers the vehicle. The direction you push now becomes a turn to starboard.',
    opposite: 'Often the left stick, left and right.',
    action: joystickInputAxes.axis_y,
    hint: 'horizontal',
  }),
  axisStep({
    id: 'throttle',
    title: 'Throttle',
    content: 'Move the axis that drives the vehicle. The direction you push now becomes forward.',
    opposite: 'Often the right stick, up and down. Pushing the other way drives in reverse.',
    action: joystickInputAxes.axis_z,
    hint: 'surge',
  }),
]

const flyingAxes = (rudderTitle: string): WizardAxisStep[] => [
  axisStep({
    id: 'roll',
    title: 'Roll',
    content: 'Move the axis that rolls the vehicle. The direction you push now becomes a roll to the right.',
    opposite: 'Often the right stick, left and right.',
    action: joystickInputAxes.axis_y,
    hint: 'horizontal',
  }),
  axisStep({
    id: 'pitch',
    title: 'Pitch',
    content: 'Move the axis that pitches the vehicle. The direction you push now becomes nose up.',
    opposite: 'Often the right stick, up and down.',
    action: joystickInputAxes.axis_x,
    hint: 'surge',
  }),
  axisStep({
    id: 'throttle',
    title: 'Throttle',
    content: 'Move the axis that sets the throttle. The direction you push now becomes full throttle.',
    opposite: 'Often the left stick, up and down.',
    action: joystickInputAxes.axis_z,
    hint: 'vertical',
    unipolar: true,
  }),
  axisStep({
    id: 'yaw',
    title: rudderTitle,
    content: 'Move the axis that turns the vehicle about its vertical axis. The direction you push now turns right.',
    opposite: 'Often the left stick, left and right.',
    action: joystickInputAxes.axis_r,
    hint: 'yaw',
  }),
]

const boatSteps = (): JoystickWizardStep[] =>
  gcsDrivenSteps(
    drivingAxes(),
    [
      modeStep(VehicleType.Rover, RoverMode.MANUAL, 'Manual'),
      modeStep(VehicleType.Rover, RoverMode.HOLD, 'Hold'),
      modeStep(VehicleType.Rover, RoverMode.LOITER, 'Loiter'),
      modeStep(VehicleType.Rover, RoverMode.AUTO, 'Auto'),
    ],
    [
      modeStep(VehicleType.Rover, RoverMode.ACRO, 'Acro'),
      modeStep(VehicleType.Rover, RoverMode.STEERING, 'Steering'),
      modeStep(VehicleType.Rover, RoverMode.GUIDED, 'Guided'),
      modeStep(VehicleType.Rover, RoverMode.RTL, 'Return to launch'),
      modeStep(VehicleType.Rover, RoverMode.SMART_RTL, 'Smart return to launch'),
    ]
  )

const roverSteps = (): JoystickWizardStep[] =>
  gcsDrivenSteps(
    drivingAxes(),
    [
      modeStep(VehicleType.Rover, RoverMode.MANUAL, 'Manual'),
      modeStep(VehicleType.Rover, RoverMode.HOLD, 'Hold'),
      modeStep(VehicleType.Rover, RoverMode.STEERING, 'Steering'),
      modeStep(VehicleType.Rover, RoverMode.AUTO, 'Auto'),
    ],
    [
      modeStep(VehicleType.Rover, RoverMode.ACRO, 'Acro'),
      modeStep(VehicleType.Rover, RoverMode.SIMPLE, 'Simple'),
      modeStep(VehicleType.Rover, RoverMode.GUIDED, 'Guided'),
      modeStep(VehicleType.Rover, RoverMode.RTL, 'Return to launch'),
      modeStep(VehicleType.Rover, RoverMode.SMART_RTL, 'Smart return to launch'),
    ]
  )

const copterSteps = (): JoystickWizardStep[] =>
  gcsDrivenSteps(
    flyingAxes('Yaw'),
    [
      modeStep(VehicleType.Copter, CopterMode.STABILIZE, 'Stabilize'),
      modeStep(VehicleType.Copter, CopterMode.ALT_HOLD, 'Altitude hold'),
      modeStep(VehicleType.Copter, CopterMode.LOITER, 'Loiter'),
      modeStep(VehicleType.Copter, CopterMode.RTL, 'Return to launch'),
    ],
    [
      modeStep(VehicleType.Copter, CopterMode.ACRO, 'Acro'),
      modeStep(VehicleType.Copter, CopterMode.POSHOLD, 'Position hold'),
      modeStep(VehicleType.Copter, CopterMode.AUTO, 'Auto'),
      modeStep(VehicleType.Copter, CopterMode.GUIDED, 'Guided'),
      modeStep(VehicleType.Copter, CopterMode.BRAKE, 'Brake'),
      modeStep(VehicleType.Copter, CopterMode.LAND, 'Land'),
    ]
  )

const planeSteps = (): JoystickWizardStep[] =>
  gcsDrivenSteps(
    flyingAxes('Rudder'),
    [
      modeStep(VehicleType.Plane, PlaneMode.MANUAL, 'Manual'),
      modeStep(VehicleType.Plane, PlaneMode.FLY_BY_WIRE_A, 'Fly by wire A'),
      modeStep(VehicleType.Plane, PlaneMode.LOITER, 'Loiter'),
      modeStep(VehicleType.Plane, PlaneMode.RTL, 'Return to launch'),
    ],
    [
      modeStep(VehicleType.Plane, PlaneMode.STABILIZE, 'Stabilize'),
      modeStep(VehicleType.Plane, PlaneMode.ACRO, 'Acro'),
      modeStep(VehicleType.Plane, PlaneMode.CRUISE, 'Cruise'),
      modeStep(VehicleType.Plane, PlaneMode.CIRCLE, 'Circle'),
      modeStep(VehicleType.Plane, PlaneMode.AUTO, 'Auto'),
      modeStep(VehicleType.Plane, PlaneMode.GUIDED, 'Guided'),
      modeStep(VehicleType.Plane, PlaneMode.TAKEOFF, 'Takeoff'),
    ]
  )

const genericSteps = (): JoystickWizardStep[] => [
  axisStep({
    id: 'surge',
    title: 'Forward and backward',
    content: 'Move the axis that drives the vehicle along its length. The direction you push now becomes forward.',
    opposite: 'Sent to the vehicle as the forward axis of a manual control message.',
    action: joystickInputAxes.axis_x,
    hint: 'surge',
  }),
  axisStep({
    id: 'sway',
    title: 'Sideways',
    content: 'Move the axis that drives the vehicle sideways. The direction you push now becomes right.',
    opposite: 'Sent to the vehicle as the lateral axis of a manual control message.',
    action: joystickInputAxes.axis_y,
    hint: 'horizontal',
  }),
  axisStep({
    id: 'throttle',
    title: 'Throttle',
    content: 'Move the axis that sets the throttle. The direction you push now becomes full throttle.',
    opposite: 'Sent to the vehicle as the throttle axis of a manual control message.',
    action: joystickInputAxes.axis_z,
    hint: 'vertical',
    unipolar: true,
  }),
  axisStep({
    id: 'yaw',
    title: 'Yaw',
    content: 'Move the axis that turns the vehicle. The direction you push now turns right.',
    opposite: 'Sent to the vehicle as the yaw axis of a manual control message.',
    action: joystickInputAxes.axis_r,
    hint: 'yaw',
  }),
  shiftStep,
  ...armSteps,
]

const stepsByVehicle: Record<JoystickWizardVehicle, () => JoystickWizardStep[]> = {
  [JoystickWizardVehicle.Sub]: subSteps,
  [JoystickWizardVehicle.Boat]: boatSteps,
  [JoystickWizardVehicle.Rover]: roverSteps,
  [JoystickWizardVehicle.Copter]: copterSteps,
  [JoystickWizardVehicle.Plane]: planeSteps,
  [JoystickWizardVehicle.Generic]: genericSteps,
}

/**
 * Build the ordered steps of a wizard flow.
 *
 * Mode actions are renamed when the user renames a flight mode, so this has to run when the wizard opens rather than
 * at module load.
 * @param {JoystickWizardVehicle} vehicle - Flow to build
 * @returns {JoystickWizardStep[]} Every step of the flow, in order, branches included
 */
export const buildWizardSteps = (vehicle: JoystickWizardVehicle): JoystickWizardStep[] => [
  introStep,
  vehicleStep,
  ...stepsByVehicle[vehicle](),
  ...shortcutSteps,
  reviewStep,
]
