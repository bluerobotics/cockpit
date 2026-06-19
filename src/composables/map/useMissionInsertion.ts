import { v4 as uuid } from 'uuid'
import { type Ref, ref } from 'vue'

import { openSnackbar } from '@/composables/snackbar'
import { useMissionStore } from '@/stores/mission'
import type { CockpitMission, MissionCommand, Survey, Waypoint, WaypointCoordinates } from '@/types/mission'

/**
 * View-side hooks {@link useMissionInsertion} needs to render and load the merged mission. Kept as
 * callbacks so the composable stays free of leaflet and of the host view's rendering internals.
 */
export type UseMissionInsertionOptions = {
  /**
   * Clones a waypoint's commands (falling back to the planner's default nav commands when empty).
   */
  cloneCommands: (commands?: MissionCommand[]) => MissionCommand[]
  /**
   * Draws a single waypoint marker on the host map.
   */
  addWaypointMarker: (waypoint: Waypoint) => void
  /**
   * Refreshes all waypoint markers (endpoint visuals, indices) after a batch change.
   */
  updateWaypointMarkers: () => void
  /**
   * Loads a mission as a fresh draft, optionally preserving the current map view.
   */
  loadDraftMission: (
    mission: CockpitMission,
    options?: {
      /** Keep the host map's current center/zoom instead of restoring the saved-mission settings. */
      preserveMapView?: boolean
    }
  ) => Promise<void>
}

/**
 * Owns merging a chosen library mission into the current planning: append at the end, insert into a
 * specific segment, or load fresh when the planning is empty. Undo snapshots, marker refreshes and
 * user feedback are handled here so the host view only wires rendering callbacks and the confirm hook.
 * @param {UseMissionInsertionOptions} options - View-side rendering and loading callbacks.
 * @returns {object} The insert-segment intent ref and the placement finalizer.
 */
export const useMissionInsertion = (
  options: UseMissionInsertionOptions
): {
  /**
   * Segment index a placed mission should be spliced into, or null for append/fresh-load. Set by the
   * host before placement so either placement outcome routes to the requested segment.
   */
  insertSegmentIndex: Ref<number | null>
  /**
   * Routes a placed mission to the right outcome: segment insert, append, or fresh load.
   */
  finalizeMissionPlacement: (mission: CockpitMission) => void
} => {
  const missionStore = useMissionStore()

  const insertSegmentIndex = ref<number | null>(null)

  // Reuses the same fresh id for matching per-survey waypoint copies — survey edit mode relies
  // on those ids matching the top-level waypoints, otherwise an orphan survey path is rendered.
  // (A plain record is used because `Map` is shadowed by Leaflet's `L.Map` import in the host.)
  const cloneMissionForPlanning = (
    mission: CockpitMission
  ): {
    /**
     * Top-level waypoints with fresh ids.
     */
    newWaypoints: Waypoint[]
    /**
     * Surveys with fresh ids; their internal waypoints reuse the top-level fresh ids.
     */
    newSurveys: Survey[]
  } => {
    const oldToNewWaypointId: Record<string, string> = {}
    const newWaypoints: Waypoint[] = (mission.waypoints ?? []).map((wp) => {
      const newId = uuid()
      oldToNewWaypointId[wp.id] = newId
      return {
        id: newId,
        coordinates: [wp.coordinates[0], wp.coordinates[1]],
        altitude: wp.altitude,
        altitudeReferenceType: wp.altitudeReferenceType,
        commands: options.cloneCommands(wp.commands),
      }
    })
    const newSurveys: Survey[] = (mission.surveys ?? []).map((survey) => ({
      ...survey,
      id: uuid(),
      polygonCoordinates: survey.polygonCoordinates.map((c) => [c[0], c[1]] as WaypointCoordinates),
      waypoints: survey.waypoints.map((wp) => ({
        ...wp,
        id: oldToNewWaypointId[wp.id] ?? uuid(),
        coordinates: [wp.coordinates[0], wp.coordinates[1]],
        commands: options.cloneCommands(wp.commands),
      })),
    }))
    return { newWaypoints, newSurveys }
  }

  const appendMissionToPlanning = (mission: CockpitMission): void => {
    if (!mission.waypoints?.length && !mission.surveys?.length) {
      openSnackbar({ variant: 'error', message: 'Mission has nothing to add.', duration: 2500 })
      return
    }

    missionStore.pushUndoSnapshot()

    const { newWaypoints, newSurveys } = cloneMissionForPlanning(mission)

    if (newWaypoints.length) {
      missionStore.currentPlanningWaypoints.push(...newWaypoints)
      newWaypoints.forEach((wp) => options.addWaypointMarker(wp))
      options.updateWaypointMarkers()
    }
    newSurveys.forEach((survey) => missionStore.currentPlanningSurveys.push(survey))

    openSnackbar({ variant: 'success', message: 'Mission added to current planning.', duration: 2000 })
  }

  // Splices the mission at `segmentIndex + 1` so it sits between waypoint `segmentIndex` and
  // waypoint `segmentIndex + 1`.
  const insertMissionIntoSegment = (mission: CockpitMission, segmentIndex: number): void => {
    const planning = missionStore.currentPlanningWaypoints
    if (segmentIndex < 0 || segmentIndex >= planning.length - 1) {
      openSnackbar({ variant: 'error', message: 'Cannot insert mission: invalid segment.', duration: 2500 })
      return
    }
    if (!mission.waypoints?.length) {
      openSnackbar({ variant: 'error', message: 'Mission has no waypoints to insert.', duration: 2500 })
      return
    }

    missionStore.pushUndoSnapshot()

    const { newWaypoints, newSurveys } = cloneMissionForPlanning(mission)

    missionStore.currentPlanningWaypoints.splice(segmentIndex + 1, 0, ...newWaypoints)
    newWaypoints.forEach((wp) => options.addWaypointMarker(wp))
    options.updateWaypointMarkers()

    newSurveys.forEach((survey) => missionStore.currentPlanningSurveys.push(survey))

    openSnackbar({
      variant: 'success',
      message: `Mission inserted between waypoints ${segmentIndex + 1} and ${segmentIndex + 2}.`,
      duration: 2500,
    })
  }

  // Routes a placed library mission to the right outcome: segment insert when triggered from a
  // segment radial menu, append when the planner already has content, or fresh load when empty.
  const finalizeMissionPlacement = (mission: CockpitMission): void => {
    const segmentIndex = insertSegmentIndex.value
    insertSegmentIndex.value = null
    if (segmentIndex !== null) {
      insertMissionIntoSegment(mission, segmentIndex)
      return
    }

    const hasExistingPlanning =
      missionStore.currentPlanningWaypoints.length > 0 || missionStore.currentPlanningSurveys.length > 0
    if (hasExistingPlanning) {
      appendMissionToPlanning(mission)
    } else {
      // Keep the user's current viewport — the mission was just positioned at the chosen spot, so
      // restoring the saved-mission's center/zoom would yank the camera away.
      options.loadDraftMission(mission, { preserveMapView: true }).catch((err) => {
        openSnackbar({ variant: 'error', message: `Failed to load mission: ${err}`, duration: 3500 })
      })
    }
  }

  return {
    insertSegmentIndex,
    finalizeMissionPlacement,
  }
}
