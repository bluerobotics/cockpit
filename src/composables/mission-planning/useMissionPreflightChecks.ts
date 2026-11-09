import { t } from 'ttag'

import { useInteractionDialog } from '@/composables/interactionDialog'
import type { UseMissionFenceBreachesReturn } from '@/composables/map/useMissionFenceBreaches'
import { useSnackbar } from '@/composables/snackbar'
import { useMissionTerrain } from '@/composables/terrain/useMissionTerrain'
import { useFenceBreachAction } from '@/composables/useFenceBreachAction'
import type { MissionFenceBreachReports } from '@/libs/geo-fence'
import { type PreparedTerrainUpload, prepareTerrainUpload, terrainUploadMessages } from '@/libs/terrain/mission-terrain'
import { useHazardStore } from '@/stores/hazards'
import { useMissionStore } from '@/stores/mission'
import { useTerrainStore } from '@/stores/terrain'
import type { HazardAdvisory } from '@/types/hazards'
import type { Waypoint } from '@/types/mission'

// A mission skirting a long shoreline can raise a finding per run, which is a list nobody reads.
const MAX_LISTED_ADVISORIES = 6
// The check downloads elevation tiles, so on a slow link the operator would be left pressing Upload
// with nothing happening. Past this the upload is offered without it, saying so.
const HAZARD_CHECK_DEADLINE_MS = 10000

const uploadWarningTitle = (breaches: boolean, hazards: boolean, unchecked: boolean, terrain: boolean): string => {
  if (terrain && !breaches && !hazards && !unchecked) return 'Mission comes too close to the terrain'
  if (breaches && hazards) return 'Mission breaches the geofence and touches hazard areas'
  if (breaches)
    return unchecked ? 'Mission breaches geofence, and hazards were not checked' : 'Mission breaches geofence'
  if (hazards) return 'Mission touches hazard areas'
  return 'Mission was not checked against hazard data'
}

type UploadWarningFindings = MissionFenceBreachReports & {
  /**
   * Hazard advisories the check raised.
   */
  advisories: HazardAdvisory[]
  /**
   * Whether the hazard check could not finish in time.
   */
  unchecked: boolean
  /**
   * Terrain findings worth the operator's attention, as sentences.
   */
  terrain: string[]
  /**
   * What crossing the fence stored on the vehicle leads to.
   */
  consequence: string
}

const uploadWarningMessage = ({
  vehicle,
  draft,
  advisories,
  unchecked,
  terrain,
  consequence,
}: UploadWarningFindings): string[] => {
  const message: string[] = [...terrain]
  if (unchecked) {
    message.push(
      'The hazard check could not finish, so this mission has not been checked against hazard data. Loading ' +
        'that data needs an internet connection.'
    )
  }
  if (vehicle?.hasBreaches) {
    message.push(
      `${vehicle.breaches.length} of ${vehicle.totalChecked} waypoints breach the geofence stored ` +
        `on the vehicle. ${consequence}`
    )
  }
  if (draft?.hasBreaches) {
    message.push(
      `${draft.breaches.length} of ${draft.totalChecked} waypoints breach the geofence you are ` +
        'drawing, which has not been uploaded to the vehicle yet.'
    )
  }
  if (vehicle?.hasBreaches || draft?.hasBreaches) {
    message.push('The waypoints in question are marked red on the map, each with the reason on hover.')
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
  return message
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
 * What the pre-flight gate needs from the view it runs in.
 */
export interface UseMissionPreflightChecksOptions {
  /**
   * Geofence breach reports of the planning mission, with the helpers to refresh them and to show the breaches.
   */
  fenceBreaches: Pick<UseMissionFenceBreachesReturn, 'reports' | 'recheck' | 'focusBreaches'>
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
  /**
   * Prepares the terrain of the waypoints about to be uploaded, as the terrain settings ask, and says what changed.
   */
  prepareMissionUpload: (waypoints: Waypoint[]) => Promise<Waypoint[]>
}

/**
 * Collects the checks a mission has to pass before it is uploaded (geofence breaches and hazard
 * advisories) and presents whatever they found in a single confirmation, so the operator is not
 * asked the same question twice for one upload.
 * @param {UseMissionPreflightChecksOptions} options The view's geofence breach reports and helpers.
 * @returns {UseMissionPreflightChecksReturn} The confirmation gate to call before uploading.
 */
export const useMissionPreflightChecks = ({
  fenceBreaches,
}: UseMissionPreflightChecksOptions): UseMissionPreflightChecksReturn => {
  const hazardStore = useHazardStore()
  const missionStore = useMissionStore()
  const { confirmAction } = useInteractionDialog()
  const { outcome: breachOutcome } = useFenceBreachAction()
  const terrainStore = useTerrainStore()
  const missionTerrain = useMissionTerrain()
  const { openSnackbar } = useSnackbar()

  // Terrain findings join the confirmation; a check that could not finish (no internet, nothing stored) only says so,
  // since a prompt on every offline upload would teach the operator to dismiss it.
  const checkTerrain = async (): Promise<string[]> => {
    if (!terrainStore.settings.checkTerrainOnUpload) return []
    const work = missionTerrain
      .analyze()
      .then((analysis) => (analysis ? terrainUploadMessages(analysis, missionTerrain.context()) : []))
    const messages = await withDeadline(work, HAZARD_CHECK_DEADLINE_MS).catch((error) => {
      console.error('Terrain check failed before upload:', error)
      return undefined
    })
    if (messages === undefined) {
      openSnackbar({
        variant: 'info',
        message: t`The terrain check did not finish, so the mission was not checked against the terrain.`,
        duration: 5000,
      })
      return []
    }
    return messages
  }

  const confirmMissionUpload = async (): Promise<boolean> => {
    const waypoints = missionStore.currentPlanningWaypoints
    // The live check is debounced, so a waypoint moved a moment ago would still be judged by the
    // previous snapshot.
    fenceBreaches.recheck()
    const { vehicle, draft } = fenceBreaches.reports.value
    const hasBreaches = vehicle?.hasBreaches === true || draft?.hasBreaches === true
    const home = missionStore.plannedHomePosition ?? missionStore.homeMarkerPosition
    const [checked, terrain] = await Promise.all([
      withDeadline(hazardStore.checkMission(waypoints, home), HAZARD_CHECK_DEADLINE_MS),
      checkTerrain(),
    ])
    const advisories = checked ?? []
    if (!hasBreaches && checked?.length === 0 && terrain.length === 0) return true

    const message = uploadWarningMessage({
      vehicle,
      draft,
      advisories,
      unchecked: checked === undefined,
      terrain,
      consequence:
        breachOutcome.value ??
        'Uploading anyway may trigger the fence action the autopilot is configured with once the mission runs.',
    })
    const title = uploadWarningTitle(hasBreaches, advisories.length > 0, checked === undefined, terrain.length > 0)

    const confirmed = await confirmAction(
      title,
      message,
      'Upload to vehicle anyway',
      '720px',
      'Back to mission planning'
    )
    const outcome = confirmed ? 'Uploaded the mission despite' : 'Cancelled the mission upload from'
    logUserAction(`${outcome} the pre-flight warning`)
    if (!confirmed && hasBreaches) fenceBreaches.focusBreaches()
    return confirmed
  }

  const announcePreparedUpload = ({
    resolvedWaypoints,
    addedWaypoints,
    unresolvedWaypoints,
    aimedRois,
  }: PreparedTerrainUpload): void => {
    const changes = [
      resolvedWaypoints > 0 ? t`${resolvedWaypoints} terrain-following waypoints set above sea level` : '',
      addedWaypoints > 0 ? t`${addedWaypoints} waypoints added to hold the height over the ground` : '',
      aimedRois > 0 ? t`${aimedRois} camera targets aimed at the ground` : '',
    ].filter(Boolean)
    const changeList = changes.join(', ')
    const uploading = changes.length > 0 ? t`Uploading with ${changeList}.` : ''
    const unknown =
      unresolvedWaypoints > 0
        ? t`${unresolvedWaypoints} terrain-following waypoints were sent as planned, as the terrain under them is unknown.`
        : ''
    const message = [uploading, unknown].filter(Boolean).join(' ')
    if (message) openSnackbar({ variant: unknown ? 'warning' : 'info', message, duration: 6000 })
  }

  const prepareMissionUpload = async (waypoints: Waypoint[]): Promise<Waypoint[]> => {
    const { resolveTerrainOnUpload, aimRoiAtGround, terrainFollowToleranceM } = terrainStore.settings
    if (!resolveTerrainOnUpload && !aimRoiAtGround) return waypoints
    const work = prepareTerrainUpload(waypoints, missionTerrain.home.value, missionTerrain.context(), {
      resolveTerrain: resolveTerrainOnUpload,
      aimRois: aimRoiAtGround,
      toleranceM: terrainFollowToleranceM,
    })
    try {
      const prepared = await withDeadline(work, HAZARD_CHECK_DEADLINE_MS)
      if (!prepared) throw new Error(t`the terrain did not load in time`)
      announcePreparedUpload(prepared)
      return prepared.waypoints
    } catch (error) {
      const message = t`Could not read the terrain to prepare the upload, so the mission is sent as planned: ${error}`
      openSnackbar({ variant: 'warning', message, duration: 6000 })
      return waypoints
    }
  }

  return { confirmMissionUpload, prepareMissionUpload }
}
