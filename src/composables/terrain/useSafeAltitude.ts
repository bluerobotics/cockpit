import { msgid, ngettext, t } from 'ttag'
import { type ComputedRef, type Ref, computed, ref, watch } from 'vue'

import { openSnackbar } from '@/composables/snackbar'
import { type MissionTerrainAnalysis, terrainFindingRank } from '@/libs/terrain/mission-terrain'
import { raiseToSafeAltitude, safeAltitudeRaisesM } from '@/libs/terrain/safe-altitude'
import { useMissionStore } from '@/stores/mission'
import { useTerrainStore } from '@/stores/terrain'
import type { Waypoint } from '@/types/mission'

import type { UseMissionTerrainReturn } from './useMissionTerrain'

/**
 * Raising the planning mission's waypoints to a safe height over the terrain, on demand or after every change.
 */
export interface UseSafeAltitudeReturn {
  /**
   * Whether every change to the mission re-settles the waypoints at a safe height, for this planning session only.
   */
  keepSafe: Ref<boolean>
  /**
   * Clearance kept over the terrain: the safety margin plus the terrain model's error, in meters.
   */
  targetM: ComputedRef<number>
  /**
   * Whether raising some waypoint would bring the mission closer to that clearance.
   */
  needsRaise: ComputedRef<boolean>
  /**
   * Whether a raise asked for by hand is running.
   */
  raising: Ref<boolean>
  /**
   * Whether waypoint heights are being worked out, by hand or after a change.
   */
  recalculating: ComputedRef<boolean>
  /**
   * What the last raise did, for the panel.
   */
  note: Ref<string>
  /**
   * Whether the altitudes from before the last raise by hand can still be put back.
   */
  canRestore: ComputedRef<boolean>
  /**
   * Raises the waypoints once, by hand.
   */
  raise: () => Promise<void>
  /**
   * Puts back the altitudes from before the last raise by hand.
   */
  restore: () => void
}

/**
 * An altitude a raise wrote over a waypoint's planned one.
 */
interface WrittenAltitude {
  /**
   * Altitude the raise wrote.
   */
  altitude: number
  /**
   * Altitude the waypoint was planned at.
   */
  plannedM: number
}

const altitudeSignature = (waypoints: Waypoint[]): string =>
  waypoints.map(({ id, altitude }) => `${id}:${altitude}`).join()

const stillTooClose = (analysis: MissionTerrainAnalysis | null): string => {
  const remaining = analysis
    ? analysis.profile.findings.filter(({ kind }) => terrainFindingRank(kind) <= 1).length +
      analysis.returnFindings.length
    : 0
  return remaining > 0
    ? ` ${ngettext(
        msgid`${remaining} stretch still too close; see the findings.`,
        `${remaining} stretches still too close; see the findings.`,
        remaining
      )}`
    : ''
}

/**
 * Raises the planning mission's waypoints to a safe height over the terrain. Only the mission's waypoints
 * change: a survey keeps its planned altitude, which is what it rebuilds its waypoints at when reshaped.
 * @param {UseMissionTerrainReturn} terrain The live mission terrain check.
 * @param {Ref<boolean>} keepSafe Whether to re-settle after every change; the live check must run while it is true.
 * @returns {UseSafeAltitudeReturn} The raise state and actions.
 */
export const useSafeAltitude = (terrain: UseMissionTerrainReturn, keepSafe: Ref<boolean>): UseSafeAltitudeReturn => {
  const missionStore = useMissionStore()
  const terrainStore = useTerrainStore()
  const raising = ref(false)
  const note = ref('')
  const previousAltitudes = ref<number[] | null>(null)
  const raisedSignature = ref('')

  const targetM = computed(
    () => terrainStore.settings.minimumClearanceM + terrainStore.effectiveSource.verticalUncertaintyM
  )

  const needsRaise = computed(() => {
    const analysis = terrain.analysis.value
    if (!analysis || terrain.vehicleClass.value !== 'air') return false
    return safeAltitudeRaisesM(analysis, targetM.value).some((raiseM) => raiseM > 0)
  })

  const canRestore = computed(
    () =>
      !keepSafe.value &&
      previousAltitudes.value !== null &&
      altitudeSignature(missionStore.currentPlanningWaypoints) === raisedSignature.value
  )

  // What the raises wrote, by waypoint id, so a later pass tells its own raise from an edit and starts over
  // from the altitude the waypoint was planned at.
  // ponytail: entries of deleted waypoints stay until the planning view is left; prune by live id if it matters.
  const written = new Map<string, WrittenAltitude>()

  const plannedAltitude = (waypoint: Waypoint): number => {
    const record = written.get(waypoint.id)
    return record?.altitude === waypoint.altitude ? record.plannedM : waypoint.altitude
  }

  const writeAltitudes = (altitudes: number[]): void => {
    missionStore.currentPlanningWaypoints.forEach((waypoint, index) => {
      const plannedM = plannedAltitude(waypoint)
      waypoint.altitude = altitudes[index]
      if (altitudes[index] === plannedM) written.delete(waypoint.id)
      else written.set(waypoint.id, { altitude: altitudes[index], plannedM })
    })
    raisedSignature.value = altitudeSignature(missionStore.currentPlanningWaypoints)
  }

  const pathSignature = (): string => JSON.stringify(terrain.points())

  const raise = async (): Promise<void> => {
    logUserAction('Raised the mission waypoints to a safe height over the terrain')
    raising.value = true
    try {
      const analysis = terrain.analysis.value
      const path = pathSignature()
      // A check behind the mission, or a mission changed while raising, would put the raises on the wrong waypoints.
      if (!analysis || JSON.stringify(analysis.points) !== path) throw new Error(t`the terrain check is still running`)
      const result = await raiseToSafeAltitude(analysis, targetM.value, terrain.analyze)
      if (pathSignature() !== path) throw new Error(t`the mission changed while it was being checked, try again`)
      const raisedCount = result.raisesM.filter((raiseM) => raiseM > 0).length
      if (raisedCount === 0) {
        openSnackbar({
          variant: 'info',
          message: t`Raising the waypoints cannot clear what is left, which is all in the climb out of home.`,
          duration: 5000,
        })
        return
      }
      const current = missionStore.currentPlanningWaypoints.map(({ altitude }) => altitude)
      previousAltitudes.value = current
      missionStore.pushUndoSnapshot('terrain')
      writeAltitudes(current.map((altitude, index) => altitude + (result.raisesM[index] ?? 0)))
      const mostM = Math.max(...result.raisesM)
      const raised = ngettext(
        msgid`Raised ${raisedCount} waypoint by up to ${mostM} m.`,
        `Raised ${raisedCount} waypoints by up to ${mostM} m.`,
        raisedCount
      )
      note.value = `${raised}${stillTooClose(result.analysis)}`
      openSnackbar({ variant: 'success', message: note.value, duration: 3000 })
    } catch (error) {
      openSnackbar({ variant: 'error', message: t`Could not raise the waypoints: ${error}`, duration: 5000 })
    } finally {
      raising.value = false
    }
  }

  const restore = (): void => {
    const previous = previousAltitudes.value
    if (!previous) return
    logUserAction('Restored the waypoint altitudes from before raising them to a safe height')
    missionStore.pushUndoSnapshot('terrain')
    writeAltitudes(previous)
    previousAltitudes.value = null
    openSnackbar({ variant: 'success', message: t`Waypoint altitudes restored.`, duration: 2000 })
  }

  // Each pass starts over from the planned altitudes, so a waypoint the terrain no longer needs raised (a
  // survey rotated off a hill) comes back down, never below what was planned.
  const settle = async (): Promise<string | null> => {
    const waypoints = missionStore.currentPlanningWaypoints
    const path = pathSignature()
    const planned = waypoints.map(plannedAltitude)
    const plannedPoints = terrain
      .points()
      .map((point) => (point.waypointIndex === null ? point : { ...point, altitude: planned[point.waypointIndex] }))
    const plannedAnalysis = await terrain.analyze(plannedPoints)
    if (!plannedAnalysis || pathSignature() !== path) return null
    const result = await raiseToSafeAltitude(plannedAnalysis, targetM.value, terrain.analyze)
    if (pathSignature() !== path || !keepSafe.value) return null
    const altitudes = planned.map((plannedM, index) => plannedM + (result.raisesM[index] ?? 0))
    const raisedCount = altitudes.filter((altitude, index) => altitude > waypoints[index].altitude).length
    const loweredCount = altitudes.filter((altitude, index) => altitude < waypoints[index].altitude).length
    if (raisedCount + loweredCount === 0) return ''
    writeAltitudes(altitudes)
    const raised = ngettext(msgid`${raisedCount} waypoint`, `${raisedCount} waypoints`, raisedCount)
    const lowered = ngettext(msgid`${loweredCount} waypoint`, `${loweredCount} waypoints`, loweredCount)
    const changes =
      raisedCount === 0
        ? t`Kept a safe height: lowered ${lowered}.`
        : loweredCount === 0
        ? t`Kept a safe height: raised ${raised}.`
        : t`Kept a safe height: raised ${raised} and lowered ${lowered}.`
    return `${changes}${stillTooClose(result.analysis)}`
  }

  // The re-check of a path this just wrote would only repeat the same answer, so it is skipped once.
  let ownWritePath = ''
  const settling = ref(false)
  // A run asked for while one is going, null for none, true when it was forced.
  let pendingRun: boolean | null = null
  // Also settled when no waypoint carries a raise and an up-to-date check asks for none.
  const alreadySettled = (path: string): boolean =>
    JSON.stringify(terrain.analysis.value?.points) === path &&
    !needsRaise.value &&
    missionStore.currentPlanningWaypoints.every((waypoint) => plannedAltitude(waypoint) === waypoint.altitude)
  const nothingToSettle = (): boolean => {
    if (!terrain.analysis.value) return true
    const path = pathSignature()
    if (path !== ownWritePath) return alreadySettled(path)
    ownWritePath = ''
    return true
  }
  // Null when the mission changed under the run, which the next check picks up.
  const reportSettle = (message: string | null, forced: boolean): void => {
    if (message === null) return
    if (message) {
      ownWritePath = pathSignature()
      previousAltitudes.value = null
    }
    const shown = message || (forced ? t`Every waypoint already keeps a safe height.` : '')
    if (!shown) return
    note.value = shown
    openSnackbar({ variant: 'info', message: shown, duration: 2000 })
  }
  // Forced when the switch is turned on, which always recalculates and always says what it found.
  const autoSettle = async (forced = false): Promise<void> => {
    if (!keepSafe.value || terrain.vehicleClass.value !== 'air') return
    if (!forced && nothingToSettle()) return
    if (settling.value) {
      pendingRun = pendingRun === true || forced
      return
    }
    settling.value = true
    try {
      reportSettle(await settle(), forced)
    } catch (error) {
      openSnackbar({ variant: 'error', message: t`Could not keep a safe height: ${error}`, duration: 5000 })
    } finally {
      settling.value = false
      const pending = pendingRun
      pendingRun = null
      if (pending !== null) void autoSettle(pending)
    }
  }
  watch(terrain.analysis, () => void autoSettle())
  watch(keepSafe, (on) => on && void autoSettle(true))
  watch(
    () => missionStore.currentPlanningWaypoints.length === 0,
    (cleared) => {
      if (!cleared) return
      note.value = ''
      previousAltitudes.value = null
    }
  )

  const recalculating = computed(() => raising.value || settling.value)

  return { keepSafe, targetM, needsRaise, raising, recalculating, note, canRestore, raise, restore }
}
