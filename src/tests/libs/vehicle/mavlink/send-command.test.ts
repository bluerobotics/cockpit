import { describe, expect, it, vi } from 'vitest'

import { MavCmd, MAVLinkType, MavResult } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { type Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'
import { Signal } from '@/libs/signal'
import { MAVLinkVehicle } from '@/libs/vehicle/mavlink/vehicle'
import type { CommandAck } from '@/libs/vehicle/types'

vi.mock('@/libs/communication/mavlink', () => ({ sendMavlinkMessage: vi.fn() }))
vi.mock('@/libs/settings-management', () => ({
  settingsManager: { getKeyValue: vi.fn(), setKeyValue: vi.fn() },
}))

const command = (type: MavCmd): Message.CommandLong =>
  ({ type: MAVLinkType.COMMAND_LONG, command: { type } } as unknown as Message.CommandLong)

const ack = (type: MavCmd, result = MavResult.MAV_RESULT_ACCEPTED): CommandAck =>
  ({ command: { type }, result: { type: result } } as unknown as CommandAck)

describe('sendCommand', () => {
  it('still sees its ack when another command is acknowledged right after it', async () => {
    const vehicle = { onCommandAck: new Signal<CommandAck>() }
    const sending = MAVLinkVehicle.prototype.sendCommand.call(
      vehicle,
      command(MavCmd.MAV_CMD_COMPONENT_ARM_DISARM)
    ) as Promise<void>

    // Arming makes Cockpit request the home position, whose ack lands before the next 100 ms poll.
    vehicle.onCommandAck.emit_value(ack(MavCmd.MAV_CMD_COMPONENT_ARM_DISARM))
    vehicle.onCommandAck.emit_value(ack(MavCmd.MAV_CMD_REQUEST_MESSAGE))

    await expect(sending).resolves.toBeUndefined()
  })

  it('rejects when its own command is refused', async () => {
    const vehicle = { onCommandAck: new Signal<CommandAck>() }
    const sending = MAVLinkVehicle.prototype.sendCommand.call(
      vehicle,
      command(MavCmd.MAV_CMD_COMPONENT_ARM_DISARM)
    ) as Promise<void>
    const outcome = expect(sending).rejects.toThrow('MAV_RESULT_DENIED')

    vehicle.onCommandAck.emit_value(ack(MavCmd.MAV_CMD_COMPONENT_ARM_DISARM, MavResult.MAV_RESULT_DENIED))

    await outcome
  })
})
