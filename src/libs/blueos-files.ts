import ky, { HTTPError } from 'ky'

import { protocol } from '@/libs/blueos'

// BlueOS bundles the File Browser service behind `/file-browser`, exposing a REST API for reading and
// writing real files on the vehicle. Unlike the bag-of-holding (a single JSON document), it stores
// each asset as its own file, so it fits large/binary artifacts without bloating the settings payload.
const requestTimeout = 15000

// Persistent user-data volume on the vehicle (survives reboots and BlueOS updates). File Browser maps
// its `userdata` shortcut here, so everything Cockpit writes lives under `userdata/cockpit/<subfolder>`.
const cockpitAssetsRoot = ['userdata', 'cockpit']

// File Browser hands out a session token even when configured with `--auth.method=noauth`; cache it per
// vehicle so we don't log in on every request.
const tokenByAddress = new Map<string, string>()

/**
 * A single entry in a File Browser folder listing.
 */
interface FileBrowserEntry {
  /**
   * Entry name, including the file extension.
   */
  name: string
  /**
   * Whether the entry is a directory rather than a file.
   */
  isDir: boolean
}

/**
 * Response body of a File Browser `resources/<folder>` listing request.
 */
interface FileBrowserListing {
  /**
   * The files and folders contained in the listed directory.
   */
  items?: FileBrowserEntry[]
}

const fileBrowserUrl = (vehicleAddress: string, path: string): string =>
  `${protocol}//${vehicleAddress}/file-browser/api/${path}`

const encodeSegments = (segments: string[]): string => segments.map(encodeURIComponent).join('/')

const authToken = async (vehicleAddress: string): Promise<string> => {
  const cached = tokenByAddress.get(vehicleAddress)
  if (cached) return cached
  const token = await ky
    .post(fileBrowserUrl(vehicleAddress, 'login'), {
      json: { username: '', password: '', recaptcha: '' },
      timeout: requestTimeout,
      retry: 0,
    })
    .text()
  tokenByAddress.set(vehicleAddress, token)
  return token
}

// File Browser issues expiring JWTs even in noauth mode, so a cached token can go stale (e.g. after a
// vehicle reboot). Refresh the token once on an auth error and retry before surfacing the failure.
const withAuth = async <T>(vehicleAddress: string, request: (token: string) => Promise<T>): Promise<T> => {
  try {
    return await request(await authToken(vehicleAddress))
  } catch (error) {
    const status = error instanceof HTTPError ? error.response.status : undefined
    if (status !== 401 && status !== 403) throw error
    tokenByAddress.delete(vehicleAddress)
    return await request(await authToken(vehicleAddress))
  }
}

// File Browser does not create missing parent directories on upload, so the destination chain has to be
// created explicitly before writing a file into it.
const ensureFolderExists = async (vehicleAddress: string, token: string, subfolder: string): Promise<void> => {
  const folderChains = [cockpitAssetsRoot, [...cockpitAssetsRoot, subfolder]]
  for (const chain of folderChains) {
    await ky
      .post(fileBrowserUrl(vehicleAddress, `resources/${encodeSegments(chain)}/?override=false`), {
        headers: { 'X-Auth': token },
        timeout: requestTimeout,
        retry: 0,
      })
      .catch(() => undefined)
  }
}

/**
 * Uploads (creating or overwriting) a single file into the vehicle's Cockpit assets folder.
 * @param {string} vehicleAddress - The vehicle's address.
 * @param {string} subfolder - Folder under `userdata/cockpit` to store the file in.
 * @param {string} fileName - Name of the file to write, including its extension.
 * @param {Blob | string} content - The file's content.
 * @returns {Promise<void>} Resolves once the file has been written.
 */
export const uploadFileToVehicle = async (
  vehicleAddress: string,
  subfolder: string,
  fileName: string,
  content: Blob | string
): Promise<void> => {
  await withAuth(vehicleAddress, async (token) => {
    await ensureFolderExists(vehicleAddress, token, subfolder)
    await ky.post(
      fileBrowserUrl(
        vehicleAddress,
        `resources/${encodeSegments([...cockpitAssetsRoot, subfolder, fileName])}?override=true`
      ),
      {
        headers: { 'X-Auth': token },
        body: content,
        timeout: requestTimeout,
        retry: 0,
      }
    )
  })
}

/**
 * Downloads a single file from the vehicle's Cockpit assets folder.
 * @param {string} vehicleAddress - The vehicle's address.
 * @param {string} subfolder - Folder under `userdata/cockpit` the file lives in.
 * @param {string} fileName - Name of the file to read, including its extension.
 * @returns {Promise<Blob>} The file's content as a Blob.
 */
export const downloadFileFromVehicle = async (
  vehicleAddress: string,
  subfolder: string,
  fileName: string
): Promise<Blob> => {
  return await withAuth(vehicleAddress, (token) => {
    const rawPath = `raw/${encodeSegments([...cockpitAssetsRoot, subfolder, fileName])}?auth=${token}`
    return ky.get(fileBrowserUrl(vehicleAddress, rawPath), { timeout: requestTimeout, retry: 0 }).blob()
  })
}

/**
 * Deletes a single file from the vehicle's Cockpit assets folder.
 * @param {string} vehicleAddress - The vehicle's address.
 * @param {string} subfolder - Folder under `userdata/cockpit` the file lives in.
 * @param {string} fileName - Name of the file to delete, including its extension.
 * @returns {Promise<void>} Resolves once the file has been deleted.
 */
export const deleteFileFromVehicle = async (
  vehicleAddress: string,
  subfolder: string,
  fileName: string
): Promise<void> => {
  await withAuth(vehicleAddress, async (token) => {
    await ky.delete(
      fileBrowserUrl(vehicleAddress, `resources/${encodeSegments([...cockpitAssetsRoot, subfolder, fileName])}`),
      {
        headers: { 'X-Auth': token },
        timeout: requestTimeout,
        retry: 0,
      }
    )
  })
}

/**
 * Lists the file names present in the vehicle's Cockpit assets subfolder.
 * @param {string} vehicleAddress - The vehicle's address.
 * @param {string} subfolder - Folder under `userdata/cockpit` to list.
 * @returns {Promise<string[]>} The names of the files in the folder, or an empty array when the folder does not exist.
 */
export const listVehicleFiles = async (vehicleAddress: string, subfolder: string): Promise<string[]> => {
  try {
    const folder = await withAuth(vehicleAddress, (token) =>
      ky
        .get(fileBrowserUrl(vehicleAddress, `resources/${encodeSegments([...cockpitAssetsRoot, subfolder])}`), {
          headers: { 'X-Auth': token },
          timeout: requestTimeout,
          retry: 0,
        })
        .json<FileBrowserListing>()
    )
    return (folder.items ?? []).filter((item) => !item.isDir).map((item) => item.name)
  } catch {
    // A missing folder (nothing uploaded yet) returns 404; treat it as an empty listing.
    return []
  }
}
