import { saveAs } from 'file-saver'
import { msgid, ngettext, t } from 'ttag'
import { v4 as uuid } from 'uuid'
import { type ComputedRef, type Ref, computed, ref } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { useExternalMapOverlays } from '@/composables/map/useExternalMapOverlays'
import { openSnackbar } from '@/composables/snackbar'
import { sampleTerrain } from '@/libs/terrain/elevation-service'
import { measuredCellCenter, medianOffsetM } from '@/libs/terrain/measured-terrain'
import {
  type MeasuredTerrainGeoJson,
  type MeasuredTerrainMeta,
  type SelectedCell,
  cellsInMissionArea,
  measuredTerrainFromGeoJson,
  measuredTerrainToGeoJson,
  MISSION_AREA_MARGIN_M,
} from '@/libs/terrain/measured-terrain-geojson'
import { terrainVehicleClass } from '@/libs/terrain/mission-profile'
import { messageFromError } from '@/libs/utils'
import { useMissionStore } from '@/stores/mission'
import { useTerrainStore } from '@/stores/terrain'
import type { TerrainDatasetMeta } from '@/types/terrain'

/**
 * The measured terrain datasets kept with the missions, and what the library does with them.
 */
export interface UseTerrainLibraryReturn {
  /**
   * Every dataset kept on the vehicle, newest last.
   */
  datasets: ComputedRef<TerrainDatasetMeta[]>
  /**
   * Ids of the datasets currently drawn on the maps.
   */
  shownIds: Ref<string[]>
  /**
   * How many trusted cells the current mission's area holds, as of the last {@link refreshMissionCells}.
   */
  missionCellCount: Ref<number>
  /**
   * Whether a dataset is being written or read.
   */
  busy: Ref<boolean>
  /**
   * Counts the trusted cells in the current mission's area, for the controls that need them.
   */
  refreshMissionCells: () => void
  /**
   * Keeps the current mission's measurements in the library, under a name.
   */
  saveMissionTerrain: (name: string, missionId?: string) => Promise<void>
  /**
   * Writes the current mission's measurements to a GeoJSON file.
   */
  exportMissionTerrain: () => Promise<void>
  /**
   * Reads a GeoJSON file into the library and into the measured terrain, and shows it on the maps.
   */
  importFile: (file: File) => Promise<void>
  /**
   * Adds a dataset's measurements to the measured terrain, so the terrain checks use them.
   */
  useAsMeasured: (id: string) => Promise<void>
  /**
   * Shows or hides a dataset on every Cockpit map.
   */
  toggleOnMap: (id: string) => Promise<void>
  /**
   * Draws a dataset on every Cockpit map and asks them to frame the ground it covers.
   */
  focusOnMap: (id: string) => Promise<void>
  /**
   * Writes a dataset back out to a GeoJSON file.
   */
  exportDataset: (id: string) => Promise<void>
  /**
   * Forgets a dataset, here and on the vehicle, after the operator confirms.
   */
  removeDataset: (id: string) => Promise<void>
}

const overlayIdFor = (id: string): string => `cockpit-terrain-${id}`

const parseGeoJsonText = (text: string): Partial<MeasuredTerrainGeoJson> => {
  try {
    return JSON.parse(text) as Partial<MeasuredTerrainGeoJson>
  } catch {
    throw new Error(t`it is not a GeoJSON file.`)
  }
}

const fileNameFor = (name: string): string => {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'measured-terrain'
  return `${slug}-${new Date().toISOString().slice(0, 10)}.geojson`
}

const createState = (): UseTerrainLibraryReturn => {
  const terrainStore = useTerrainStore()
  const missionStore = useMissionStore()
  const { confirmAction } = useInteractionDialog()
  const { handleExternalMapOverlayMessage, removeOverlay } = useExternalMapOverlays()

  const shownIds = ref<string[]>([])
  const missionCellCount = ref(0)
  const busy = ref(false)

  const datasets = computed(() =>
    [...terrainStore.terrainDatasets].sort((first, second) => first.createdAt - second.createdAt)
  )

  const vehicleClass = (): ReturnType<typeof terrainVehicleClass> =>
    terrainVehicleClass(missionStore.effectiveVehicleType)

  const missionCells = (): SelectedCell[] =>
    cellsInMissionArea(
      terrainStore.measured,
      missionStore.currentPlanningWaypoints.map((waypoint) => waypoint.coordinates),
      missionStore.currentPlanningSurveys.map((survey) => survey.polygonCoordinates),
      MISSION_AREA_MARGIN_M
    )

  // Walking the whole grid costs too much to do on every mission edit, so the panels ask for it when they open.
  const refreshMissionCells = (): void => {
    missionCellCount.value = missionCells().length
  }

  const missionName = (): string => missionStore.missionName || 'Mission'

  // The comparison with the internet model travels with the dataset, so a card can show how far the measurements
  // sit from it without reading the file again.
  const buildGeoJson = async (
    cells: SelectedCell[],
    describedBy: Pick<MeasuredTerrainMeta, 'vehicleClass' | 'missionName'>
  ): Promise<MeasuredTerrainGeoJson> => {
    const centers = cells.map(([key]) => measuredCellCenter(key))
    const modelM = await sampleTerrain(centers, { mode: 'bilinear', modelOnly: true })
    return measuredTerrainToGeoJson(cells, {
      waterLevelM: terrainStore.settings.waterLevelOffsetM,
      ...describedBy,
      modelM,
    })
  }

  const metaFor = (name: string, geojson: MeasuredTerrainGeoJson, missionId?: string): TerrainDatasetMeta => {
    const heights = geojson.features.map((feature) => feature.geometry.coordinates[2])
    const latitudes = geojson.features.map((feature) => feature.geometry.coordinates[1])
    const longitudes = geojson.features.map((feature) => feature.geometry.coordinates[0])
    const model = geojson.features.map((feature) => (feature.properties.model_height_m as number | null) ?? null)
    return {
      // Lowercase hexadecimal with single dashes, which is what the overlay pipeline accepts as an overlay id.
      id: uuid(),
      createdAt: Date.now(),
      name,
      ...(geojson.cockpit.missionName ? { missionName: geojson.cockpit.missionName } : {}),
      ...(missionId ? { missionId } : {}),
      pointCount: geojson.features.length,
      bounds: {
        south: Math.min(...latitudes),
        north: Math.max(...latitudes),
        west: Math.min(...longitudes),
        east: Math.max(...longitudes),
      },
      minHeightM: Math.min(...heights),
      maxHeightM: Math.max(...heights),
      vehicleClass: geojson.cockpit.vehicleClass,
      modelOffsetM: medianOffsetM(heights, model),
    }
  }

  const noCellsMessage = t`No measurement the vehicle recorded falls within ${MISSION_AREA_MARGIN_M} m of this mission. Record along its path, or load a dataset from a file.`

  const withBusy = async (action: () => Promise<void>, failure: string): Promise<void> => {
    if (busy.value) return
    busy.value = true
    try {
      await action()
    } catch (error) {
      openSnackbar({ variant: 'error', message: `${failure} ${messageFromError(error)}`, duration: 5000 })
    } finally {
      busy.value = false
    }
  }

  const saveMissionTerrain = (name: string, missionId?: string): Promise<void> =>
    withBusy(async () => {
      const cells = missionCells()
      if (cells.length === 0) {
        openSnackbar({ variant: 'warning', message: noCellsMessage, duration: 6000 })
        return
      }
      logUserAction(`Kept the measured terrain of a mission in the library as "${name}"`)
      const geojson = await buildGeoJson(cells, { vehicleClass: vehicleClass(), missionName: missionName() })
      const meta = metaFor(name, geojson, missionId)
      await terrainStore.addTerrainDataset(meta, JSON.stringify(geojson))
      refreshMissionCells()
      const message = t`"${name}" kept with ${cells.length} measured cells, and copied to the vehicle when it is online.`
      openSnackbar({ variant: 'success', message, duration: 5000 })
    }, t`Could not keep the measured terrain:`)

  const exportMissionTerrain = (): Promise<void> =>
    withBusy(async () => {
      const cells = missionCells()
      if (cells.length === 0) {
        openSnackbar({ variant: 'warning', message: noCellsMessage, duration: 6000 })
        return
      }
      logUserAction("Exported the measured terrain of the current mission's area as GeoJSON")
      const geojson = await buildGeoJson(cells, { vehicleClass: vehicleClass(), missionName: missionName() })
      const fileName = fileNameFor(`${missionName()}-terrain`)
      saveAs(new Blob([JSON.stringify(geojson)], { type: 'application/geo+json' }), fileName)
      const message = t`${cells.length} measured cells saved as ${fileName}.`
      openSnackbar({ variant: 'success', message, duration: 4000 })
    }, t`Could not save the measured terrain:`)

  const readDataset = async (id: string): Promise<MeasuredTerrainGeoJson> => {
    const url = terrainStore.terrainDatasetUrl(id)
    if (!url) throw new Error(t`its file is not on this computer yet. Connect to the vehicle and try again.`)
    return (await (await fetch(url)).json()) as MeasuredTerrainGeoJson
  }

  const mergeIntoMeasured = async (source: unknown, label: string): Promise<SelectedCell[]> => {
    const { cells, skipped } = measuredTerrainFromGeoJson(source, terrainStore.settings.waterLevelOffsetM)
    if (cells.size === 0) throw new Error(t`it holds no measured points.`)
    await terrainStore.importMeasured(cells)
    refreshMissionCells()
    const message =
      skipped > 0
        ? ngettext(
            msgid`${cells.size} measured cells from "${label}" added to the measured terrain, ${skipped} feature ignored.`,
            `${cells.size} measured cells from "${label}" added to the measured terrain, ${skipped} features ignored.`,
            skipped
          )
        : t`${cells.size} measured cells from "${label}" added to the measured terrain.`
    openSnackbar({ variant: 'success', message, duration: 5000 })
    return [...cells]
  }

  const showOnMap = (meta: TerrainDatasetMeta, geojson: MeasuredTerrainGeoJson): void => {
    // Live, so the overlay pipeline keeps no second copy of the mesh: the library file stays the only source.
    handleExternalMapOverlayMessage({
      type: 'cockpit:setMapOverlay',
      overlay: {
        id: overlayIdFor(meta.id),
        name: t`${meta.name} (measured terrain)`,
        live: true,
        geojson: { type: 'FeatureCollection', features: geojson.features },
      },
    })
    if (!shownIds.value.includes(meta.id)) shownIds.value = [...shownIds.value, meta.id]
  }

  const hideFromMap = (id: string): void => {
    removeOverlay(overlayIdFor(id))
    shownIds.value = shownIds.value.filter((shown) => shown !== id)
  }

  const importFile = (file: File): Promise<void> =>
    withBusy(async () => {
      const text = await file.text()
      const source = parseGeoJsonText(text)
      const name = file.name.replace(/\.(geo)?json$/i, '') || 'Imported terrain'
      logUserAction(`Imported the measured terrain file "${file.name}"`)
      const cells = await mergeIntoMeasured(source, name)
      // Written back in Cockpit's own shape, so a file from other software gains the same colors, depths and
      // model comparison as one this Cockpit saved.
      const geojson = await buildGeoJson(cells, {
        vehicleClass: source.cockpit?.vehicleClass ?? vehicleClass(),
        missionName: source.cockpit?.missionName,
      })
      const meta = metaFor(name, geojson)
      await terrainStore.addTerrainDataset(meta, JSON.stringify(geojson))
      showOnMap(meta, geojson)
    }, t`Could not read that file:`)

  const useAsMeasured = (id: string): Promise<void> =>
    withBusy(async () => {
      const meta = datasets.value.find((dataset) => dataset.id === id)
      if (!meta) return
      logUserAction(`Used the "${meta.name}" measured terrain dataset as measured terrain`)
      await mergeIntoMeasured(await readDataset(id), meta.name)
    }, t`Could not use that dataset as measured terrain:`)

  const toggleOnMap = (id: string): Promise<void> =>
    withBusy(async () => {
      if (shownIds.value.includes(id)) {
        logUserAction('Hid a measured terrain dataset from the maps')
        hideFromMap(id)
        return
      }
      const meta = datasets.value.find((dataset) => dataset.id === id)
      if (!meta) return
      logUserAction(`Showed the "${meta.name}" measured terrain dataset on the maps`)
      showOnMap(meta, await readDataset(id))
      openSnackbar({ variant: 'success', message: t`"${meta.name}" is now drawn on the maps.`, duration: 4000 })
    }, t`Could not show that dataset on the map:`)

  const focusOnMap = (id: string): Promise<void> =>
    withBusy(async () => {
      const meta = datasets.value.find((dataset) => dataset.id === id)
      if (!meta) return
      logUserAction(`Centered the maps on the "${meta.name}" measured terrain dataset`)
      // Framed from the dataset's own bounds, so this still works before its file has come down from the vehicle.
      const { south, west, north, east } = meta.bounds
      missionStore.requestMapCenterOn([(south + north) / 2, (west + east) / 2], meta.bounds)
      if (!shownIds.value.includes(id)) showOnMap(meta, await readDataset(id))
      openSnackbar({ variant: 'success', message: t`Showing "${meta.name}" on the map.`, duration: 4000 })
    }, t`Centered the map, but could not draw that dataset:`)

  const exportDataset = (id: string): Promise<void> =>
    withBusy(async () => {
      const meta = datasets.value.find((dataset) => dataset.id === id)
      if (!meta) return
      logUserAction(`Exported the "${meta.name}" measured terrain dataset as GeoJSON`)
      const geojson = await readDataset(id)
      const fileName = fileNameFor(meta.name)
      saveAs(new Blob([JSON.stringify(geojson)], { type: 'application/geo+json' }), fileName)
      openSnackbar({ variant: 'success', message: t`"${meta.name}" saved as ${fileName}.`, duration: 4000 })
    }, t`Could not save that dataset:`)

  const removeDataset = async (id: string): Promise<void> => {
    const meta = datasets.value.find((dataset) => dataset.id === id)
    if (!meta) return
    logUserAction(`Opened the confirmation to delete the "${meta.name}" measured terrain dataset`)
    const confirmed = await confirmAction(
      t`Delete "${meta.name}"?`,
      t`The dataset is removed from this computer and from the vehicle. Measurements already added to the measured terrain stay.`,
      t`Delete`,
      '640px'
    )
    if (!confirmed) {
      logUserAction('Canceled deleting a measured terrain dataset')
      return
    }
    logUserAction(`Deleted the "${meta.name}" measured terrain dataset`)
    hideFromMap(id)
    await withBusy(async () => {
      await terrainStore.removeTerrainDataset(id)
      openSnackbar({ variant: 'success', message: t`"${meta.name}" deleted.`, duration: 4000 })
    }, t`Could not delete that dataset:`)
  }

  return {
    datasets,
    shownIds,
    missionCellCount,
    busy,
    refreshMissionCells,
    saveMissionTerrain,
    exportMissionTerrain,
    importFile,
    useAsMeasured,
    toggleOnMap,
    focusOnMap,
    exportDataset,
    removeDataset,
  }
}

let state: UseTerrainLibraryReturn | undefined

/**
 * The measured terrain datasets of the mission library: saving a mission's measurements, importing and
 * exporting them as GeoJSON, drawing them on the maps and feeding them back into the terrain checks. The state
 * is created once and shared, so a dataset shown on the maps stays shown after the library is closed.
 * @returns {UseTerrainLibraryReturn} The datasets and the actions on them.
 */
export const useTerrainLibrary = (): UseTerrainLibraryReturn => {
  if (!state) state = createState()
  return state
}
