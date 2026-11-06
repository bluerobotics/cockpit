import { StorageSerializers, useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { v4 as uuid } from 'uuid'
import { computed, onScopeDispose, ref, watch } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { openSnackbar } from '@/composables/snackbar'
import {
  BlueOsCloudApiError,
  createMission,
  fetchMissions,
  isPermanentApiError,
  updateMission,
} from '@/libs/blueos-cloud/api'
import { fetchAuthenticatedUser, isTokenValid, refreshAccessToken } from '@/libs/blueos-cloud/auth'
import {
  type PendingCloudMission,
  type PendingMissionQueue,
  enqueueCreate,
  enqueueUpdate,
  findPending,
  pendingMissions,
  registerFailedAttempt,
  settlePending,
} from '@/libs/blueos-cloud/mission-sync-queue'
import { BlueOsCloudMission, BlueOsCloudTokens, BlueOsCloudUser } from '@/libs/blueos-cloud/types'

// Drop a mission sync operation after this many rejections by the server so a permanently rejected op can't wedge
// the queue. Failures that never reached the server (offline) don't count, or field work would be thrown away.
const MAX_MISSION_SYNC_ATTEMPTS = 5

// Backoff before retrying the queue after a failed flush (e.g. still offline).
const MISSION_SYNC_RETRY_MS = 30_000

/**
 * Fields for creating a new BlueOS Cloud mission from the session.
 */
interface StartCloudMissionInput {
  /**
   * Mission title.
   */
  name: string
  /**
   * Optional mission description.
   */
  description?: string
  /**
   * Start latitude in decimal degrees.
   */
  latitude?: number | null
  /**
   * Start longitude in decimal degrees.
   */
  longitude?: number | null
}

/**
 * Fields to change on the currently linked BlueOS Cloud mission.
 */
interface UpdateLinkedMissionInput {
  /**
   * New mission title.
   */
  name?: string
  /**
   * New mission description.
   */
  description?: string
  /**
   * New start latitude in decimal degrees.
   */
  latitude?: number | null
  /**
   * New start longitude in decimal degrees.
   */
  longitude?: number | null
}

export const useBlueOsCloudStore = defineStore('blueOsCloud', () => {
  const isIntegrationEnabled = useBlueOsStorage<boolean>('cockpit-blueos-cloud-enabled', false)
  const tokens = useStorage<BlueOsCloudTokens | null>('cockpit-blueos-cloud-tokens', null, undefined, {
    serializer: StorageSerializers.object,
  })
  const user = useStorage<BlueOsCloudUser | null>('cockpit-blueos-cloud-user', null, undefined, {
    serializer: StorageSerializers.object,
  })

  const missions = ref<BlueOsCloudMission[]>([])
  const isLoadingMissions = ref(false)
  const lastError = ref<string | null>(null)

  /**
   * Identifier of the cloud mission currently linked to the active Cockpit session, set from the mission
   * configuration dialog. Upload pickers read this to auto-select the right mission by default.
   */
  const linkedMissionId = useStorage<string | null>('cockpit-blueos-cloud-linked-mission-id', null, undefined, {
    serializer: StorageSerializers.object,
  })

  // Persistent queue of mission mutations awaiting internet, so offline field work is replayed once online.
  const missionSyncQueue = useStorage<PendingMissionQueue>('cockpit-blueos-cloud-mission-queue-v1', {}, undefined, {
    serializer: StorageSerializers.object,
  })

  // Mission-cycle stamp (the mission start-time epoch) captured when the cloud mission was linked, so the link
  // is considered active only during that cycle; a new cycle (6h idle / new day) prompts a fresh select/create.
  const linkedMissionCycleId = useStorage<number | null>('cockpit-blueos-cloud-linked-mission-cycle', null, undefined, {
    serializer: StorageSerializers.object,
  })

  // Last known details of the linked mission. The mission list is fetched, so it is empty until something asks for
  // it: without this, a reload would show the linked mission as untitled and unlocated, and editing it from there
  // would erase its description and start position on the cloud.
  const cachedLinkedMission = useStorage<BlueOsCloudMission | null>(
    'cockpit-blueos-cloud-linked-mission-v1',
    null,
    undefined,
    { serializer: StorageSerializers.object }
  )

  const fetchedLinkedMission = computed<BlueOsCloudMission | null>(() => {
    const missionRef = linkedMissionId.value
    if (!missionRef) return null
    return missions.value.find((mission) => mission.id === missionRef) ?? null
  })

  watch(fetchedLinkedMission, (mission) => {
    if (mission) cachedLinkedMission.value = mission
  })

  const patchedCoordinate = (patched: number | null | undefined, base: string | null): string | null => {
    if (patched === undefined) return base
    return patched === null ? null : String(patched)
  }

  // A queued mutation is newer than both the fetched list and the cache, so it is overlaid on whichever of them
  // answered instead of replacing it: a patch carries only the fields the user changed.
  const linkedMission = computed<BlueOsCloudMission | null>(() => {
    const missionRef = linkedMissionId.value
    if (!missionRef) return null
    const cached = cachedLinkedMission.value?.id === missionRef ? cachedLinkedMission.value : null
    const base = fetchedLinkedMission.value ?? cached
    const pending = findPending(missionSyncQueue.value, missionRef)
    if (!pending) return base
    return {
      id: base?.id ?? pending.clientId,
      title: pending.title ?? base?.title ?? '',
      description: pending.description ?? base?.description ?? '',
      start_time: base?.start_time ?? null,
      end_time: base?.end_time ?? null,
      created_by: base?.created_by ?? null,
      start_latitude: patchedCoordinate(pending.latitude, base?.start_latitude ?? null),
      start_longitude: patchedCoordinate(pending.longitude, base?.start_longitude ?? null),
    }
  })

  const isAuthenticated = computed(() => !!tokens.value && !!user.value)

  // Whether the linked mission already exists on BlueOS Cloud (vs. a locally-created one still awaiting sync).
  // Read from the queue rather than from the fetched list, so it stays right before any list is loaded.
  const isLinkedMissionSynced = computed(
    () => !!linkedMissionId.value && !findPending(missionSyncQueue.value, linkedMissionId.value)
  )

  const displayName = computed(() => {
    const currentUser = user.value
    if (!currentUser) return ''
    return currentUser.name || currentUser.nickname || currentUser.email || currentUser.sub
  })

  let retryTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Clears persisted tokens and the cached user profile, effectively logging the user out locally.
   */
  const clearSession = (): void => {
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    tokens.value = null
    user.value = null
    missions.value = []
    linkedMissionId.value = null
    linkedMissionCycleId.value = null
    cachedLinkedMission.value = null
    // The sync queue is deliberately kept: it holds work the user was told was saved, and it is replayed on sign-in.
  }

  /**
   * Stores a freshly issued token bundle and refreshes the cached user profile from Auth0.
   *
   * Used both at the end of the device-flow login wizard and after a successful refresh-token exchange, so it is
   * also where anything left queued by a previous session gets its first chance to be uploaded.
   * @param {BlueOsCloudTokens} newTokens - Token bundle to persist.
   */
  const persistSession = async (newTokens: BlueOsCloudTokens): Promise<void> => {
    tokens.value = newTokens
    user.value = await fetchAuthenticatedUser(newTokens.accessToken)
    void flushMissionSyncQueue()
  }

  // Shared in-flight refresh so concurrent callers exchange the refresh token only once.
  let refreshPromise: Promise<string> | null = null

  /**
   * Returns a valid access token, refreshing it on the fly when it has expired.
   *
   * Concurrent callers share a single in-flight refresh, so the refresh token is never exchanged more than once.
   * Throws when there is no active session or when the refresh attempt fails, so callers can show a re-login prompt.
   * @returns {Promise<string>} An access token guaranteed to be valid for the next API call.
   */
  const ensureValidAccessToken = async (): Promise<string> => {
    if (!tokens.value) throw new Error('Not signed in to BlueOS Cloud')

    if (isTokenValid(tokens.value)) return tokens.value.accessToken

    const refreshToken = tokens.value.refreshToken
    if (!refreshToken) {
      clearSession()
      throw new Error('BlueOS Cloud session expired. Please sign in again.')
    }

    if (!refreshPromise) {
      refreshPromise = refreshAccessToken(refreshToken)
        .then(async (refreshed) => {
          await persistSession(refreshed)
          return refreshed.accessToken
        })
        .catch((error) => {
          // Only a refusal from Auth0 means the session is really over; a refresh that couldn't be attempted (no
          // internet) must keep the user signed in, or field work is logged out for being offline.
          if (isPermanentApiError(error)) clearSession()
          throw error
        })
        .finally(() => {
          refreshPromise = null
        })
    }

    return refreshPromise
  }

  /**
   * Refreshes the cached list of cloud missions.
   *
   * Mutates `missions`, `isLoadingMissions` and `lastError` so the UI can react to the load lifecycle.
   * @returns {Promise<BlueOsCloudMission[]>} The updated list of missions.
   */
  const refreshMissions = async (): Promise<BlueOsCloudMission[]> => {
    isLoadingMissions.value = true
    lastError.value = null
    try {
      const accessToken = await ensureValidAccessToken()
      const fetched = await fetchMissions(accessToken)
      missions.value = fetched
      return fetched
    } catch (error) {
      lastError.value = (error as Error).message
      throw error
    } finally {
      isLoadingMissions.value = false
    }
  }

  let isFlushingQueue = false

  const scheduleQueueRetry = (): void => {
    if (retryTimer) return
    retryTimer = setTimeout(() => {
      retryTimer = null
      void flushMissionSyncQueue()
    }, MISSION_SYNC_RETRY_MS)
  }

  // Inserts rather than only replacing: the list is empty until something fetches it, so a flush right after a
  // restart would otherwise drop the record the server just returned, along with the cache written from it.
  const upsertMission = (mission: BlueOsCloudMission): void => {
    missions.value = [mission, ...missions.value.filter((existing) => existing.id !== mission.id)]
  }

  // An edit saved mid-request survives the push that was already in flight, but the running flush walks a snapshot
  // taken before it, so the entry it leaves behind needs a retry of its own to ever be uploaded.
  const settleSyncedMission = (mission: PendingCloudMission, cloudId: string): void => {
    missionSyncQueue.value = settlePending(missionSyncQueue.value, mission, cloudId)
    if (mission.clientId in missionSyncQueue.value) scheduleQueueRetry()
  }

  /**
   * Creates a queued mission on the cloud and reconciles the local state with the id the server assigned: the
   * created mission enters the list, a session link pointing at the local id follows it, and the entry leaves
   * the queue.
   * @param {PendingCloudMission} mission - Queued mission to create.
   * @param {string} accessToken - Valid BlueOS Cloud access token.
   */
  const createAndReconcile = async (mission: PendingCloudMission, accessToken: string): Promise<void> => {
    const created = await createMission(
      {
        name: mission.title ?? '',
        description: mission.description,
        latitude: mission.latitude ?? null,
        longitude: mission.longitude ?? null,
        startTime: mission.startTime,
      },
      accessToken
    )
    upsertMission(created)
    if (linkedMissionId.value === mission.clientId) linkedMissionId.value = created.id
    settleSyncedMission(mission, created.id)
  }

  /**
   * Tells the user a queued operation was given up on, and clears the link when it was the mission's own creation
   * that was refused, so the dialog stops offering a mission that will never be uploaded. A refused update names a
   * mission the cloud is still serving, so that one keeps its link and loses only the edit.
   * @param {PendingCloudMission} mission - Mission that was dropped from the queue.
   */
  const announceDroppedMission = (mission: PendingCloudMission): void => {
    const wasNeverUploaded = mission.cloudId === null
    if (wasNeverUploaded && linkedMissionId.value === mission.clientId) linkedMissionId.value = null
    const missionName = mission.title ?? mission.clientId
    const rejected = wasNeverUploaded
      ? `mission "${missionName}", so it will not be uploaded`
      : `the changes to mission "${missionName}", which stays linked but keeps its previous details`
    openSnackbar({
      message: `BlueOS Cloud rejected ${rejected}.`,
      variant: 'error',
      duration: 6000,
      closeButton: true,
    })
  }

  /**
   * Pushes a single queued mission to BlueOS Cloud, counting a server refusal against its attempt budget.
   * @param {PendingCloudMission} mission - Queued mission to push.
   * @param {string} accessToken - Valid BlueOS Cloud access token.
   * @returns {Promise<'synced' | 'retry' | 'dropped'>} Whether the mission is now on the cloud, should be retried
   * later, or exhausted its attempts and left the queue unsent.
   */
  const syncPendingMission = async (
    mission: PendingCloudMission,
    accessToken: string
  ): Promise<'synced' | 'retry' | 'dropped'> => {
    const missionName = mission.title ?? mission.clientId
    try {
      if (mission.cloudId === null) {
        await createAndReconcile(mission, accessToken)
      } else {
        const updated = await updateMission(
          mission.cloudId,
          {
            name: mission.title,
            description: mission.description,
            latitude: mission.latitude,
            longitude: mission.longitude,
          },
          accessToken
        )
        upsertMission(updated)
        settleSyncedMission(mission, mission.cloudId)
      }
      return 'synced'
    } catch (opError) {
      // The mission was deleted on the cloud since we linked it: re-create it so the local mission is restored.
      const missionWasDeleted =
        mission.cloudId !== null && opError instanceof BlueOsCloudApiError && opError.status === 404
      if (missionWasDeleted) {
        try {
          await createAndReconcile(mission, accessToken)
          console.warn(`[BlueOsCloud] Mission '${missionName}' no longer existed on the cloud and was re-created.`)
          return 'synced'
        } catch (recreateError) {
          // Deliberately falls through to the accounting below, which judges the original 404: a mission the server
          // says is gone and then refuses to re-create is a refusal, and should spend an attempt like any other.
          console.error(`[BlueOsCloud] Failed to re-create missing BlueOS Cloud mission. ${recreateError}`)
        }
      } else {
        console.error(`[BlueOsCloud] Failed to sync mission '${missionName}'. ${opError}`)
      }
      if (!isPermanentApiError(opError)) return 'retry'
      const remaining = registerFailedAttempt(missionSyncQueue.value, mission.clientId, MAX_MISSION_SYNC_ATTEMPTS)
      const wasDropped = !(mission.clientId in remaining)
      missionSyncQueue.value = remaining
      return wasDropped ? 'dropped' : 'retry'
    }
  }

  /**
   * Replays queued mission mutations against BlueOS Cloud, reconciling locally-created missions with the ids the
   * server assigns. Safe to call repeatedly; it no-ops while offline, unauthenticated, or already flushing, and
   * schedules a retry when an operation fails so field work eventually syncs once the internet is reachable.
   * @returns {Promise<void>} Resolves once a flush pass finishes (successfully or by deferring for retry).
   */
  const flushMissionSyncQueue = async (): Promise<void> => {
    if (isFlushingQueue || !isAuthenticated.value) return
    if (pendingMissions(missionSyncQueue.value).length === 0) return
    isFlushingQueue = true
    try {
      const accessToken = await ensureValidAccessToken()
      for (const mission of pendingMissions(missionSyncQueue.value)) {
        const outcome = await syncPendingMission(mission, accessToken)
        if (outcome === 'synced') continue
        if (outcome === 'dropped') announceDroppedMission(mission)
        // ponytail: abort the flush after the first failure; later queue entries wait for the scheduled retry.
        // Upgrade: keep walking the remaining missions in this pass and collect failures.
        scheduleQueueRetry()
        return
      }
    } catch {
      // Could not obtain a valid token (offline or session expired); keep the queue and retry later.
      scheduleQueueRetry()
    } finally {
      isFlushingQueue = false
    }
  }

  /**
   * Starts a brand-new mission on BlueOS Cloud and links it to the session. Works offline: the mission is queued
   * with a local id and created on the cloud once the internet is reachable.
   * @param {StartCloudMissionInput} input - New mission data.
   * @param {number} cycleId - Mission-cycle stamp (mission start-time epoch) to associate the link with, and the
   * start time the mission is created with on the cloud.
   * @returns {string} The local client id now linked to the session.
   */
  const startCloudMission = (input: StartCloudMissionInput, cycleId: number): string => {
    const clientId = uuid()
    missionSyncQueue.value = enqueueCreate(missionSyncQueue.value, {
      clientId,
      title: input.name,
      description: input.description,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      startTime: cycleId,
    })
    linkedMissionId.value = clientId
    linkedMissionCycleId.value = cycleId
    void flushMissionSyncQueue()
    return clientId
  }

  /**
   * Links an already-existing cloud mission to the current session cycle.
   * @param {string} missionId - Cloud mission id to link.
   * @param {number} cycleId - Mission-cycle stamp (mission start-time epoch) to associate the link with.
   */
  const linkExistingMission = (missionId: string, cycleId: number): void => {
    linkedMissionId.value = missionId
    linkedMissionCycleId.value = cycleId
  }

  /**
   * Unlinks the current cloud mission so the next session starts fresh (used when finishing a mission).
   */
  const finishMission = (): void => {
    linkedMissionId.value = null
    linkedMissionCycleId.value = null
  }

  /**
   * Clears only the cycle link so this session has no active cloud mission, while keeping the last mission id
   * available for "continue previous".
   */
  const clearMissionCycleLink = (): void => {
    linkedMissionCycleId.value = null
  }

  /**
   * Queues an update (rename, relocate and/or re-describe) for the currently linked mission, coalescing with any
   * pending create/update for it. Works offline.
   * @param {UpdateLinkedMissionInput} input - Fields to change.
   */
  const updateLinkedMission = (input: UpdateLinkedMissionInput): void => {
    const missionRef = linkedMissionId.value
    if (!missionRef) return
    missionSyncQueue.value = enqueueUpdate(missionSyncQueue.value, missionRef, {
      // Always carry the title so a later re-create (if the cloud mission was deleted) keeps the mission name.
      title: input.name ?? linkedMission.value?.title,
      description: input.description,
      latitude: input.latitude,
      longitude: input.longitude,
    })
    void flushMissionSyncQueue()
  }

  // Replay the queue whenever the browser regains connectivity, and once now for anything left from a past session.
  const replayQueueOnReconnection = (): void => void flushMissionSyncQueue()
  window.addEventListener('online', replayQueueOnReconnection)
  onScopeDispose(() => window.removeEventListener('online', replayQueueOnReconnection))
  void flushMissionSyncQueue()

  return {
    isIntegrationEnabled,
    tokens,
    user,
    missions,
    isLoadingMissions,
    lastError,
    linkedMissionId,
    linkedMissionCycleId,
    linkedMission,
    isLinkedMissionSynced,
    isAuthenticated,
    displayName,
    persistSession,
    clearSession,
    ensureValidAccessToken,
    refreshMissions,
    startCloudMission,
    linkExistingMission,
    finishMission,
    clearMissionCycleLink,
    updateLinkedMission,
    flushMissionSyncQueue,
  }
})
