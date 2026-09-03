// Chrome 124 moved the cookie DB into `Network/Cookies`. A real Electron 29 (Chrome 122)
// profile still keeps Cookies at the userData root, so that file means a newer Electron wrote it.
// Only consulted when Chromium's `Last Version` file is missing — Electron often does not write one.
const NETWORK_COOKIES_SINCE_CHROME_MAJOR = 124

/**
 * Parse the major component of a Chromium version string (`150.0.7871.224` → 150).
 * @param {string} version Chromium version string
 * @returns {number | undefined} The major version, or undefined when it is not a number
 */
export const chromeMajor = (version: string): number | undefined => {
  const major = Number.parseInt(version.trim().split('.')[0], 10)
  return Number.isFinite(major) ? major : undefined
}

/**
 * Whether this Chromium userData was written by a newer Chrome than the one we bundled.
 * @param {string | undefined} lastVersionText Contents of Chromium's `Last Version` file, if present
 * @param {string} ourChrome `process.versions.chrome` of this Electron binary
 * @param {boolean} hasNetworkCookies Whether `Network/Cookies` exists on disk
 * @returns {boolean} True when opening this profile would be a Chromium downgrade
 */
export const shouldIsolateChromiumProfile = (
  lastVersionText: string | undefined,
  ourChrome: string,
  hasNetworkCookies: boolean
): boolean => {
  const ours = chromeMajor(ourChrome)
  if (ours === undefined) return false

  const last = lastVersionText === undefined ? undefined : chromeMajor(lastVersionText)
  if (last !== undefined) return last > ours

  return hasNetworkCookies && ours < NETWORK_COOKIES_SINCE_CHROME_MAJOR
}

/**
 * Sibling userData path used when the default profile belongs to a newer Chrome.
 * @param {string} userData Default Electron userData path
 * @param {string} chromeVersion `process.versions.chrome` of this Electron binary
 * @returns {string} Path that this Chrome major can own
 */
export const isolatedUserDataPath = (userData: string, chromeVersion: string): string => {
  const major = chromeMajor(chromeVersion)
  return major === undefined ? userData : `${userData}-chrome${major}`
}
