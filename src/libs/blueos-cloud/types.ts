/**
 * Authenticated BlueOS Cloud user, derived from the Auth0 `/userinfo` endpoint.
 */
export interface BlueOsCloudUser {
  /**
   * Auth0 subject identifier (e.g. `auth0|abc123`).
   */
  sub: string
  /**
   * Display name returned by Auth0.
   */
  name?: string
  /**
   * E-mail address returned by Auth0.
   */
  email?: string
  /**
   * Profile picture URL returned by Auth0.
   */
  picture?: string
  /**
   * Auth0 nickname / username.
   */
  nickname?: string
}

/**
 * Token bundle persisted locally after a successful login.
 */
export interface BlueOsCloudTokens {
  /**
   * Auth0 access token used to call the BlueOS Cloud API.
   */
  accessToken: string
  /**
   * Optional refresh token used to obtain a new access token when it expires.
   */
  refreshToken: string | null
  /**
   * Epoch milliseconds at which the access token expires.
   */
  expiresAt: number
}

/**
 * Successful response payload from `POST /oauth/device/code` (Auth0 Device Authorization Flow).
 */
export interface DeviceAuthorizationResponse {
  /**
   * Opaque code that the application uses to poll the token endpoint.
   */
  device_code: string
  /**
   * Short, human-readable code that the user must enter on the verification page.
   */
  user_code: string
  /**
   * Base verification URL (without the `user_code` query parameter).
   */
  verification_uri: string
  /**
   * Verification URL that already contains the `user_code` query parameter.
   */
  verification_uri_complete: string
  /**
   * Seconds before the device code expires.
   */
  expires_in: number
  /**
   * Recommended polling interval in seconds.
   */
  interval: number
}

/**
 * Successful response payload from `POST /oauth/token` (Auth0 token exchange).
 */
export interface TokenResponse {
  /**
   * Access token used to authenticate API calls.
   */
  access_token: string
  /**
   * Refresh token (only returned when the `offline_access` scope is requested).
   */
  refresh_token?: string
  /**
   * OpenID Connect ID token (JWT) describing the authenticated user.
   */
  id_token?: string
  /**
   * Token type returned by the authorization server (typically `Bearer`).
   */
  token_type: string
  /**
   * Seconds until the access token expires.
   */
  expires_in: number
}

/**
 * Mission representation as returned by the BlueOS Cloud API.
 */
export interface BlueOsCloudMission {
  /**
   * Unique mission identifier.
   */
  id: string
  /**
   * Mission title shown on the cloud UI.
   */
  title: string
  /**
   * Optional mission description.
   */
  description: string
  /**
   * ISO timestamp of when the mission started.
   */
  start_time: string | null
  /**
   * ISO timestamp of when the mission ended.
   */
  end_time: string | null
  /**
   * Identifier of the user that created the mission.
   */
  created_by: number | null
  /**
   * Decimal latitude of the mission start (string to preserve precision).
   */
  start_latitude: string | null
  /**
   * Decimal longitude of the mission start (string to preserve precision).
   */
  start_longitude: string | null
}

/**
 * Generic paginated payload used by the BlueOS Cloud API.
 */
export interface BlueOsCloudPaginatedResponse<T> {
  /**
   * Total number of items across all pages.
   */
  count: number
  /**
   * URL of the next page, or `null` when there are no more pages.
   */
  next: string | null
  /**
   * URL of the previous page, or `null` when on the first page.
   */
  previous: string | null
  /**
   * Items contained in the current page.
   */
  results: T[]
}

/**
 * Pre-signed S3 upload payload returned by `POST /missions/{id}/new_attachment/`.
 */
export interface PresignedUpload {
  /**
   * Target URL where the file must be POSTed.
   */
  url: string
  /**
   * Form fields that must be sent alongside the file in the multipart body.
   */
  fields: Record<string, string>
}
