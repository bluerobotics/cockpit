import { BlueOsCloudMission, BlueOsCloudPaginatedResponse } from './types'

export const BLUEOS_CLOUD_API_BASE = 'https://app.blueos.cloud/api/v1'
export const BLUEOS_CLOUD_APP_BASE = 'https://app.blueos.cloud'

/**
 * Error carrying the HTTP status of a failed BlueOS Cloud API call, so callers can react to specific cases
 * (e.g. a `404` meaning the mission was deleted on the cloud).
 */
export class BlueOsCloudApiError extends Error {
  /**
   * HTTP status code returned by the BlueOS Cloud API.
   */
  status: number

  /**
   * Creates a new BlueOsCloudApiError.
   * @param {string} message - Human readable description of the failure.
   * @param {number} status - HTTP status code returned by the API.
   */
  constructor(message: string, status: number) {
    super(message)
    this.name = 'BlueOsCloudApiError'
    this.status = status
  }
}

/**
 * Whether a request was definitively refused by the server, as opposed to never having reached it (offline, so
 * nothing was thrown by the API at all) or having hit a transient condition that a retry can clear.
 * @param {unknown} error - Error thrown by an API call.
 * @returns {boolean} `true` when the server answered with a status that a retry will not change.
 */
export const isPermanentApiError = (error: unknown): boolean =>
  error instanceof BlueOsCloudApiError &&
  error.status >= 400 &&
  error.status < 500 &&
  error.status !== 408 &&
  error.status !== 429

/**
 * Returns the public URL where a BlueOS Cloud mission can be viewed in the user's browser.
 * @param {string} missionId - Identifier of the mission as returned by the API.
 * @returns {string} Fully-qualified URL pointing at the mission detail page.
 */
export const buildBlueOsCloudMissionUrl = (missionId: string): string =>
  `${BLUEOS_CLOUD_APP_BASE}/v2/missions/${missionId}`

// The BlueOS Cloud API takes the Auth0 access token raw, without the `Bearer` scheme Auth0's own endpoints use.
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
    const res = await fetch(nextUrl, { headers: authHeaders(accessToken) })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new BlueOsCloudApiError(`BlueOS Cloud API error: ${res.status} ${text || res.statusText}`, res.status)
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
 * @param {number} [input.startTime] - Epoch of the moment the mission started; defaults to now.
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
    /**
     * Epoch of the moment the mission started; defaults to now.
     */
    startTime?: number
  },
  accessToken: string
): Promise<BlueOsCloudMission> => {
  // Taken from the caller rather than from the clock, since a mission created offline is only posted hours later.
  const body: Record<string, unknown> = {
    title: input.name,
    start_time: new Date(input.startTime ?? Date.now()).toISOString(),
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
    throw new BlueOsCloudApiError(
      `Failed to create BlueOS Cloud mission: ${res.status} ${text || res.statusText}`,
      res.status
    )
  }

  return res.json()
}

/**
 * Updates an existing mission in BlueOS Cloud (e.g. to rename it or move its start location).
 *
 * Only the provided fields are sent, so a rename is a `PATCH` carrying just the new title.
 * @param {string} id - Identifier of the mission to update.
 * @param {object} input - Fields to change.
 * @param {string} [input.name] - New mission title.
 * @param {string} [input.description] - New mission description.
 * @param {number | null} [input.latitude] - New starting latitude in decimal degrees.
 * @param {number | null} [input.longitude] - New starting longitude in decimal degrees.
 * @param {string} accessToken - Valid BlueOS Cloud access token.
 * @returns {Promise<BlueOsCloudMission>} The updated mission as returned by the API.
 */
export const updateMission = async (
  id: string,
  input: {
    /**
     * New mission title.
     */
    name?: string
    /**
     * New mission description.
     */
    description?: string
    /**
     * New starting latitude in decimal degrees.
     */
    latitude?: number | null
    /**
     * New starting longitude in decimal degrees.
     */
    longitude?: number | null
  },
  accessToken: string
): Promise<BlueOsCloudMission> => {
  const body: Record<string, unknown> = {}
  if (input.name !== undefined) body.title = input.name
  if (input.description !== undefined) body.description = input.description
  if (input.latitude !== undefined) body.start_latitude = input.latitude != null ? input.latitude.toFixed(6) : null
  if (input.longitude !== undefined) body.start_longitude = input.longitude != null ? input.longitude.toFixed(6) : null

  const res = await fetch(`${BLUEOS_CLOUD_API_BASE}/missions/${id}/`, {
    method: 'PATCH',
    headers: authJsonHeaders(accessToken),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new BlueOsCloudApiError(
      `Failed to update BlueOS Cloud mission: ${res.status} ${text || res.statusText}`,
      res.status
    )
  }

  return res.json()
}
