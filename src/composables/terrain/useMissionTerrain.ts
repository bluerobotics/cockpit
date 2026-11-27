import { watchDebounced } from '@vueuse/core'
import { type ComputedRef, type Ref, computed, ref, shallowRef, watch } from 'vue'

import { reloadTerrainTiles, TerrainAreaTooLargeError } from '@/libs/terrain/elevation-service'
import {
  type ProfilePoint,
  type TerrainProfileContext,
  type TerrainVehicleClass,
  terrainVehicleClass,
} from '@/libs/terrain/mission-profile'
import {
  type MissionTerrainAnalysis,
  analyzeMissionTerrain,
  missionProfilePoints,
  vehicleTerrainBehavior,
} from '@/libs/terrain/mission-terrain'
import { useHazardStore } from '@/stores/hazards'
import { useMissionStore } from '@/stores/mission'
import { useTerrainStore } from '@/stores/terrain'
import type { WaypointCoordinates } from '@/types/mission'

/**
 * A mission's terrain, checked on demand and, while asked to, kept up to date as the mission changes.
 */
export interface UseMissionTerrainReturn {
  /**
   * Home the mission starts from, the planned one first.
   */
  home: ComputedRef<WaypointCoordinates | undefined>
  /**
   * How the planned vehicle meets the terrain.
   */
  vehicleClass: ComputedRef<TerrainVehicleClass>
  /**
   * Context the checks run with right now.
   */
  context: () => TerrainProfileContext
  /**
   * Path points of the current mission.
   */
  points: () => ProfilePoint[]
  /**
   * Checks the current mission once, or the given path points in its place.
   */
  analyze: (pathPoints?: ProfilePoint[]) => Promise<MissionTerrainAnalysis | null>
  /**
   * The latest live analysis, null before the first one or for a mission under two points.
   */
  analysis: Ref<MissionTerrainAnalysis | null>
  /**
   * Whether a live analysis is running.
   */
  analyzing: Ref<boolean>
  /**
   * Why the latest live analysis failed, when it did.
   */
  analysisError: Ref<string | null>
  /**
   * Tiles the latest live check would have to download, when that was too many to start without asking.
   */
  largeAreaTiles: Ref<number | null>
  /**
   * Lets the checks read the mission's terrain however many tiles it needs, and re-checks it.
   */
  approveLargeArea: () => Promise<void>
  /**
   * Whether the operator accepted reading this mission's terrain however many tiles it needs.
   */
  largeAreaApproved: () => boolean
  /**
   * Whether the live check waits for a mission home before reading any terrain.
   */
  awaitingHome: ComputedRef<boolean>
  /**
   * Reads the terrain model again and re-checks the mission, retrying tiles and sources that failed.
   */
  rebuild: () => Promise<void>
}

// Long enough that dragging a waypoint across the map re-checks once it is dropped, not along the way.
const LIVE_DEBOUNCE_MS = 700

/**
 * Checks the planning mission against the terrain model with the vehicle's own climb and return behavior.
 * @param {Ref<boolean>} live While true, re-checks the mission whenever it or the settings change; omit for on-demand checks only.
 * @param {boolean} needsMissionHome Holds the live check, and skips the automatic return check, until the mission home is set.
 * @returns {UseMissionTerrainReturn} The checks and the live result.
 */
export const useMissionTerrain = (live?: Ref<boolean>, needsMissionHome = false): UseMissionTerrainReturn => {
  const terrainStore = useTerrainStore()
  const missionStore = useMissionStore()
  const hazardStore = useHazardStore()

  const home = computed(() => missionStore.plannedHomePosition ?? missionStore.homeMarkerPosition)
  const vehicleClass = computed(() => terrainVehicleClass(terrainStore.planningVehicleType))

  const context = (): TerrainProfileContext => ({
    vehicleClass: vehicleClass.value,
    waterLevelM: terrainStore.waterLevelNowM(),
    minimumClearanceM: terrainStore.settings.minimumClearanceM,
    minimumUnderKeelM: terrainStore.settings.minimumUnderKeelM,
    draftM: terrainStore.settings.vesselDraftM,
    uncertaintyM: terrainStore.effectiveSource.verticalUncertaintyM,
    mappedWater: hazardStore.coastlineWater,
    coastlineCoverage: hazardStore.isSourceEnabled('coastline') ? hazardStore.results.coastline ?? null : undefined,
    coastline: hazardStore.isSourceEnabled('coastline') ? hazardStore.results.coastline?.areas : undefined,
  })

  const points = (): ProfilePoint[] => missionProfilePoints(missionStore.currentPlanningWaypoints, home.value)

  // Lasts until the mission is cleared, so editing a large mission the operator already accepted does not ask again.
  let largeAreaApproved = false

  const analyze = (pathPoints = points()): Promise<MissionTerrainAnalysis | null> => {
    const { performance, behavior } = vehicleTerrainBehavior(
      terrainStore.planningVehicleType,
      terrainStore.vehicleParameters,
      missionStore.plannedCruiseSpeed
    )
    const checkReturns = !needsMissionHome || missionStore.plannedHomePosition !== undefined
    const returns = checkReturns ? behavior : null
    return analyzeMissionTerrain(pathPoints, context(), returns, performance, largeAreaApproved)
  }

  const analysis = shallowRef<MissionTerrainAnalysis | null>(null)
  const analyzing = ref(false)
  const analysisError = ref<string | null>(null)
  const largeAreaTiles = ref<number | null>(null)
  let latestRun = 0

  const awaitingHome = computed(() => needsMissionHome && missionStore.plannedHomePosition === undefined)
  // Also run with the check stopped, so a cleared mission's results never reach the next one, a running check's included.
  watch([awaitingHome, () => missionStore.currentPlanningWaypoints.length === 0], ([awaiting, cleared]) => {
    if (!awaiting && !cleared) return
    latestRun++
    analysis.value = null
    analysisError.value = null
    largeAreaTiles.value = null
    largeAreaApproved = false
    analyzing.value = false
  })

  const runLive = async (): Promise<void> => {
    if (awaitingHome.value) return
    const run = ++latestRun
    analyzing.value = true
    try {
      const result = await analyze()
      if (run !== latestRun) return
      analysis.value = result
      analysisError.value = null
      largeAreaTiles.value = null
    } catch (error) {
      if (run !== latestRun) return
      const tooLarge = error instanceof TerrainAreaTooLargeError
      // A stale profile of a different mission would read as this one's, so the large one shows nothing until accepted.
      if (tooLarge) analysis.value = null
      largeAreaTiles.value = tooLarge ? error.tileCount : null
      analysisError.value = tooLarge ? null : String(error)
    } finally {
      if (run === latestRun) analyzing.value = false
    }
  }

  if (live) {
    // A signature instead of a deep watch, so the large waypoint objects are not walked on every edit.
    const signature = computed(() => {
      if (!live.value || awaitingHome.value) return ''
      const waypoints = missionStore.currentPlanningWaypoints
        .map(
          ({ coordinates, altitude, altitudeReferenceType }) => `${coordinates},${altitude},${altitudeReferenceType}`
        )
        .join('|')
      const { settings, effectiveSourceId, bathymetrySourceId, vehicleParameters, tidePredictions, measuredVersion } =
        terrainStore
      const source = `${effectiveSourceId}:${bathymetrySourceId}`
      const thresholds = [
        settings.minimumClearanceM,
        settings.minimumUnderKeelM,
        settings.vesselDraftM,
        settings.waterLevelOffsetM,
        settings.measuredTerrainEnabled && settings.useMeasuredTerrain,
      ].join()
      // Measured terrain grows several times a second while recording, so only every hundredth reading re-checks.
      const measured = Math.floor(measuredVersion / 100)
      const vehicle = `${terrainStore.planningVehicleType}:${JSON.stringify(vehicleParameters)}`
      const homeSet = missionStore.plannedHomePosition !== undefined
      const coastlineVertices = hazardStore.coastlineWater.reduce((count, area) => count + area.coordinates.length, 0)
      const coastline = `${coastlineVertices}:${Object.values(hazardStore.results.coastline?.bbox ?? {})}`
      return `${waypoints}|${home.value}|${homeSet}|${source}|${thresholds}|${vehicle}|${tidePredictions.length}|${measured}|${coastline}`
    })
    watchDebounced(signature, (current) => current && void runLive(), { debounce: LIVE_DEBOUNCE_MS, immediate: true })
  }

  const rebuild = (): Promise<void> => {
    reloadTerrainTiles()
    return runLive()
  }

  const approveLargeArea = (): Promise<void> => {
    largeAreaApproved = true
    largeAreaTiles.value = null
    return runLive()
  }

  return {
    home,
    vehicleClass,
    context,
    points,
    analyze,
    analysis,
    analyzing,
    analysisError,
    largeAreaTiles,
    approveLargeArea,
    largeAreaApproved: () => largeAreaApproved,
    awaitingHome,
    rebuild,
  }
}
