import { describe, expect, it } from 'vitest'

import { BlueOsCloudApiError, isPermanentApiError } from '@/libs/blueos-cloud/api'
import {
  type PendingMissionQueue,
  enqueueCreate,
  enqueueUpdate,
  registerFailedAttempt,
  settlePending,
} from '@/libs/blueos-cloud/mission-sync-queue'

const queueWithOneCreate = (): PendingMissionQueue =>
  enqueueCreate({}, { clientId: 'local-1', title: 'Reef survey', latitude: null, longitude: null, startTime: 1 })

describe('BlueOS Cloud mission sync queue', () => {
  it('only treats a server refusal as permanent, so offline failures never spend the attempt budget', () => {
    expect(isPermanentApiError(new BlueOsCloudApiError('bad request', 400))).toBe(true)
    expect(isPermanentApiError(new BlueOsCloudApiError('not found', 404))).toBe(true)
    expect(isPermanentApiError(new BlueOsCloudApiError('timeout', 408))).toBe(false)
    expect(isPermanentApiError(new BlueOsCloudApiError('too many requests', 429))).toBe(false)
    expect(isPermanentApiError(new BlueOsCloudApiError('server error', 500))).toBe(false)
    expect(isPermanentApiError(new TypeError('Failed to fetch'))).toBe(false)
  })

  it('counts attempts and drops the entry only once the budget is spent', () => {
    let queue = queueWithOneCreate()

    queue = registerFailedAttempt(queue, 'local-1', 3)
    expect(queue['local-1'].attempts).toBe(1)

    queue = registerFailedAttempt(queue, 'local-1', 3)
    expect(queue['local-1'].attempts).toBe(2)

    queue = registerFailedAttempt(queue, 'local-1', 3)
    expect(queue['local-1']).toBeUndefined()
  })

  it('ignores an attempt on an entry that is no longer queued', () => {
    expect(registerFailedAttempt({}, 'gone', 3)).toEqual({})
  })

  it('keeps an edit saved while the entry was being pushed, retargeted at the new cloud id', () => {
    const pushed = queueWithOneCreate()['local-1']
    const editedMidFlight = enqueueUpdate(queueWithOneCreate(), 'local-1', { title: 'Reef survey, south wall' })

    const settled = settlePending(editedMidFlight, pushed, 'cloud-1')
    expect(settled['local-1'].title).toBe('Reef survey, south wall')
    // Without the cloud id the next flush would create the mission a second time instead of updating it.
    expect(settled['local-1'].cloudId).toBe('cloud-1')

    expect(settlePending(queueWithOneCreate(), pushed, 'cloud-1')).toEqual({})
  })
})
