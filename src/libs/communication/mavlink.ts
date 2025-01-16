import { ConnectionManager } from '@/libs/connection/connection-manager'
import type { Message as MavMessage, Package } from '@/libs/connection/m2r/messages/mavlink2rest'

import { MavComponent, MAVLinkType } from '../connection/m2r/messages/mavlink2rest-enum'
import { type Message } from '../connection/m2r/messages/mavlink2rest-message'
import { MavlinkManualControlState } from '../joystick/protocols/mavlink-manual-control'

let lastTimeLoggedConnectionError = new Date(0)

/**
 * Send a mavlink message
 * @param {MavMessage} message
 */
export const sendMavlinkMessage = (message: MavMessage): void => {
  const pack: Package = {
    header: {
      system_id: 255, // GCS system ID
      component_id: Number(MavComponent.MAV_COMP_ID_UDP_BRIDGE), // Used by historical reasons (Check QGC)
      sequence: 0,
    },
    message: message,
  }
  const textEncoder = new TextEncoder()
  try {
    ConnectionManager.write(textEncoder.encode(JSON.stringify(pack)))
  } catch (error) {
    // Don't log the error if it's too frequent
    if (Date.now() < lastTimeLoggedConnectionError.getTime() + 10000) return
    console.error('Error sending MAVLink message:', error)
    lastTimeLoggedConnectionError = new Date()
  }
}

/**
 * Send manual control
 * @param {'MavlinkManualControlState'} controllerState Current state of the controller
 * @param {number} targetId
 */
export const sendManualControl = (controllerState: MavlinkManualControlState, targetId: number): void => {
  const state = controllerState as MavlinkManualControlState
  const manualControlMessage: Message.ManualControl = {
    type: MAVLinkType.MANUAL_CONTROL,
    x: state.x,
    y: state.y,
    z: state.z,
    r: state.r,
    s: state.s,
    t: state.t,
    buttons: state.buttons,
    buttons2: state.buttons2,
    target: targetId,
  }
  sendMavlinkMessage(manualControlMessage)
}
