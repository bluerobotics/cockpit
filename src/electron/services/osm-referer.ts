import { session } from 'electron'

/**
 * Public-facing URL used as the Referer for OSM tile requests.
 *
 * Per the OSM tile usage policy the Referer must be "accurate end-to-end", so we point it at
 * Cockpit's source repository which is the canonical contact for the application.
 * @see https://operations.osmfoundation.org/policies/tiles/
 */
const COCKPIT_REFERER = 'https://github.com/bluerobotics/cockpit'

/**
 * URL filter matching every known OSM tile host. The canonical policy-compliant URL is
 * `https://tile.openstreetmap.org/...`, but the legacy `{s}.tile.openstreetmap.org` subdomains
 * are still in use inside some offline caches, so we cover both.
 */
const OSM_TILE_URL_FILTER = {
  urls: [
    'https://tile.openstreetmap.org/*',
    'https://*.tile.openstreetmap.org/*',
    'https://tile.osm.org/*',
    'https://*.tile.osm.org/*',
  ],
}

/**
 * Setup a webRequest interceptor that guarantees an HTTP Referer header on every request to
 * OpenStreetMap tile servers.
 *
 * When Cockpit is loaded from `file://` (standalone/Electron build), the document origin is
 * `"null"` and Chromium omits the Referer header for cross-origin tile requests regardless of
 * the `referrerPolicy` set on the tile `<img>` element. Without a Referer, OSM serves a
 * "403R — Referer is required" blocked-tile placeholder (with a 200 status code and
 * `X-Blocked` response header) per their tile usage policy.
 *
 * This listener injects a Cockpit-identifying Referer only for OSM tile hosts so other
 * request flows are unaffected.
 * @returns {void}
 */
export const setupOsmRefererService = (): void => {
  session.defaultSession.webRequest.onBeforeSendHeaders(OSM_TILE_URL_FILTER, (details, callback) => {
    const requestHeaders = { ...details.requestHeaders, Referer: COCKPIT_REFERER }
    callback({ requestHeaders })
  })
}
