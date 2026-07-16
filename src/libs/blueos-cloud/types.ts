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
