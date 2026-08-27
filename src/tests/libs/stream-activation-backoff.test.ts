import { expect, test, vi } from 'vitest'

import { StreamActivationBackoff } from '@/libs/stream-activation-backoff'

test('StreamActivationBackoff', () => {
  vi.useFakeTimers()

  const backoff = new StreamActivationBackoff()
  const stream = 'rtsp://192.168.2.10:554/stream_1'

  // The regression this guards: consumers re-request their stream about once a second, so a stream that never
  // activates used to be retried, and reported to the user, on every one of these ticks.
  let attempts = 0
  let dialogs = 0
  for (let tick = 0; tick < 30; tick++) {
    if (!backoff.isBackingOff(stream)) {
      attempts++
      if (backoff.registerFailure(stream)) dialogs++
    }
    vi.advanceTimersByTime(1000)
  }
  expect(dialogs).toBe(1)
  expect(attempts).toBe(6) // 30s of polling, one attempt per 5s of retry delay

  // Other streams are unaffected by this one's failures
  expect(backoff.isBackingOff('rtsp://192.168.2.11:554/stream_1')).toBe(false)

  // Once it activates, or the user deletes it, a later failure is worth reporting again
  backoff.forget(stream)
  expect(backoff.isBackingOff(stream)).toBe(false)
  expect(backoff.registerFailure(stream)).toBe(true)

  vi.useRealTimers()
})
