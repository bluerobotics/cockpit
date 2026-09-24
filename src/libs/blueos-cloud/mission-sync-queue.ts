// Cockpit usually runs offline in the field, so BlueOS Cloud mission mutations (create, rename, relocate)
// can't be sent right away. They are kept in a persistent queue and replayed once the internet is reachable.
//
// The queue is keyed by a stable client id rather than the cloud id, because a mission created offline has no
// cloud id yet. A later rename of that same mission coalesces into the pending create, so an offline
// "create then rename" flushes as a single create carrying the final title.

/**
 * A mission whose desired state still needs to be pushed to BlueOS Cloud.
 */
export interface PendingCloudMission {
  /**
   * Stable client-generated id, used as the mission reference until the cloud id is known.
   */
  clientId: string
  /**
   * Real BlueOS Cloud id once the mission has been created there; `null` while creation is still pending.
   */
  cloudId: string | null
  /**
   * Desired mission title, or `undefined` when this field should be left untouched on update.
   */
  title?: string
  /**
   * Desired mission description, or `undefined` when it should be left untouched.
   */
  description?: string
  /**
   * Desired start latitude in decimal degrees, or `undefined` when it should be left untouched.
   */
  latitude?: number | null
  /**
   * Desired start longitude in decimal degrees, or `undefined` when it should be left untouched.
   */
  longitude?: number | null
  /**
   * Epoch of the moment the mission started, captured when the create was queued so a mission created offline
   * isn't dated to whenever it reached the cloud. Absent on entries that only carry an update.
   */
  startTime?: number
  /**
   * Number of failed flush attempts, used to drop operations that can never succeed.
   */
  attempts: number
  /**
   * Bumped on every enqueue, so a flush can tell whether the entry it pushed was edited while in flight.
   */
  revision: number
}

/**
 * Persistent queue of missions awaiting synchronization, keyed by client id.
 */
export type PendingMissionQueue = Record<string, PendingCloudMission>

/**
 * Data for queuing the creation of a new mission.
 */
export interface EnqueueCreateParams {
  /**
   * Stable client id to key the mission by.
   */
  clientId: string
  /**
   * Mission title.
   */
  title: string
  /**
   * Optional mission description.
   */
  description?: string
  /**
   * Start latitude in decimal degrees, or null.
   */
  latitude: number | null
  /**
   * Start longitude in decimal degrees, or null.
   */
  longitude: number | null
  /**
   * Epoch of the moment the mission started.
   */
  startTime: number
}

/**
 * Fields to change on a queued mission; omit a field to leave it untouched.
 */
export interface MissionPatch {
  /**
   * New title.
   */
  title?: string
  /**
   * New description.
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

/**
 * Finds a pending mission by its client id or by its already-known cloud id.
 * @param {PendingMissionQueue} queue - Current queue.
 * @param {string} ref - Client id or cloud id to look up.
 * @returns {PendingCloudMission | undefined} The matching pending mission, if any.
 */
export const findPending = (queue: PendingMissionQueue, ref: string): PendingCloudMission | undefined =>
  queue[ref] ?? Object.values(queue).find((mission) => mission.cloudId === ref)

/**
 * Queues the creation of a brand-new mission.
 * @param {PendingMissionQueue} queue - Current queue.
 * @param {EnqueueCreateParams} params - New mission data.
 * @returns {PendingMissionQueue} The queue with the create operation added.
 */
export const enqueueCreate = (queue: PendingMissionQueue, params: EnqueueCreateParams): PendingMissionQueue => ({
  ...queue,
  [params.clientId]: {
    clientId: params.clientId,
    cloudId: null,
    title: params.title,
    description: params.description,
    latitude: params.latitude,
    longitude: params.longitude,
    startTime: params.startTime,
    attempts: 0,
    revision: 0,
  },
})

/**
 * Queues an update (rename and/or relocate), coalescing into an existing pending entry when present so a
 * create-then-rename collapses into a single create and repeated renames don't stack.
 * @param {PendingMissionQueue} queue - Current queue.
 * @param {string} ref - Client id or cloud id of the mission to update.
 * @param {MissionPatch} patch - Fields to change; omit a field to leave it untouched.
 * @returns {PendingMissionQueue} The queue with the update coalesced in.
 */
export const enqueueUpdate = (queue: PendingMissionQueue, ref: string, patch: MissionPatch): PendingMissionQueue => {
  const existing = findPending(queue, ref)
  // A mission that was already synced (or a selected existing cloud mission) is tracked by its cloud id.
  const base: PendingCloudMission = existing ?? { clientId: ref, cloudId: ref, attempts: 0, revision: 0 }
  const merged: PendingCloudMission = {
    ...base,
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.latitude !== undefined ? { latitude: patch.latitude } : {}),
    ...(patch.longitude !== undefined ? { longitude: patch.longitude } : {}),
    attempts: 0,
    revision: base.revision + 1,
  }
  return { ...queue, [base.clientId]: merged }
}

/**
 * Removes a mission from the queue once it is fully synced (or abandoned).
 * @param {PendingMissionQueue} queue - Current queue.
 * @param {string} clientId - Client id of the entry to remove.
 * @returns {PendingMissionQueue} The queue without that entry.
 */
const removePending = (queue: PendingMissionQueue, clientId: string): PendingMissionQueue => {
  if (!(clientId in queue)) return queue
  const next = { ...queue }
  delete next[clientId]
  return next
}

/**
 * Drops an entry that has just been pushed, unless the user edited it while the request was in flight: that newer
 * edit stays queued, retargeted at the cloud id the mission holds now, so it is flushed as an update rather than
 * being deleted unsent or created a second time.
 * @param {PendingMissionQueue} queue - Current queue.
 * @param {PendingCloudMission} pushed - The entry as it was when the request was built.
 * @param {string} cloudId - Cloud id the mission holds now that the push succeeded.
 * @returns {PendingMissionQueue} The queue without the entry, or with the newer edit retargeted.
 */
export const settlePending = (
  queue: PendingMissionQueue,
  pushed: PendingCloudMission,
  cloudId: string
): PendingMissionQueue => {
  const stored = queue[pushed.clientId]
  if (!stored || stored.revision === pushed.revision) return removePending(queue, pushed.clientId)
  return { ...queue, [pushed.clientId]: { ...stored, cloudId } }
}

/**
 * Records a failed flush attempt, dropping the entry once it has failed `maxAttempts` times so a permanently
 * rejected operation can't wedge the queue forever.
 * @param {PendingMissionQueue} queue - Current queue.
 * @param {string} clientId - Client id of the entry that failed.
 * @param {number} maxAttempts - Attempt count at which the entry is dropped.
 * @returns {PendingMissionQueue} The queue with the attempt counted or the entry dropped.
 */
export const registerFailedAttempt = (
  queue: PendingMissionQueue,
  clientId: string,
  maxAttempts: number
): PendingMissionQueue => {
  const existing = queue[clientId]
  if (!existing) return queue
  const attempts = existing.attempts + 1
  if (attempts >= maxAttempts) return removePending(queue, clientId)
  return { ...queue, [clientId]: { ...existing, attempts } }
}

/**
 * Lists the missions still awaiting synchronization.
 * @param {PendingMissionQueue} queue - Current queue.
 * @returns {PendingCloudMission[]} The pending missions.
 */
export const pendingMissions = (queue: PendingMissionQueue): PendingCloudMission[] => Object.values(queue)
