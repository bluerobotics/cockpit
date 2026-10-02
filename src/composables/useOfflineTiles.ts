import type { Map as MapLibreMap } from 'maplibre-gl'
import { computed, ref } from 'vue'

import { type DialogOptions, type DialogResult } from '@/composables/interactionDialog'
import { type SnackbarOptions } from '@/composables/snackbar'
import { fromMapLibreZoom } from '@/libs/map/maplibre'
import type { RasterLayerDefinition } from '@/libs/map/raster-layers'
import { type OfflineTileInfo, hasOfflineTile, offlineTilesInBounds, saveOfflineTile } from '@/libs/map/tile-protocol'
import { messageFromError } from '@/libs/utils'
import { type DialogActions } from '@/types/general'

/**
 * Dialog and snackbar functions the composable needs from the consuming component.
 */
interface OfflineTilesDeps {
  /**
   * Shows an interaction dialog and resolves once the user confirms or dismisses it.
   */
  showDialog: (options: DialogOptions) => Promise<DialogResult>
  /**
   * Closes the currently open interaction dialog.
   */
  closeDialog: () => void
  /**
   * Opens a snackbar with the given options.
   */
  openSnackbar: (options: SnackbarOptions) => void
}

const SAMPLE_COUNT = 3
const PARALLEL_DOWNLOADS = 20
// Below this zoom the visible area spans so many tiles that saving it would download a continent.
const MIN_SAVE_ZOOM = 5

const downloadTile = async (url: string): Promise<Blob> => {
  const response = await fetch(url, { referrerPolicy: 'strict-origin-when-cross-origin' })
  if (!response.ok) throw new Error(`Request failed with status ${response.statusText}`)
  return response.blob()
}

/**
 * Estimates the average byte size of tiles by downloading a small sample.
 * @param {OfflineTileInfo[]} tiles - The tiles to sample from
 * @param {number} count - How many tiles to sample
 * @returns {Promise<number>} Average tile size in bytes, or 0 on failure
 */
async function estimateAvgTileSize(tiles: OfflineTileInfo[], count: number = SAMPLE_COUNT): Promise<number> {
  const samples = tiles.slice(0, Math.min(count, tiles.length))
  if (samples.length === 0) return 0
  try {
    const blobs = await Promise.all(samples.map((t) => downloadTile(t.url)))
    return blobs.reduce((sum, b) => sum + b.size, 0) / blobs.length
  } catch {
    return 0
  }
}

/**
 * Formats a byte value into a human-readable MB string.
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string (e.g. "12.3 MB")
 */
function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1)
}

/**
 * Composable that encapsulates offline tile download logic including
 * size estimation, confirmation dialogs, and download progress tracking.
 * @param {OfflineTilesDeps} deps - Dialog and snackbar functions from the consuming component
 * @returns {object} Reactive state and helper functions for offline tile management
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useOfflineTiles(deps: OfflineTilesDeps) {
  const { showDialog, closeDialog, openSnackbar } = deps

  const isSavingOfflineTiles = ref(false)
  const tilesSaved = ref(0)
  const tilesTotal = ref(0)
  const savingLayerName = ref('')
  const avgTileSize = ref(0)

  const estimatedTotalMB = computed(() => {
    if (avgTileSize.value <= 0 || tilesTotal.value <= 0) return ''
    return formatMB(avgTileSize.value * tilesTotal.value)
  })

  const estimatedDownloadedMB = computed(() => {
    if (avgTileSize.value <= 0) return ''
    return formatMB(avgTileSize.value * tilesSaved.value)
  })

  const savePercentage = computed(() => {
    if (tilesTotal.value <= 0) return 0
    return Math.round((tilesSaved.value / tilesTotal.value) * 100)
  })

  const finishSaving = (): void => {
    isSavingOfflineTiles.value = false
    savingLayerName.value = ''
    tilesSaved.value = 0
    tilesTotal.value = 0
    avgTileSize.value = 0
  }

  // Tiles already saved are skipped, like leaflet.offline did, but still count towards the progress.
  const saveTile = async (tile: OfflineTileInfo): Promise<void> => {
    try {
      if (!(await hasOfflineTile(tile.key))) await saveOfflineTile(tile, await downloadTile(tile.url))
    } catch (error) {
      console.warn(`Could not save map tile ${tile.url} for offline use:`, error)
    }
    tilesSaved.value += 1
  }

  const downloadTiles = async (tiles: OfflineTileInfo[], layerLabel: string): Promise<void> => {
    tilesSaved.value = 0
    tilesTotal.value = tiles.length
    savingLayerName.value = layerLabel
    isSavingOfflineTiles.value = true
    openSnackbar({ message: `Saving ${tiles.length} ${layerLabel} tiles...`, variant: 'info', duration: 2000 })

    const queue = [...tiles]
    const worker = async (): Promise<void> => {
      for (let tile = queue.shift(); tile; tile = queue.shift()) await saveTile(tile)
    }
    await Promise.all(Array.from({ length: Math.min(PARALLEL_DOWNLOADS, tiles.length) }, worker))

    openSnackbar({ message: `${layerLabel} offline tiles saved!`, variant: 'success', duration: 3000 })
    finishSaving()
  }

  /**
   * Asks to save the tiles of a layer that cover the visible area, from the current zoom down to `maxZoom`, and
   * downloads them when confirmed.
   * @param {MapLibreMap} map - The map whose visible area to save.
   * @param {RasterLayerDefinition} layer - The layer whose tiles to save.
   * @param {string} layerLabel - Human-readable label for the layer (e.g. "Esri")
   * @param {number} maxZoom - Maximum zoom level to save, on the tile scale
   */
  const saveVisibleTiles = async (
    map: MapLibreMap,
    layer: RasterLayerDefinition,
    layerLabel: string,
    maxZoom: number
  ): Promise<void> => {
    if (!layer.template) return
    const zoom = Math.round(fromMapLibreZoom(map.getZoom()))
    if (zoom < MIN_SAVE_ZOOM) {
      openSnackbar({
        message: `Zoom in to at least level ${MIN_SAVE_ZOOM} to save ${layerLabel} tiles for offline use.`,
        variant: 'error',
        duration: 4000,
      })
      return
    }
    const bounds = map.getBounds()
    const tiles = offlineTilesInBounds(
      layer.template,
      [
        [bounds.getNorth(), bounds.getWest()],
        [bounds.getSouth(), bounds.getEast()],
      ],
      zoom,
      maxZoom,
      layer.subdomains
    )

    let sizeInfo = ''
    try {
      const avg = await estimateAvgTileSize(tiles)
      if (avg > 0) {
        avgTileSize.value = avg
        sizeInfo = ` (~${formatMB(avg * tiles.length)} MB)`
      }
    } catch {
      // Fall back to count-only display
    }

    showDialog({
      variant: 'info',
      message: `Save ${tiles.length} ${layerLabel} tiles${sizeInfo} for offline use?`,
      persistent: false,
      maxWidth: '450px',
      actions: [
        { text: 'Cancel', color: 'white', action: closeDialog },
        {
          text: 'Save tiles',
          color: 'white',
          action: () => {
            closeDialog()
            downloadTiles(tiles, layerLabel).catch((error) => {
              openSnackbar({
                message: `Could not save ${layerLabel} tiles: ${messageFromError(error)}`,
                variant: 'error',
              })
              finishSaving()
            })
          },
        },
      ] as DialogActions[],
    })
  }

  return {
    isSavingOfflineTiles,
    tilesSaved,
    tilesTotal,
    savingLayerName,
    avgTileSize,
    estimatedTotalMB,
    estimatedDownloadedMB,
    savePercentage,
    saveVisibleTiles,
  }
}
