import L from 'leaflet'
import { type SaveStatus, type TileInfo, downloadTile, savetiles } from 'leaflet.offline'
import { computed, ref } from 'vue'
import type { ComposerTranslation } from 'vue-i18n'

import { type DialogOptions, type DialogResult } from '@/composables/interactionDialog'
import { type SnackbarOptions } from '@/composables/snackbar'
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
  /**
   * i18n translation function.
   */
  t: ComposerTranslation
}

const SAMPLE_COUNT = 3

/**
 * Estimates the average byte size of tiles by downloading a small sample.
 * @param {TileInfo[]} tiles - The array of tile info objects to sample from
 * @param {number} count - How many tiles to sample
 * @returns {Promise<number>} Average tile size in bytes, or 0 on failure
 */
async function estimateAvgTileSize(tiles: TileInfo[], count: number = SAMPLE_COUNT): Promise<number> {
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
  const { showDialog, closeDialog, openSnackbar, t } = deps

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

  const confirmDownloadDialog =
    (layerLabel: string) =>
    async (status: SaveStatus, ok: () => void): Promise<void> => {
      const tileCount = status._tilesforSave.length
      let sizeInfo = ''
      try {
        const avg = await estimateAvgTileSize(status._tilesforSave)
        if (avg > 0) {
          avgTileSize.value = avg
          sizeInfo = ` (~${formatMB(avg * tileCount)} MB)`
        }
      } catch {
        // Fall back to count-only display
      }

      showDialog({
        variant: 'info',
        message: `${t('Save {count} {layerLabel} tiles for offline use?', { count: tileCount, layerLabel })}${sizeInfo}`,
        persistent: false,
        maxWidth: '450px',
        actions: [
          { text: t('Cancel'), color: 'white', action: closeDialog },
          {
            text: t('Save tiles'),
            color: 'white',
            action: () => {
              ok()
              closeDialog()
            },
          },
        ] as DialogActions[],
      })
    }

  const deleteDownloadedTilesDialog =
    (layerLabel: string) =>
    (_status: SaveStatus, ok: () => void): void => {
      showDialog({
        variant: 'warning',
        message: t('Remove all saved {layerLabel} tiles for this layer?', { layerLabel }),
        persistent: false,
        maxWidth: '450px',
        actions: [
          { text: t('Cancel'), color: 'white', action: closeDialog },
          {
            text: t('Remove tiles'),
            color: 'white',
            action: () => {
              ok()
              closeDialog()
              openSnackbar({ message: t('{layerLabel} offline tiles removed', { layerLabel }), variant: 'info', duration: 3000 })
            },
          },
        ] as DialogActions[],
      })
    }

  /**
   * Creates a savetiles control for the given layer with download size estimation.
   * @param {any} layer - The TileLayerOffline instance
   * @param {string} layerLabel - Human-readable label for the layer (e.g. "Esri")
   * @param {number} maxZoom - Maximum zoom level to save
   * @returns {L.Control} The savetiles control instance
   */
  const downloadOfflineMapTiles = (layer: any, layerLabel: string, maxZoom: number): L.Control => {
    return savetiles(layer, {
      saveWhatYouSee: true,
      maxZoom,
      alwaysDownload: false,
      position: 'topright',
      parallel: 20,
      confirm: confirmDownloadDialog(layerLabel),
      confirmRemoval: deleteDownloadedTilesDialog(layerLabel),
      saveText: `<i class="mdi mdi-download" title="${t('Save {layerLabel} tiles', { layerLabel })}"></i>`,
      rmText: `<i class="mdi mdi-trash-can" title="${t('Remove {layerLabel} tiles', { layerLabel })}"></i>`,
    })
  }

  /**
   * Attaches progress event listeners to a tile layer for tracking download state.
   * @param {any} layer - The TileLayerOffline instance
   * @param {string} layerName - Human-readable name for snackbar messages
   */
  const attachOfflineProgress = (layer: any, layerName: string): void => {
    layer.on('savestart', (e: any) => {
      tilesSaved.value = 0
      tilesTotal.value = e?._tilesforSave?.length ?? 0
      savingLayerName.value = layerName
      isSavingOfflineTiles.value = true
      openSnackbar({ message: t('Saving {count} {layerName} tiles...', { count: tilesTotal.value, layerName }), variant: 'info', duration: 2000 })
    })

    layer.on('loadtileend', () => {
      tilesSaved.value += 1
      if (tilesTotal.value > 0 && tilesSaved.value >= tilesTotal.value) {
        openSnackbar({ message: t('{layerName} offline tiles saved!', { layerName }), variant: 'success', duration: 3000 })
        isSavingOfflineTiles.value = false
        savingLayerName.value = ''
        tilesSaved.value = 0
        tilesTotal.value = 0
        avgTileSize.value = 0
      }
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
    downloadOfflineMapTiles,
    attachOfflineProgress,
  }
}
