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

export type JoysticConnectEvent = {
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

export type JoysticDisconnectEvent = {
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
   * Gamepad axes state
   */
  axes: number[]
  /**
   * Gamepad buttons state
   */
  buttons: GamepadButton[]
}

export type JoysticksMap = Map<number, Gamepad>

export type JoystickEvent = JoysticConnectEvent | JoysticDisconnectEvent
export type JoystickStateEvent = JoystickAxisEvent | JoystickButtonEvent

type CallbackJoystickStateEventType = (event: JoystickStateEvent) => void
type CallbackJoystickEventType = (event: JoysticksMap) => void

/**
 * Joystick Manager
 * Abstraction over Gamepad API
 */
class JoystickManager {
  private static instance = new JoystickManager()

  private callbacksJoystick: Array<CallbackJoystickEventType> = []
  private callbacksJoystickState: Array<CallbackJoystickStateEventType> = []
  private joysticks: JoysticksMap = new Map()
  private enabledJoysticks: Array<string> = []
  private animationFrameId: number | null = null
  private previousGamepadState: Map<number, GamepadState> = new Map()

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
  onJoystickUpdate(callback: CallbackJoystickEventType): void {
    this.callbacksJoystick.push(callback)
  }

  /**
   * Get Vendor ID and Product ID from joystick
   * @param {Gamepad} gamepad Object
   * @returns {'vendor_id: string | undefined, product_id: string | undefined'} VID and PID
   */
  private getVidPid(gamepad: Gamepad): {
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
   * Request user for joystick HID access
   * @param {Gamepad} gamepad object
   */
  private getHID(gamepad: Gamepad): void {
    // The objective of this function is to get serial information and track the configuration
    // for a specific joystick, including calibration.
    // Electron API appears to be not working: https://www.electronjs.org/docs/latest/api/structures/hid-device
    // W3C productName may help but it's not working: https://wicg.github.io/webhid/
    // For both serialInformation is not available: https://github.com/w3c/gamepad/issues/73
    const { vendor_id, product_id } = this.getVidPid(gamepad)

    console.debug(`Joystick: ${gamepad.id} (${vendor_id}:${product_id})`)

    if (vendor_id == undefined || product_id == undefined) {
      return
    }

    // Enable joysticks to be used
    // Needs to be more adopted by the browsers
    /*
    navigator.hid
      .requestDevice({
        filters: [
          {
            vendorId: parseInt(vendor_id, 16),
            productID: parseInt(product_id, 16),
          },
        ],
      })
      .then((devices: Array<string>) => {
        if (devices.length != 0) {
          this.enabledJoysticks.push(joystick_information)
        }
      })
    */
  }

  /**
   * Process joystick event internally
   * @param {JoystickEvent} event
   */
  private processJoystickUpdate(event: JoystickEvent): void {
    const index = event.detail.index

    if (event.type == EventType.Connected) {
      const gamepad = event.detail.gamepad

      if (!this.joysticks.has(index)) {
        this.getHID(gamepad)
        this.enabledJoysticks.push(gamepad.id)
      }
      this.joysticks.set(index, gamepad)
    } else {
      // Disconnect
      this.joysticks.delete(index)
    }

    for (const callback of this.callbacksJoystick) {
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
   * Start listening for gamepad events
   */
  private start(): void {
    // Listen for gamepad connections
    window.addEventListener('gamepadconnected', (event: GamepadEvent) => {
      this.handleGamepadConnected(event)
    })

    // Listen for gamepad disconnections
    window.addEventListener('gamepaddisconnected', (event: GamepadEvent) => {
      this.handleGamepadDisconnected(event)
    })

    // Start the polling loop
    this.pollGamepads()
  }

  /**
   * Handle gamepad connection event
   * @param {GamepadEvent} event - Gamepad connection event
   */
  private handleGamepadConnected(event: GamepadEvent): void {
    const gamepad = event.gamepad
    const joystickEvent: JoysticConnectEvent = {
      type: EventType.Connected,
      detail: {
        index: gamepad.index,
        gamepad: gamepad,
      },
    }
    this.processJoystickUpdate(joystickEvent)
  }

  /**
   * Handle gamepad disconnection event
   * @param {GamepadEvent} event - Gamepad disconnection event
   */
  private handleGamepadDisconnected(event: GamepadEvent): void {
    const joystickEvent: JoysticDisconnectEvent = {
      type: EventType.Disconnected,
      detail: {
        index: event.gamepad.index,
      },
    }
    this.processJoystickUpdate(joystickEvent)
  }

  /**
   * Poll for gamepad state changes
   */
  private pollGamepads(): void {
    const gamepads = navigator.getGamepads()

    for (const gamepad of gamepads) {
      if (!gamepad) continue

      const previousState = this.previousGamepadState.get(gamepad.index)

      // Check axes
      if (previousState) {
        // Check for axis changes
        gamepad.axes.forEach((value, index) => {
          if (previousState.axes[index] !== value) {
            const stick = Math.floor(index / 2)
            const axis = index % 2
            const joystickEvent: JoystickAxisEvent = {
              type: EventType.Axis,
              detail: {
                index: gamepad.index,
                gamepad: gamepad,
                stick: stick as JoystickDetail.Stick,
                axis: axis as JoystickDetail.Axis,
                value: value,
              },
            }
            this.emitStateEvent(joystickEvent)
          }
        })

        // Check for button changes
        gamepad.buttons.forEach((button, index) => {
          const previousButton = previousState.buttons[index]
          if (previousButton.pressed !== button.pressed || previousButton.value !== button.value) {
            const joystickEvent: JoystickButtonEvent = {
              type: EventType.Button,
              detail: {
                index: gamepad.index,
                gamepad: gamepad,
                button: index,
                pressed: button.pressed,
                value: button.value,
              },
            }
            this.emitStateEvent(joystickEvent)
          }
        })
      }

      // Update previous state
      this.previousGamepadState.set(gamepad.index, {
        axes: [...gamepad.axes],
        buttons: [...gamepad.buttons],
      })
    }

    // Continue polling
    this.animationFrameId = requestAnimationFrame(() => this.pollGamepads())
  }

  /**
   * Emit state event to registered callbacks
   * @param {JoystickStateEvent} joystickEvent - The event to emit
   */
  private emitStateEvent(joystickEvent: JoystickStateEvent): void {
    if (!this.enabledJoysticks.includes(joystickEvent.detail.gamepad.id)) return

    for (const callback of this.callbacksJoystickState) {
      callback(joystickEvent)
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
