import { useInteractionDialog } from '@/composables/interactionDialog'
import { useGeoFenceStore } from '@/stores/geoFence'
import { useHazardStore } from '@/stores/hazards'
import { useMissionStore } from '@/stores/mission'

// A mission skirting a long shoreline can raise a finding per run, which is a list nobody reads.
const MAX_LISTED_ADVISORIES = 6

/**
 * The pre-flight gate a mission upload has to pass.
 */
export interface UseMissionPreflightChecksReturn {
  /**
   * Runs every pre-flight check against the planning mission and, when any of them has something to
   * say, asks the operator whether to upload anyway.
   */
  confirmMissionUpload: () => Promise<boolean>
}

/**
 * Collects the checks a mission has to pass before it is uploaded (geofence breaches and hazard
 * advisories) and presents whatever they found in a single confirmation, so the operator is not
 * asked the same question twice for one upload.
 * @returns {UseMissionPreflightChecksReturn} The confirmation gate to call before uploading.
 */
export const useMissionPreflightChecks = (): UseMissionPreflightChecksReturn => {
  const fenceStore = useGeoFenceStore()
  const hazardStore = useHazardStore()
  const missionStore = useMissionStore()
  const { showDialog, closeDialog } = useInteractionDialog()

  const confirmMissionUpload = async (): Promise<boolean> => {
    const waypoints = missionStore.currentPlanningWaypoints
    const fenceReport = fenceStore.detectMissionBreaches(waypoints)
    const home = missionStore.plannedHomePosition ?? missionStore.homeMarkerPosition
    const advisories = await hazardStore.checkMission(waypoints, home)
    if (!fenceReport.hasBreaches && advisories.length === 0) return true

    const message: string[] = []
    if (fenceReport.hasBreaches) {
      message.push(
        `${fenceReport.breachedIndices.length} of ${fenceReport.totalChecked} waypoints fall outside an inclusion ` +
          'fence or inside an exclusion fence. Uploading anyway may trigger an in-flight fence breach action ' +
          '(RTL / Land / Brake, depending on the autopilot configuration).'
      )
    }
    if (advisories.length > 0) {
      message.push(...advisories.slice(0, MAX_LISTED_ADVISORIES).map((advisory) => advisory.message))
      const hidden = advisories.length - MAX_LISTED_ADVISORIES
      if (hidden > 0) message.push(`And ${hidden} more, listed in the hazard advisories panel.`)
      message.push(
        'Hazard data comes from public, contributor-maintained databases and only covers the area it was loaded ' +
          'for, so it can be incomplete or out of date.'
      )
    }

    const title = fenceReport.hasBreaches
      ? advisories.length > 0
        ? 'Mission breaches the geofence and touches hazard areas'
        : 'Mission breaches geofence'
      : 'Mission touches hazard areas'

    let confirmed = false
    try {
      // Awaiting the dialog's own promise is what keeps Escape and backdrop
      // clicks from stranding the upload: those reject rather than press a button.
      await showDialog({
        variant: 'warning',
        title,
        message,
        persistent: false,
        maxWidth: '720px',
        actions: [
          {
            text: 'Back to mission planning',
            action: () => logUserAction('Cancelled the mission upload from the pre-flight warning'),
          },
          {
            text: 'Upload to vehicle anyway',
            class: 'bg-[#FFFFFF33]',
            action: () => {
              logUserAction('Uploaded the mission despite the pre-flight warning')
              confirmed = true
            },
          },
        ],
      })
    } catch {
      return false
    } finally {
      closeDialog()
    }
    return confirmed
  }

  return { confirmMissionUpload }
}
