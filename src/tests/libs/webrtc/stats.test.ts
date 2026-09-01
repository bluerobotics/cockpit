import { expect, test, vi } from 'vitest'

import { deleteDataLakeVariable, setDataLakeVariableData } from '@/libs/actions/data-lake'
import { streamStatVariableId } from '@/libs/video/stream-stats'
import { monitorStreamPeerConnection, setStreamStatPublishedName, trackVideoArrival } from '@/libs/webrtc/stats'

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

test('Follows bytesReceived under the internal stream name, and skips an unmapped stream', () => {
  const now = vi.spyOn(performance, 'now').mockReturnValue(1000)
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  const internalByExternal = new Map<string, string>([['ext-cam', 'front']])
  const unmappedId = 'rtsp://user:secret@10.0.0.1/cam'
  setStreamStatPublishedName((externalId) => internalByExternal.get(externalId))
  const writtenIds: string[] = []

  try {
    expect(streamStatVariableId('front', 'bytesReceived')).toBe('stream-front-bytesReceived')
    setDataLakeVariableData('stream-front-bytesReceived', 1000)
    writtenIds.push('stream-front-bytesReceived')
    const secondsWithoutVideo = trackVideoArrival('ext-cam', 'a stream whose source is lost will not reconnect')
    expect(secondsWithoutVideo()).toBe(0)

    internalByExternal.set('ext-cam', 'front-renamed')
    expect(streamStatVariableId('front-renamed', 'bytesReceived')).toBe('stream-front-renamed-bytesReceived')
    expect(secondsWithoutVideo()).toBeUndefined()

    setDataLakeVariableData('stream-front-renamed-bytesReceived', 1000)
    writtenIds.push('stream-front-renamed-bytesReceived')
    expect(secondsWithoutVideo()).toBe(0)

    internalByExternal.delete('ext-cam')
    const warningsBeforeDrop = warn.mock.calls.length
    expect(secondsWithoutVideo()).toBeUndefined()
    expect(secondsWithoutVideo()).toBeUndefined()
    const dropWarnings = warn.mock.calls.slice(warningsBeforeDrop).map((call) => String(call[0]))
    expect(dropWarnings).toHaveLength(1)
    expect(dropWarnings[0].includes('ext-cam')).toBe(false)
    expect(dropWarnings[0].includes('stream-ext-cam-bytesReceived')).toBe(false)

    const warningsBefore = warn.mock.calls.length
    const unmappedSeconds = trackVideoArrival(unmappedId, 'a stream whose source is lost will not reconnect')
    expect(unmappedSeconds()).toBeUndefined()
    expect(unmappedSeconds()).toBeUndefined()
    const unmappedWarnings = warn.mock.calls.slice(warningsBefore).map((call) => String(call[0]))
    expect(unmappedWarnings).toHaveLength(1)
    expect(unmappedWarnings[0].includes(unmappedId)).toBe(false)
    expect(unmappedWarnings[0].includes(`stream-${unmappedId}-bytesReceived`)).toBe(false)
  } finally {
    writtenIds.forEach((id) => deleteDataLakeVariable(id))
    setStreamStatPublishedName(() => undefined)
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
