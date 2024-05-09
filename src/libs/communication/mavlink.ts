import { ConnectionManager } from '@/libs/connection/connection-manager'
import type { Message as MavMessage, Package } from '@/libs/connection/m2r/messages/mavlink2rest'

import { MavComponent } from '../connection/m2r/messages/mavlink2rest-enum'

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
  ConnectionManager.write(textEncoder.encode(JSON.stringify(pack)))
}
