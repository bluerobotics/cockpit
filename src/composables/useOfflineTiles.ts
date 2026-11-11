import L from 'leaflet'
import { computed, ref } from 'vue'

import { type DialogOptions, type DialogResult } from '@/composables/interactionDialog'
import { type SnackbarOptions } from '@/composables/snackbar'
import {
  type OfflineTile,
  type OfflineTileLayer,
  downloadTile,
  saveTiles,
  storedTileKeys,
} from '@/libs/map/offline-tile-layer'
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

// ponytail: fixed cap that keeps listing the tiles quick and the download finite; base it on the free storage
// (getStorageBytesAvailable) if operators need to save larger areas in one go.
const MAX_TILES_PER_SAVE = 100_000

/**
 * Estimates the average byte size of tiles by downloading a small sample.
 * @param {OfflineTile[]} tiles - The tiles to sample from
 * @param {number} count - How many tiles to sample
 * @returns {Promise<number>} Average tile size in bytes, or 0 on failure
 */
async function estimateAvgTileSize(tiles: OfflineTile[], count: number = SAMPLE_COUNT): Promise<number> {
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

  const confirmDownloadDialog = async (tiles: OfflineTile[], layerLabel: string, ok: () => void): Promise<void> => {
    const tileCount = tiles.length
    let sizeInfo = ''
    try {
      const avg = await estimateAvgTileSize(tiles)
      if (avg > 0) {
        avgTileSize.value = avg
        sizeInfo = ` (~${formatMB(avg * tileCount)} MB)`
      }
    } catch {
      // Fall back to count-only display
    }

    showDialog({
      variant: 'info',
      message: `Save ${tileCount} ${layerLabel} tiles${sizeInfo} for offline use?`,
      persistent: false,
      maxWidth: '450px',
      actions: [
        { text: 'Cancel', color: 'white', action: closeDialog },
        {
          text: 'Save tiles',
          color: 'white',
          action: () => {
            ok()
            closeDialog()
          },
        },
      ] as DialogActions[],
    })
  }

  // The progress readout is shared, and a second save of the same layer would download the tiles still in flight.
  // Checked on entry, and again when a download starts, since two saves can both pass the entry while preparing.
  const refuseWhileSaving = (): boolean => {
    if (!isSavingOfflineTiles.value) return false
    const message = `${savingLayerName.value} tiles are still being saved. Wait for that to finish.`
    openSnackbar({ message, variant: 'info', duration: 3000 })
    return true
  }

  const downloadTiles = async (tiles: OfflineTile[], layerName: string): Promise<void> => {
    if (refuseWhileSaving()) return
    tilesSaved.value = 0
    tilesTotal.value = tiles.length
    savingLayerName.value = layerName
    isSavingOfflineTiles.value = true
    openSnackbar({ message: `Saving ${tilesTotal.value} ${layerName} tiles...`, variant: 'info', duration: 2000 })

    const failed = await saveTiles(tiles, () => (tilesSaved.value += 1))

    if (failed > 0) {
      const message = `${tiles.length - failed} ${layerName} tiles saved, ${failed} could not be downloaded`
      openSnackbar({ message, variant: 'warning', duration: 5000 })
    } else {
      openSnackbar({ message: `${layerName} offline tiles saved!`, variant: 'success', duration: 3000 })
    }
    isSavingOfflineTiles.value = false
    savingLayerName.value = ''
    tilesSaved.value = 0
    tilesTotal.value = 0
    avgTileSize.value = 0
  }

  /**
   * Saves the tiles of the visible area, from the current zoom level up to the layer's last native zoom level,
   * after the user confirms the download size. Tiles already saved are skipped.
   * @param {L.Map} map - The map whose visible area is saved
   * @param {OfflineTileLayer} layer - The layer whose tiles are saved
   * @param {string} layerLabel - Human-readable label for the layer (e.g. "Esri")
   */
  const saveOfflineTiles = async (map: L.Map, layer: OfflineTileLayer, layerLabel: string): Promise<void> => {
    if (refuseWhileSaving()) return

    const maxZoom = layer.options.maxNativeZoom ?? layer.options.maxZoom ?? map.getMaxZoom()
    // Past the last native level Leaflet scales up that level's tiles, so those are the ones to save.
    const minZoom = Math.min(Math.round(map.getZoom()), maxZoom)
    const bounds = map.getBounds()

    const tileCount = layer.countTilesIn(map, bounds, minZoom, maxZoom)
    if (tileCount > MAX_TILES_PER_SAVE) {
      const limit = MAX_TILES_PER_SAVE.toLocaleString()
      const message = `This area has too many ${layerLabel} tiles to save at once (over ${limit}). Zoom in and try again.`
      openSnackbar({ message, variant: 'warning', duration: 5000 })
      return
    }

    const saved = await storedTileKeys(layer.urlTemplate).catch(() => new Set<string>())
    const tiles = layer.tilesIn(map, bounds, minZoom, maxZoom).filter((tile) => !saved.has(tile.key))
    if (tiles.length === 0) {
      const message = `The visible ${layerLabel} tiles are already saved for offline use`
      openSnackbar({ message, variant: 'info', duration: 3000 })
      return
    }
    await confirmDownloadDialog(tiles, layerLabel, () => downloadTiles(tiles, layerLabel))
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
    saveOfflineTiles,
  }
}
