import { type ProtocolAction } from '@/types/joystick'

/**
 * Vehicle families that get their own guided mapping flow.
 * Boat and Rover are split even though both run ArduRover, as their available modes differ.
 */
export enum JoystickWizardVehicle {
  Sub = 'sub',
  Boat = 'boat',
  Rover = 'rover',
  Copter = 'copter',
  Plane = 'plane',
  Generic = 'generic',
}

/**
 * Which pair of direction arrows to draw while an axis step waits for input.
 */
export type WizardAxisHint = 'vertical' | 'horizontal' | 'surge' | 'yaw'

/**
 * What every step of the flow carries, whatever it asks the user for.
 */
interface WizardStepBase {
  /**
   * Stable identifier, also used as the jump target of question options
   */
  id: string
  /**
   * Heading shown at the top of the wizard
   */
  title: string
  /**
   * Instruction shown next to the wizard icon
   */
  content?: string
  /**
   * Secondary line shown above the input readout
   */
  opposite?: string
}

/**
 * Welcome screen.
 */
export interface WizardIntroStep extends WizardStepBase {
  /**
   * Step discriminant
   */
  kind: 'intro'
}

/**
 * Screen where the user confirms which vehicle the mapping is for, choosing the flow that follows.
 */
export interface WizardVehicleStep extends WizardStepBase {
  /**
   * Step discriminant
   */
  kind: 'vehicle'
}

/**
 * Screen that binds one axis to a vehicle function.
 */
export interface WizardAxisStep extends WizardStepBase {
  /**
   * Step discriminant
   */
  kind: 'axis'
  /**
   * Action the detected axis is bound to
   */
  action: ProtocolAction
  /**
   * Value written to the mapping at full deflection towards the direction the user chose
   */
  fullScale: number
  /**
   * Whether the autopilot expects this axis over 0..fullScale rather than ±fullScale
   */
  unipolar?: boolean
  /**
   * Direction arrows to draw while detecting
   */
  hint: WizardAxisHint
}

/**
 * Screen that binds one button to a vehicle function or to the shift modifier.
 */
export interface WizardButtonStep extends WizardStepBase {
  /**
   * Step discriminant
   */
  kind: 'button'
  /**
   * Action the detected button is bound to
   */
  action: ProtocolAction
}

/**
 * Screen that branches the flow on a yes/no question about the vehicle.
 */
export interface WizardQuestionStep extends WizardStepBase {
  /**
   * Step discriminant
   */
  kind: 'question'
  /**
   * Answers, each continuing the flow at the step it names
   */
  options: {
    /**
     * Text shown on the answer button
     */
    label: string
    /**
     * Identifier of the step to continue at
     */
    goTo: string
  }[]
}

/**
 * Final screen, listing everything that was mapped with a live readout.
 */
export interface WizardReviewStep extends WizardStepBase {
  /**
   * Step discriminant
   */
  kind: 'review'
}

export type JoystickWizardStep =
  | WizardIntroStep
  | WizardVehicleStep
  | WizardAxisStep
  | WizardButtonStep
  | WizardQuestionStep
  | WizardReviewStep
