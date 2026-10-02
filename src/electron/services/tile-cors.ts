import { session } from 'electron'

/**
 * Tile hosts the map draws that do not send CORS headers. The map uploads every tile to WebGL, which the browser only
 * allows for tiles served with `Access-Control-Allow-Origin`, so without it these overlays stay blank.
 */
const CORS_LESS_TILE_URL_FILTER = {
  urls: ['https://geoserver.openseamap.org/geoserver/*'],
}

/**
 * Setup a webRequest interceptor that marks responses from the known CORS-less tile hosts as readable from any origin.
 *
 * Scoped to those hosts, and only adds the header when the server did not send one, so no other response is touched.
 * @returns {void}
 */
export const setupTileCorsService = (): void => {
  session.defaultSession.webRequest.onHeadersReceived(CORS_LESS_TILE_URL_FILTER, (details, callback) => {
    const responseHeaders = { ...details.responseHeaders }
    const hasAllowOrigin = Object.keys(responseHeaders).some(
      (name) => name.toLowerCase() === 'access-control-allow-origin'
    )
    if (!hasAllowOrigin) responseHeaders['Access-Control-Allow-Origin'] = ['*']
    callback({ responseHeaders })
  })
}
