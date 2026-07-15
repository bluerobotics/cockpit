import { v4 as uuid } from 'uuid'

import { deleteFileFromVehicle, uploadFileToVehicle } from '@/libs/blueos-files'
import type { CustomTileArchiveFormat, CustomTileProviderMeta } from '@/types/mission'

import { requestPersistentStorage } from './storage-quota'
import { openTileArchive } from './tile-archive'
import { removeCachedTileArchive, setCachedTileArchive } from './tile-provider-storage'

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
export const pickTileArchiveFiles = (): Promise<File[]> => {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.zip,.mbtiles,.pmtiles'
    input.multiple = true
    input.onchange = (event: Event): void => {
      resolve(Array.from((event.target as HTMLInputElement).files ?? []))
    }
    input.oncancel = (): void => resolve([])
    input.click()
  })
}

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
    maxZoom: input.maxZoom,
    tms: input.tms || undefined,
    attribution: input.attribution?.trim() || undefined,
    createdAt: Date.now(),
  }
}

/**
 * Validates a tile archive, uploads it to the vehicle for durable/shared storage, caches it locally for
 * rendering, and returns its provider metadata. The caller adds the returned metadata to the mission store.
 * @param {File} file - The tile archive to import.
 * @param {string} vehicleAddress - Address of the connected vehicle to store the archive on.
 * @returns {Promise<CustomTileProviderMeta>} The metadata describing the stored provider.
 * @throws {Error} When the format is unsupported, the archive is invalid, or the upload fails.
 */
export const importTileArchiveFile = async (file: File, vehicleAddress: string): Promise<CustomTileProviderMeta> => {
  const format = tileArchiveFormatFromFile(file)
  if (!format) throw new Error(`"${file.name}" is not a supported tile archive (.zip, .mbtiles or .pmtiles).`)

  // Opening the archive both validates it and yields the zoom range / bounds before we consume any storage.
  const source = await openTileArchive(file, format)
  const { minZoom, maxZoom, bounds } = source
  source.close()

  const id = uuid()
  await uploadFileToVehicle(vehicleAddress, tileProviderSubfolder, tileArchiveFileName({ id, format }), file)

  await requestPersistentStorage()
  await setCachedTileArchive(id, file)

  return {
    id,
    name: providerNameFromFile(file),
    type: 'file',
    format,
    fileSize: file.size,
    minZoom,
    maxZoom,
    bounds,
    createdAt: Date.now(),
  }
}

/**
 * Removes a provider's stored data: the local archive cache always, and the vehicle copy when a vehicle address
 * is available. Best-effort; failures are logged, not thrown.
 * @param {CustomTileProviderMeta} provider - The provider being removed.
 * @param {string} [vehicleAddress] - Address of the connected vehicle, if any.
 * @returns {Promise<void>}
 */
export const deleteStoredTileProvider = async (
  provider: CustomTileProviderMeta,
  vehicleAddress?: string
): Promise<void> => {
  await removeCachedTileArchive(provider.id)
  if (provider.type !== 'file' || !provider.format || !vehicleAddress) return
  try {
    await deleteFileFromVehicle(vehicleAddress, tileProviderSubfolder, tileArchiveFileName(provider))
  } catch (error) {
    console.error(`Failed to remove tile archive for provider ${provider.id} from the vehicle:`, error)
  }
}
