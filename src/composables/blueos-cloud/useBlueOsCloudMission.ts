import { type ComputedRef, computed } from 'vue'

import { openSnackbar } from '@/composables/snackbar'
import type { BlueOsCloudMission } from '@/libs/blueos-cloud/types'
import { generateAutomaticMissionName } from '@/libs/mission/automatic-name'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useBlueOsCloudStore } from '@/stores/blueOsCloud'
import { useMissionStore } from '@/stores/mission'
import type { WaypointCoordinates } from '@/types/mission'

/**
 * Payload emitted by the BlueOS Cloud mission form.
 */
export type MissionFormSubmitPayload = {
  /**
   * Mission title.
   */
  name: string
  /**
   * Mission description.
   */
  description: string
  /**
   * Mission start location, or `null` when the user left it unset.
   */
  location: WaypointCoordinates | null
}

/**
 * Public API of {@link useBlueOsCloudMission}.
 */
type BlueOsCloudMissionApi = {
  /**
   * Whether cloud missions are available, which requires pirate mode and an authenticated user.
   */
  isCloudActive: ComputedRef<boolean>
  /**
   * Whether a cloud mission is already linked to the current mission cycle.
   */
  hasMissionThisCycle: ComputedRef<boolean>
  /**
   * Mission offered as "continue previous", or `null` when one is already linked to this cycle.
   */
  previousMission: ComputedRef<BlueOsCloudMission | null>
  /**
   * Fetches the mission list when it holds no record of the linked mission, so its details are revalidated.
   */
  ensureLinkedMissionLoaded: () => Promise<void>
  /**
   * Relinks the previously linked mission to the current cycle.
   */
  continuePreviousMission: () => void
  /**
   * Links a mission chosen from the picker to the current cycle.
   * @param {BlueOsCloudMission} mission - Selected cloud mission.
   */
  selectExistingMission: (mission: BlueOsCloudMission) => void
  /**
   * Creates a mission from the form payload and links it to a brand-new mission cycle.
   * @param {MissionFormSubmitPayload} payload - New mission fields.
   */
  createMission: (payload: MissionFormSubmitPayload) => void
  /**
   * Applies the form payload to the mission already linked to this cycle.
   * @param {MissionFormSubmitPayload} payload - Updated mission fields.
   */
  editLinkedMission: (payload: MissionFormSubmitPayload) => void
}

/**
 * Mission-cycle awareness and the linking actions (continue, select, create, edit) shared by the startup decision
 * dialog and the mission configuration dialog, so both entry points behave identically.
 * @returns {BlueOsCloudMissionApi} Cycle state and mission linking actions.
 */
export const useBlueOsCloudMission = (): BlueOsCloudMissionApi => {
  const interfaceStore = useAppInterfaceStore()
  const cloudStore = useBlueOsCloudStore()
  const missionStore = useMissionStore()

  // BlueOS Cloud missions are an advanced feature, gated behind pirate mode like the Cloud settings menu.
  const isCloudActive = computed(() => interfaceStore.pirateMode && cloudStore.isAuthenticated)

  // Stamp that ties a cloud mission link to the current mission cycle (renewed after 6h idle / a new day).
  const currentCycleId = computed(() => new Date(missionStore.missionStartTime).getTime())

  const hasMissionThisCycle = computed(
    () => !!cloudStore.linkedMissionId && cloudStore.linkedMissionCycleId === currentCycleId.value
  )

  // Last linked mission id is kept even after skip/cycle mismatch, so "continue previous" stays available.
  const previousMission = computed(() => (hasMissionThisCycle.value ? null : cloudStore.linkedMission))

  const notify = (message: string): void => {
    openSnackbar({ message, variant: 'success', duration: 3000, closeButton: true })
  }

  const ensureLinkedMissionLoaded = async (): Promise<void> => {
    const missionRef = cloudStore.linkedMissionId
    // Also fetches while the mission is linked to this cycle, where only the cache would answer: the remembered
    // details would otherwise never notice an edit made on the cloud, and an edit from Cockpit would revert it.
    if (!missionRef || !cloudStore.isLinkedMissionSynced) return
    if (cloudStore.missions.some((mission) => mission.id === missionRef)) return
    try {
      await cloudStore.refreshMissions()
    } catch {
      // Offline — continue-previous stays hidden until the missions can be loaded.
    }
  }

  const continuePreviousMission = (): void => {
    const mission = previousMission.value
    if (!mission) return
    const title = mission.title?.trim()
    missionStore.applyMissionName(title || generateAutomaticMissionName(), {
      isAutomatic: !title,
      startNewMission: false,
    })
    cloudStore.linkExistingMission(mission.id, currentCycleId.value)
    notify(`Continuing BlueOS Cloud mission "${title || 'Untitled mission'}".`)
  }

  const selectExistingMission = (mission: BlueOsCloudMission): void => {
    logUserAction(`Opened BlueOS Cloud mission '${mission.title}'`)
    const title = mission.title?.trim()
    missionStore.applyMissionName(title || generateAutomaticMissionName(), {
      isAutomatic: !title,
      startNewMission: false,
    })
    cloudStore.linkExistingMission(mission.id, currentCycleId.value)
    notify(`Now logging to BlueOS Cloud mission "${title || 'Untitled mission'}".`)
  }

  const createMission = (payload: MissionFormSubmitPayload): void => {
    const { name, description, location } = payload
    logUserAction(`Created BlueOS Cloud mission '${name}'`)
    missionStore.applyMissionName(name, { isAutomatic: false, startNewMission: true })
    cloudStore.startCloudMission(
      { name, description, latitude: location?.[0] ?? null, longitude: location?.[1] ?? null },
      currentCycleId.value
    )
    notify(`Mission "${name}" saved. It will sync to BlueOS Cloud when online.`)
  }

  const editLinkedMission = (payload: MissionFormSubmitPayload): void => {
    const { name, description, location } = payload
    logUserAction('Edited the linked BlueOS Cloud mission')
    missionStore.applyMissionName(name, { isAutomatic: false, startNewMission: false })
    cloudStore.updateLinkedMission({
      name,
      description,
      latitude: location?.[0] ?? null,
      longitude: location?.[1] ?? null,
    })
    notify(`Mission "${name}" updated.`)
  }

  return {
    isCloudActive,
    hasMissionThisCycle,
    previousMission,
    ensureLinkedMissionLoaded,
    continuePreviousMission,
    selectExistingMission,
    createMission,
    editLinkedMission,
  }
}
