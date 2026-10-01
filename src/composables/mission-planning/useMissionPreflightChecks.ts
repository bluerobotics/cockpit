import { useInteractionDialog } from '@/composables/interactionDialog'
import { useGeoFenceStore } from '@/stores/geoFence'
import { useHazardStore } from '@/stores/hazards'
import { useMissionStore } from '@/stores/mission'

// A mission skirting a long shoreline can raise a finding per run, which is a list nobody reads.
const MAX_LISTED_ADVISORIES = 6
// The check downloads elevation tiles, so on a slow link the operator would be left pressing Upload
// with nothing happening. Past this the upload is offered without it, saying so.
const HAZARD_CHECK_DEADLINE_MS = 10000

const uploadWarningTitle = (breaches: boolean, hazards: boolean, unchecked: boolean): string => {
  if (breaches && hazards) return 'Mission breaches the geofence and touches hazard areas'
  if (breaches)
    return unchecked ? 'Mission breaches geofence, and hazards were not checked' : 'Mission breaches geofence'
  if (hazards) return 'Mission touches hazard areas'
  return 'Mission was not checked against hazard data'
}

const withDeadline = async <T>(work: Promise<T>, ms: number): Promise<T | undefined> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), ms)
  })
  try {
    return await Promise.race([work, deadline])
  } finally {
    clearTimeout(timer)
  }
}

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
  const { confirmAction } = useInteractionDialog()

  const confirmMissionUpload = async (): Promise<boolean> => {
    const waypoints = missionStore.currentPlanningWaypoints
    const fenceReport = fenceStore.detectMissionBreaches(waypoints)
    const home = missionStore.plannedHomePosition ?? missionStore.homeMarkerPosition
    const checked = await withDeadline(hazardStore.checkMission(waypoints, home), HAZARD_CHECK_DEADLINE_MS)
    const advisories = checked ?? []
    if (!fenceReport.hasBreaches && checked?.length === 0) return true

    const message: string[] = []
    if (checked === undefined) {
      message.push(
        'The hazard check could not finish, so this mission has not been checked against hazard data. Loading ' +
          'that data needs an internet connection.'
      )
    }
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

    const title = uploadWarningTitle(fenceReport.hasBreaches, advisories.length > 0, checked === undefined)

    const confirmed = await confirmAction(
      title,
      message,
      'Upload to vehicle anyway',
      '720px',
      'Back to mission planning'
    )
    const outcome = confirmed ? 'Uploaded the mission despite' : 'Cancelled the mission upload from'
    logUserAction(`${outcome} the pre-flight warning`)
    return confirmed
  }

  return { confirmMissionUpload }
}
