import { BlueOsCloudMission, BlueOsCloudPaginatedResponse, PresignedUpload } from './types'

export const BLUEOS_CLOUD_API_BASE = 'https://app.blueos.cloud/api/v1'

const authHeaders = (accessToken: string): Record<string, string> => ({
  Authorization: accessToken,
})

const authJsonHeaders = (accessToken: string): Record<string, string> => ({
  'Authorization': accessToken,
  'Content-Type': 'application/json',
})

const fetchAllPages = async <T>(initialUrl: string, accessToken: string): Promise<T[]> => {
  const all: T[] = []
  let nextUrl: string | null = initialUrl

  while (nextUrl) {
    const res = await fetch(nextUrl.replace(/^http:\/\//, 'https://'), { headers: authHeaders(accessToken) })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`BlueOS Cloud API error: ${res.status} ${text || res.statusText}`)
    }
    const data = (await res.json()) as BlueOsCloudPaginatedResponse<T> | T[]
    if (Array.isArray(data)) {
      all.push(...data)
      nextUrl = null
    } else {
      all.push(...data.results)
      nextUrl = data.next
    }
  }

  return all
}

/**
 * Fetches every mission visible to the authenticated user, automatically following pagination.
 * @param {string} accessToken - Valid BlueOS Cloud access token.
 * @returns {Promise<BlueOsCloudMission[]>} List of missions sorted as returned by the API.
 */
export const fetchMissions = async (accessToken: string): Promise<BlueOsCloudMission[]> => {
  return fetchAllPages<BlueOsCloudMission>(`${BLUEOS_CLOUD_API_BASE}/missions/`, accessToken)
}

/**
 * Creates a new mission in BlueOS Cloud.
 *
 * Latitude and longitude are formatted to 6 decimal places to satisfy the API contract.
 * @param {object} input - Data describing the new mission.
 * @param {string} input.name - Human-readable mission title.
 * @param {string} [input.description] - Optional mission description.
 * @param {number | null} [input.latitude] - Optional starting latitude in decimal degrees.
 * @param {number | null} [input.longitude] - Optional starting longitude in decimal degrees.
 * @param {string} accessToken - Valid BlueOS Cloud access token.
 * @returns {Promise<BlueOsCloudMission>} Newly created mission as returned by the API.
 */
export const createMission = async (
  input: {
    /**
     * Human-readable mission title.
     */
    name: string
    /**
     * Optional mission description.
     */
    description?: string
    /**
     * Optional starting latitude in decimal degrees.
     */
    latitude?: number | null
    /**
     * Optional starting longitude in decimal degrees.
     */
    longitude?: number | null
  },
  accessToken: string
): Promise<BlueOsCloudMission> => {
  const body: Record<string, unknown> = {
    title: input.name,
    start_time: new Date().toISOString(),
  }
  if (input.description) body.description = input.description
  if (input.latitude != null) body.start_latitude = input.latitude.toFixed(6)
  if (input.longitude != null) body.start_longitude = input.longitude.toFixed(6)

  const res = await fetch(`${BLUEOS_CLOUD_API_BASE}/missions/`, {
    method: 'POST',
    headers: authJsonHeaders(accessToken),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Failed to create BlueOS Cloud mission: ${res.status} ${text || res.statusText}`)
  }

  return res.json()
}

/**
 * Requests a pre-signed S3 upload URL for adding an attachment to a mission.
 *
 * The returned `url` and `fields` must be sent together as a multipart form body, with the file appended last.
 * @param {string} missionId - Identifier of the mission that should receive the attachment.
 * @param {string} fileName - Name to use for the file once it is stored on the cloud.
 * @param {string} accessToken - Valid BlueOS Cloud access token.
 * @param {string} [capturedAt] - Optional ISO timestamp describing when the file was originally captured.
 * @returns {Promise<PresignedUpload>} Pre-signed upload payload that must be POSTed to S3.
 */
export const getPresignedUpload = async (
  missionId: string,
  fileName: string,
  accessToken: string,
  capturedAt?: string
): Promise<PresignedUpload> => {
  const body = new URLSearchParams()
  body.append('file_name', fileName)
  if (capturedAt) body.append('captured_at', capturedAt)

  const res = await fetch(`${BLUEOS_CLOUD_API_BASE}/missions/${missionId}/new_attachment/`, {
    method: 'POST',
    headers: {
      'Authorization': accessToken,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Failed to request BlueOS Cloud upload: ${res.status} ${text || res.statusText}`)
  }

  return res.json()
}

/**
 * Uploads a Blob to a pre-signed S3 URL using the standard multipart form contract.
 *
 * The function reports progress via the optional `onProgress` callback so callers can render a progress bar.
 * @param {PresignedUpload} presigned - Pre-signed payload returned by {@link getPresignedUpload}.
 * @param {Blob} fileBlob - File contents to be uploaded.
 * @param {string} fileName - File name to register on S3 (must match the one used in the pre-signed request).
 * @param {(progress: number) => void} [onProgress] - Optional callback invoked with progress in the 0-100 range.
 * @param {AbortSignal} [signal] - Optional signal that aborts the upload (e.g. when the user cancels).
 * @returns {Promise<void>} Resolves once the upload has been accepted by S3.
 */
export const uploadFileToPresignedUrl = (
  presigned: PresignedUpload,
  fileBlob: Blob,
  fileName: string,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const formData = new FormData()
    for (const [key, value] of Object.entries(presigned.fields)) {
      formData.append(key, value)
    }
    formData.append('file', fileBlob, fileName)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', presigned.url)

    xhr.upload.onprogress = (event): void => {
      if (event.lengthComputable && event.total > 0) {
        const pct = (event.loaded / event.total) * 100
        onProgress?.(Math.min(pct, 99))
      }
    }

    xhr.onload = (): void => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100)
        resolve()
        return
      }
      reject(new Error(`S3 upload failed: ${xhr.status} ${xhr.statusText}`))
    }
    xhr.onerror = (): void => reject(new Error('Network error during BlueOS Cloud upload'))
    xhr.onabort = (): void => reject(new Error('BlueOS Cloud upload aborted'))

    signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(formData)
  })
}
