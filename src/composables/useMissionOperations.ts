import { computed, ComputedRef } from 'vue'

import { type DialogOptions, type DialogResult } from '@/composables/interactionDialog'
import { type SnackbarOptions } from '@/composables/snackbar'
import { useMissionStore } from '@/stores/mission'
import { type CockpitMission, instanceOfCockpitMission } from '@/types/mission'

/**
 * View-owned functions the mission operations rely on, injected so the composable stays decoupled from
 * the consuming component's map and feedback plumbing.
 */
interface MissionOperationsDeps {
  /**
   * Loads a mission onto the planner map, replacing the current one.
   */
  loadDraftMission: (mission: CockpitMission) => Promise<void>
  /**
   * Shows an interaction dialog and resolves once the user confirms or dismisses it.
   */
  showDialog: (options: DialogOptions) => Promise<DialogResult>
  /**
   * Closes the currently open interaction dialog.
   */
  closeDialog: () => void
  /**
   * Opens a snackbar with the given options.
   */
  openSnackbar: (options: SnackbarOptions) => void
}

/**
 * Composable centralizing mission operations shared by the mission-planning surfaces, starting with
 * restoring the last uploaded mission for quick edits.
 * @param {MissionOperationsDeps} deps - View-owned map-loading, dialog and snackbar functions.
 * @returns {{ hasLastUploadedMission: ComputedRef<boolean>, restoreLastUploadedMission: () => void }}
 * Reactive state and helpers for mission operations.
 */
export const useMissionOperations = (
  deps: MissionOperationsDeps
): {
  /**
   * Whether a restorable last-uploaded mission snapshot is currently stored.
   */
  hasLastUploadedMission: ComputedRef<boolean>
  /**
   * Restores the last uploaded mission onto the planner, confirming first when a mission is in progress.
   */
  restoreLastUploadedMission: () => void
} => {
  const { loadDraftMission, showDialog, closeDialog, openSnackbar } = deps
  const missionStore = useMissionStore()

  const hasLastUploadedMission = computed(() => instanceOfCockpitMission(missionStore.lastUploadedMission))

  const restoreLastUploadedMission = (): void => {
    const mission = missionStore.lastUploadedMission
    if (!instanceOfCockpitMission(mission)) return

    const doRestore = (): void => {
      logUserAction('Restored the last uploaded mission')
      loadDraftMission(mission).catch((err) => {
        openSnackbar({ variant: 'error', message: `Failed to restore last uploaded mission: ${err}`, duration: 3500 })
      })
    }

    if (missionStore.currentPlanningWaypoints.length === 0) {
      doRestore()
      return
    }

    logUserAction('Opened the restore-last-uploaded-mission dialog')
    showDialog({
      variant: 'warning',
      title: 'Restore last uploaded mission',
      message: 'This will replace the current mission with the last one uploaded to the vehicle. Continue?',
      persistent: false,
      maxWidth: 620,
      actions: [
        { text: 'Cancel', color: 'white', action: closeDialog },
        {
          text: 'Restore',
          color: 'white',
          action: () => {
            closeDialog()
            doRestore()
          },
        },
      ],
    })
  }

  return { hasLastUploadedMission, restoreLastUploadedMission }
}
