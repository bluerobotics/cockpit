import { useIntervalFn, useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { type SnackbarOptions, useSnackbar } from '@/composables/snackbar'
import { useTerrainElevation } from '@/composables/useTerrainElevation'
import { type VehicleFileMeta, createVehicleFileStorage } from '@/composables/useVehicleFileStorage'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { type CoastlineFaces, coastlineFaces } from '@/libs/hazards/coastline-faces'
import { bboxContains, bboxMaxSpanDegrees, MAX_HAZARD_BBOX_DEG } from '@/libs/hazards/hazard-areas'
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
import { terrainGridLayout } from '@/libs/hazards/terrain-areas'
import { traceGridAreas } from '@/libs/hazards/terrain-trace'
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

type SourceLoad = {
  /**
   * Areas the load added, zero for the grid sources, which trace rather than list areas.
   */
  areaCount: number
  /**
   * Whether the source held more than the query could bring back.
   */
  truncated: boolean
}

type SourceLoadReport = SourceLoad & {
  /**
   * Labels of the sources the report covers, joined as they are read out.
   */
  labels: string
  /**
   * Why the load failed, absent when it succeeded.
   */
  error?: string
}

const NOTHING_LOADED: SourceLoad = { areaCount: 0, truncated: false }

// Decided from the collected reports alone, so the loaders can stay out of the messaging.
const refreshOutcomeSnackbar = (
  reports: SourceLoadReport[],
  withAreas: boolean,
  withGrid: boolean
): SnackbarOptions => {
  const failures = reports.filter((report) => report.error !== undefined)
  if (failures.length > 0) {
    const detail = failures.map((report) => `${report.labels}: ${report.error}`).join('. ')
    return { variant: 'error', message: `Could not load every hazard source. ${detail}`, duration: 6000 }
  }
  const partial = reports.filter((report) => report.truncated).map((report) => report.labels)
  const partialNote = partial.length > 0 ? ` ${partial.join(' and ')} had more than fit; zoom in for the rest.` : ''
  const areaCount = reports.reduce((total, report) => total + report.areaCount, 0)
  const loaded = [
    ...(withAreas ? [`${areaCount} hazard area${areaCount === 1 ? '' : 's'}`] : []),
    ...(withGrid ? ['the ground elevation'] : []),
  ].join(' and ')
  return {
    variant: 'success',
    message: `Loaded ${loaded} over the current view.${partialNote}`,
    duration: partial.length > 0 ? 6000 : 3000,
  }
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

  const results = shallowRef<Partial<Record<HazardAreaSourceId, HazardFetchResult>>>({})
  const terrainGrid = shallowRef<TerrainGrid | null>(null)
  const fetchingSources = ref<HazardSourceId[]>([])
  const advisories = ref<HazardAdvisory[]>([])
  // Session-only: it exists to stop the same area being added twice, and a reload takes the
  // question with it since the operator then sees the polygon in the editor rather than the button.
  const fenceExclusionByArea = ref<Record<string, string>>({})

  let controller: AbortController | null = null
  let checkToken = 0

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

  // Tracing takes seconds on a full grid, so it runs in a worker and lands here when it is done,
  // and it depends only on the grid and its threshold: toggling any source must not throw it away.
  // Shallow, as the grid is: a traced coastline-sized area holds tens of thousands of coordinates,
  // and deep reactivity would proxy every one of them.
  const tracedAreas = shallowRef<Record<HazardGridSourceId, HazardArea[]>>({ 'terrain': [], 'shallow-water': [] })
  const traceTokens: Record<HazardGridSourceId, number> = { 'terrain': 0, 'shallow-water': 0 }
  const traceRuns: Record<HazardGridSourceId, Promise<void>> = {
    'terrain': Promise.resolve(),
    'shallow-water': Promise.resolve(),
  }

  const thresholdOf = (sourceId: HazardGridSourceId): number =>
    sourceId === 'terrain' ? settings.value.terrainClearanceMeters : settings.value.shallowWaterDepthMeters

  const retrace = async (sourceId: HazardGridSourceId): Promise<void> => {
    const token = ++traceTokens[sourceId]
    const grid = terrainGrid.value
    const keepIfCurrent = (areas: HazardArea[]): void => {
      if (traceTokens[sourceId] === token) tracedAreas.value = { ...tracedAreas.value, [sourceId]: areas }
    }
    if (!grid) return keepIfCurrent([])
    try {
      keepIfCurrent(await traceGridAreas(sourceId, grid, thresholdOf(sourceId)))
    } catch (error) {
      console.error(`Could not trace the ${HAZARD_SOURCES[sourceId].label.toLowerCase()} areas:`, error)
    }
  }

  // Synchronous so a caller that has just replaced the grid can await the trace it started.
  HAZARD_GRID_SOURCE_IDS.forEach((sourceId) =>
    // An array source is compared element by element, so a settings payload arriving from the
    // vehicle with the same threshold in it does not start the trace again.
    watch([terrainGrid, () => thresholdOf(sourceId)], () => (traceRuns[sourceId] = retrace(sourceId)), {
      flush: 'sync',
    })
  )

  const whenTraced = (): Promise<void> =>
    Promise.all(HAZARD_GRID_SOURCE_IDS.map((sourceId) => traceRuns[sourceId])).then(() => undefined)

  const tracedTerrainAreas = computed<HazardArea[]>(() => tracedAreas.value.terrain)
  const tracedShallowAreas = computed<HazardArea[]>(() => tracedAreas.value['shallow-water'])

  /** Ground higher than the terrain threshold, over the loaded grid. */
  const terrainAreas = computed<HazardArea[]>(() => (isSourceEnabled('terrain') ? tracedTerrainAreas.value : []))

  /** Water no deeper than the shallow-water depth, over the loaded grid. */
  const shallowAreas = computed<HazardArea[]>(() => (isSourceEnabled('shallow-water') ? tracedShallowAreas.value : []))

  /** Area each enabled source with loaded data covers, anything outside being unknown rather than clear. */
  const loadedBboxes = computed<GeoBbox[]>(() => [
    ...enabledAreaSources.value.flatMap((sourceId) => results.value[sourceId]?.bbox ?? []),
    ...(enabledGridSources.value.length > 0 && terrainGrid.value ? [terrainGrid.value.bbox] : []),
  ])

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
    const bbox = HAZARD_GRID_SOURCE_IDS.includes(sourceId as HazardGridSourceId)
      ? terrainGrid.value?.bbox
      : results.value[sourceId as HazardAreaSourceId]?.bbox
    return bbox !== undefined && bboxContains(bbox, point)
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

  const loadedAtMs = (sourceId: HazardFileSourceId): number =>
    (sourceId === 'terrain' ? terrainGrid.value?.fetchedAtMs : results.value[sourceId]?.fetchedAtMs) ?? -Infinity

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
    fetchedAtMs: number,
    data: HazardFetchResult | TerrainGrid
  ): Promise<void> => {
    const replaced = filesOfSource(sourceId)
    try {
      await hazardFiles.add(
        { id: `${sourceId}-${fetchedAtMs}`, sourceId, createdAt: fetchedAtMs },
        JSON.stringify(data)
      )
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

  const loadAreaSource = async (
    sourceId: HazardAreaSourceId,
    bbox: GeoBbox,
    signal: AbortSignal
  ): Promise<SourceLoad> => {
    const result = await fetchers[sourceId](bbox, signal)
    if (signal.aborted) return NOTHING_LOADED
    results.value = { ...results.value, [sourceId]: result }
    await storeSourceFile(sourceId, result.fetchedAtMs, result)
    return { areaCount: result.areas.length, truncated: result.truncated === true }
  }

  const loadTerrainGrid = async (bbox: GeoBbox, signal: AbortSignal): Promise<SourceLoad> => {
    const grid = await sampleTerrainGrid(bbox)
    if (signal.aborted) return NOTHING_LOADED
    terrainGrid.value = grid
    // The areas only appear once the worker has traced them, so the source stays busy until then.
    await Promise.all([whenTraced(), storeSourceFile('terrain', grid.fetchedAtMs, grid)])
    return NOTHING_LOADED
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

    // The grid sources share one sampling, so they are loaded, and fail, together.
    const runLoad = async (
      sourceIds: HazardSourceId[],
      load: () => Promise<SourceLoad>
    ): Promise<SourceLoadReport | undefined> => {
      const labels = sourceIds.map((sourceId) => HAZARD_SOURCES[sourceId].label).join(' and ')
      try {
        return { labels, ...(await load()) }
      } catch (error) {
        if ((error as DOMException)?.name === 'AbortError') return undefined
        return { labels, ...NOTHING_LOADED, error: describeFailure(error) }
      } finally {
        fetchingSources.value = fetchingSources.value.filter((id) => !sourceIds.includes(id))
      }
    }

    const reports = await Promise.all([
      ...sources.map((sourceId) =>
        runLoad([sourceId], () => loadAreaSource(sourceId, queryBbox, activeController.signal))
      ),
      ...(withTerrain ? [runLoad(gridSources, () => loadTerrainGrid(queryBbox, activeController.signal))] : []),
    ])

    if (controller === activeController) controller = null
    if (activeController.signal.aborted) return

    const loaded = reports.filter((report): report is SourceLoadReport => report !== undefined)
    openSnackbar(refreshOutcomeSnackbar(loaded, sources.length > 0, withTerrain))
  }

  /**
   * Drops one source's areas, on the map and on disk.
   * @param {HazardAreaSourceId} sourceId Source to clear.
   * @returns {Promise<void>}
   */
  const clearSource = async (sourceId: HazardAreaSourceId): Promise<void> => {
    const remaining = { ...results.value }
    delete remaining[sourceId]
    results.value = remaining
    await Promise.all(filesOfSource(sourceId).map((entry) => hazardFiles.remove(entry.id)))
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

    const budget = settings.value.exclusionVertexBudget
    const ring = hazardAreaToExclusionRing(area, marginM, budget)
    const polygon = Array.isArray(ring) ? fenceStore.addPolygon(ring, false, area.label) : undefined
    if (!polygon) {
      const tooCoarse =
        `"${area.label}" cannot be outlined within ${budget} vertices while staying ${marginM} m clear of it. ` +
        'Raise the exclusion vertex budget or the clearance, or pick a smaller area.'
      const malformed = `"${area.label}" could not be turned into an exclusion zone. Its outline is too small or malformed.`
      openSnackbar({ variant: 'error', message: ring === 'budget' ? tooCoarse : malformed, duration: 6000 })
      return false
    }

    logUserAction(`Added "${area.label}" to the geofence as an exclusion zone ${marginM} m clear of it`)
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
    const token = ++checkToken
    let found: HazardAdvisory[] = []
    try {
      // A grid whose trace has not landed yet would read as empty, which is the one answer a check
      // gating an upload must not give.
      await whenTraced()
      const { groundM, altitudesAmslM } = await sampleMissionGround(waypoints, homePosition)
      found = [
        ...checkCoverage(waypoints, loadedBboxes.value),
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
    // A check waiting on an uncached elevation tile can finish after a newer one, whose result the
    // panel is already showing.
    if (checkToken === token) advisories.value = found
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
    coastlineExclusionAreas,
    findArea,
    loadedAreasOf,
    isLoadedAt,
    advisories,
    visibleAreas,
    isFetching,
    isSamplingTerrain,
    fetchingSources,
    isSourceEnabled,
    setSourceEnabled,
    refreshAreas,
    clearSource,
    checkMission,
    addAreaAsFenceExclusion,
    isAreaExcluded,
  }
})
