import { v4 as uuid } from 'uuid'

import { deleteFileFromVehicle, uploadFileToVehicle } from '@/libs/blueos-files'
import { constrain, formatBytes, messageFromError, pickFilesFromDisk } from '@/libs/utils'
import type { CustomTileArchiveFormat, CustomTileProviderMeta } from '@/types/mission'

import { getStorageBytesAvailable, requestPersistentStorage } from './storage-quota'
import { openTileArchive } from './tile-archive'
import { getCachedTileArchive, removeCachedTileArchive, setCachedTileArchive } from './tile-provider-storage'

const ARCHIVE_EXTENSIONS: Record<string, CustomTileArchiveFormat> = {
  zip: 'zip',
  mbtiles: 'mbtiles',
  pmtiles: 'pmtiles',
}

/**
 * Folder under `userdata/cockpit` on the vehicle that holds every uploaded tile archive.
 */
export const tileProviderSubfolder = 'tile-providers'

/**
 * Milliseconds allowed for an archive transfer to or from the vehicle. Archives run to tens of megabytes over a
 * tether, so the File Browser helpers' settings-sized default would expire on every one of them.
 */
export const archiveTransferTimeout = 10 * 60 * 1000

// The whole database is copied into the wasm heap to be read (see the `ponytail:` note in `tile-archive.ts`),
// which costs roughly twice the file size in memory, so imports are capped well below where a tab would die.
const maxMbtilesArchiveBytes = 256 * 1024 * 1024

/**
 * The vehicle file name of a `file` provider's archive, derived from its id and format.
 * @param {Pick<CustomTileProviderMeta, 'id' | 'format'>} provider - The provider's id and archive format.
 * @returns {string} The archive file name (e.g. `<id>.mbtiles`).
 */
export const tileArchiveFileName = (provider: Pick<CustomTileProviderMeta, 'id' | 'format'>): string =>
  `${provider.id}.${provider.format}`

/**
 * Opens a file picker for the user to choose one or more tile archives (ZIP/MBTiles/PMTiles). Uses a hidden file
 * input so it works identically in Standalone (Electron) and Lite (Web).
 * @returns {Promise<File[]>} The selected files, or an empty array if the dialog was dismissed.
 */
export const pickTileArchiveFiles = (): Promise<File[]> => pickFilesFromDisk('.zip,.mbtiles,.pmtiles')

/**
 * Detects the archive format of a file from its extension.
 * @param {File} file - The file to inspect.
 * @returns {CustomTileArchiveFormat | undefined} The format, or `undefined` if the extension is unsupported.
 */
export const tileArchiveFormatFromFile = (file: File): CustomTileArchiveFormat | undefined => {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return ARCHIVE_EXTENSIONS[extension]
}

const providerNameFromFile = (file: File): string => file.name.replace(/\.(zip|mbtiles|pmtiles)$/i, '')

/**
 * Whether an XYZ URL template is usable (contains the `{z}`, `{x}` and `{y}` placeholders).
 * @param {string} urlTemplate - The URL template to validate.
 * @returns {boolean} True if the template has all three placeholders.
 */
export const isValidTileUrlTemplate = (urlTemplate: string): boolean =>
  /\{z\}/.test(urlTemplate) && /\{x\}/.test(urlTemplate) && /\{y\}/.test(urlTemplate)

const highestUsableTileZoom = 24

/**
 * Normalizes a user-typed maximum zoom into a zoom level Leaflet can use.
 * @param {unknown} value - The raw field value, which a cleared numeric input delivers as an empty string.
 * @returns {number | undefined} The rounded, clamped zoom, or `undefined` when no usable number was given.
 */
export const normalizeTileMaxZoom = (value: unknown): number | undefined => {
  if (value === '' || value === null || value === undefined) return undefined
  const zoom = Math.round(Number(value))
  return Number.isFinite(zoom) ? constrain(zoom, 0, highestUsableTileZoom) : undefined
}

/**
 * Fields used to create a URL-based custom tile provider.
 */
export interface UrlTileProviderInput {
  /**
   * User-facing name.
   */
  name: string
  /**
   * XYZ tile URL template, e.g. `https://host/tiles/{z}/{x}/{y}.png`.
   */
  urlTemplate: string
  /**
   * Highest zoom level the source serves.
   */
  maxZoom?: number
  /**
   * Attribution string to display on the map.
   */
  attribution?: string
  /**
   * Whether the URL uses the TMS y-axis convention (row 0 at the bottom) instead of XYZ.
   */
  tms?: boolean
}

/**
 * Builds metadata for a URL-based custom tile provider. No vehicle or storage is involved, since the URL itself
 * is the whole configuration.
 * @param {UrlTileProviderInput} input - The provider fields.
 * @returns {CustomTileProviderMeta} The provider metadata, ready to persist.
 * @throws {Error} When the URL template is missing the `{z}`/`{x}`/`{y}` placeholders.
 */
export const buildUrlTileProvider = (input: UrlTileProviderInput): CustomTileProviderMeta => {
  const urlTemplate = input.urlTemplate.trim()
  if (!isValidTileUrlTemplate(urlTemplate)) {
    throw new Error('The tile URL must contain the {z}, {x} and {y} placeholders.')
  }
  return {
    id: uuid(),
    name: input.name.trim() || 'Custom provider',
    type: 'url',
    urlTemplate,
    maxZoom: normalizeTileMaxZoom(input.maxZoom),
    tms: input.tms || undefined,
    attribution: input.attribution?.trim() || undefined,
    createdAt: Date.now(),
  }
}

/**
 * Validates a tile archive and caches it locally for rendering, returning its provider metadata flagged for a
 * later vehicle upload. Works offline: the archive is usable immediately from the local cache and
 * {@link syncTileProviderToVehicle} uploads it once a vehicle is online. The caller adds the returned metadata
 * to the mission store.
 * @param {File} file - The tile archive to import.
 * @returns {Promise<CustomTileProviderMeta>} The metadata describing the locally-cached provider.
 * @throws {Error} When the archive is unsupported, too large or unreadable. The message continues the caller's
 * own `"<file name>" could not be imported:` prefix, so it starts mid-sentence rather than naming the file again.
 */
export const importTileArchiveFile = async (file: File): Promise<CustomTileProviderMeta> => {
  const format = tileArchiveFormatFromFile(file)
  if (!format) throw new Error(`"${file.name}" is not a supported tile archive (.zip, .mbtiles or .pmtiles).`)

  // Refused before opening it: reading an MBTiles copies the whole database into memory, so a file past the
  // ceiling would take the tab down instead of reporting an error the operator can act on.
  if (format === 'mbtiles' && file.size > maxMbtilesArchiveBytes) {
    const limit = formatBytes(maxMbtilesArchiveBytes, 0)
    throw new Error(`it is larger than ${limit}, which is more than Cockpit can open as an MBTiles map.`)
  }

  // Opening the archive both validates it and yields the zoom range / bounds before we consume any storage.
  const source = await openTileArchive(file, format)
  const { minZoom, maxZoom, bounds } = source
  source.close()

  // Until the vehicle is online this cache is the only copy of the archive, so a write that does not land has
  // to fail the import instead of leaving a provider that can never render or upload.
  const availableBytes = await getStorageBytesAvailable()
  if (availableBytes !== undefined && file.size > availableBytes) {
    throw new Error('there is not enough browser storage to save it. Free up space or use Cockpit Standalone.')
  }

  const id = uuid()
  await requestPersistentStorage()
  try {
    await setCachedTileArchive(id, file)
  } catch (error) {
    throw new Error(`saving it on this computer failed: ${messageFromError(error)}`)
  }

  return {
    id,
    name: providerNameFromFile(file),
    type: 'file',
    format,
    minZoom,
    maxZoom,
    bounds,
    createdAt: Date.now(),
    pendingVehicleSync: true,
  }
}

/**
 * Uploads a `file` provider's locally-cached archive to the vehicle for durable/shared storage. Used to drain
 * providers imported offline once a vehicle is online. No-op for non-`file` providers.
 * @param {CustomTileProviderMeta} provider - The provider whose cached archive should be uploaded.
 * @param {string} vehicleAddress - Address of the connected vehicle to store the archive on.
 * @returns {Promise<boolean>} True once uploaded; false when this computer holds no copy to upload, which is
 * the normal state on every topside computer other than the one the archive was imported on.
 * @throws {Error} When the upload fails.
 */
export const syncTileProviderToVehicle = async (
  provider: CustomTileProviderMeta,
  vehicleAddress: string
): Promise<boolean> => {
  if (provider.type !== 'file' || !provider.format) return false
  const archive = await getCachedTileArchive(provider.id)
  if (!archive) return false
  const fileName = tileArchiveFileName(provider)
  await uploadFileToVehicle(vehicleAddress, tileProviderSubfolder, fileName, archive, archiveTransferTimeout)
  return true
}

/**
 * Removes a provider's stored data: the local archive cache always, and the vehicle copy when a vehicle address
 * is available.
 * @param {CustomTileProviderMeta} provider - The provider being removed.
 * @param {string} [vehicleAddress] - Address of the connected vehicle, if any.
 * @returns {Promise<void>}
 * @throws {Error} When the archive cannot be deleted, so the caller can tell the user the bytes were left behind.
 */
export const deleteStoredTileProvider = async (
  provider: CustomTileProviderMeta,
  vehicleAddress?: string
): Promise<void> => {
  await removeCachedTileArchive(provider.id)
  // A provider still pending sync was never uploaded, so there is nothing on the vehicle to delete.
  if (provider.type !== 'file' || !provider.format || !vehicleAddress || provider.pendingVehicleSync) return
  await deleteFileFromVehicle(vehicleAddress, tileProviderSubfolder, tileArchiveFileName(provider))
}
