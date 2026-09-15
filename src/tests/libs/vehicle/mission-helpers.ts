import { vi } from 'vitest'

import type { Package } from '@/libs/connection/m2r/messages/mavlink2rest'
import { MAVLinkType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { type Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'

export const pack = (message: object): Package =>
  ({ header: { system_id: 1, component_id: 1, sequence: 0 }, message } as Package)

export const itemInt = (seq: number): Message.MissionItemInt =>
  ({ type: MAVLinkType.MISSION_ITEM_INT, seq, x: seq, y: seq } as Message.MissionItemInt)

export const drain = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    vi.advanceTimersByTime(0)
    await Promise.resolve()
  }
}

export const flushUntil = async (ready: () => boolean): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    vi.advanceTimersByTime(0)
    await Promise.resolve()
    if (ready()) return
  }
  throw new Error('flushUntil timed out')
}
