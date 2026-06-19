import { v4 as uuid } from 'uuid'

import type { MapOverlayMeta, MapOverlayRenderMode } from '@/types/mission'

import { OVERLAY_RENDER_VERSION, renderGeoTiffImage } from './geotiff-overlay'
import {
  getOverlayStorageBytesAvailable,
  mapOverlayStorage,
  removeCachedOverlayRender,
  requestPersistentOverlayStorage,
  setCachedOverlayRender,
} from './overlay-storage'

const GEOTIFF_EXTENSIONS = ['tif', 'tiff', 'gtiff']

/**
 * Error thrown when a GeoTIFF cannot be stored because the browser's IndexedDB quota would be exceeded.
 * More likely in the Lite (Web) build; Standalone (Electron) has a much larger IndexedDB quota.
 */
export class OverlayStorageQuotaError extends Error {
  /**
   * @param {string} message - Human-readable description of the quota problem.
   */
  constructor(message: string) {
    super(message)
    this.name = 'OverlayStorageQuotaError'
  }
}

/**
 * Opens a file picker for the user to choose one or more GeoTIFF files. Uses a hidden file input so it works
 * identically in Standalone (Electron) and Lite (Web), where the bytes are read in-renderer.
 * @returns {Promise<File[]>} The selected files, or an empty array if the dialog was dismissed.
 */
export const pickGeoTiffFiles = (): Promise<File[]> => {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.tif,.tiff,.gtiff,image/tiff'
    input.multiple = true
    input.onchange = (event: Event): void => {
      const files = Array.from((event.target as HTMLInputElement).files ?? [])
      resolve(files)
    }
    // A cancelled dialog never fires `change`; resolve empty so callers don't hang.
    input.oncancel = (): void => resolve([])
    input.click()
  })
}

const overlayNameFromFile = (file: File): string => file.name.replace(/\.(tif|tiff|gtiff)$/i, '')

/**
 * Whether a file looks like a GeoTIFF based on its extension.
 * @param {File} file - The file to check.
 * @returns {boolean} True if the extension matches a known GeoTIFF extension.
 */
export const isGeoTiffFile = (file: File): boolean => {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return GEOTIFF_EXTENSIONS.includes(extension)
}

/**
 * Parses, validates and persists a GeoTIFF file, returning its overlay metadata. The raster bytes are written
 * to the overlay storage (IndexedDB); the caller is responsible for adding the returned metadata to the
 * mission store.
 * @param {File} file - The GeoTIFF file to import.
 * @returns {Promise<MapOverlayMeta>} The metadata describing the stored overlay.
 * @throws {OverlayStorageQuotaError} When the file would exceed the available IndexedDB quota (Lite only).
 */
export const importGeoTiffFile = async (file: File): Promise<MapOverlayMeta> => {
  const renderMode: MapOverlayRenderMode = 'grayscale'

  // Render once here (read + colorize) — this both validates the GeoTIFF before we consume storage and produces
  // the image we cache, so the first display and later reloads reuse it instead of parsing the raster again.
  const { dataUrl, bounds } = await renderGeoTiffImage(file, renderMode)

  const available = await getOverlayStorageBytesAvailable()
  if (available !== undefined && file.size > available) {
    throw new OverlayStorageQuotaError(
      `Not enough browser storage to save "${file.name}". Free up space or use the Standalone (desktop) app.`
    )
  }

  await requestPersistentOverlayStorage()

  const id = uuid()
  try {
    await mapOverlayStorage.setItem(id, file)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new OverlayStorageQuotaError(
        `Browser storage is full, so "${file.name}" could not be saved. Free up space or use the Standalone app.`
      )
    }
    throw error
  }
  await setCachedOverlayRender(id, { version: OVERLAY_RENDER_VERSION, renderMode, dataUrl, bounds })

  return {
    id,
    name: overlayNameFromFile(file),
    bounds,
    opacity: 1,
    visible: true,
    renderMode,
    fileSize: file.size,
    createdAt: Date.now(),
  }
}

/**
 * Removes a stored overlay's raster bytes from persistent storage. Safe to call even if the bytes are gone.
 * @param {string} id - The overlay id (also the storage key).
 * @returns {Promise<void>}
 */
export const deleteStoredOverlay = async (id: string): Promise<void> => {
  try {
    await mapOverlayStorage.removeItem(id)
  } catch (error) {
    console.error(`Failed to remove stored map overlay ${id}:`, error)
  }
  await removeCachedOverlayRender(id)
}
