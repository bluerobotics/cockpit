import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { BlueOsCloudApiError, createMission, updateMission } from '@/libs/blueos-cloud/api'
import type { BlueOsCloudMission } from '@/libs/blueos-cloud/types'
import { useBlueOsCloudStore } from '@/stores/blueOsCloud'

// The vehicle-synced settings backend is not what these tests are about, and it needs a live BlueOS to initialize.
vi.mock('@/composables/settingsSyncer', () => ({ useBlueOsStorage: (_key: string, value: unknown) => ref(value) }))

vi.mock('@/libs/blueos-cloud/api', async () => ({
  ...(await vi.importActual<typeof import('@/libs/blueos-cloud/api')>('@/libs/blueos-cloud/api')),
  createMission: vi.fn(),
  updateMission: vi.fn(),
}))

// Recent Node versions expose a localStorage global that jsdom does not replace and that throws on use, so the
// tests bring their own.
const entries = new Map<string, string>()
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
    removeItem: (key: string) => entries.delete(key),
    clear: () => entries.clear(),
  },
})

const cloudMission: BlueOsCloudMission = {
  id: 'cloud-1',
  title: 'Reef survey',
  description: 'North wall',
  start_time: null,
  end_time: null,
  created_by: null,
  start_latitude: '-27.5',
  start_longitude: '-48.5',
}

// A reload keeps only what is in local storage, so the mission list starts empty again.
const reloadStore = (): ReturnType<typeof useBlueOsCloudStore> => {
  setActivePinia(createPinia())
  return useBlueOsCloudStore()
}

const signIn = (store: ReturnType<typeof useBlueOsCloudStore>): void => {
  store.tokens = { accessToken: 'token', refreshToken: null, expiresAt: Date.now() + 3_600_000 }
  store.user = { sub: 'auth0|user' }
}

describe('BlueOS Cloud linked mission', () => {
  beforeEach(() => {
    window.localStorage.clear()
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('still knows the linked mission after a reload, with no list fetched', async () => {
    const store = useBlueOsCloudStore()
    store.missions = [cloudMission]
    store.linkExistingMission(cloudMission.id, 1)
    await nextTick()

    const reloaded = reloadStore()
    expect(reloaded.missions).toEqual([])
    expect(reloaded.linkedMission).toEqual(cloudMission)
    expect(reloaded.isLinkedMissionSynced).toBe(true)
  })

  it('does not offer the remembered mission once another one is linked', async () => {
    const store = useBlueOsCloudStore()
    store.missions = [cloudMission]
    store.linkExistingMission(cloudMission.id, 1)
    await nextTick()

    const reloaded = reloadStore()
    reloaded.linkExistingMission('cloud-2', 1)
    expect(reloaded.linkedMission).toBeNull()
  })

  it('shows a queued offline edit rather than the stale fetched mission', () => {
    const store = useBlueOsCloudStore()
    store.missions = [cloudMission]
    store.linkExistingMission(cloudMission.id, 1)

    store.updateLinkedMission({ name: 'Reef survey, south wall' })

    expect(store.linkedMission?.title).toBe('Reef survey, south wall')
    // Fields the edit never carried keep the values the cloud returned, so a later edit can't blank them.
    expect(store.linkedMission?.description).toBe(cloudMission.description)
    expect(store.linkedMission?.start_latitude).toBe(cloudMission.start_latitude)
  })

  it('keeps showing the edit after it syncs on a start with no list fetched', async () => {
    const store = useBlueOsCloudStore()
    store.missions = [cloudMission]
    store.linkExistingMission(cloudMission.id, 1)
    await nextTick()
    store.updateLinkedMission({ name: 'Reef survey, south wall' })
    await nextTick()

    const editedMission = { ...cloudMission, title: 'Reef survey, south wall' }
    vi.mocked(updateMission).mockResolvedValue(editedMission)

    const reloaded = reloadStore()
    signIn(reloaded)
    await reloaded.flushMissionSyncQueue()

    expect(reloaded.linkedMission).toEqual(editedMission)
  })

  it('reports a mission created offline as not yet synced', () => {
    const store = useBlueOsCloudStore()
    const clientId = store.startCloudMission({ name: 'Hull inspection' }, 1)

    expect(store.linkedMission?.title).toBe('Hull inspection')
    expect(store.isLinkedMissionSynced).toBe(false)
    expect(clientId).not.toBe('')
  })

  it('uploads a mission created offline with the time it started, not the time it reached the cloud', async () => {
    const startedAt = new Date('2026-08-19T09:00:00.000Z').getTime()
    const store = useBlueOsCloudStore()
    store.startCloudMission({ name: 'Hull inspection' }, startedAt)
    await nextTick()
    vi.mocked(createMission).mockResolvedValue({ ...cloudMission, title: 'Hull inspection' })

    const reloaded = reloadStore()
    signIn(reloaded)
    await reloaded.flushMissionSyncQueue()

    expect(createMission).toHaveBeenCalledWith(expect.objectContaining({ startTime: startedAt }), 'token')
  })

  it('keeps the mission linked when the cloud gives up on an edit, since the mission itself is fine', async () => {
    const store = useBlueOsCloudStore()
    store.missions = [cloudMission]
    store.linkExistingMission(cloudMission.id, 1)
    store.updateLinkedMission({ name: 'Reef survey, south wall' })
    await nextTick()

    vi.mocked(updateMission).mockRejectedValue(new BlueOsCloudApiError('bad request', 400))
    const reloaded = reloadStore()
    signIn(reloaded)
    // One flush per attempt, since the queue backs off to its retry timer after each refusal.
    for (let attempt = 0; attempt < 5; attempt++) await reloaded.flushMissionSyncQueue()

    // The edit was given up on, but the mission it targeted is on the cloud and stays linked.
    expect(reloaded.isLinkedMissionSynced).toBe(true)
    expect(reloaded.linkedMissionId).toBe(cloudMission.id)
  })
})
