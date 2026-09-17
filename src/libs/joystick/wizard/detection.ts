import { type JoystickState } from '@/types/joystick'

/**
 * Deflection, in normalized axis units, below which a movement is treated as noise or stick drift rather than a
 * deliberate input.
 */
const axisDetectionThreshold = 0.05

/**
 * An axis the user moved, and how far they pushed it.
 */
export interface MovedAxis {
  /**
   * Index of the axis, in Cockpit-standard numbering
   */
  index: number
  /**
   * Largest deflection seen since the axis was first detected, whose sign is the direction the user chose
   */
  deflection: number
}

/**
 * What a single controller frame revealed.
 */
export interface DetectionFrame {
  /**
   * Buttons released during this frame, excluding presses carried over from a previous step
   */
  releases: number[]
  /**
   * The axis being moved, once one has passed the detection threshold
   */
  movedAxis?: MovedAxis
  /**
   * Where the sticks are on this frame alone, for a reading that has to follow the user back rather than hold the
   * largest push of the step
   */
  liveAxis?: MovedAxis
}

/**
 * Turns a stream of controller states into the discrete events the wizard maps.
 *
 * Buttons are read on release rather than on press so that a chord (shift plus a button) is committed with the
 * modifier state the user actually held, and so that holding a button down cannot bind it repeatedly. Axes report
 * their largest deflection instead of the first one over the threshold, so a slow push still records the direction
 * the user meant rather than wherever the stick happened to be on the frame it crossed.
 */
export class JoystickInputDetector {
  private wasPressed = new Map<number, boolean>()
  private carriedOver = new Set<number>()
  private restingAxes = new Map<number, number>()
  private moved: MovedAxis | undefined = undefined

  /**
   * Read a controller frame.
   * @param {JoystickState} state - Current state of the controller, in Cockpit-standard numbering
   * @returns {DetectionFrame} Button releases and axis movement found in this frame
   */
  update(state: JoystickState): DetectionFrame {
    const releases: number[] = []

    state.buttons.forEach((value, index) => {
      const isPressed = (value ?? 0) > 0.5
      const wasPressed = this.wasPressed.get(index) ?? false
      this.wasPressed.set(index, isPressed)
      if (isPressed || !wasPressed) return
      if (this.carriedOver.delete(index)) return
      releases.push(index)
    })

    let liveAxis: MovedAxis | undefined = undefined
    state.axes.forEach((value, index) => {
      const current = value ?? 0
      const resting = this.restingAxes.get(index)
      if (resting === undefined) {
        this.restingAxes.set(index, current)
        return
      }

      const deflection = current - resting
      if (Math.abs(deflection) < axisDetectionThreshold) return
      if (liveAxis === undefined || Math.abs(deflection) > Math.abs(liveAxis.deflection)) {
        liveAxis = { index, deflection }
      }
      if (this.moved === undefined || Math.abs(deflection) > Math.abs(this.moved.deflection)) {
        this.moved = { index, deflection }
      }
    })

    return { releases, movedAxis: this.moved, liveAxis }
  }

  /**
   * Whether a button is currently down.
   * @param {number} index - Index of the button, in Cockpit-standard numbering
   * @returns {boolean} True while the button is held
   */
  isPressed(index: number): boolean {
    return this.wasPressed.get(index) ?? false
  }

  /**
   * Start a new step: forget the previous axis detection, take the current stick positions as rest, and ignore the
   * buttons the user is still holding so the press that advanced the wizard is not read again as the next binding.
   * @param {JoystickState} state - Controller state at the moment the step opened
   */
  startStep(state: JoystickState): void {
    this.moved = undefined
    this.restingAxes.clear()
    state.axes.forEach((value, index) => this.restingAxes.set(index, value ?? 0))
    this.carriedOver.clear()
    state.buttons.forEach((value, index) => {
      const isPressed = (value ?? 0) > 0.5
      this.wasPressed.set(index, isPressed)
      if (isPressed) this.carriedOver.add(index)
    })
  }
}
