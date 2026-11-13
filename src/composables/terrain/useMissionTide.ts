import { watchDebounced } from '@vueuse/core'
import { startOfDay } from 'date-fns'
import { type ComputedRef, type Ref, computed, ref, shallowRef, watch } from 'vue'

import type { TerrainVehicleClass } from '@/libs/terrain/mission-profile'
import { type TideStation, fetchTideStations } from '@/libs/terrain/water-level'
import { useTerrainStore } from '@/stores/terrain'
import type { WaypointCoordinates } from '@/types/mission'

/**
 * The tide used for a mission and the station it comes from.
 */
export interface UseMissionTideReturn {
  /**
   * Whether the vehicle or the settings call for the tide; it is only looked up while true and the dock is open.
   */
  used: ComputedRef<boolean>
  /**
   * Tide stations around the mission, nearest first.
   */
  stations: Ref<TideStation[]>
  /**
   * Whether the stations around the mission are being looked up.
   */
  findingStations: Ref<boolean>
  /**
   * Why looking up the stations failed, when it did.
   */
  stationsError: Ref<string | null>
  /**
   * Whether the station is the one nearest the mission, rather than one picked in the settings.
   */
  automatic: ComputedRef<boolean>
  /**
   * The station in use, null when none is near or it is not known yet.
   */
  station: ComputedRef<TideStation | null>
  /**
   * Start of the mission day, in local time, in milliseconds since the epoch.
   */
  dayStartMs: Ref<number>
  /**
   * Looks up the stations and reads the tide again.
   */
  retry: () => void
}

/** Radius the nearest station is looked for in. */
export const TIDE_STATION_RADIUS_KM = 150
/** Days ahead the mission day can be set to. */
export const MAX_TIDE_DAYS_AHEAD = 30
const DAY_MS = 24 * 60 * 60 * 1000
// About 2 km, so dragging a waypoint does not look the stations up again.
const CENTER_STEP_DEG = 0.02

/**
 * Picks the tide station for a mission, the nearest one unless the settings name another, and keeps its tide loaded
 * from today until two days past the mission day.
 * @param {Ref<boolean>} open Whether the terrain dock is open.
 * @param {Ref<TerrainVehicleClass>} vehicleClass Kind of vehicle the mission is for.
 * @param {() => WaypointCoordinates[]} positions The mission's positions, home included.
 * @returns {UseMissionTideReturn} The station and the controls.
 */
export const useMissionTide = (
  open: Ref<boolean>,
  vehicleClass: Ref<TerrainVehicleClass>,
  positions: () => WaypointCoordinates[]
): UseMissionTideReturn => {
  const terrainStore = useTerrainStore()

  const used = computed(
    () => ['surface', 'underwater'].includes(vehicleClass.value) || terrainStore.settings.tideStationId !== ''
  )
  const active = computed(() => open.value && used.value)
  const stations = shallowRef<TideStation[]>([])
  const findingStations = ref(false)
  const stationsError = ref<string | null>(null)
  const dayStartMs = ref(startOfDay(Date.now()).getTime())

  const center = computed<WaypointCoordinates | null>(() => {
    const all = positions()
    if (all.length === 0) return null
    const lats = all.map(([lat]) => lat)
    const lons = all.map(([, lon]) => lon)
    const snap = (value: number): number => Math.round(value / CENTER_STEP_DEG) * CENTER_STEP_DEG
    return [snap((Math.min(...lats) + Math.max(...lats)) / 2), snap((Math.min(...lons) + Math.max(...lons)) / 2)]
  })

  let stationsRun = 0
  const findStations = async (): Promise<void> => {
    const around = center.value
    if (!active.value || !around) return
    const run = ++stationsRun
    findingStations.value = true
    stationsError.value = null
    try {
      const found = await fetchTideStations(around, TIDE_STATION_RADIUS_KM)
      if (run === stationsRun) stations.value = found
    } catch (error) {
      if (run === stationsRun) stationsError.value = String(error)
    } finally {
      if (run === stationsRun) findingStations.value = false
    }
  }
  watchDebounced(
    () => (active.value && center.value ? center.value.join() : ''),
    (key) => key && void findStations(),
    { debounce: 700, immediate: true }
  )

  // Ids from before stations were named by their source read as automatic.
  const pickedId = computed(() => {
    const id = terrainStore.settings.tideStationId
    return id.includes('/') ? id : ''
  })
  const automatic = computed(() => pickedId.value === '')
  const stationId = computed(() => pickedId.value || stations.value[0]?.id || '')
  const station = computed(() => {
    const id = stationId.value
    const loaded = terrainStore.tideStation
    return stations.value.find((candidate) => candidate.id === id) ?? (loaded?.id === id ? loaded : null)
  })

  let loadedKey = ''
  const loadTide = (force = false): void => {
    if (!active.value) return
    // Without a station near, the automatic choice waits for the lookup before dropping the tide loaded before.
    if (!stationId.value && (findingStations.value || stationsError.value)) return
    const today = startOfDay(Date.now()).getTime()
    const fromMs = Math.min(today, dayStartMs.value)
    const toMs = Math.max(today + 3 * DAY_MS, dayStartMs.value + 2 * DAY_MS)
    const key = `${stationId.value}|${fromMs}|${toMs}`
    if (key === loadedKey && !force) return
    loadedKey = key
    void terrainStore.loadTide(stationId.value, fromMs, toMs)
  }
  watch([active, stationId, dayStartMs, findingStations], () => loadTide())

  const retry = (): void => {
    void findStations()
    loadTide(true)
  }

  return { used, stations, findingStations, stationsError, automatic, station, dayStartMs, retry }
}
