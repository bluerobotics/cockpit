import { expect, test } from 'vitest'

import { sessionRangeCoveringBatch, sessionWithCreditedPoints } from '@/libs/data-lake-logging'

const sessionGapMs = 5 * 60 * 1000

test('a flushed batch widens the session range without counting the points', () => {
  const session = sessionRangeCoveringBatch(null, 1000, 2000, 2001)

  expect(session.startTime).toBe(2000)
  expect(session.endTime).toBe(2001)
  expect(session.dataPointCount).toBe(0)
  expect(session.bootId).toBe(1000)

  const widened = sessionRangeCoveringBatch(session, 1000, 2002, 2003)
  expect(widened.startTime).toBe(2000)
  expect(widened.endTime).toBe(2003)
  expect(widened.dataPointCount).toBe(0)

  const credited = sessionWithCreditedPoints(widened, 2000, 4)
  expect(credited?.dataPointCount).toBe(4)
  expect(sessionRangeCoveringBatch(credited, 1000, 2004, 2005).dataPointCount).toBe(4)
})

test('a gap larger than the threshold opens a new session instead of stretching the old range', () => {
  const session = sessionRangeCoveringBatch(null, 1000, 2000, 2000)
  const next = sessionRangeCoveringBatch(session, 1000, 2000 + sessionGapMs + 1, 2000 + sessionGapMs + 1)

  expect(next.id).not.toBe(session.id)
  expect(next.startTime).toBe(2000 + sessionGapMs + 1)
  expect(next.dataPointCount).toBe(0)
})

test('a gap of exactly the session threshold stays on the same session', () => {
  const session = sessionRangeCoveringBatch(null, 1000, 2000, 2000)
  const next = sessionRangeCoveringBatch(session, 1000, 2000 + sessionGapMs, 2000 + sessionGapMs)

  expect(next.id).toBe(session.id)
  expect(next.startTime).toBe(2000)
  expect(next.endTime).toBe(2000 + sessionGapMs)
  expect(next.dataPointCount).toBe(0)
})

test('points are credited only once the batch is inside the session range', () => {
  const session = sessionRangeCoveringBatch(null, 1000, 2000, 2010)

  expect(sessionWithCreditedPoints(session, 2000, 4)?.dataPointCount).toBe(4)
  expect(sessionWithCreditedPoints(session, 1999, 4)).toBeNull()
  expect(sessionWithCreditedPoints(session, 2011, 4)).toBeNull()
})
