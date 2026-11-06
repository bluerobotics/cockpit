import { expect, test, vi } from 'vitest'

import { monitorStreamPeerConnection, noteStreamBytesReceived, trackVideoArrival } from '@/libs/webrtc/stats'

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

test('Follows the video of a stream by its external id, whether or not it has a correspondency entry', () => {
  const now = vi.spyOn(performance, 'now').mockReturnValue(1000)
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  const streamName = 'rtsp://user:secret@10.0.0.1/unmapped-cam'

  try {
    const secondsWithoutVideo = trackVideoArrival(streamName, 'a stream whose source is lost will not reconnect')
    expect(secondsWithoutVideo()).toBeUndefined()
    expect(secondsWithoutVideo()).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0]).includes(streamName)).toBe(false)

    noteStreamBytesReceived(streamName, 1000)
    expect(secondsWithoutVideo()).toBe(0)

    now.mockReturnValue(2500)
    noteStreamBytesReceived(streamName, 1000)
    expect(secondsWithoutVideo()).toBe(1.5)

    noteStreamBytesReceived(streamName, 2000)
    expect(secondsWithoutVideo()).toBe(0)

    now.mockReturnValue(5000)
    expect(secondsWithoutVideo()).toBeUndefined()
  } finally {
    warn.mockRestore()
    now.mockRestore()
  }
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
