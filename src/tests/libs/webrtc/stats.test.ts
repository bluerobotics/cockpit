import { expect, test } from 'vitest'

import { monitorStreamPeerConnection } from '@/libs/webrtc/stats'

test('Registers the new peer connection before dropping the previous one', () => {
  const calls: string[] = []
  const peersToMonitor: Record<string, boolean> = { old: true }
  const stats = {
    peersToMonitor,
    addConnection: (options: Record<string, unknown>): void => {
      calls.push(`add:${options.peerId}`)
      peersToMonitor[options.peerId as string] = true
    },
    removePeer: (peerId: string): void => {
      calls.push(`remove:${peerId}`)
      delete peersToMonitor[peerId]
    },
  }

  monitorStreamPeerConnection(stats, {
    peerConnection: {} as RTCPeerConnection,
    peerId: 'new',
    sessionId: 'new',
  })

  expect(calls).toEqual(['add:new', 'remove:old'])
  expect(Object.keys(peersToMonitor)).toEqual(['new'])
})

test('Keeps the peer monitored when the same connection is registered again', () => {
  const peersToMonitor: Record<string, boolean> = { same: true }
  const stats = {
    peersToMonitor,
    addConnection: (options: Record<string, unknown>): void => {
      peersToMonitor[options.peerId as string] = true
    },
    removePeer: (peerId: string): void => {
      delete peersToMonitor[peerId]
    },
  }

  monitorStreamPeerConnection(stats, { peerConnection: {} as RTCPeerConnection, peerId: 'same', sessionId: 'same' })

  expect(Object.keys(peersToMonitor)).toEqual(['same'])
})
