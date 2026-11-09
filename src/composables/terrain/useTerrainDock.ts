import { refThrottled } from '@vueuse/core'
import { type InjectionKey, type Ref, computed, inject, provide, ref, watch } from 'vue'

import { useMapContext } from '@/composables/map/useMapContext'
import { type TerrainMapStretch, useTerrainMapOverlay } from '@/composables/map/useTerrainMapOverlay'
import { bboxMaxSpanDegrees, MAX_HAZARD_BBOX_DEG, paddedBbox } from '@/libs/hazards/hazard-areas'
import type { TerrainFindingKind, TerrainProfileSample } from '@/libs/terrain/mission-profile'
import { followPathCorners } from '@/libs/terrain/mission-profile'
import {
  climbFindingMessage,
  OTHER_FINDING_RANK,
  profileStretch,
  RETURN_FINDING_RANK,
  returnFindingMessage,
  terrainFindingMessage,
  terrainFindingRank,
  terrainFindingSeverity,
} from '@/libs/terrain/mission-terrain'
import { sampleAtFraction } from '@/libs/terrain/profile-chart'
import type { TerrainTileBounds } from '@/libs/terrain/tiles'
import { useHazardStore } from '@/stores/hazards'
import { useMissionStore } from '@/stores/mission'
import type { GeoBbox } from '@/types/general'
import type { WaypointCoordinates } from '@/types/mission'

import { type UseMissionTerrainReturn, useMissionTerrain } from './useMissionTerrain'
import { type UseSafeAltitudeReturn, useSafeAltitude } from './useSafeAltitude'

/**
 * A finding as the dock lists it.
 */
export interface TerrainDockFinding {
  /**
   * Stable key for the list.
   */
  key: string
  /**
   * Sentence shown.
   */
  message: string
  /**
   * Marker and stretch color.
   */
  color: string
  /**
   * Icon shown, or {@link TERRAIN_WARNING_ICON} for the warning triangle.
   */
  icon: string
  /**
   * Start, meters along the mission.
   */
  fromM: number
  /**
   * End, meters along the mission.
   */
  toM: number
  /**
   * How urgent it is, 0 the most; the list reads in this order.
   */
  rank: number
}

/**
 * State the terrain dock shares with its panels.
 */
export interface TerrainDockState {
  /**
   * The live mission terrain check.
   */
  terrain: UseMissionTerrainReturn
  /**
   * Whether the dock is open; the live check only runs while it is, or while a safe height is kept.
   */
  open: Ref<boolean>
  /**
   * Raising the waypoints to a safe height over the terrain.
   */
  safeAltitude: UseSafeAltitudeReturn
  /**
   * Every finding, terrain, return and climb, most urgent first and then in mission order.
   */
  findings: Ref<TerrainDockFinding[]>
  /**
   * Distance of the ghost run's vehicle along the mission, null when not running.
   */
  ghostDistanceM: Ref<number | null>
  /**
   * The ghost run's vehicle station.
   */
  ghostSample: Ref<TerrainProfileSample | undefined>
  /**
   * Profile station the chart is hovering.
   */
  hover: Ref<TerrainProfileSample | null>
  /**
   * Fits the map to some positions.
   */
  focus: (positions: WaypointCoordinates[]) => void
  /**
   * Area the map shows, null before it is created.
   */
  visibleBounds: () => TerrainTileBounds | null
  /**
   * Moves a waypoint up or down by some meters, whatever its altitude is measured from.
   */
  setWaypointHeight: (waypointIndex: number, changeM: number) => void
  /**
   * Whether the model reads land along the mission where no coastline map is loaded to tell it from shallow water.
   */
  coastlineMissing: Ref<boolean>
  /**
   * Whether the coastline map is loading.
   */
  loadingCoastline: Ref<boolean>
  /**
   * Loads the coastline map over the mission, keeping the area already loaded when it fits in one load.
   */
  loadMissionCoastline: () => void
}

const terrainDockKey: InjectionKey<TerrainDockState> = Symbol('terrain-dock')

const SEVERITY_COLORS = { danger: '#FF5252', warning: '#FF8800', info: '#FFD54F' } as const

/**
 * Icon of the findings where the vehicle hits the terrain, drawn as the triangle the chart marks shallows with.
 */
export const TERRAIN_WARNING_ICON = 'terrain-warning-triangle'

const TERRAIN_FINDING_ICONS: Partial<Record<TerrainFindingKind, string>> = {
  'collision': TERRAIN_WARNING_ICON,
  'reaches-coastline': 'mdi-map-marker-alert-outline',
}
const COASTLINE_MARGIN_M = 500

const bboxUnion = (a: GeoBbox, b: GeoBbox): GeoBbox => ({
  south: Math.min(a.south, b.south),
  west: Math.min(a.west, b.west),
  north: Math.max(a.north, b.north),
  east: Math.max(a.east, b.east),
})

/**
 * Creates the terrain dock's shared state, its map drawing included, and provides it to the dock's panels.
 * @returns {TerrainDockState} The state.
 */
export const provideTerrainDock = (): TerrainDockState => {
  const missionStore = useMissionStore()
  const hazardStore = useHazardStore()
  const { map } = useMapContext()
  const open = ref(false)
  const keepSafe = ref(false)
  const terrain = useMissionTerrain(
    computed(() => open.value || keepSafe.value),
    true
  )
  const safeAltitude = useSafeAltitude(terrain, keepSafe)
  const ghostDistanceM = ref<number | null>(null)
  const hover = ref<TerrainProfileSample | null>(null)

  const findings = computed<TerrainDockFinding[]>(() => {
    const analysis = terrain.analysis.value
    if (!analysis) return []
    const context = terrain.context()
    const { points, profile, returnFindings, climbFindings } = analysis
    return [
      ...profile.findings.map((finding, index) => ({
        key: `terrain-${index}`,
        message: terrainFindingMessage(finding, points, context),
        color: SEVERITY_COLORS[terrainFindingSeverity(finding.kind)],
        icon: TERRAIN_FINDING_ICONS[finding.kind] ?? 'mdi-image-filter-hdr',
        fromM: finding.fromM,
        toM: finding.toM,
        rank: terrainFindingRank(finding.kind),
      })),
      ...returnFindings.map((finding, index) => ({
        key: `return-${index}`,
        message: returnFindingMessage(finding, points, context),
        color: SEVERITY_COLORS.warning,
        icon: 'mdi-home-import-outline',
        fromM: finding.fromM,
        toM: finding.toM,
        rank: RETURN_FINDING_RANK,
      })),
      ...climbFindings.map((finding, index) => ({
        key: `climb-${index}`,
        message: climbFindingMessage(finding, points),
        color: finding.kind === 'slows-to-climb' ? SEVERITY_COLORS.info : SEVERITY_COLORS.warning,
        icon: 'mdi-chart-line-variant',
        fromM: finding.fromM,
        toM: finding.toM,
        rank: OTHER_FINDING_RANK,
      })),
    ].sort((a, b) => a.rank - b.rank || a.fromM - b.fromM)
  })

  const stretches = computed<TerrainMapStretch[]>(() => {
    const checked = terrain.analysis.value?.profile.samples ?? []
    if (!open.value || checked.length === 0) return []
    // Moves with a waypoint being dragged, which the re-check only catches up with once it is dropped.
    const samples = followPathCorners(
      checked,
      terrain.points().map(({ coordinates }) => coordinates)
    )
    // Drawn least urgent first, so where two findings share a stretch the more urgent line is on top.
    return [...findings.value].reverse().map(({ fromM, toM, color, message }) => ({
      path: profileStretch(samples, fromM, toM),
      color,
      message,
    }))
  })

  const ghostSample = computed(() => {
    const samples = terrain.analysis.value?.profile.samples ?? []
    const distance = ghostDistanceM.value
    if (distance === null || samples.length === 0) return undefined
    return sampleAtFraction(samples, distance / (samples.at(-1)?.distanceM || 1))
  })

  const overlay = useTerrainMapOverlay(map, {
    // Each change redraws every finding line, which a waypoint drag would otherwise do at pointer rate.
    stretches: refThrottled(stretches, 100),
    hover: computed(() => (open.value ? hover.value?.coordinates ?? null : null)),
    ghost: computed(() => (open.value ? ghostSample.value?.coordinates ?? null : null)),
  })

  // Arrow-key steps on one waypoint in quick succession undo together, so a few presses keep the terrain history.
  let lastHeightEdit = { id: '', altitude: NaN, atMs: 0 }
  const setWaypointHeight = (waypointIndex: number, changeM: number): void => {
    const waypoint = missionStore.currentPlanningWaypoints[waypointIndex]
    if (!waypoint || changeM === 0) return
    const last = lastHeightEdit
    const continues = last.id === waypoint.id && last.altitude === waypoint.altitude && Date.now() - last.atMs < 1500
    if (!continues) missionStore.pushUndoSnapshot('terrain')
    waypoint.altitude = Math.round(waypoint.altitude + changeM)
    lastHeightEdit = { id: waypoint.id, altitude: waypoint.altitude, atMs: Date.now() }
    logUserAction(`Set waypoint ${waypointIndex + 1} to ${waypoint.altitude} m from the terrain profile`)
  }

  const missionCoastlineBbox = (): GeoBbox =>
    paddedBbox(
      terrain.points().map(({ coordinates }) => coordinates),
      COASTLINE_MARGIN_M
    )

  // A mission too large for one coastline load cannot be helped by loading it over the mission.
  const coastlineMissing = computed(
    () =>
      !!terrain.analysis.value?.profile.findings.some(({ kind }) => kind === 'unmapped-shallows') &&
      bboxMaxSpanDegrees(missionCoastlineBbox()) <= MAX_HAZARD_BBOX_DEG
  )
  const loadingCoastline = computed(() => hazardStore.fetchingSources.includes('coastline'))

  const fetchMissionCoastline = (): void => {
    const mission = missionCoastlineBbox()
    const loaded = hazardStore.results.coastline?.bbox
    const merged = loaded ? bboxUnion(loaded, mission) : mission
    void hazardStore.refreshAreas(bboxMaxSpanDegrees(merged) > MAX_HAZARD_BBOX_DEG ? mission : merged, ['coastline'])
  }

  const loadMissionCoastline = (): void => {
    logUserAction('Loaded the coastline over the mission from the terrain panel')
    fetchMissionCoastline()
  }

  // Loaded with the rest of the terrain data, so the button is only needed once a load has failed.
  watch([open, coastlineMissing], ([isOpen, missing]) => {
    if (isOpen && missing && !loadingCoastline.value) fetchMissionCoastline()
  })

  const state: TerrainDockState = {
    terrain,
    open,
    safeAltitude,
    findings,
    ghostDistanceM,
    ghostSample,
    hover,
    focus: overlay.focus,
    visibleBounds: overlay.visibleBounds,
    setWaypointHeight,
    coastlineMissing,
    loadingCoastline,
    loadMissionCoastline,
  }
  provide(terrainDockKey, state)
  return state
}

/**
 * The terrain dock's shared state, for its panels.
 * @returns {TerrainDockState} The state.
 */
export const useTerrainDock = (): TerrainDockState => {
  const state = inject(terrainDockKey)
  if (!state) throw new Error('useTerrainDock() must be called inside the terrain dock')
  return state
}
