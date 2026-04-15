import L from 'leaflet'
import { type SaveStatus, savetiles } from 'leaflet.offline'
import { computed, ref } from 'vue'

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
}

/**
 * Composable that encapsulates offline tile download logic including
 * confirmation dialogs and download progress tracking.
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

  const savePercentage = computed(() => {
    if (tilesTotal.value <= 0) return 0
    return Math.round((tilesSaved.value / tilesTotal.value) * 100)
  })

  const confirmDownloadDialog =
    (layerLabel: string) =>
    (status: SaveStatus, ok: () => void): void => {
      showDialog({
        variant: 'info',
        message: `Save ${status._tilesforSave.length} ${layerLabel} tiles for offline use?`,
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

  const deleteDownloadedTilesDialog =
    (layerLabel: string) =>
    (_status: SaveStatus, ok: () => void): void => {
      showDialog({
        variant: 'warning',
        message: `Remove all saved ${layerLabel} tiles for this layer?`,
        persistent: false,
        maxWidth: '450px',
        actions: [
          { text: 'Cancel', color: 'white', action: closeDialog },
          {
            text: 'Remove tiles',
            color: 'white',
            action: () => {
              ok()
              closeDialog()
              openSnackbar({ message: `${layerLabel} offline tiles removed`, variant: 'info', duration: 3000 })
            },
          },
        ] as DialogActions[],
      })
    }

  /**
   * Creates a savetiles control for the given layer.
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
      saveText: `<i class="mdi mdi-download" title="Save ${layerLabel} tiles"></i>`,
      rmText: `<i class="mdi mdi-trash-can" title="Remove ${layerLabel} tiles"></i>`,
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
      openSnackbar({ message: `Saving ${tilesTotal.value} ${layerName} tiles...`, variant: 'info', duration: 2000 })
    })

    layer.on('loadtileend', () => {
      tilesSaved.value += 1
      if (tilesTotal.value > 0 && tilesSaved.value >= tilesTotal.value) {
        openSnackbar({ message: `${layerName} offline tiles saved!`, variant: 'success', duration: 3000 })
        isSavingOfflineTiles.value = false
        savingLayerName.value = ''
        tilesSaved.value = 0
        tilesTotal.value = 0
      }
    })
  }

  return {
    isSavingOfflineTiles,
    tilesSaved,
    tilesTotal,
    savingLayerName,
    savePercentage,
    downloadOfflineMapTiles,
    attachOfflineProgress,
  }
}
