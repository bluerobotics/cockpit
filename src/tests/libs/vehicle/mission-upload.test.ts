import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Package } from '@/libs/connection/m2r/messages/mavlink2rest'
import { MAVLinkType, MavMissionResult, MavMissionType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { type Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'
import { SignalTyped } from '@/libs/signal'
import { type MissionUploadPort, uploadMissionItems } from '@/libs/vehicle/mavlink/mission-upload'
import { defaultLoadingCallback } from '@/types/mission'

import { drain, flushUntil, itemInt, pack } from './mission-helpers'

const ack = (result = MavMissionResult.MAV_MISSION_ACCEPTED, missionType?: MavMissionType): Package =>
  pack({
    mavtype: { type: result },
    ...(missionType === undefined ? {} : { mission_type: { type: missionType } }),
  })

const fakeVehicle = (counts: number[], sent: number[]): MissionUploadPort => ({
  sendMissionCount: (count: number): void => {
    counts.push(count)
  },
  sendMissionItemInt: (item: Message.MissionItemInt): void => {
    sent.push(item.seq)
  },
  onIncomingMAVLinkMessage: new SignalTyped(),
})

describe('uploadMissionItems', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('sends each requested item immediately and finishes on ACK', async () => {
    vi.useFakeTimers()
    const counts: number[] = []
    const sent: number[] = []
    const port = fakeVehicle(counts, sent)
    const items = [itemInt(0), itemInt(1), itemInt(2)]
    const pending = uploadMissionItems(port, items)
    expect(counts).toEqual([3])

    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_REQUEST_INT, pack({ seq: 0 }))
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_REQUEST_INT, pack({ seq: 1 }))
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_REQUEST_INT, pack({ seq: 2 }))
    expect(sent).toEqual([0, 1, 2])

    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_ACK, ack())
    await pending
  })

  it('answers a legacy MISSION_REQUEST with the INT item', async () => {
    vi.useFakeTimers()
    const sent: number[] = []
    const port = fakeVehicle([], sent)
    const pending = uploadMissionItems(port, [itemInt(0), itemInt(1)])
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_REQUEST, pack({ seq: 0 }))
    expect(sent).toEqual([0])
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_ACK, ack())
    await pending
  })

  it('retries only the last requested item after a short idle', async () => {
    vi.useFakeTimers()
    const sent: number[] = []
    const port = fakeVehicle([], sent)
    const pending = uploadMissionItems(port, [itemInt(0), itemInt(1)])
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_REQUEST_INT, pack({ seq: 0 }))
    expect(sent).toEqual([0])

    await drain()
    vi.advanceTimersByTime(250)
    await flushUntil(() => sent.length === 2)
    expect(sent).toEqual([0, 0])

    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_REQUEST_INT, pack({ seq: 1 }))
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_ACK, ack())
    await pending
  })

  it('resends MISSION_COUNT after a short idle if the vehicle has not asked for an item', async () => {
    vi.useFakeTimers()
    const counts: number[] = []
    const port = fakeVehicle(counts, [])
    const pending = uploadMissionItems(port, [itemInt(0)])
    expect(counts).toEqual([1])

    await drain()
    vi.advanceTimersByTime(250)
    await flushUntil(() => counts.length === 2)
    expect(counts).toEqual([1, 1])

    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_REQUEST_INT, pack({ seq: 0 }))
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_ACK, ack())
    await pending
  })

  it('does not resend while requests keep arriving', async () => {
    vi.useFakeTimers()
    const sent: number[] = []
    const port = fakeVehicle([], sent)
    const pending = uploadMissionItems(port, [itemInt(0), itemInt(1), itemInt(2)])

    for (const seq of [0, 1, 2]) {
      port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_REQUEST_INT, pack({ seq }))
      await drain()
      vi.advanceTimersByTime(200)
      await drain()
    }
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_ACK, ack())
    await pending
    expect(sent).toEqual([0, 1, 2])
  })

  it('acks an empty mission without sending items', async () => {
    vi.useFakeTimers()
    const counts: number[] = []
    const sent: number[] = []
    const port = fakeVehicle(counts, sent)
    const pending = uploadMissionItems(port, [])
    expect(counts).toEqual([0])
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_ACK, ack())
    await pending
    expect(sent).toEqual([])
  })

  it('ignores requests that fall outside the mission', async () => {
    vi.useFakeTimers()
    const sent: number[] = []
    const port = fakeVehicle([], sent)
    const pending = uploadMissionItems(port, [itemInt(0), itemInt(1)])
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_REQUEST_INT, pack({ seq: 9 }))
    await Promise.resolve()
    expect(sent).toEqual([])

    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_REQUEST_INT, pack({ seq: 0 }))
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_REQUEST_INT, pack({ seq: 1 }))
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_ACK, ack())
    await pending
    expect(sent).toEqual([0, 1])
  })

  it('rejects when the vehicle refuses the mission', async () => {
    vi.useFakeTimers()
    const port = fakeVehicle([], [])
    const pending = uploadMissionItems(port, [itemInt(0)])
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_REQUEST_INT, pack({ seq: 0 }))
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_ACK, ack(MavMissionResult.MAV_MISSION_NO_SPACE))
    await expect(pending).rejects.toThrow(/The vehicle refused the mission/)
  })

  it('names a refused geofence as a geofence', async () => {
    vi.useFakeTimers()
    const port = fakeVehicle([], [])
    const pending = uploadMissionItems(port, [itemInt(0)], MavMissionType.MAV_MISSION_TYPE_FENCE)
    const fence = { mission_type: { type: MavMissionType.MAV_MISSION_TYPE_FENCE } }
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_REQUEST_INT, pack({ seq: 0, ...fence }))
    port.onIncomingMAVLinkMessage.emit_value(
      MAVLinkType.MISSION_ACK,
      ack(MavMissionResult.MAV_MISSION_NO_SPACE, MavMissionType.MAV_MISSION_TYPE_FENCE)
    )
    await expect(pending).rejects.toThrow(/The vehicle refused the geofence/)
  })

  it('keeps going when the vehicle rejects a duplicate sequence', async () => {
    vi.useFakeTimers()
    const sent: number[] = []
    const port = fakeVehicle([], sent)
    const pending = uploadMissionItems(port, [itemInt(0), itemInt(1)])
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_REQUEST_INT, pack({ seq: 0 }))
    port.onIncomingMAVLinkMessage.emit_value(
      MAVLinkType.MISSION_ACK,
      ack(MavMissionResult.MAV_MISSION_INVALID_SEQUENCE)
    )
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_REQUEST_INT, pack({ seq: 1 }))
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_ACK, ack())
    await pending
    expect(sent).toEqual([0, 1])
  })

  it('still stalls if the vehicle only answers with invalid-sequence', async () => {
    vi.useFakeTimers()
    const port = fakeVehicle([], [])
    const pending = uploadMissionItems(
      port,
      [itemInt(0)],
      MavMissionType.MAV_MISSION_TYPE_MISSION,
      defaultLoadingCallback,
      300
    )
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_REQUEST_INT, pack({ seq: 0 }))
    const assertion = expect(pending).rejects.toThrow(/Timed out waiting for the vehicle to accept/)
    for (let i = 0; i < 20; i++) {
      port.onIncomingMAVLinkMessage.emit_value(
        MAVLinkType.MISSION_ACK,
        ack(MavMissionResult.MAV_MISSION_INVALID_SEQUENCE)
      )
      vi.advanceTimersByTime(50)
      await drain()
    }
    await assertion
  })

  it('ignores an ACK or request for a different mission type', async () => {
    vi.useFakeTimers()
    const sent: number[] = []
    const port = fakeVehicle([], sent)
    const pending = uploadMissionItems(port, [itemInt(0)])
    const fence = { mission_type: { type: MavMissionType.MAV_MISSION_TYPE_FENCE } }
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_REQUEST_INT, pack({ seq: 0, ...fence }))
    expect(sent).toEqual([])
    port.onIncomingMAVLinkMessage.emit_value(
      MAVLinkType.MISSION_ACK,
      ack(MavMissionResult.MAV_MISSION_NO_SPACE, MavMissionType.MAV_MISSION_TYPE_FENCE)
    )
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_REQUEST_INT, pack({ seq: 0 }))
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_ACK, ack())
    await pending
    expect(sent).toEqual([0])
  })

  it('answers requests for a given mission type and ignores the others', async () => {
    vi.useFakeTimers()
    const sent: number[] = []
    const port = fakeVehicle([], sent)
    const pending = uploadMissionItems(port, [itemInt(0)], MavMissionType.MAV_MISSION_TYPE_FENCE)
    const fence = { mission_type: { type: MavMissionType.MAV_MISSION_TYPE_FENCE } }
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_REQUEST_INT, pack({ seq: 0 }))
    expect(sent).toEqual([])
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_ACK, ack())
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_REQUEST_INT, pack({ seq: 0, ...fence }))
    expect(sent).toEqual([0])
    port.onIncomingMAVLinkMessage.emit_value(
      MAVLinkType.MISSION_ACK,
      ack(MavMissionResult.MAV_MISSION_ACCEPTED, MavMissionType.MAV_MISSION_TYPE_FENCE)
    )
    await pending
  })

  it('fails if the vehicle never accepts the mission', async () => {
    vi.useFakeTimers()
    const port = fakeVehicle([], [])
    const pending = uploadMissionItems(
      port,
      [itemInt(0)],
      MavMissionType.MAV_MISSION_TYPE_MISSION,
      defaultLoadingCallback,
      300
    )
    const assertion = expect(pending).rejects.toThrow(/Timed out waiting for the vehicle to accept/)
    for (let i = 0; i < 20; i++) {
      vi.advanceTimersByTime(50)
      await drain()
    }
    await assertion
  })
})
