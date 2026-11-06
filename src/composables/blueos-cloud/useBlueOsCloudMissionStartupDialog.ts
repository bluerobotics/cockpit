import { type ComputedRef, type Ref, onMounted, ref, watch } from 'vue'

import { type MissionFormSubmitPayload, useBlueOsCloudMission } from '@/composables/blueos-cloud/useBlueOsCloudMission'
import type { BlueOsCloudMission } from '@/libs/blueos-cloud/types'
import { useBlueOsCloudStore } from '@/stores/blueOsCloud'

/**
 * Public API of {@link useBlueOsCloudMissionStartupDialog}.
 */
type BlueOsCloudMissionStartupDialogApi = {
  /**
   * Whether the initial decision dialog is open.
   */
  showDecisionDialog: Ref<boolean>
  /**
   * Whether the existing-mission picker is open.
   */
  showMissionPicker: Ref<boolean>
  /**
   * Whether the create-mission form is open.
   */
  showMissionForm: Ref<boolean>
  /**
   * Previous linked mission offered as "continue", when known.
   */
  previousMission: ComputedRef<BlueOsCloudMission | null>
  /**
   * Relink the previous mission to the current cycle.
   */
  continuePreviousMission: () => void
  /**
   * Open the existing-mission picker from the decision dialog.
   */
  openMissionPicker: () => void
  /**
   * Open the create-mission form from the decision dialog.
   */
  openCreateMissionForm: () => void
  /**
   * Skip cloud missions for this cycle while keeping the previous mission id.
   */
  skipMission: () => void
  /**
   * Dismiss the decision dialog without choosing anything.
   */
  dismissDecisionDialog: () => void
  /**
   * Link a mission chosen from the picker.
   * @param {BlueOsCloudMission} mission - Selected cloud mission.
   */
  onMissionSelected: (mission: BlueOsCloudMission) => void
  /**
   * Create a mission from the form submit payload.
   * @param {MissionFormSubmitPayload} payload - New mission fields.
   */
  onMissionFormSubmit: (payload: MissionFormSubmitPayload) => void
}

/**
 * State and handlers for the BlueOS Cloud mission decision dialog shown when Cockpit starts.
 * @returns {BlueOsCloudMissionStartupDialogApi} Dialog visibility flags and action handlers.
 */
export const useBlueOsCloudMissionStartupDialog = (): BlueOsCloudMissionStartupDialogApi => {
  const cloudStore = useBlueOsCloudStore()
  const {
    isCloudActive,
    hasMissionThisCycle,
    previousMission,
    ensureLinkedMissionLoaded,
    continuePreviousMission,
    selectExistingMission,
    createMission,
  } = useBlueOsCloudMission()

  const showDecisionDialog = ref(false)
  const showMissionPicker = ref(false)
  const showMissionForm = ref(false)

  const closeDecisionDialog = (): void => {
    showDecisionDialog.value = false
  }

  const dismissDecisionDialog = (): void => {
    logUserAction('Dismissed the BlueOS Cloud mission question without choosing')
    closeDecisionDialog()
  }

  const onContinuePreviousMission = (): void => {
    continuePreviousMission()
    closeDecisionDialog()
  }

  const openMissionPicker = (): void => {
    closeDecisionDialog()
    showMissionPicker.value = true
  }

  const openCreateMissionForm = (): void => {
    closeDecisionDialog()
    showMissionForm.value = true
  }

  const skipMission = (): void => {
    cloudStore.clearMissionCycleLink()
    closeDecisionDialog()
  }

  // The picker and the form replace the decision dialog, so closing one without choosing has to bring the question
  // back: nothing else would reopen it for the rest of the session.
  let isChoiceMade = false

  const onSurfaceVisibilityChange = (isOpen: boolean): void => {
    if (isOpen || isChoiceMade) return
    showDecisionDialog.value = true
  }

  watch(showMissionPicker, onSurfaceVisibilityChange)
  watch(showMissionForm, onSurfaceVisibilityChange)

  const openIfEligible = async (): Promise<void> => {
    // A mission already linked to this cycle means the session is just being resumed, so there is nothing to decide.
    if (!isCloudActive.value || hasMissionThisCycle.value) return
    // Never stack the question on top of a surface the user is already answering it with.
    if (showDecisionDialog.value || showMissionPicker.value || showMissionForm.value) return
    await ensureLinkedMissionLoaded()
    isChoiceMade = false
    showDecisionDialog.value = true
  }

  onMounted(() => {
    void openIfEligible()
  })

  watch(isCloudActive, (active, wasActive) => {
    if (active && !wasActive) void openIfEligible()
  })

  const onMissionSelected = (mission: BlueOsCloudMission): void => {
    isChoiceMade = true
    selectExistingMission(mission)
  }

  const onMissionFormSubmit = (payload: MissionFormSubmitPayload): void => {
    isChoiceMade = true
    createMission(payload)
  }

  return {
    showDecisionDialog,
    showMissionPicker,
    showMissionForm,
    previousMission,
    continuePreviousMission: onContinuePreviousMission,
    openMissionPicker,
    openCreateMissionForm,
    skipMission,
    dismissDecisionDialog,
    onMissionSelected,
    onMissionFormSubmit,
  }
}
