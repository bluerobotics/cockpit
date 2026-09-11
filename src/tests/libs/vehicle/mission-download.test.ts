import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Package } from '@/libs/connection/m2r/messages/mavlink2rest'
import { MAVLinkType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { type Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'
import { SignalTyped } from '@/libs/signal'
import { type MissionDownloadPort, downloadMissionItems } from '@/libs/vehicle/mavlink/mission-download'

const pack = (message: object): Package =>
  ({ header: { system_id: 1, component_id: 1, sequence: 0 }, message } as Package)

const itemInt = (seq: number): Message.MissionItemInt =>
  ({ type: MAVLinkType.MISSION_ITEM_INT, seq, x: seq, y: seq } as Message.MissionItemInt)

const fakeVehicle = (requested: number[], acks: boolean[]): MissionDownloadPort => ({
  requestMissionItemsList: (): void => undefined,
  requestMissionItem: (seq: number): void => {
    requested.push(seq)
  },
  sendMissionAck: (success: boolean): void => {
    acks.push(success)
  },
  onIncomingMAVLinkMessage: new SignalTyped(),
})

const drain = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    vi.advanceTimersByTime(0)
    await Promise.resolve()
  }
}

const flushUntil = async (ready: () => boolean): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    vi.advanceTimersByTime(0)
    await Promise.resolve()
    if (ready()) return
  }
  throw new Error('flushUntil timed out')
}

describe('downloadMissionItems', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps a window of outstanding requests after MISSION_COUNT', async () => {
    vi.useFakeTimers()
    const requested: number[] = []
    const acks: boolean[] = []
    const port = fakeVehicle(requested, acks)
    const pending = downloadMissionItems(port)
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_COUNT, pack({ count: 400 }))
    await flushUntil(() => requested.length === 64)
    expect(requested[0]).toBe(0)
    expect(requested[63]).toBe(63)

    for (let seq = 0; seq < 64; seq++) {
      port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_ITEM_INT, pack(itemInt(seq)))
    }
    await flushUntil(() => requested.length === 128)
    expect(requested[64]).toBe(64)

    for (let seq = 64; seq < 400; seq++) {
      port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_ITEM_INT, pack(itemInt(seq)))
    }
    const items = await pending
    expect(items).toHaveLength(400)
    expect(items[17]?.seq).toBe(17)
    expect(acks).toEqual([true])
  })

  it('retries only the in-flight holes after a short idle', async () => {
    vi.useFakeTimers()
    const requested: number[] = []
    const port = fakeVehicle(requested, [])
    const pending = downloadMissionItems(port)
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_COUNT, pack({ count: 5 }))
    await flushUntil(() => requested.length === 5)
    expect(requested).toEqual([0, 1, 2, 3, 4])

    for (const seq of [0, 1, 2, 4]) {
      port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_ITEM_INT, pack(itemInt(seq)))
    }
    await drain()
    vi.advanceTimersByTime(80)
    await flushUntil(() => requested.length === 6)
    expect(requested).toEqual([0, 1, 2, 3, 4, 3])

    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_ITEM_INT, pack(itemInt(3)))
    const items = await pending
    expect(items.map((item) => item.seq)).toEqual([0, 1, 2, 3, 4])
  })

  it('does not re-ask the window while items keep arriving', async () => {
    vi.useFakeTimers()
    const requested: number[] = []
    const port = fakeVehicle(requested, [])
    const pending = downloadMissionItems(port)
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_COUNT, pack({ count: 5 }))
    await flushUntil(() => requested.length === 5)

    vi.advanceTimersByTime(100)
    await flushUntil(() => requested.length > 5)
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_ITEM_INT, pack(itemInt(0)))
    const afterFirstIdle = requested.length

    for (const seq of [1, 2, 3, 4]) {
      await drain()
      vi.advanceTimersByTime(100)
      await drain()
      port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_ITEM_INT, pack(itemInt(seq)))
    }
    await pending
    expect(requested.length).toBe(afterFirstIdle)
  })

  it('acks an empty mission without requesting items', async () => {
    vi.useFakeTimers()
    const requested: number[] = []
    const acks: boolean[] = []
    const port = fakeVehicle(requested, acks)
    const pending = downloadMissionItems(port)
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_COUNT, pack({ count: 0 }))
    const items = await pending
    expect(items).toEqual([])
    expect(requested).toEqual([])
    expect(acks).toEqual([true])
  })

  it('ignores items that arrive before the count or fall outside it', async () => {
    vi.useFakeTimers()
    const requested: number[] = []
    const port = fakeVehicle(requested, [])
    const pending = downloadMissionItems(port)
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_ITEM_INT, pack(itemInt(0)))
    await Promise.resolve()
    expect(requested).toEqual([])

    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_COUNT, pack({ count: 2 }))
    await flushUntil(() => requested.length === 2)
    expect(requested).toEqual([0, 1])

    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_ITEM_INT, pack(itemInt(9)))
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_ITEM_INT, pack(itemInt(0)))
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_ITEM_INT, pack(itemInt(1)))
    const items = await pending
    expect(items.map((item) => item.seq)).toEqual([0, 1])
  })

  it('rejects a mission larger than the download limit', async () => {
    vi.useFakeTimers()
    const port = fakeVehicle([], [])
    const pending = downloadMissionItems(port)
    port.onIncomingMAVLinkMessage.emit_value(MAVLinkType.MISSION_COUNT, pack({ count: 4097 }))
    await expect(pending).rejects.toThrow(/4096/)
  })
})
