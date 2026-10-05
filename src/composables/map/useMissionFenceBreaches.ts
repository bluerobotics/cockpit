import { watchDebounced } from '@vueuse/core'
import { type ComputedRef, type Ref, type ShallowRef, computed, onBeforeUnmount, ref, watch } from 'vue'

import { closeSnackbar, openSnackbar } from '@/composables/snackbar'
import type { BreachReason, MissionBreachReport, MissionFenceBreachReports } from '@/libs/geo-fence'
import type { CockpitMap } from '@/libs/map/cesium-map'
import { fitMapToWaypoints, isMapReady } from '@/libs/map/utils-map'
import { useGeoFenceStore } from '@/stores/geoFence'
import type { Waypoint, WaypointCoordinates } from '@/types/mission'

// Both the fence shapes and the waypoints move under a drag, so the check only runs once the
// operator settles rather than on every pointer frame.
const RECHECK_DEBOUNCE_MS = 250

const reasonText: Record<BreachReason, string> = {
  'outside-inclusion': 'outside the inclusion area of',
  'inside-exclusion': 'inside an exclusion area of',
}

/**
 * Reactive inputs driving the breach check.
 */
export interface UseMissionFenceBreachesOptions {
  /** Waypoints to check, in order; typically the mission being planned. */
  waypoints: () => Waypoint[]
  /** Re-renders the caller's waypoint markers, so the breaching ones repaint when the verdict changes. */
  refreshMarkers: () => void
}

/**
 * Handles exposed by the breach composable.
 */
export interface UseMissionFenceBreachesReturn {
  /** Latest breach report per fence, for surfaces that name the fence a breach belongs to. */
  reports: Ref<MissionFenceBreachReports>
  /** How many distinct waypoints breach at least one of the fences. */
  breachedCount: ComputedRef<number>
  /** What is wrong with a waypoint, as a sentence per fence it breaches, or `''` when it breaches none. */
  breachTitleFor: (waypointId: string) => string
  /** Re-runs the check now, for callers that must not act on the debounced snapshot. */
  recheck: () => void
  /** Fits the map around the breaching waypoints, so the operator can see which ones to move. */
  focusBreaches: () => void
}

/**
 * Keeps a mission checked against the geofences that apply to it, telling the caller which
 * waypoints breach which fence and why, and warning the operator while any of them does.
 * @param {ShallowRef<CockpitMap | undefined>} map - The map the breaching waypoints are framed on.
 * @param {UseMissionFenceBreachesOptions} options - The waypoints to check and the marker refresher.
 * @returns {UseMissionFenceBreachesReturn} The reports, the breach count, the per-waypoint reason and the helpers.
 */
export const useMissionFenceBreaches = (
  map: ShallowRef<CockpitMap | undefined>,
  options: UseMissionFenceBreachesOptions
): UseMissionFenceBreachesReturn => {
  const fenceStore = useGeoFenceStore()
  const reports = ref<MissionFenceBreachReports>({})

  // Keyed by waypoint id rather than index, since the markers are, and an index shifts the moment a
  // waypoint is inserted ahead of it.
  const reasonsById = computed<Record<string, string[]>>(() => {
    const waypoints = options.waypoints()
    const reasons: Record<string, string[]> = {}
    const collect = (report: MissionBreachReport | undefined, fence: string): void => {
      report?.breaches.forEach(({ index, reason }) => {
        const waypoint = waypoints[index]
        if (!waypoint) return
        reasons[waypoint.id] = [...(reasons[waypoint.id] ?? []), `This waypoint is ${reasonText[reason]} ${fence}.`]
      })
    }
    collect(reports.value.vehicle, 'the geofence stored on the vehicle')
    collect(reports.value.draft, 'the geofence you are drawing')
    return reasons
  })

  const breachedCount = computed<number>(() => Object.keys(reasonsById.value).length)

  // What the operator can actually see of the verdict, so a re-check that changes nothing visible
  // does not repaint every marker.
  const breachSignature = computed<string>(() =>
    Object.entries(reasonsById.value)
      .map(([id, reasons]) => `${id}:${reasons.join('')}`)
      .sort()
      .join('|')
  )

  const breachTitleFor = (waypointId: string): string => (reasonsById.value[waypointId] ?? []).join('\n')

  const breachedCoordinates = (): WaypointCoordinates[] =>
    options
      .waypoints()
      .filter((waypoint) => reasonsById.value[waypoint.id] !== undefined)
      .map((waypoint) => waypoint.coordinates)

  // Every entry point is a button the operator pressed (the warning, the dialog, the checklist row),
  // so the log sits here rather than once per caller.
  const focusBreaches = (): void => {
    logUserAction('Focused the map on the waypoints breaching the geofence')
    const coordinates = breachedCoordinates()
    if (!isMapReady(map.value)) return
    fitMapToWaypoints(map.value, coordinates, { padding: 80, maxZoom: 18 })
  }

  const recheck = (): void => {
    reports.value = fenceStore.detectMissionBreaches(options.waypoints())
  }

  // The warning outlives any timeout, since a mission that breaches a fence stays wrong until the
  // operator moves a waypoint. Only a change in how many breach re-announces it, so a verdict that
  // merely gets re-checked never pushes a second one or reopens a dismissed one.
  let warningId: number | undefined = undefined
  let announcedCount = 0
  const announce = (count: number): void => {
    if (count === announcedCount) return
    if (warningId !== undefined) closeSnackbar(warningId)
    warningId = undefined
    announcedCount = count
    if (count === 0) return
    const subject = count === 1 ? 'waypoint breaches' : 'waypoints breach'
    warningId = openSnackbar({
      variant: 'warning',
      message: `${count} mission ${subject} the geofence. They are marked red on the map.`,
      persistent: true,
      action: { label: 'Show', handler: focusBreaches },
    })
  }

  watchDebounced(
    [
      () => options.waypoints().map((waypoint) => waypoint.coordinates.slice()),
      () => fenceStore.polygons,
      () => fenceStore.circles,
      () => fenceStore.lastUploadedPlan,
    ],
    recheck,
    { deep: true, immediate: true, debounce: RECHECK_DEBOUNCE_MS }
  )

  watch(breachSignature, () => {
    options.refreshMarkers()
    announce(breachedCount.value)
  })

  onBeforeUnmount(() => {
    if (warningId !== undefined) closeSnackbar(warningId)
    warningId = undefined
  })

  return { reports, breachedCount, breachTitleFor, recheck, focusBreaches }
}
