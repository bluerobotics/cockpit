import { useIntervalFn, useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { useSnackbar } from '@/composables/snackbar'
import { useTerrainElevation } from '@/composables/useTerrainElevation'
import { type VehicleFileMeta, createVehicleFileStorage } from '@/composables/useVehicleFileStorage'
import { bboxIntersects } from '@/libs/baseStation/coverageBbox'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { type CoastlineFaces, coastlineFaces } from '@/libs/hazards/coastline-faces'
import { bboxContains, bboxMaxSpanDegrees, coversPoint, MAX_HAZARD_BBOX_DEG } from '@/libs/hazards/hazard-areas'
import {
  checkCoverage,
  checkMissionAgainstAreas,
  checkPathOverAreas,
  checkShallowWater,
  checkTerrainElevation,
  waypointAltitudesAmsl,
} from '@/libs/hazards/hazard-checks'
import { parseStoredHazards, parseStoredTerrainGrid } from '@/libs/hazards/hazard-storage'
import { hazardAreaToExclusionRing } from '@/libs/hazards/hazard-to-fence'
import { fetchAirspaceHazards, OpenAipAuthError } from '@/libs/hazards/openaip'
import { fetchOverpassHazardAreas } from '@/libs/hazards/overpass-hazards'
import { HAZARD_AREA_SOURCE_IDS, HAZARD_GRID_SOURCE_IDS, HAZARD_SOURCES } from '@/libs/hazards/sources'
import {
  clearGridSamplesIn,
  shallowWaterAreas,
  terrainAreasAbove,
  terrainGridLayout,
} from '@/libs/hazards/terrain-areas'
import { useAlertStore } from '@/stores/alert'
import { useGeoFenceStore } from '@/stores/geoFence'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import { Alert, AlertLevel } from '@/types/alert'
import type { GeoBbox } from '@/types/general'
import type {
  HazardAdvisory,
  HazardAdvisorySettings,
  HazardArea,
  HazardAreaSourceId,
  HazardCoverage,
  HazardFetchResult,
  HazardGridSourceId,
  HazardSourceId,
  TerrainGrid,
} from '@/types/hazards'
import type { Waypoint, WaypointCoordinates } from '@/types/mission'

// Enabling a source only decides what a refresh will ask for and what the map draws; no fetch
// happens until the operator presses refresh. Airspace stays off because it needs a personal key,
// and terrain and shallow water because they download elevation tiles.
const DEFAULT_HAZARD_SETTINGS: HazardAdvisorySettings = {
  enabledSources: ['coastline', 'restricted-waters', 'seamarks'],
  proximityMarginMeters: 50,
  terrainClearanceMeters: 10,
  shallowWaterDepthMeters: 2,
  liveAlerts: true,
  exclusionVertexBudget: 60,
}

const LIVE_CHECK_INTERVAL_MS = 3000
// A vehicle holding position on the edge of the margin drifts in and out of it; this keeps that from
// repeating the same alert every few seconds.
const LIVE_REALERT_AFTER_MS = 60000

type HazardFetcher = (bbox: GeoBbox, signal: AbortSignal) => Promise<HazardFetchResult>

type MissionGround = {
  /**
   * Ground elevation under each waypoint, empty when nothing needed it.
   */
  groundM: (number | null)[]
  /**
   * Each waypoint's altitude above sea level, empty when no loaded area has a vertical band.
   */
  altitudesAmslM: (number | undefined)[]
}

// The elevation grid both grid sources trace is stored once, under `terrain`.
type HazardFileSourceId = HazardAreaSourceId | 'terrain'

type HazardFileMeta = VehicleFileMeta & {
  /**
   * Source whose last fetch the file holds.
   */
  sourceId: HazardFileSourceId
}

export const useHazardStore = defineStore('hazards', () => {
  const { openSnackbar } = useSnackbar()
  const fenceStore = useGeoFenceStore()
  const alertStore = useAlertStore()
  const vehicleStore = useMainVehicleStore()
  const missionStore = useMissionStore()
  const { isSampling: isSamplingTerrain, sampleElevations } = useTerrainElevation()

  const settings = useBlueOsStorage<HazardAdvisorySettings>('cockpit-hazard-sources-v1', DEFAULT_HAZARD_SETTINGS)
  // A personal credential, so it stays on this computer rather than syncing to the vehicle, where
  // every other operator of that vehicle would inherit it.
  const openAipApiKey = useStorage('cockpit-hazard-openaip-api-key', '')

  // Merge defaults so a settings payload written before a field existed still has it.
  settings.value = { ...DEFAULT_HAZARD_SETTINGS, ...settings.value }

  const results = ref<Partial<Record<HazardAreaSourceId, HazardFetchResult>>>({})
  const terrainGrid = shallowRef<TerrainGrid | null>(null)
  const fetchingSources = ref<HazardSourceId[]>([])
  const advisories = ref<HazardAdvisory[]>([])
  const advisoriesCheckedAtMs = ref<number | null>(null)
  // Session-only: it exists to stop the same area being added twice, and a reload takes the
  // question with it since the operator then sees the polygon in the editor rather than the button.
  const fenceExclusionByArea = ref<Record<string, string>>({})

  let controller: AbortController | null = null

  const fetchers: Record<HazardAreaSourceId, HazardFetcher> = {
    'coastline': (bbox, signal) => fetchOverpassHazardAreas('coastline', bbox, signal),
    'restricted-waters': (bbox, signal) => fetchOverpassHazardAreas('restricted-waters', bbox, signal),
    'seamarks': (bbox, signal) => fetchOverpassHazardAreas('seamarks', bbox, signal),
    'airspace': (bbox, signal) => fetchAirspaceHazards(bbox, openAipApiKey.value.trim(), signal),
  }

  const isSourceEnabled = (sourceId: HazardSourceId): boolean => settings.value.enabledSources.includes(sourceId)

  const enabledAreaSources = computed<HazardAreaSourceId[]>(() => HAZARD_AREA_SOURCE_IDS.filter(isSourceEnabled))
  const enabledGridSources = computed<HazardGridSourceId[]>(() => HAZARD_GRID_SOURCE_IDS.filter(isSourceEnabled))

  /** Areas of every enabled source, which is what the map overlay draws and the checks run against. */
  const visibleAreas = computed<HazardArea[]>(() =>
    enabledAreaSources.value.flatMap((sourceId) => results.value[sourceId]?.areas ?? [])
  )

  // Tracing takes seconds on a full grid, so it depends only on the grid and its threshold: toggling any
  // source must not throw the trace away. Each is still traced lazily, on its first read while enabled.
  const tracedTerrainAreas = computed<HazardArea[]>(() =>
    terrainGrid.value ? terrainAreasAbove(terrainGrid.value, settings.value.terrainClearanceMeters) : []
  )
  const tracedShallowAreas = computed<HazardArea[]>(() =>
    terrainGrid.value ? shallowWaterAreas(terrainGrid.value, settings.value.shallowWaterDepthMeters) : []
  )

  /** Ground higher than the terrain threshold, over the loaded grid. */
  const terrainAreas = computed<HazardArea[]>(() => (isSourceEnabled('terrain') ? tracedTerrainAreas.value : []))

  /** Water no deeper than the shallow-water depth, over the loaded grid. */
  const shallowAreas = computed<HazardArea[]>(() => (isSourceEnabled('shallow-water') ? tracedShallowAreas.value : []))

  /** Area each enabled source with loaded data covers, anything outside being unknown rather than clear. */
  const loadedCoverage = computed<HazardCoverage[]>(() => [
    ...enabledAreaSources.value.flatMap((sourceId) => results.value[sourceId] ?? []),
    ...(enabledGridSources.value.length > 0 && terrainGrid.value ? [terrainGrid.value] : []),
  ])

  /** Oldest fetch among the enabled sources, so the panel can show how stale the whole picture is. */
  const oldestFetchAtMs = computed<number | null>(() => {
    const times = [
      ...enabledAreaSources.value.map((sourceId) => results.value[sourceId]?.fetchedAtMs),
      enabledGridSources.value.length > 0 ? terrainGrid.value?.fetchedAtMs : undefined,
    ].filter((time): time is number => time !== undefined)
    return times.length > 0 ? Math.min(...times) : null
  })

  // A truncated coastline is missing runs, which would merge land and water into one face.
  const dividedCoastline = computed<CoastlineFaces>(() => {
    const coastline = results.value.coastline
    return coastline && !coastline.truncated ? coastlineFaces(coastline.areas, coastline.bbox) : { land: [], water: [] }
  })

  /** The side of the coastline the vehicle must keep off: the land for a boat or submarine, the water for a rover. */
  const coastlineExclusionAreas = computed<HazardArea[]>(() => {
    if (!isSourceEnabled('coastline')) return []
    const vehicleType = missionStore.effectiveVehicleType
    if (vehicleType === MavType.MAV_TYPE_GROUND_ROVER) return dividedCoastline.value.water
    if (vehicleType === MavType.MAV_TYPE_SURFACE_BOAT || vehicleType === MavType.MAV_TYPE_SUBMARINE) {
      return dividedCoastline.value.land
    }
    return []
  })

  /**
   * Finds a loaded area of any enabled source, grid-traced ones included.
   * @param {string} areaId Area to look up.
   * @returns {HazardArea | undefined} The area, when it is still loaded and its source enabled.
   */
  const findArea = (areaId: string): HazardArea | undefined =>
    [...visibleAreas.value, ...terrainAreas.value, ...shallowAreas.value, ...coastlineExclusionAreas.value].find(
      (area) => area.id === areaId
    )

  /**
   * Loaded areas of one source, whether or not the source is enabled.
   * @param {HazardSourceId} sourceId Source to read.
   * @returns {HazardArea[]} Its areas, traced first for the grid sources.
   */
  const loadedAreasOf = (sourceId: HazardSourceId): HazardArea[] => {
    if (sourceId === 'terrain') return tracedTerrainAreas.value
    if (sourceId === 'shallow-water') return tracedShallowAreas.value
    return results.value[sourceId]?.areas ?? []
  }

  /**
   * Whether a source has data loaded over a point, even if it found nothing there.
   * @param {HazardSourceId} sourceId Source to check.
   * @param {WaypointCoordinates} point Point to check.
   * @returns {boolean} True when the source's last load covered the point.
   */
  const isLoadedAt = (sourceId: HazardSourceId, point: WaypointCoordinates): boolean => {
    const loaded = HAZARD_GRID_SOURCE_IDS.includes(sourceId as HazardGridSourceId)
      ? terrainGrid.value
      : results.value[sourceId as HazardAreaSourceId]
    return loaded != null && coversPoint(loaded, point)
  }

  const isFetching = computed<boolean>(() => fetchingSources.value.length > 0)

  // Each fetch is kept as a file on the vehicle (and cached on this computer), so every topside
  // computer flying it reuses the last load, offline included, until the operator loads again. The
  // fetch time is part of the id so a reload elsewhere arrives as a new file rather than a stale one.
  const hazardFiles = createVehicleFileStorage<HazardFileMeta>({
    settingsKey: 'cockpit-hazard-area-files-v1',
    indexedDbStoreName: 'cockpit-hazard-area-files',
    vehicleSubfolder: 'hazard-areas',
    mimeType: 'application/json',
    fileExtension: 'json',
  })

  const filesOfSource = (sourceId: HazardFileSourceId): HazardFileMeta[] =>
    hazardFiles.entries.value.filter((entry) => entry.sourceId === sourceId)

  const storedAtMs = (data: HazardFetchResult | TerrainGrid): number => data.clearedAtMs ?? data.fetchedAtMs

  const loadedAtMs = (sourceId: HazardFileSourceId): number => {
    const loaded = sourceId === 'terrain' ? terrainGrid.value : results.value[sourceId]
    return loaded ? storedAtMs(loaded) : -Infinity
  }

  const isNewerThanLoaded = (entry: HazardFileMeta): boolean =>
    hazardFiles.entries.value.some(({ id }) => id === entry.id) && loadedAtMs(entry.sourceId) < entry.createdAt

  const restoreStoredHazards = async (entry: HazardFileMeta, url: string): Promise<void> => {
    if (!isNewerThanLoaded(entry)) return
    const json = await (await fetch(url)).text()
    if (entry.sourceId === 'terrain') {
      const grid = parseStoredTerrainGrid(json)
      if (grid && isNewerThanLoaded(entry)) terrainGrid.value = grid
      return
    }
    const stored = parseStoredHazards(entry.sourceId, json)
    if (stored && isNewerThanLoaded(entry)) results.value = { ...results.value, [entry.sourceId]: stored }
  }

  watch(
    () => hazardFiles.entries.value.map((entry) => ({ entry, url: hazardFiles.urlFor(entry.id) })),
    (files) => {
      files.forEach(({ entry, url }) => {
        if (!url) return
        restoreStoredHazards(entry, url).catch((error) =>
          console.error(`Could not restore stored hazard areas for ${entry.sourceId}:`, error)
        )
      })
    },
    { immediate: true }
  )

  // Best-effort: a failed write leaves the freshly fetched areas usable for the session rather than
  // failing the refresh.
  const storeSourceFile = async (
    sourceId: HazardFileSourceId,
    data: HazardFetchResult | TerrainGrid
  ): Promise<void> => {
    const replaced = filesOfSource(sourceId)
    const createdAt = storedAtMs(data)
    try {
      await hazardFiles.add({ id: `${sourceId}-${createdAt}`, sourceId, createdAt }, JSON.stringify(data))
      await Promise.all(replaced.map((entry) => hazardFiles.remove(entry.id)))
    } catch (error) {
      console.warn(`Could not store hazard data for ${sourceId}:`, error)
    }
  }

  const sampleTerrainGrid = async (bbox: GeoBbox): Promise<TerrainGrid> => {
    const { columns, rows, zoom, positions } = terrainGridLayout(bbox)
    // Whole meters keep the stored file small, and the model is no finer than that.
    const elevationsM = (await sampleElevations(positions, zoom)).map((elevation) =>
      elevation === null ? null : Math.round(elevation)
    )
    if (elevationsM.every((elevation) => elevation === null))
      throw new Error('the elevation tiles could not be reached')
    return { bbox, fetchedAtMs: Date.now(), columns, rows, elevationsM }
  }

  const setSourceEnabled = (sourceId: HazardSourceId, enabled: boolean): void => {
    const remaining = settings.value.enabledSources.filter((id) => id !== sourceId)
    settings.value.enabledSources = enabled ? [...remaining, sourceId] : remaining
  }

  const describeFailure = (error: unknown): string => {
    if (error instanceof OpenAipAuthError) return error.message
    if (error instanceof Error) return error.message
    return 'the source could not be reached'
  }

  /**
   * Fetches every enabled area source, and samples the terrain grid when terrain is enabled, over one
   * bounding box, replacing whatever each had cached. Areas outside the box were never queried, so
   * their absence says nothing about them.
   * @param {GeoBbox} bbox Area to query, normally the current map view.
   * @param {HazardSourceId[]} [only] Sources to load instead of the enabled ones, enabled or not.
   * @returns {Promise<void>}
   */
  const refreshAreas = async (bbox: GeoBbox, only?: HazardSourceId[]): Promise<void> => {
    // The caller reads the box off a map through a ref, so what arrives here is a reactive proxy.
    // It ends up inside the cached result, and IndexedDB cannot structured-clone a proxy.
    const queryBbox = { ...bbox }
    const sources = only ? HAZARD_AREA_SOURCE_IDS.filter((id) => only.includes(id)) : enabledAreaSources.value
    const gridSources = only ? HAZARD_GRID_SOURCE_IDS.filter((id) => only.includes(id)) : enabledGridSources.value
    const withTerrain = gridSources.length > 0
    if (sources.length === 0 && !withTerrain) {
      openSnackbar({ variant: 'info', message: 'No hazard sources are enabled.', duration: 3000 })
      return
    }
    if (bboxMaxSpanDegrees(queryBbox) > MAX_HAZARD_BBOX_DEG) {
      openSnackbar({
        variant: 'info',
        message: 'The visible area is too large to load hazard data for. Zoom in and try again.',
        duration: 4000,
      })
      return
    }

    // A full refresh replaces the one in flight, while loading single sources adds to it.
    const activeController = new AbortController()
    if (!only) {
      controller?.abort()
      controller = activeController
    }
    const loading = [...sources, ...gridSources]
    fetchingSources.value = [...fetchingSources.value.filter((id) => !loading.includes(id)), ...loading]

    const failures: string[] = []
    const partial: string[] = []
    let areaCount = 0

    // The grid sources share one sampling, so they are loaded, and fail, together.
    const load = async (sourceIds: HazardSourceId[], fetchAndStore: () => Promise<void>): Promise<void> => {
      try {
        await fetchAndStore()
      } catch (error) {
        if ((error as DOMException)?.name === 'AbortError') return
        const labels = sourceIds.map((sourceId) => HAZARD_SOURCES[sourceId].label).join(' and ')
        failures.push(`${labels}: ${describeFailure(error)}`)
      } finally {
        fetchingSources.value = fetchingSources.value.filter((id) => !sourceIds.includes(id))
      }
    }

    const loadTerrain = async (): Promise<void> => {
      const grid = await sampleTerrainGrid(queryBbox)
      if (activeController.signal.aborted) return
      terrainGrid.value = grid
      await storeSourceFile('terrain', grid)
    }

    await Promise.all([
      ...sources.map((sourceId) =>
        load([sourceId], async () => {
          const result = await fetchers[sourceId](queryBbox, activeController.signal)
          if (activeController.signal.aborted) return
          results.value = { ...results.value, [sourceId]: result }
          areaCount += result.areas.length
          if (result.truncated) partial.push(HAZARD_SOURCES[sourceId].label)
          await storeSourceFile(sourceId, result)
        })
      ),
      ...(withTerrain ? [load(gridSources, loadTerrain)] : []),
    ])

    if (controller === activeController) controller = null
    if (activeController.signal.aborted) return

    if (failures.length > 0) {
      openSnackbar({
        variant: 'error',
        message: `Could not load every hazard source. ${failures.join('. ')}`,
        duration: 6000,
      })
      return
    }
    const partialNote = partial.length > 0 ? ` ${partial.join(' and ')} had more than fit; zoom in for the rest.` : ''
    const loaded = [
      ...(sources.length > 0 ? [`${areaCount} hazard area${areaCount === 1 ? '' : 's'}`] : []),
      ...(withTerrain ? ['the ground elevation'] : []),
    ].join(' and ')
    openSnackbar({
      variant: 'success',
      message: `Loaded ${loaded} over the current view.${partialNote}`,
      duration: partial.length > 0 ? 6000 : 3000,
    })
  }

  /**
   * Drops one source's areas, on the map and on disk.
   * @param {HazardFileSourceId} sourceId Source to clear, `terrain` being the grid both grid sources trace.
   * @returns {Promise<void>}
   */
  const clearSource = async (sourceId: HazardFileSourceId): Promise<void> => {
    if (sourceId === 'terrain') {
      terrainGrid.value = null
    } else {
      const remaining = { ...results.value }
      delete remaining[sourceId]
      results.value = remaining
    }
    await Promise.all(filesOfSource(sourceId).map((entry) => hazardFiles.remove(entry.id)))
  }

  /**
   * Clears the loaded hazard data inside a box, on the map and in the stored copies, and marks the box as
   * not loaded again so waypoints in it are reported as uncovered. Areas reaching outside the box are kept.
   * @param {GeoBbox} bbox Area to clear, normally the current map view.
   * @returns {Promise<void>}
   */
  const clearDataIn = async (bbox: GeoBbox): Promise<void> => {
    const box = { ...bbox }
    const clearedAtMs = Date.now()
    const isWhollyInside = (coverage: HazardCoverage): boolean =>
      bboxContains(box, [coverage.bbox.south, coverage.bbox.west]) &&
      bboxContains(box, [coverage.bbox.north, coverage.bbox.east])
    const cut = <T extends HazardFetchResult | TerrainGrid>(data: T): T => ({
      ...data,
      clearedBboxes: [...(data.clearedBboxes ?? []), box],
      clearedAtMs,
    })

    const loaded: (HazardFetchResult | TerrainGrid)[] = [
      ...HAZARD_AREA_SOURCE_IDS.flatMap((sourceId) => results.value[sourceId] ?? []),
      ...(terrainGrid.value ? [terrainGrid.value] : []),
    ]
    const updates = loaded
      .filter((data) => bboxIntersects(data.bbox, box))
      .map((data) => {
        const sourceId = 'sourceId' in data ? data.sourceId : 'terrain'
        if (isWhollyInside(data)) return clearSource(sourceId)
        if ('sourceId' in data) {
          // Only whole areas go: a coastline run cut at the box edge would no longer divide land from water.
          const areas = data.areas.filter((area) => !area.coordinates.every((point) => bboxContains(box, point)))
          const next = cut({ ...data, areas })
          results.value = { ...results.value, [data.sourceId]: next }
          return storeSourceFile(data.sourceId, next)
        }
        const next = cut(clearGridSamplesIn(data, box))
        terrainGrid.value = next
        return storeSourceFile('terrain', next)
      })
    await Promise.all(updates)
    openSnackbar({
      variant: 'success',
      message:
        updates.length > 0
          ? 'Cleared the hazard data in the current view. Load it again to check missions there.'
          : 'There was no hazard data in the current view to clear.',
      duration: 4000,
    })
  }

  /**
   * Clears every loaded hazard source and its stored copies, including copies not restored yet.
   * @returns {Promise<void>}
   */
  const clearAllData = async (): Promise<void> => {
    await Promise.all([...HAZARD_AREA_SOURCE_IDS, 'terrain' as const].map(clearSource))
    openSnackbar({ variant: 'success', message: 'Cleared all hazard data.', duration: 3000 })
  }

  /**
   * Adds a hazard area to the geofence editor as an exclusion polygon, keeping the operator's
   * clearance margin around it and simplifying it down to the configured vertex budget.
   *
   * A fence is two-dimensional, so an airspace area's vertical band is not carried over: the
   * resulting exclusion keeps the vehicle out at every altitude. Nor are an area's holes, so an exclusion
   * traced from the elevation grid also covers the deeper water or lower ground it rings.
   * @param {string} areaId Area to convert, as listed in the advisories or picked on the map.
   * @param {number} [marginM] Clearance to keep from the area, in meters. Defaults to the proximity margin.
   * @returns {boolean} True when a polygon was added.
   */
  const addAreaAsFenceExclusion = (areaId: string, marginM = settings.value.proximityMarginMeters): boolean => {
    const area = findArea(areaId)
    if (!area) return false

    const ring = hazardAreaToExclusionRing(area, marginM, settings.value.exclusionVertexBudget)
    const polygon = ring ? fenceStore.addPolygon(ring, false, area.label) : undefined
    if (!polygon) {
      openSnackbar({
        variant: 'error',
        message: `"${area.label}" could not be turned into an exclusion zone. Its outline is too small or malformed.`,
        duration: 5000,
      })
      return false
    }

    fenceExclusionByArea.value = { ...fenceExclusionByArea.value, [areaId]: polygon.id }
    const band =
      area.lowerLimitM !== undefined || area.upperLimitM !== undefined
        ? ' Its altitude limits are not carried over: a fence keeps the vehicle out at every altitude.'
        : ''
    openSnackbar({
      variant: 'success',
      message:
        `Added "${area.label}" to the geofence as an exclusion zone with ${polygon.vertices.length} vertices, ` +
        `${marginM} m clear of it. Upload the fence to apply it.${band}`,
      duration: 6000,
    })
    return true
  }

  /**
   * Whether an area is already in the geofence editor as an exclusion polygon added from here.
   * @param {string} areaId Area to look up.
   * @returns {boolean} True while the polygon this area produced is still in the editor.
   */
  const isAreaExcluded = (areaId: string): boolean => {
    const polygonId = fenceExclusionByArea.value[areaId]
    return polygonId !== undefined && fenceStore.polygons.some((polygon) => polygon.id === polygonId)
  }

  // Ground is sampled only when something reads it: the grid sources, or airspace bands, whose limits
  // are above sea level while waypoint altitudes are usually relative to home or terrain.
  const sampleMissionGround = async (
    waypoints: Waypoint[],
    homePosition?: WaypointCoordinates
  ): Promise<MissionGround> => {
    const hasBands = visibleAreas.value.some((area) => area.lowerLimitM !== undefined || area.upperLimitM !== undefined)
    if (waypoints.length === 0 || (!hasBands && enabledGridSources.value.length === 0)) {
      return { groundM: [], altitudesAmslM: [] }
    }
    const withHome = hasBands && homePosition !== undefined
    const positions = waypoints.map((waypoint) => waypoint.coordinates)
    const samples = await sampleElevations(withHome ? [...positions, homePosition] : positions)
    const groundM = samples.slice(0, waypoints.length)
    const homeGroundM = withHome ? samples[waypoints.length] ?? null : null
    return { groundM, altitudesAmslM: hasBands ? waypointAltitudesAmsl(waypoints, groundM, homeGroundM) : [] }
  }

  const groundAdvisories = (waypoints: Waypoint[], groundM: (number | null)[]): HazardAdvisory[] => {
    const { terrainClearanceMeters: thresholdM, shallowWaterDepthMeters: depthM } = settings.value
    return [
      ...(isSourceEnabled('terrain')
        ? [
            ...checkTerrainElevation(waypoints, groundM, thresholdM),
            ...checkPathOverAreas(waypoints, terrainAreas.value, 'terrain', `ground higher than ${thresholdM} m`),
          ]
        : []),
      ...(isSourceEnabled('shallow-water')
        ? [
            ...checkShallowWater(waypoints, groundM, depthM),
            ...checkPathOverAreas(waypoints, shallowAreas.value, 'shallow-water', `water ${depthM} m deep or less`),
          ]
        : []),
    ]
  }

  /**
   * Re-runs the hazard checks against a mission and stores the result for the advisory panel.
   * @param {Waypoint[]} waypoints Mission waypoints, in order.
   * @param {WaypointCoordinates} [homePosition] Mission home, the reference for altitudes relative to home.
   * @returns {Promise<HazardAdvisory[]>} The advisories raised, empty when the loaded data shows no contact.
   */
  const checkMission = async (waypoints: Waypoint[], homePosition?: WaypointCoordinates): Promise<HazardAdvisory[]> => {
    let found: HazardAdvisory[] = []
    try {
      const { groundM, altitudesAmslM } = await sampleMissionGround(waypoints, homePosition)
      found = [
        ...checkCoverage(waypoints, loadedCoverage.value),
        ...checkMissionAgainstAreas(
          waypoints,
          visibleAreas.value,
          settings.value.proximityMarginMeters,
          altitudesAmslM
        ),
        ...groundAdvisories(waypoints, groundM),
      ]
    } catch (error) {
      // A malformed ring from a contributor-maintained source must not take the panel, or the
      // upload it gates, down with it. An empty result reads as "nothing found", which the panel
      // already qualifies as "in the data that was loaded".
      console.error('Hazard advisory check failed:', error)
    }
    advisories.value = found
    advisoriesCheckedAtMs.value = Date.now()
    return found
  }

  const lastLiveAlertAtMs = new Map<string, number>()
  let liveContacts = new Set<string>()

  // Runs on a timer rather than a watch on the vehicle position, which updates several times a second.
  const checkVehicleContacts = (): void => {
    const { latitude, longitude } = vehicleStore.coordinates
    if (!settings.value.liveAlerts || !vehicleStore.isVehicleOnline) {
      liveContacts = new Set()
      return
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return

    const areas = [...visibleAreas.value, ...terrainAreas.value, ...shallowAreas.value]
    const marginM = settings.value.proximityMarginMeters
    const contacts = checkMissionAgainstAreas([{ coordinates: [latitude, longitude] }], areas, marginM)
    // Keyed by message, since a coastline or a traced terrain level is many areas sharing one label.
    const messages = new Set(
      contacts.map(({ areaId, kind }) => {
        const label = areas.find((area) => area.id === areaId)?.label ?? 'a hazard area'
        return `Vehicle is ${kind === 'inside' ? `inside "${label}"` : `within ${marginM} m of "${label}"`}.`
      })
    )
    const now = Date.now()
    messages.forEach((message) => {
      if (liveContacts.has(message) || now - (lastLiveAlertAtMs.get(message) ?? -Infinity) < LIVE_REALERT_AFTER_MS) {
        return
      }
      alertStore.pushAlert(new Alert(AlertLevel.Warning, message))
      lastLiveAlertAtMs.set(message, now)
    })
    liveContacts = messages
  }

  useIntervalFn(checkVehicleContacts, LIVE_CHECK_INTERVAL_MS)

  return {
    settings,
    openAipApiKey,
    results,
    terrainGrid,
    terrainAreas,
    shallowAreas,
    coastlineExclusionAreas,
    findArea,
    loadedAreasOf,
    isLoadedAt,
    advisories,
    advisoriesCheckedAtMs,
    enabledAreaSources,
    visibleAreas,
    oldestFetchAtMs,
    isFetching,
    isSamplingTerrain,
    fetchingSources,
    isSourceEnabled,
    setSourceEnabled,
    refreshAreas,
    clearSource,
    clearDataIn,
    clearAllData,
    checkMission,
    addAreaAsFenceExclusion,
    isAreaExcluded,
  }
})
