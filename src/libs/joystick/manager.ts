import { defaultJoystickCalibration } from '@/assets/defaults'
import { type JoystickCalibration, type JoystickState } from '@/types/joystick'

import { applyCalibration } from './calibration'

export const joystickCalibrationOptionsKey = 'cockpit-joystick-calibration-options'

/**
 * Possible events from GamepadListener
 * https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API
 */
export enum EventType {
  Unknown = 'unknown',
  Connected = 'connected',
  Disconnected = 'disconnected',
  Axis = 'axis',
  Button = 'button',
}

/**
 * Supported joystick models
 */
export enum JoystickModel {
  DualSense = 'DualSense (PS5)',
  DualShock4 = 'DualShock (PS4)',
  XboxOne_Wireless = 'Xbox One Wireless Controller',
  XboxOneS_Bluetooth = 'Xbox One S (bluetooth)',
  XboxController_Bluetooth = 'Xbox controller (bluetooth)',
  XboxController_Wired = 'Xbox controller (wired)',
  XboxController_360 = 'Xbox 360 controller',
  LogitechExtreme3DPro = 'Logitech Extreme 3D Pro',
  IpegaPG9023 = 'Ipega PG-9023',
  SteamDeckLCD = 'Steam Deck LCD',
  SteamDeckOLED = 'Steam Deck OLED',
  Unknown = 'Unknown',
}

const JoystickMapVidPid: Map<string, JoystickModel> = new Map([
  // Sony
  ['054c:0ce6', JoystickModel.DualSense],
  ['054c:09cc', JoystickModel.DualShock4],
  ['045e:02e0', JoystickModel.XboxOne_Wireless],
  ['045e:02fd', JoystickModel.XboxOneS_Bluetooth],
  ['045e:0b13', JoystickModel.XboxController_Bluetooth],
  ['045e:0b12', JoystickModel.XboxController_Wired],
  ['28de:11ff', JoystickModel.XboxController_360],
  ['046d:c215', JoystickModel.LogitechExtreme3DPro],
  ['1949:0402', JoystickModel.IpegaPG9023],
  ['28de:11ff', JoystickModel.SteamDeckLCD],
  ['28de:1205', JoystickModel.SteamDeckOLED],
])

// Necessary to add functions
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace EventType {
  /**
   * Return a list of possible events for gamepad api
   * @returns {Array<string>}
   */
  export function events(): Array<string> {
    return Object.keys(EventType).map((name) => name.toLowerCase())
  }

  /**
   * Return enum value from Gamepad API event
   * @param {string} type
   * @returns {EventType}
   */
  export function fromGamepadEventType(type: string): EventType {
    const fields = type.split(':')
    if (fields.length <= 1) {
      return EventType.Unknown
    }

    const name = fields[1]

    for (const eventName of EventType.events()) {
      if (eventName == name) {
        return eventName as EventType
      }
    }

    return EventType.Unknown
  }
}

// Encapsulate joystick event values
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace JoystickDetail {
  /**
   * Stick values
   */
  export enum Stick {
    Left = 0,
    Right = 1,
  }

  /**
   * Axis values
   */
  export enum Axis {
    Horizontal = 0,
    Vertical = 1,
  }
}

export type JoystickAxisEvent = {
  /**
   * Event type
   */
  type: EventType.Axis
  /**
   * Detail information about the event
   */
  detail: {
    /**
     * Joystick index
     */
    index: number
    /**
     * Gamepad object
     */
    gamepad: Gamepad
    /**
     * Stick position
     */
    stick: JoystickDetail.Stick
    /**
     * Axis type
     */
    axis: JoystickDetail.Axis
    /**
     * Axis value
     */
    value: number
  }
}

export type JoystickButtonEvent = {
  /**
   * Event type
   */
  type: EventType.Button
  /**
   * Detail information about the event
   */
  detail: {
    /**
     * Joystick index
     */
    index: number
    /**
     * Gamepad object
     */
    gamepad: Gamepad
    /**
     * Button number
     */
    button: number
    /**
     * Pressing state
     */
    pressed: boolean
    /**
     * Axis value
     */
    value: number
  }
}

export type JoystickConnectEvent = {
  /**
   * Event type
   */
  type: EventType.Connected
  /**
   * Detail information about the event
   */
  detail: {
    /**
     * Joystick index
     */
    index: number
    /**
     * Gamepad object
     */
    gamepad: Gamepad
  }
}

export type JoystickDisconnectEvent = {
  /**
   * Event type
   */
  type: EventType.Disconnected
  /**
   * Detail information about the event
   */
  detail: {
    /**
     * Joystick index
     */
    index: number
  }
}

export type JoysticksMap = Map<number, Gamepad>

export type JoystickConnectionEvent = JoystickConnectEvent | JoystickDisconnectEvent
export type JoystickStateEvent = JoystickAxisEvent | JoystickButtonEvent

type CallbackJoystickStateEventType = (gamepadIndex: number, currentState: JoystickState, gamepad: Gamepad) => void
type CallbackJoystickConnectionEventType = (event: JoysticksMap) => void

/**
 * Joystick Manager
 * Abstraction over Gamepad API
 */
class JoystickManager {
  private static instance = new JoystickManager()

  private callbacksJoystickConnection: Array<CallbackJoystickConnectionEventType> = []
  private callbacksJoystickState: Array<CallbackJoystickStateEventType> = []
  private joysticks: JoysticksMap = new Map()
  private enabledJoysticks: Array<number> = []
  private animationFrameId: number | null = null
  private previousGamepadState: Map<number, JoystickState> = new Map()
  private lastTimeGamepadConnectionsPolled = 0
  private currentGamepadsConnections: Array<Gamepad> = []
  private calibrationOptions: Map<JoystickModel, JoystickCalibration> = new Map()

  /**
   * Singleton constructor
   */
  private constructor() {
    this.start()
  }

  /**
   * Singleton access
   * @returns {JoystickManager}
   */
  static self(): JoystickManager {
    return JoystickManager.instance
  }

  /**
   * Callback to be used and receive joystick connection updates
   * @param {JoysticksMap} callback
   */
  onJoystickConnectionUpdate(callback: CallbackJoystickConnectionEventType): void {
    this.callbacksJoystickConnection.push(callback)
  }

  /**
   * Get Vendor ID and Product ID from joystick
   * @param {Gamepad} gamepad Object
   * @returns {'vendor_id: string | undefined, product_id: string | undefined'} VID and PID
   */
  getVidPid(gamepad: Gamepad): {
    vendor_id: string | undefined // eslint-disable-line
    product_id: string | undefined // eslint-disable-line
  } {
    const joystick_information = gamepad.id
    const vendor_regex = new RegExp('Vendor: (?<vendor_id>[0-9a-f]{4})')
    const product_regex = new RegExp('Product: (?<product_id>[0-9a-f]{4})')
    const vendor_id = vendor_regex.exec(joystick_information)?.groups?.vendor_id
    const product_id = product_regex.exec(joystick_information)?.groups?.product_id
    return { vendor_id, product_id }
  }

  /**
   * Get joystick model
   * @param {Gamepad} gamepad Object
   * @returns {JoystickModel} Joystick model
   */
  getModel(gamepad: Gamepad): JoystickModel {
    const { vendor_id, product_id } = this.getVidPid(gamepad)

    if (vendor_id == undefined || product_id == undefined) {
      return JoystickModel.Unknown
    }
    return JoystickMapVidPid.get(`${vendor_id}:${product_id}`) ?? JoystickModel.Unknown
  }

  /**
   * Process joystick event internally
   * @param {JoystickConnectionEvent} event
   */
  private processJoystickConnectionUpdate(event: JoystickConnectionEvent): void {
    const index = event.detail.index

    if (event.type == EventType.Connected) {
      const gamepad = event.detail.gamepad

      if (!this.joysticks.has(index)) {
        this.enabledJoysticks.push(gamepad.index)
      }
      this.joysticks.set(index, gamepad)
    } else {
      // Disconnect
      this.joysticks.delete(index)
    }

    for (const callback of this.callbacksJoystickConnection) {
      callback(this.joysticks)
    }
  }

  /**
   * Register joystick event callback
   * @param {callbackJoystickStateEventType} callback
   */
  onJoystickStateUpdate(callback: CallbackJoystickStateEventType): void {
    this.callbacksJoystickState.push(callback)
  }

  /**
   * Poll for gamepad connections and disconnection every 500ms, and activates polling the gamepad states.
   * The polling for connections and disconnections is a workaround to get around the fact that the gamepad API events do not work the same way in all browsers.
   * In Chrome, for example, the gamepadconnected event is sometimes not fired when a gamepad is connected after a long time since the page was loaded.
   * This is a workaround to get around this issue.
   */
  private start(): void {
    // Start polling for gamepad connections and disconnections
    this.updateGamepadsConnections()

    // Start polling for gamepad states
    this.pollGamepadsStates()

    // Check calibration settings every second
    this.updateCalibrationSettings()
  }

  /**
   * Update calibration settings
   */
  private updateCalibrationSettings(): void {
    this.loadCalibrationSettings()
    setTimeout(() => {
      this.updateCalibrationSettings()
    }, 1000)
  }

  /**
   * Handle gamepad connection event
   * @param {Gamepad} gamepad - Gamepad connection event
   */
  private handleGamepadConnected(gamepad: Gamepad): void {
    const joystickEvent: JoystickConnectEvent = {
      type: EventType.Connected,
      detail: {
        index: gamepad.index,
        gamepad: gamepad,
      },
    }
    this.processJoystickConnectionUpdate(joystickEvent)
  }

  /**
   * Handle gamepad disconnection event
   * @param {Gamepad} gamepad - Gamepad disconnection event
   */
  private handleGamepadDisconnected(gamepad: Gamepad): void {
    const joystickEvent: JoystickDisconnectEvent = {
      type: EventType.Disconnected,
      detail: {
        index: gamepad.index,
      },
    }
    this.processJoystickConnectionUpdate(joystickEvent)
  }

  /**
   * Update gamepad connections
   */
  private updateGamepadsConnections(): void {
    // Poll for gamepad connections and disconnections every 500ms
    if (Date.now() - this.lastTimeGamepadConnectionsPolled > 500) {
      const gamepadConnectionsState = navigator.getGamepads()

      // Add new gamepads to the list
      for (const gamepad of gamepadConnectionsState) {
        if (gamepad && !this.currentGamepadsConnections.map((g) => g.index).includes(gamepad.index)) {
          this.currentGamepadsConnections.push(gamepad)
          this.handleGamepadConnected(gamepad)
        }
      }

      // Remove gamepads that are not connected anymore
      for (const gamepad of this.currentGamepadsConnections) {
        if (!gamepadConnectionsState.map((g) => g?.index).includes(gamepad.index)) {
          this.currentGamepadsConnections.splice(this.currentGamepadsConnections.indexOf(gamepad), 1)
          this.handleGamepadDisconnected(gamepad)
        }
      }
      this.lastTimeGamepadConnectionsPolled = Date.now()
    }
    this.animationFrameId = requestAnimationFrame(() => this.updateGamepadsConnections())
  }

  /**
   * Load calibration settings from localStorage
   */
  private loadCalibrationSettings(): void {
    try {
      const stored = localStorage.getItem(joystickCalibrationOptionsKey)
      if (stored) {
        const options = JSON.parse(stored) as Record<JoystickModel, JoystickCalibration>
        this.calibrationOptions = new Map(Object.entries(options).map(([key, value]) => [key as JoystickModel, value]))
      }
    } catch (error) {
      console.error('Failed to load joystick calibration settings:', error)
    }
  }

  /**
   * Get calibration settings for a joystick model
   * @param {JoystickModel} model The joystick model
   * @returns {JoystickCalibration} The calibration settings
   */
  private getCalibrationSettings(model: JoystickModel): JoystickCalibration {
    return this.calibrationOptions.get(model) ?? defaultJoystickCalibration
  }

  /**
   * Apply calibration to a joystick value
   * @param {string} inputType The type of input ('button' or 'axis')
   * @param {number} inputIndex The index of the input
   * @param {number} originalValue The original value of the input
   * @param {Gamepad} gamepad The gamepad object
   * @returns {number} The calibrated value
   */
  private applyCalibrationToValue(
    inputType: 'button' | 'axis',
    inputIndex: number,
    originalValue: number,
    gamepad: Gamepad
  ): number {
    const model = this.getModel(gamepad)
    const calibration = this.getCalibrationSettings(model)
    return applyCalibration(inputType, inputIndex, originalValue, calibration)
  }

  /**
   * Poll for gamepad state changes
   */
  private pollGamepadsStates(): void {
    const gamepads = navigator.getGamepads()

    for (const gamepad of gamepads) {
      if (!gamepad) continue

      const previousState = this.previousGamepadState.get(gamepad.index)

      const newState: JoystickState = {
        axes: [...gamepad.axes],
        buttons: [...(gamepad.buttons.map((button) => button.value) as number[])],
      }

      // Check axes
      if (previousState) {
        // Check for axis changes
        gamepad.axes.forEach((value, index) => {
          if (previousState.axes[index] !== value) {
            const calibratedValue = this.applyCalibrationToValue('axis', index, value, gamepad)
            newState.axes[index] = calibratedValue
          }
        })

        // Check for button changes
        gamepad.buttons.forEach((button, index) => {
          const previousButton = previousState.buttons[index]
          if (previousButton !== button.value) {
            newState.buttons[index] = button.value
          }
        })
      }

      // Update previous state
      this.previousGamepadState.set(gamepad.index, newState)

      this.emitStateEvent(gamepad.index, newState, gamepad)
    }

    // Continue polling
    this.animationFrameId = requestAnimationFrame(() => this.pollGamepadsStates())
  }

  /**
   * Emit state event to registered callbacks
   * @param {number} gamepadIndex - The gamepad index
   * @param {JoystickState} gamepadState - The gamepad state
   * @param {Gamepad} gamepad - The gamepad object
   */
  private emitStateEvent(gamepadIndex: number, gamepadState: JoystickState, gamepad: Gamepad): void {
    if (!this.enabledJoysticks.includes(gamepadIndex)) return

    // Get the joystick model to check if it's disabled
    const model = this.getModel(gamepad)
    const disabledJoystickModels = JSON.parse(localStorage.getItem('cockpit-disabled-joystick-models') || '[]')
    if (disabledJoystickModels.includes(model)) return

    for (const callback of this.callbacksJoystickState) {
      callback(gamepadIndex, gamepadState, gamepad)
    }
  }

  /**
   * Stop polling for gamepad events
   */
  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }
}

export const joystickManager = JoystickManager.self()
