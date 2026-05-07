import { BlueOsCloudTokens, BlueOsCloudUser, DeviceAuthorizationResponse, TokenResponse } from './types'

export const BLUEOS_CLOUD_AUTH0_DOMAIN = 'bcloud-prod.us.auth0.com'
export const BLUEOS_CLOUD_AUTH0_CLIENT_ID = '0zWm0LYYxwIzFKXsv84mElKoo601QG4S'
export const BLUEOS_CLOUD_AUTH0_AUDIENCE = 'https://app.blueos.cloud/api/v1'
export const BLUEOS_CLOUD_AUTH0_SCOPE = 'openid profile email offline_access'

const TOKEN_REFRESH_SAFETY_MARGIN_MS = 60_000

/**
 * Custom error thrown when the user explicitly cancels or rejects the device authorization request.
 *
 * Use it to differentiate user-driven aborts from generic network failures in the wizard UI.
 */
export class DeviceAuthorizationCancelled extends Error {
  /**
   * Creates a new DeviceAuthorizationCancelled error.
   * @param {string} message - Human readable description of why the flow was cancelled.
   */
  constructor(message = 'Device authorization cancelled') {
    super(message)
    this.name = 'DeviceAuthorizationCancelled'
  }
}

/**
 * Starts the Auth0 Device Authorization Flow by requesting a device & user code pair.
 *
 * The returned `verification_uri_complete` URL must be opened by the user in a browser to authorize the application.
 * Once the user finishes the browser flow, call {@link pollForDeviceAuthorizationToken} with the returned `device_code`
 * to exchange it for an access token.
 * @returns {Promise<DeviceAuthorizationResponse>} The device authorization payload returned by Auth0.
 */
export const requestDeviceAuthorization = async (): Promise<DeviceAuthorizationResponse> => {
  const body = new URLSearchParams({
    client_id: BLUEOS_CLOUD_AUTH0_CLIENT_ID,
    scope: BLUEOS_CLOUD_AUTH0_SCOPE,
    audience: BLUEOS_CLOUD_AUTH0_AUDIENCE,
  })

  const res = await fetch(`https://${BLUEOS_CLOUD_AUTH0_DOMAIN}/oauth/device/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Failed to start BlueOS Cloud login: ${res.status} ${text || res.statusText}`)
  }

  return res.json()
}

const buildTokensFromResponse = (
  response: TokenResponse,
  fallbackRefreshToken: string | null | undefined
): BlueOsCloudTokens => ({
  accessToken: response.access_token,
  refreshToken: response.refresh_token ?? fallbackRefreshToken ?? null,
  expiresAt: Date.now() + response.expires_in * 1000,
})

/**
 * Polls the Auth0 token endpoint until the user completes the browser-side authorization flow.
 *
 * The polling cadence respects the `interval` returned by Auth0, automatically slowing down when the server responds
 * with `slow_down`, and stops after `expires_in` seconds with a clear error.
 * @param {DeviceAuthorizationResponse} authorization - Payload returned by {@link requestDeviceAuthorization}.
 * @param {AbortSignal} [signal] - Optional signal that allows cancelling the polling loop (e.g. when the user closes
 *   the wizard dialog).
 * @returns {Promise<BlueOsCloudTokens>} Tokens obtained once the user authorizes the application.
 */
export const pollForDeviceAuthorizationToken = async (
  authorization: DeviceAuthorizationResponse,
  signal?: AbortSignal
): Promise<BlueOsCloudTokens> => {
  let intervalSeconds = authorization.interval > 0 ? authorization.interval : 5
  const expiresAt = Date.now() + authorization.expires_in * 1000

  while (Date.now() < expiresAt) {
    if (signal?.aborted) throw new DeviceAuthorizationCancelled('Login wizard was closed')

    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(resolve, intervalSeconds * 1000)
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timeoutId)
          reject(new DeviceAuthorizationCancelled('Login wizard was closed'))
        },
        { once: true }
      )
    })

    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: authorization.device_code,
      client_id: BLUEOS_CLOUD_AUTH0_CLIENT_ID,
    })
    const res = await fetch(`https://${BLUEOS_CLOUD_AUTH0_DOMAIN}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (res.ok) {
      const data: TokenResponse = await res.json()
      return buildTokensFromResponse(data, null)
    }

    const errorPayload = (await res.json().catch(() => ({}))) as {
      /**
       *
       */
      error?: string
      /**
       *
       */
      error_description?: string
    }

    if (errorPayload.error === 'authorization_pending') continue
    if (errorPayload.error === 'slow_down') {
      intervalSeconds += 5
      continue
    }
    if (errorPayload.error === 'access_denied') {
      throw new DeviceAuthorizationCancelled('Authorization was denied on the BlueOS Cloud login page')
    }
    if (errorPayload.error === 'expired_token') {
      throw new Error('BlueOS Cloud login code expired. Please try again.')
    }

    throw new Error(`BlueOS Cloud login failed: ${errorPayload.error_description || errorPayload.error || res.status}`)
  }

  throw new Error('BlueOS Cloud login timed out. Please try again.')
}

/**
 * Refreshes the access token using a previously issued refresh token.
 * @param {string} refreshToken - Refresh token returned during the original device flow.
 * @returns {Promise<BlueOsCloudTokens>} New token bundle reusing the input refresh token when a new one is not issued.
 */
export const refreshAccessToken = async (refreshToken: string): Promise<BlueOsCloudTokens> => {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: BLUEOS_CLOUD_AUTH0_CLIENT_ID,
    refresh_token: refreshToken,
  })

  const res = await fetch(`https://${BLUEOS_CLOUD_AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Failed to refresh BlueOS Cloud session: ${res.status} ${text || res.statusText}`)
  }

  const data: TokenResponse = await res.json()
  return buildTokensFromResponse(data, refreshToken)
}

/**
 * Determines whether a token bundle is still valid.
 *
 * A small safety margin is subtracted from the absolute expiration time so callers don't try to use a token that is
 * about to expire mid-flight.
 * @param {BlueOsCloudTokens | null} tokens - Token bundle to check, or `null` when no user is logged in.
 * @returns {boolean} `true` when the access token is present and not within the safety margin of expiring.
 */
export const isTokenValid = (tokens: BlueOsCloudTokens | null): boolean => {
  if (!tokens?.accessToken) return false
  return Date.now() < tokens.expiresAt - TOKEN_REFRESH_SAFETY_MARGIN_MS
}

/**
 * Fetches the authenticated user profile from Auth0.
 * @param {string} accessToken - Valid Auth0 access token.
 * @returns {Promise<BlueOsCloudUser>} Profile data describing the authenticated user.
 */
export const fetchAuthenticatedUser = async (accessToken: string): Promise<BlueOsCloudUser> => {
  const res = await fetch(`https://${BLUEOS_CLOUD_AUTH0_DOMAIN}/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Failed to fetch BlueOS Cloud user info: ${res.status} ${text || res.statusText}`)
  }

  const profile = (await res.json()) as Record<string, unknown>
  return {
    sub: String(profile.sub ?? ''),
    name: typeof profile.name === 'string' ? profile.name : undefined,
    email: typeof profile.email === 'string' ? profile.email : undefined,
    picture: typeof profile.picture === 'string' ? profile.picture : undefined,
    nickname: typeof profile.nickname === 'string' ? profile.nickname : undefined,
  }
}
