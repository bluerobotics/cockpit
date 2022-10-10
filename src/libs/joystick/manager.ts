import { GamepadListener } from 'gamepad.js'

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

// Necessary to add functions
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace EventType {
  /**
   * Return a list of possible events for gamepad api
   *
   * @returns {Array<string>}
   */
  export function events(): Array<string> {
    return Object.keys(EventType).map((name) => name.toLowerCase())
  }

  /**
   * Return enum value from Gamepad API event
   *
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

// From GamePad API
type GamepadEvent = {
  /**
   * Event name
   */
  type: string
  /**
   * Generic object that describes event
   */
  detail: unknown
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

export type JoystickEvent = {
  /**
   * Event type
   */
  type: EventType
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

type callbackJoystickStateEventType = (event: JoystickEvent) => void
type callbackJoystickEventType = (event: Array<Gamepad>) => void

/**
 * Joystick Manager
 * Abstraction over Gamepad API
 */
class JoystickManager {
  private static instance = new JoystickManager()

  private callbacksJoystick: Array<callbackJoystickEventType> = []
  private callbacksJoystickState: Array<callbackJoystickStateEventType> = []
  private gamepadListener = new GamepadListener()
  private joysticks: Array<Gamepad> = []
  // We need to safe in settings
  private enabledJoysticks: Array<string> = []

  /**
   * Singleton constructor
   */
  private constructor() {
    this.gamepadListener.start()
    this.connectEvents()
  }

  /**
   * Singleton access
   *
   * @returns {JoystickManager}
   */
  static self(): JoystickManager {
    return JoystickManager.instance
  }

  /**
   * Callback to be used and receive joystick updates
   *
   * @param {callbackJoystickEventType} callback
   */
  onJoystickUpdate(callback: callbackJoystickEventType): void {
    this.callbacksJoystick.push(callback)
  }

  /**
   * Request user for joystick HID access
   *
   * @param {Gamepad} gamepad object
   */
  private getHID(gamepad: Gamepad): void {
    // The objective of this function is to get serial information and track the configuration
    // for a specific joystick, including calibration.
    // Electron API appears to be not working: https://www.electronjs.org/docs/latest/api/structures/hid-device
    // W3C productName may help but it's not working: https://wicg.github.io/webhid/
    // For both serialInformation is not available: https://github.com/w3c/gamepad/issues/73
    const joystick_information = gamepad.id
    const vendor_regex = new RegExp('Vendor: (?<vendor_id>[0-9a-f]{4})')
    const product_regex = new RegExp('Product: (?<product_id>[0-9a-f]{4})')
    const vendor_id = vendor_regex.exec(joystick_information)?.groups?.vendor_id
    const product_id =
      product_regex.exec(joystick_information)?.groups?.product_id
    if (vendor_id === undefined || product_id === undefined) {
      console.warn(
        `Failed to fetch Product or Vendor identifier for joystick: ${vendor_id}:${product_id}`
      )
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
   *
   * @param {JoystickEvent} event
   */
  private processJoystickUpdate(event: JoystickEvent): void {
    const index = event.detail.index

    if (index < 0) {
      console.log(`index: ${index}, length:${this.joysticks.length}`)
      console.log(
        `event: ${JSON.stringify(event)}, joysticks: ${JSON.stringify(
          this.joysticks
        )}`
      )
      throw new Error('Invalid joystick index.')
    }

    if (index > this.joysticks.length) {
      console.log(`index: ${index}, length:${this.joysticks.length}`)
      console.log(
        `event: ${JSON.stringify(event)}, joysticks: ${JSON.stringify(
          this.joysticks
        )}`
      )
      throw new Error(
        'Connected joystick index is beyond the number of joysticks connected.'
      )
    }

    // Let us know if we need to push a new joystick or remove one that already exists
    let isLatest = true

    if (index < this.joysticks.length) {
      isLatest = false
      console.log(`index: ${index}, length:${this.joysticks.length}`)
      console.log(
        `event: ${JSON.stringify(event)}, joysticks: ${JSON.stringify(
          this.joysticks
        )}`
      )
      console.warn('Connected index is below the number of joysticks connected')
    }

    if (event.type == EventType.Connected) {
      const gamepad = event.detail.gamepad

      if (isLatest) {
        // this.getHID(gamepad)
        this.enabledJoysticks.push(gamepad.id)
        this.joysticks.push(gamepad)
      } else {
        this.joysticks[index] = gamepad
      }
    } else {
      this.joysticks.splice(index, 1)
    }

    for (const callback of this.callbacksJoystick) {
      callback(this.joysticks)
    }
  }

  /**
   * Register joystick event callback
   *
   * @param {callbackJoystickStateEventType} callback
   */
  onJoystickStateUpdate(callback: callbackJoystickStateEventType): void {
    this.callbacksJoystickState.push(callback)
  }

  /**
   * Connect necessary events with callbacks
   */
  private connectEvents(): void {
    for (const name of EventType.events()) {
      this.gamepadListener.on(`gamepad:${name}`, (event: GamepadEvent) => {
        const eventType = name as EventType
        const joystickEvent = event as JoystickEvent
        joystickEvent.type = EventType.fromGamepadEventType(joystickEvent.type)

        if ([EventType.Connected, EventType.Disconnected].includes(eventType)) {
          this.processJoystickUpdate(joystickEvent)
        }

        if (!this.enabledJoysticks.includes(joystickEvent.detail.gamepad.id)) {
          console.warn(
            `Joystick is not enabled: ${joystickEvent.detail.gamepad.id}`
          )
          return
        }

        for (const callback of this.callbacksJoystickState) {
          callback(joystickEvent)
        }
      })
    }
  }
}

export const joystickManager = JoystickManager.self()
