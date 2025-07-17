import { defaultJoystickCalibration } from '@/assets/defaults'
import {
  type ElectronSDLJoystickControllerStateEventData as ElectronSDLControllerStateEventData,
  type JoystickCalibration,
  type JoystickState,
  convertSDLControllerStateToGamepadState,
  convertSDLJoystickStateToGamepadState,
} from '@/types/joystick'

import { applyCalibration } from './calibration'

export const joystickCalibrationOptionsKey = 'cockpit-joystick-calibration-options'

import { isElectron } from '../utils'

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
  XboxOne_Wired = 'Xbox One Wired Controller',
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

export type JoystickStateEvent = {
  /**
   * Joystick index
   */
  index: number
  /**
   * Gamepad object
   */
  gamepad: Gamepad
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

export type GamepadState = {
  /**
   * The epoch of the given state
   */
  timestamp: number
  /**
   * The actual state
   */
  state: {
    /**
     * Gamepad axes state
     */
    axes: number[]
    /**
     * Gamepad buttons state
     */
    buttons: GamepadButton[]
  }
}

export type JoysticksMap = Map<number, Gamepad>

export type JoystickConnectionEvent = JoystickConnectEvent | JoystickDisconnectEvent

type CallbackJoystickStateEventType = (event: JoystickStateEvent) => void
type CallbackJoystickConnectionEventType = (event: JoysticksMap) => void

/**
 * Joystick Manager
 * Abstraction over Gamepad API and SDL
 */
class JoystickManager {
  private static instance = new JoystickManager()

  private callbacksJoystickConnection: Array<CallbackJoystickConnectionEventType> = []
  private callbacksJoystickState: Array<CallbackJoystickStateEventType> = []
  private joysticks: JoysticksMap = new Map()
  private enabledJoysticks: Array<number> = []
  private animationFrameId: number | null = null
  private lastTimeGamepadStatesPolled = 0
  private previousGamepadState: Map<number, JoystickState> = new Map()
  private calibrationOptions: Map<JoystickModel, JoystickCalibration> = new Map()
  /**
   * Singleton constructor
   */
  private constructor() {
    console.log('Starting JoystickManager...')

    if (isElectron()) {
      // Also check SDL status directly after a short delay
      setTimeout(async () => {
        try {
          if (!window.electronAPI) {
            console.error('Electron API not available.')
            this.startGamepadApiMonitoringRoutine()
            return
          }
          const status = await window.electronAPI.checkSDLStatus()

          if (!status.loaded) {
            console.error('SDL not loaded according to status check, falling back to Gamepad API.')
            this.startGamepadApiMonitoringRoutine()
          } else {
            console.log('SDL loaded successfully, using SDL for controllers.')
            this.startElectronSdlJoystickMonitoringRoutine()
          }
        } catch (error) {
          console.error('Error checking SDL status, falling back to Gamepad API:', error)
          this.startGamepadApiMonitoringRoutine()
        }
      }, 3000)
    } else {
      // In browser or if electronAPI is not available, use the Gamepad API
      console.log('Not in Electron or Electron API not available, using Gamepad API.')
      this.startGamepadApiMonitoringRoutine()
    }
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
   * Register joystick event callback
   * @param {callbackJoystickStateEventType} callback
   */
  onJoystickStateUpdate(callback: CallbackJoystickStateEventType): void {
    this.callbacksJoystickState.push(callback)
  }

  /**
   * Check SDL status
   * @returns {Promise<void>}
   */
  private async startSDLStatusCheckRoutine(): Promise<void> {
    if (!window.electronAPI) {
      return
    }
    const status = await window.electronAPI.checkSDLStatus()

    if (!status.loaded) {
      console.error('SDL connection dropped. Falling back to Gamepad API.')
      this.startGamepadApiMonitoringRoutine()
    }

    // Remove any joysticks that are not in the status.connectedControllers map
    let joystickConnectionsChanged = false
    for (const [, gamepad] of this.joysticks) {
      if (!status.connectedControllers.has(gamepad.index) && !status.connectedJoysticks.has(gamepad.index)) {
        this.joysticks.delete(gamepad.index)
        joystickConnectionsChanged = true
      }
    }

    if (joystickConnectionsChanged) {
      this.emitJoystickConnectionUpdate()
    }

    setTimeout(() => this.startSDLStatusCheckRoutine(), 1000)
  }

  /**
   * Set up joystick monitoring in Electron environment
   * This method sets up listeners for joystick events from the main process
   * and converts them to the same format as the Gamepad API events
   */
  private startElectronSdlJoystickMonitoringRoutine(): void {
    if (!window.electronAPI) {
      console.error('Electron API not available.')
      return
    }

    // Start checking SDL status
    this.startSDLStatusCheckRoutine()

    /**
     * Listen for joystick state updates from the main process
     * Converts SDL joystick state to Gamepad API format
     * @param data The joystick state data from the main process
     */
    window.electronAPI.onElectronSDLControllerJoystickStateChange((data: ElectronSDLControllerStateEventData) => {
      // Convert SDL joystick state to our event format

      const gamepadState =
        data.type === 'joystick'
          ? convertSDLJoystickStateToGamepadState(data.state)
          : convertSDLControllerStateToGamepadState(data.state)

      const joystickEvent: JoystickStateEvent = {
        index: data.deviceId,
        gamepad: {
          id: `${data.deviceName} (SDL STANDARD JOYSTICK Vendor: ${data.vendorId} Product: ${data.productId})`,
          index: data.deviceId,
          connected: true,
          timestamp: Date.now(),
          mapping: 'standard',
          axes: gamepadState.axes.map((value) => value ?? 0),
          buttons: gamepadState.buttons.map((value) => ({
            pressed: (value ?? 0) > 0.5,
            value: value ?? 0,
            touched: false,
          })),
          vibrationActuator: {
            playEffect: async () => 'complete' as const,
            reset: async () => 'complete' as const,
          },
        },
      }

      // Add joystick to the list of joysticks if it is not already there
      if (!this.joysticks.has(data.deviceId)) {
        this.joysticks.set(data.deviceId, joystickEvent.gamepad)
        this.enabledJoysticks.push(data.deviceId)
      }

      // Emit joystick state update
      this.emitStateEvent(joystickEvent)

      // Emit joystick connection update
      this.emitJoystickConnectionUpdate()
    })
  }

  /**
   * Poll for gamepad connections and disconnection every 500ms, and activates polling the gamepad states.
   * The polling for connections and disconnections is a workaround to get around the fact that the gamepad API events do not work the same way in all browsers.
   * In Chrome, for example, the gamepadconnected event is sometimes not fired when a gamepad is connected after a long time since the page was loaded.
   * This is a workaround to get around this issue.
   */
  private startGamepadApiMonitoringRoutine(): void {
    // Start polling for gamepad connections and disconnections
    this.pollGamepadsConnections(500)

    // Start polling for gamepad states
    this.pollGamepadsStates(20)

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
   * Poll for gamepad connections and disconnections every interval ms
   * @param {number} interval The interval in milliseconds
   */
  private pollGamepadsConnections(interval: number): void {
    const gamepadConnectionsState = navigator.getGamepads()

    let joystickConnectionsChanged = false

    // Add new gamepads to the list
    for (const gamepad of gamepadConnectionsState) {
      if (gamepad && !this.joysticks.has(gamepad.index)) {
        this.joysticks.set(gamepad.index, gamepad)
        this.enabledJoysticks.push(gamepad.index)
        console.log(`Joystick ${gamepad.index} connected.`)
        joystickConnectionsChanged = true
      }
    }

    // Remove gamepads that are not connected anymore
    for (const gamepad of this.joysticks.values()) {
      if (!gamepadConnectionsState.map((g) => g?.index).includes(gamepad.index)) {
        this.joysticks.delete(gamepad.index)
        this.enabledJoysticks = this.enabledJoysticks.filter((index) => index !== gamepad.index)
        joystickConnectionsChanged = true
      }
    }

    // Emit the updated list of joysticks for all listeners if there were any changes
    if (joystickConnectionsChanged) {
      this.emitJoystickConnectionUpdate()
    }

    setTimeout(() => {
      this.pollGamepadsConnections(interval)
    }, interval)
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
   * @param {number} interval The interval in milliseconds
   */
  private pollGamepadsStates(interval: number): void {
    if (new Date().getTime() - this.lastTimeGamepadStatesPolled < interval) return

    const gamepads = navigator.getGamepads()

    for (const gamepad of gamepads) {
      if (!gamepad) continue

      const previousState = this.previousGamepadState.get(gamepad.index)

      const newState: JoystickState = {
        axes: [...gamepad.axes],
        buttons: [...(gamepad.buttons.map((button) => button.value) as number[])],
      }
      let shouldEmitStateEvent = false

      // Check axes
      if (previousState) {
        // Check for axis changes
        gamepad.axes.forEach((value, index) => {
          if (previousState.axes[index] !== value) {
            const calibratedValue = this.applyCalibrationToValue('axis', index, value, gamepad)
            newState.axes[index] = calibratedValue
          }
          if (previousState.axes[index] !== value) {
            shouldEmitStateEvent = true
          }
        })

        // Check for button changes
        gamepad.buttons.forEach((button, index) => {
          const previousButton = previousState.buttons[index]
          if (previousButton !== button.value) {
            newState.buttons[index] = button.value
          }
          if (previousButton !== button.value) {
            shouldEmitStateEvent = true
          }
        })
      }

      // Update previous state
      this.previousGamepadState.set(gamepad.index, newState)

      if (shouldEmitStateEvent) {
        this.emitStateEvent({ index: gamepad.index, gamepad: gamepad })
      }
    }

    // Continue polling
    this.animationFrameId = requestAnimationFrame(() => this.pollGamepadsStates(interval))
  }

  /**
   * Emit state event to registered callbacks
   * @param {JoystickStateEvent} joystickEvent - The state event to emit
   */
  private emitStateEvent(joystickEvent: JoystickStateEvent): void {
    if (!this.enabledJoysticks.includes(joystickEvent.index)) return

    // Get the joystick model to check if it's disabled
    const model = this.getModel(joystickEvent.gamepad)
    const disabledJoystickModels = JSON.parse(localStorage.getItem('cockpit-disabled-joystick-models') || '[]')
    if (disabledJoystickModels.includes(model)) return

    // Emit state event to registered callbacks
    for (const callback of this.callbacksJoystickState) {
      callback(joystickEvent)
    }
  }

  /**
   * Emit joystick state updates to registered callbacks
   * @param {JoystickStateEvent} joystickEvent - The state event to emit
   */
  /**
   * Emit joystick connection updates to registered callbacks
   */
  private emitJoystickConnectionUpdate(): void {
    for (const callback of this.callbacksJoystickConnection) {
      callback(this.joysticks)
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
