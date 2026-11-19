import { refThrottled, useThrottleFn } from '@vueuse/core'
import { t } from 'ttag'
import { type InjectionKey, type Ref, computed, inject, provide, ref, shallowRef, watch } from 'vue'

import { useBaseStation } from '@/composables/baseStation/useBaseStation'
import { useMapContext } from '@/composables/map/useMapContext'
import {
  type TerrainMapDot,
  type TerrainMapStretch,
  useTerrainMapOverlay,
} from '@/composables/map/useTerrainMapOverlay'
import { openSnackbar } from '@/composables/snackbar'
import { bboxMaxSpanDegrees, MAX_HAZARD_BBOX_DEG, paddedBbox } from '@/libs/hazards/hazard-areas'
import type { VisibilityGrid } from '@/libs/terrain/line-of-sight'
import { measuredCellCenter, measuredCellLabel, trustedCells } from '@/libs/terrain/measured-terrain'
import { rampColor } from '@/libs/terrain/measured-terrain-geojson'
import type { TerrainFindingKind, TerrainProfileSample } from '@/libs/terrain/mission-profile'
import { followPathCorners, legLabel } from '@/libs/terrain/mission-profile'
import {
  climbFindingMessage,
  OTHER_FINDING_RANK,
  profileStretch,
  RETURN_FINDING_RANK,
  returnFindingMessage,
  terrainFindingMessage,
  terrainFindingRank,
  terrainFindingSeverity,
  terrainRelativeStretches,
} from '@/libs/terrain/mission-terrain'
import { sampleAtFraction } from '@/libs/terrain/profile-chart'
import {
  type LinkStation,
  type PathSightKind,
  type PathSightStretch,
  type SightFinding,
  PATH_SIGHT_COLORS,
  visibilityImagePixels,
} from '@/libs/terrain/sight-analysis'
import type { TerrainTileBounds } from '@/libs/terrain/tiles'
import { useHazardStore } from '@/stores/hazards'
import { useMissionStore } from '@/stores/mission'
import { useTerrainStore } from '@/stores/terrain'
import type { GeoBbox } from '@/types/general'
import type { CockpitMission, WaypointCoordinates } from '@/types/mission'
import type { TerrainObserver } from '@/types/terrain'

import { type UseMissionTerrainReturn, useMissionTerrain } from './useMissionTerrain'
import { type UseMissionTideReturn, useMissionTide } from './useMissionTide'
import { type UseMissionWaterReturn, useMissionWater } from './useMissionWater'
import { type UseSafeAltitudeReturn, useSafeAltitude } from './useSafeAltitude'
import { type TerrainUploadPreview, useTerrainUploadPreview } from './useTerrainUploadPreview'

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
   * Dashed on the map, for link and sight findings.
   */
  dashed: boolean
  /**
   * How observers see the vehicle along it, for sight findings, which the chart and the map draw from `pathSight`.
   */
  sightKind?: PathSightKind
  /**
   * How urgent it is, 0 the most; the list reads in this order.
   */
  rank: number
  /**
   * Heading of the warning triangle the chart marks it with, unmarked when absent.
   */
  warningTitle?: string
  /**
   * Buttons that settle it from its card.
   */
  actions?: TerrainDockFindingAction[]
}

/**
 * A button on a finding's card.
 */
export interface TerrainDockFindingAction {
  /**
   * Button text.
   */
  label: string
  /**
   * What the button does, shown on hover.
   */
  help: string
  /**
   * Runs it.
   */
  run: () => void
}

/**
 * The waypoints and surveys of a mission the terrain tools rewrite.
 */
export type TerrainMissionEdit = Required<Pick<CockpitMission, 'waypoints' | 'surveys'>>

/**
 * Asks the planning view to replace the mission with new waypoints and surveys.
 */
export type ReplaceMission = (mission: TerrainMissionEdit, message: string) => void

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
   * Every finding, terrain, return, climb, link and sight, most urgent first and then in mission order.
   */
  findings: Ref<TerrainDockFinding[]>
  /**
   * Radio link along the mission, empty until checked.
   */
  linkStations: Ref<LinkStation[]>
  /**
   * Link findings from the last radio check.
   */
  linkFindings: Ref<SightFinding[]>
  /**
   * How observers see the vehicle along the mission, from the last visibility surface.
   */
  pathSight: Ref<PathSightStretch[]>
  /**
   * Sight legend entry pointed at or tapped, null for none.
   */
  sightLegendKind: Ref<PathSightKind | null>
  /**
   * The last visibility surface, cleared when the observers, the visual range or the cloud base change.
   */
  visibility: Ref<VisibilityGrid | null>
  /**
   * Observers the visibility surface is computed for: those placed on the map, then the base station when placed.
   */
  sightObservers: Ref<TerrainObserver[]>
  /**
   * Distance of the ghost run's vehicle along the mission, null when not running.
   */
  ghostDistanceM: Ref<number | null>
  /**
   * The ghost run's vehicle station.
   */
  ghostSample: Ref<TerrainProfileSample | undefined>
  /**
   * Whether measured terrain cells are drawn on the map.
   */
  showMeasured: Ref<boolean>
  /**
   * Whether the profile outlines the model's ground along the whole mission, to compare it with the measurements.
   */
  compareModel: Ref<boolean>
  /**
   * Profile station the chart is hovering.
   */
  hover: Ref<TerrainProfileSample | null>
  /**
   * Waits for a click on the map.
   */
  pickPoint: () => Promise<WaypointCoordinates | null>
  /**
   * Fits the map to some positions.
   */
  focus: (positions: WaypointCoordinates[]) => void
  /**
   * Area the map shows, null before it is created.
   */
  visibleBounds: () => TerrainTileBounds | null
  /**
   * Replaces the mission, through the planning view.
   */
  replaceMission: ReplaceMission
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
  /**
   * Where an aircraft's or ground vehicle's mission runs over water, which its heights alone do not show.
   */
  water: UseMissionWaterReturn
  /**
   * The tide station nearest the mission, or the one the settings name, and the mission day its tide is read for.
   */
  tide: UseMissionTideReturn
  /**
   * What an upload holding the height over the ground would send, while that upload option is on for an aircraft.
   */
  uploadPreview: Ref<TerrainUploadPreview | null>
}

const terrainDockKey: InjectionKey<TerrainDockState> = Symbol('terrain-dock')

const SEVERITY_COLORS = { danger: '#FF5252', warning: '#FF8800', info: '#FFD54F' } as const

/**
 * Icon of the findings the chart marks with a warning triangle, drawn as that triangle.
 */
export const TERRAIN_WARNING_ICON = 'terrain-warning-triangle'

const TERRAIN_FINDING_ICONS: Partial<Record<TerrainFindingKind, string>> = {
  'collision': TERRAIN_WARNING_ICON,
  'reaches-coastline': 'mdi-map-marker-alert-outline',
}
const TERRAIN_WARNING_TITLES: Partial<Record<TerrainFindingKind, string>> = {
  collision: t`Goes into the terrain`,
}
const SIGHT_COLORS: Record<SightFinding['kind'], string> = {
  'link-blocked': '#E040FB',
  'link-degraded': '#B388FF',
  'must-climb': PATH_SIGHT_COLORS['must-climb'],
  'never-seen': PATH_SIGHT_COLORS['never-seen'],
}
const SIGHT_TEXT: Record<SightFinding['kind'], string> = {
  'link-blocked': t`The terrain blocks the radio link`,
  'link-degraded': t`The terrain crowds the radio link`,
  'must-climb': t`The vehicle flies too low for any observer to see it`,
  'never-seen': t`No observer can see the vehicle`,
}
const PATH_SIGHT_TEXT: Record<PathSightKind, string> = {
  'in-sight': t`An observer sees the vehicle here.`,
  'must-climb': t`Too low here for any observer to see the vehicle.`,
  'never-seen': t`No observer can see the vehicle here, at any height.`,
}
const MAX_MEASURED_DOTS = 5000
const COASTLINE_MARGIN_M = 500
export const DEFAULT_EYE_HEIGHT_M = 1.7

const bboxUnion = (a: GeoBbox, b: GeoBbox): GeoBbox => ({
  south: Math.min(a.south, b.south),
  west: Math.min(a.west, b.west),
  north: Math.max(a.north, b.north),
  east: Math.max(a.east, b.east),
})

/**
 * Creates the terrain dock's shared state, its map drawing included, and provides it to the dock's panels.
 * @param {ReplaceMission} replaceMission Replaces the mission through the planning view.
 * @returns {TerrainDockState} The state.
 */
export const provideTerrainDock = (replaceMission: ReplaceMission): TerrainDockState => {
  const terrainStore = useTerrainStore()
  const missionStore = useMissionStore()
  const hazardStore = useHazardStore()
  const baseStation = useBaseStation()
  const { map } = useMapContext()
  const open = ref(false)
  const keepSafe = ref(false)
  const terrain = useMissionTerrain(
    computed(() => open.value || keepSafe.value),
    true
  )
  const safeAltitude = useSafeAltitude(terrain, keepSafe)
  const linkStations = shallowRef<LinkStation[]>([])
  const linkFindings = shallowRef<SightFinding[]>([])
  const pathSight = shallowRef<PathSightStretch[]>([])
  const sightLegendKind = ref<PathSightKind | null>(null)
  const visibility = shallowRef<VisibilityGrid | null>(null)
  const ghostDistanceM = ref<number | null>(null)
  const showMeasured = ref(false)
  const compareModel = ref(false)
  const hover = ref<TerrainProfileSample | null>(null)

  // Link and sight results describe the mission they were computed for, so an edit retires them.
  watch(
    () => terrain.analysis.value,
    () => {
      linkStations.value = []
      linkFindings.value = []
      pathSight.value = []
      sightLegendKind.value = null
    }
  )

  const sightObservers = computed<TerrainObserver[]>(() => {
    const base = baseStation.activePosition
    const placed = terrainStore.settings.visualObservers
    return base ? [...placed, { position: base, heightAboveGroundM: DEFAULT_EYE_HEIGHT_M }] : placed
  })
  watch(
    [sightObservers, () => terrainStore.settings.visualRangeM, () => terrainStore.settings.cloudBaseM],
    () => {
      visibility.value = null
      pathSight.value = []
      sightLegendKind.value = null
    },
    { deep: true }
  )

  const answerTerrainRequests = (): void => {
    terrainStore.settings.serveTerrainToVehicle = true
    logUserAction('Turned on answering the vehicle terrain requests from the terrain findings')
    openSnackbar({
      variant: 'success',
      message: t`Cockpit now answers the vehicle's terrain requests.`,
      duration: 3000,
    })
  }

  const holdTerrainHeight = (): void => {
    terrainStore.settings.resolveTerrainOnUpload = true
    logUserAction('Turned on holding terrain height on upload from the terrain findings')
    const message = t`Terrain height is now held on upload. The chart and the map show the waypoints it adds.`
    openSnackbar({ variant: 'success', message, duration: 3000 })
  }

  const uploadPreview = useTerrainUploadPreview(
    terrain,
    computed(() => open.value && terrainStore.settings.resolveTerrainOnUpload && terrain.vehicleClass.value === 'air')
  )

  const vehicleTerrainActions = computed<TerrainDockFindingAction[]>(() => [
    {
      label: t`Answer terrain requests`,
      help:
        // eslint-disable-next-line max-len, vue/max-len
        t`Sends the vehicle ground heights from Cockpit's terrain model whenever it asks, and the vehicle follows the terrain itself, along the line the chart draws. It only asks with terrain enabled (its TERRAIN_ENABLE parameter), and keeps what it gets for flying without Cockpit.`,
      run: answerTerrainRequests,
    },
    {
      label: t`Hold terrain height`,
      help:
        // eslint-disable-next-line max-len, vue/max-len
        t`Still follows the terrain, with no terrain data needed on the vehicle: the upload adds waypoints wherever the ground rises or falls, so the straight lines between them pass at most ${terrainStore.settings.terrainFollowToleranceM} m above the height over the ground, and sends every height above sea level. The planned mission keeps its heights over the ground; the chart and the map preview the waypoints the upload adds.`,
      run: holdTerrainHeight,
    },
  ])

  // Either switch gives the vehicle what the chart assumes it holds, so the finding only stands while both are off.
  const vehicleTerrainFindings = computed<TerrainDockFinding[]>(() => {
    const analysis = terrain.analysis.value
    const { serveTerrainToVehicle, resolveTerrainOnUpload } = terrainStore.settings
    if (!analysis || terrain.vehicleClass.value !== 'air' || serveTerrainToVehicle || resolveTerrainOnUpload) return []
    return terrainRelativeStretches(analysis.points, analysis.profile.samples).map(({ fromM, toM, label }, index) => ({
      key: `vehicle-terrain-${index}`,
      message:
        // eslint-disable-next-line max-len, vue/max-len
        t`From ${label} the waypoints are set "Relative to terrain", so the vehicle needs terrain data of its own to hold their height over the ground. Turn on "Answer the vehicle's terrain requests" or "Hold terrain height on upload" in the Vehicle tab.`,
      color: SEVERITY_COLORS.warning,
      icon: TERRAIN_WARNING_ICON,
      fromM,
      toM,
      dashed: false,
      rank: OTHER_FINDING_RANK,
      warningTitle: t`Needs terrain on the vehicle`,
      actions: vehicleTerrainActions.value,
    }))
  })

  const findings = computed<TerrainDockFinding[]>(() => {
    const analysis = terrain.analysis.value
    if (!analysis) return []
    const context = terrain.context()
    const { points, profile, returnFindings, climbFindings } = analysis
    // Only an aircraft's height decides whether it is seen, so only its out-of-sight stretches are findings.
    const sightFindings =
      terrain.vehicleClass.value === 'air'
        ? pathSight.value.flatMap(({ kind, ...stretch }) => (kind === 'in-sight' ? [] : [{ kind, ...stretch }]))
        : []
    return [
      ...profile.findings.map((finding, index) => ({
        key: `terrain-${index}`,
        message: terrainFindingMessage(finding, points, context),
        color: SEVERITY_COLORS[terrainFindingSeverity(finding.kind)],
        icon: TERRAIN_FINDING_ICONS[finding.kind] ?? 'mdi-image-filter-hdr',
        fromM: finding.fromM,
        toM: finding.toM,
        dashed: false,
        rank: terrainFindingRank(finding.kind),
        warningTitle: TERRAIN_WARNING_TITLES[finding.kind],
      })),
      ...vehicleTerrainFindings.value,
      ...returnFindings.map((finding, index) => ({
        key: `return-${index}`,
        message: returnFindingMessage(finding, points, context),
        color: SEVERITY_COLORS.warning,
        icon: 'mdi-home-import-outline',
        fromM: finding.fromM,
        toM: finding.toM,
        dashed: false,
        rank: RETURN_FINDING_RANK,
      })),
      ...climbFindings.map((finding, index) => ({
        key: `climb-${index}`,
        message: climbFindingMessage(finding, points),
        color: finding.kind === 'slows-to-climb' ? SEVERITY_COLORS.info : SEVERITY_COLORS.warning,
        icon: 'mdi-chart-line-variant',
        fromM: finding.fromM,
        toM: finding.toM,
        dashed: false,
        rank: OTHER_FINDING_RANK,
      })),
      ...[...linkFindings.value, ...sightFindings].map(({ kind, legIndex, fromM, toM }, index) => {
        const sightKind = kind === 'must-climb' || kind === 'never-seen' ? kind : undefined
        const leg = legLabel(points, legIndex)
        return {
          key: `sight-${index}`,
          message: t`${SIGHT_TEXT[kind]} from ${leg}.`,
          color: SIGHT_COLORS[kind],
          icon: sightKind ? 'mdi-eye-off-outline' : 'mdi-access-point-network-off',
          fromM,
          toM,
          dashed: true,
          sightKind,
          rank: OTHER_FINDING_RANK,
        }
      }),
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
    const sight = pathSight.value.map(({ kind, fromM, toM }) => ({
      path: profileStretch(samples, fromM, toM),
      color: PATH_SIGHT_COLORS[kind],
      message: PATH_SIGHT_TEXT[kind],
      dashed: true,
      highlighted: sightLegendKind.value === kind,
    }))
    // Drawn least urgent first, so where two findings share a stretch the more urgent line is on top.
    return [
      ...sight,
      ...[...findings.value]
        .reverse()
        .filter(({ sightKind }) => !sightKind)
        .map(({ fromM, toM, color, message, dashed }) => ({
          path: profileStretch(samples, fromM, toM),
          color,
          message,
          dashed,
        })),
    ]
  })

  const ghostSample = computed(() => {
    const samples = terrain.analysis.value?.profile.samples ?? []
    const distance = ghostDistanceM.value
    if (distance === null || samples.length === 0) return undefined
    return sampleAtFraction(samples, distance / (samples.at(-1)?.distanceM || 1))
  })

  const image = computed(() => {
    const grid = visibility.value
    if (!open.value || !grid) return null
    const canvas = document.createElement('canvas')
    canvas.width = grid.columns
    canvas.height = grid.rows
    const { minimumClearanceM, visualRangeM } = terrainStore.settings
    const observers = sightObservers.value.map(({ position }) => position)
    const pixels = visibilityImagePixels(grid, Math.max(30, minimumClearanceM * 6), observers, visualRangeM)
    canvas.getContext('2d')?.putImageData(new ImageData(pixels, grid.columns, grid.rows), 0, 0)
    return { bounds: grid.bbox, url: canvas.toDataURL('image/png') }
  })

  const measuredDots = shallowRef<TerrainMapDot[]>([])
  const refreshMeasuredDots = useThrottleFn(
    () => {
      if (!open.value || !showMeasured.value || !terrainStore.settings.measuredTerrainEnabled) {
        measuredDots.value = []
        return
      }
      const cells = trustedCells(terrainStore.measured).slice(-MAX_MEASURED_DOTS)
      const heights = cells.map(([, cell]) => cell.sum / cell.count)
      const low = Math.min(...heights)
      const span = Math.max(0.5, Math.max(...heights) - low)
      const { waterLevelOffsetM } = terrainStore.settings
      measuredDots.value = cells.map(([key, cell], index) => ({
        coordinates: measuredCellCenter(key),
        color: rampColor((heights[index] - low) / span),
        label: measuredCellLabel(cell, terrain.vehicleClass.value, waterLevelOffsetM),
      }))
    },
    2000,
    true
  )
  watch(
    [
      open,
      showMeasured,
      terrain.vehicleClass,
      () => terrainStore.settings.measuredTerrainEnabled,
      () => terrainStore.settings.waterLevelOffsetM,
      () => terrainStore.measuredVersion,
    ],
    () => void refreshMeasuredDots(),
    { immediate: true }
  )

  const water = useMissionWater(
    computed(() => terrain.analysis.value?.profile.samples ?? []),
    computed(() => open.value && ['air', 'ground'].includes(terrain.vehicleClass.value)),
    () => terrainStore.waterLevelNowM()
  )

  const tide = useMissionTide(open, terrain.vehicleClass, () => terrain.points().map(({ coordinates }) => coordinates))

  const overlay = useTerrainMapOverlay(map, {
    // Each change redraws every finding line, which a waypoint drag would otherwise do at pointer rate.
    stretches: refThrottled(stretches, 100),
    hover: computed(() => (open.value ? hover.value?.coordinates ?? null : null)),
    image,
    observers: computed(() => (open.value ? terrainStore.settings.visualObservers : [])),
    ghost: computed(() => (open.value ? ghostSample.value?.coordinates ?? null : null)),
    measured: measuredDots,
    uploadWaypoints: computed<TerrainMapDot[]>(() =>
      (uploadPreview.value?.path ?? []).flatMap(({ coordinates, amslM, added }) => {
        const heightM = Math.round(amslM)
        return added ? [{ coordinates, color: '#FFFFFF', label: t`Added on upload, ${heightM} m above sea level` }] : []
      })
    ),
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
    linkStations,
    linkFindings,
    pathSight,
    sightLegendKind,
    visibility,
    sightObservers,
    ghostDistanceM,
    ghostSample,
    showMeasured,
    compareModel,
    hover,
    pickPoint: overlay.pickPoint,
    focus: overlay.focus,
    visibleBounds: overlay.visibleBounds,
    replaceMission,
    setWaypointHeight,
    coastlineMissing,
    loadingCoastline,
    loadMissionCoastline,
    water,
    tide,
    uploadPreview,
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
