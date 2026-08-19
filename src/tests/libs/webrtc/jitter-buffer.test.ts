import { expect, test } from 'vitest'

import { setJitterBufferTarget } from '@/libs/webrtc/jitter-buffer'

const fakeReceivers = (kinds: string[]): Record<string, unknown>[] =>
  kinds.map((kind) => ({ track: { kind } } as Record<string, unknown>))

const fakePeerConnection = (receivers: Record<string, unknown>[]): RTCPeerConnection =>
  ({ getReceivers: () => receivers } as never)

test('Applies the target to video receivers only', () => {
  const receivers = fakeReceivers(['video', 'audio'])

  setJitterBufferTarget(fakePeerConnection(receivers), 250)

  expect(receivers[0].jitterBufferTarget).toBe(250)
  expect(receivers[0].playoutDelayHint).toBe(0.25)
  expect(receivers[1].jitterBufferTarget).toBeUndefined()
})

test('Clamps the target to the range accepted by browsers', () => {
  const tooHigh = fakeReceivers(['video'])
  const negative = fakeReceivers(['video'])

  setJitterBufferTarget(fakePeerConnection(tooHigh), 10000)
  setJitterBufferTarget(fakePeerConnection(negative), -1)

  expect(tooHigh[0].jitterBufferTarget).toBe(4000)
  expect(negative[0].jitterBufferTarget).toBe(0)
})

test('Zero target leaves the legacy hint unset', () => {
  const receivers = fakeReceivers(['video'])

  setJitterBufferTarget(fakePeerConnection(receivers), 0)

  expect(receivers[0].jitterBufferTarget).toBe(0)
  expect(receivers[0].playoutDelayHint).toBeNull()
})
