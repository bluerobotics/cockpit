import { BrowserWindow } from 'electron'
import { ipcMain } from 'electron'

import {
  SDLControllerDevice,
  SDLControllerInstance,
  SDLJoystickDevice,
  SDLJoystickInstance,
  SDLJoystickState,
  SDLModule,
  SDLStatus,
} from '@/types/sdl'

import { decimalToHex, scale } from '../utils'

/**
 * Open joystick device type
 */
export interface OpenJoystick {
  /**
   * Joystick device
   */
  device: SDLJoystickDevice
  /**
   * Joystick instance
   */
  instance: SDLJoystickInstance
}

/**
 * Open controller device type
 */
export interface OpenController {
  /**
   * Controller device
   */
  device: SDLControllerDevice
  /**
   * Controller instance
   */
  instance: SDLControllerInstance
}

const openedJoysticks = new Map<number, OpenJoystick>()
const openedControllers = new Map<number, OpenController>()

/**
 * The interval at which to check the state of a joystick
 */
const stateCheckInterval = 50 // ms

/**
 * Load the SDL module
 * @returns {SDLModule} The loaded SDL module
 * @throws {Error} If the SDL module does not load or does not have the expected joystick property
 */
export function loadSDL(): SDLModule {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const module = require('@kmamal/sdl')

    if (!module) {
      throw new Error('SDL module does not exist.')
    }

    if (!module.joystick || !module.controller) {
      throw new Error('SDL module does not have expected joystick or controller properties.')
    }

    return module
  } catch (sdlLoadError) {
    throw new Error(`Failed to load SDL module: ${(sdlLoadError as Error).message}`)
  }
}

/**
 * Open an SDL controller device
 * @param {SDLModule} sdl - The SDL module
 * @param {SDLControllerDevice} device - The controller device
 */
export const openController = (sdl: SDLModule, device: SDLControllerDevice): void => {
  try {
    const instance = sdl.controller.openDevice(device)

    if (!instance) {
      throw new Error('Could not open controller.')
    }

    // Store the controller instance for later reference
    openedControllers.set(device.id, { device, instance })

    // Set up polling interval for controller state
    const pollInterval = setInterval(() => {
      if (instance.closed) {
        console.debug(`Controller '${device.name}' with id '${device.id}' closed. Deleting auxiliary data...`)
        openedControllers.delete(device.id)
        clearInterval(pollInterval)
        return
      }

      checkControllerState(device.id)
    }, stateCheckInterval)
  } catch (error) {
    console.error(`Error opening controller ${device.name}:`, error)
  }
}

/**
 * Open an SDL joystick device
 * @param {SDLModule} sdl - The SDL module
 * @param {SDLJoystickDevice} device - The joystick device
 */
export const openJoystick = (sdl: SDLModule, device: SDLJoystickDevice): void => {
  try {
    const instance = sdl.joystick.openDevice(device)

    if (!instance) {
      throw new Error('Could not open joystick.')
    }

    // Store the joystick instance for later reference
    openedJoysticks.set(device.id, { device, instance })

    // Create polling function to check joystick state

    // Set up polling interval for joystick state
    const pollInterval = setInterval(() => {
      if (instance.closed) {
        console.debug(`Joystick '${device.name}' with id '${device.id}' closed. Deleting auxiliary data...`)
        openedJoysticks.delete(device.id)
        clearInterval(pollInterval)
        return
      }

      checkJoystickState(device.id)
    }, stateCheckInterval)
  } catch (error) {
    console.error(`Error opening joystick ${device.name}:`, error)
  }
}

export const checkJoystickState = (deviceId: number): void => {
  const { instance, device } = openedJoysticks.get(deviceId) as OpenJoystick

  if (!instance || !device) {
    throw new Error(`Joystick with id '${deviceId}' not found.`)
  }

  // Only process if the joystick is still connected
  if (instance.closed) {
    throw new Error(`Joystick with id '${deviceId}' is closed.`)
  }

  const buttonsWithHatsMerged = structuredClone(instance.buttons)
  instance.hats.forEach((hat) => {
    buttonsWithHatsMerged.push(
      ...[
        hat === 'centered',
        hat === 'up' || hat === 'rightup' || hat === 'leftup',
        hat === 'right' || hat === 'rightup' || hat === 'rightdown',
        hat === 'down' || hat === 'rightdown' || hat === 'leftdown',
        hat === 'left' || hat === 'leftup' || hat === 'leftdown',
      ]
    )
  })

  const currentState: SDLJoystickState = {
    buttons: buttonsWithHatsMerged,
    axes: instance.axes,
  }

  // Send joystick state to renderer
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send('sdl-controller-joystick-state', {
      deviceId: device.id,
      deviceName: device.name,
      productId: decimalToHex(device.product),
      vendorId: decimalToHex(device.vendor),
      type: 'joystick',
      state: currentState,
    })
  })
}

export const checkControllerState = (deviceId: number): void => {
  const { instance, device } = openedControllers.get(deviceId) as OpenController

  if (!instance || !device) {
    throw new Error(`Controller with id '${deviceId}' not found.`)
  }

  // Only process if the joystick is still connected
  if (instance.closed) {
    throw new Error(`Controller with id '${deviceId}' is closed.`)
  }

  const state = { buttons: structuredClone(instance.buttons), axes: structuredClone(instance.axes) }
  state.axes.leftTrigger = scale(state.axes.leftTrigger, 0.5, 1, 0, 1)
  state.axes.rightTrigger = scale(state.axes.rightTrigger, 0.5, 1, 0, 1)
  state.buttons.extra = state.buttons[''] ?? false
  delete state.buttons['']

  // Send joystick state to renderer
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send('sdl-controller-joystick-state', {
      deviceId: device.id,
      deviceName: device.name,
      productId: decimalToHex(device.product),
      vendorId: decimalToHex(device.vendor),
      type: 'controller',
      state,
    })
  })
}

export const checkDeviceChanges = (sdl: SDLModule): void => {
  try {
    const currentControllerDevices = sdl.controller.devices

    // First try to open the devices that are connected as controllers
    // Controllers are prioritized over joysticks since they have their buttons and axes standardized
    currentControllerDevices.forEach((device) => {
      if (!openedControllers.has(device.id)) {
        console.debug(`Opening controller '${device.name}' with id '${device.id}'...`)
        openController(sdl, device)
        console.log(`Controller '${device.name}' with id '${device.id}' opened.`)
      }
    })
  } catch (sdlError) {
    console.error('Error accessing SDL controller devices:', sdlError)
  }

  // If there are controllers opened, don't open joysticks, as the same device would be recognized twice
  if (openedControllers.size > 0) return

  try {
    const currentJoystickDevices = sdl.joystick.devices

    const namesOfOpenedControllers = Array.from(openedControllers.values()).map((controller) => controller.device.name)

    // Open joystickes that are connected but not opened
    // Filter out the devices that are already opened as controllers
    currentJoystickDevices
      .filter((device) => !namesOfOpenedControllers.includes(device.name))
      .forEach((device) => {
        if (!openedJoysticks.has(device.id)) {
          console.debug(`Opening joystick '${device.name}' with id '${device.id}'...`)
          openJoystick(sdl, device)
          console.log(`Joystick '${device.name}' with id '${device.id}' opened.`)
        }
      })
  } catch (sdlError) {
    console.error('Error accessing SDL joystick devices:', sdlError)
  }
}

/**
 * Initialize joystick detection and monitoring
 */
export const setupJoystickMonitoring = (): void => {
  let sdl: SDLModule | null = null
  let sdlSuccessfullyLoaded = false

  // Set up IPC handler to check SDL load status
  ipcMain.handle('check-sdl-status', () => {
    const connectedControllers: SDLStatus['connectedControllers'] = new Map()
    const connectedJoysticks: SDLStatus['connectedJoysticks'] = new Map()

    // Include opened controllers
    openedControllers.forEach((controller) => {
      connectedControllers.set(controller.device.id, {
        deviceId: controller.device.id,
        deviceName: controller.device.name,
      })
    })

    // Include opened joysticks (they should also be reported as connected)
    openedJoysticks.forEach((joystick) => {
      connectedJoysticks.set(joystick.device.id, {
        deviceId: joystick.device.id,
        deviceName: joystick.device.name,
      })
    })

    return {
      loaded: sdlSuccessfullyLoaded,
      connectedControllers,
      connectedJoysticks,
    }
  })

  try {
    sdl = loadSDL()
    sdlSuccessfullyLoaded = true
  } catch (error) {
    console.error('Cannot setup joystick monitoring. Failed to load SDL module:', error)
    return
  }

  console.debug('Initializing SDL joystick monitoring...')
  setInterval(() => checkDeviceChanges(sdl), 1000)
}
