import type { ExternalMapGeoTiff, ExternalMapOverlay } from '@/libs/map/external-overlay-api'
import type { ExternalPoi, ExternalPoiUpdate } from '@/libs/poi/external-api'

import { CallbackRateLimiter } from './callback-rate-limiter'

/**
 * Current version of the Cockpit Widget API
 */
export const COCKPIT_WIDGET_API_VERSION = '0.0.0'

/**
 * Listens to updates for a specific datalake variable.
 * This function sets up a message listener that receives updates from the parent window
 * and forwards them to the callback function, respecting the specified rate limit.
 * @param {string} variableId - The name of the datalake variable to listen to
 * @param {Function} callback - The function to call when the variable is updated
 * @param {number} maxRateHz - The maximum rate (in Hz) at which updates should be received. Default is 10 Hz
 * @example
 * ```typescript
 * // Listen to updates at 5Hz
 * listenToDatalakeVariable('cockpit-memory-usage', (value) => {
 *   console.log('Memory Usage:', value);
 * }, 5);
 * ```
 */
export function listenToDatalakeVariable(variableId: string, callback: (data: any) => void, maxRateHz = 10): void {
  // Convert Hz to minimum interval in milliseconds
  const minIntervalMs = 1000 / maxRateHz
  const rateLimiter = new CallbackRateLimiter(minIntervalMs)

  const message = {
    type: 'cockpit:listenToDatalakeVariables',
    variable: variableId,
    maxRateHz: maxRateHz,
  }
  window.parent.postMessage(message, '*')

  window.addEventListener('message', function handler(event) {
    if (event.data.type === 'cockpit:datalakeVariable' && event.data.variable === variableId) {
      // Only call callback if we haven't exceeded the rate limit
      if (rateLimiter.canCall()) {
        callback(event.data.value)
      }
    }
  })
}

/**
 * Adds a point of interest to Cockpit. Ignored, with a warning in Cockpit's logs, if the id is already in use or
 * Cockpit has not finished syncing with the vehicle yet.
 * @param {ExternalPoi} poi - The point of interest. Its id is yours to choose, to update or remove it later
 * @example
 * ```typescript
 * addPointOfInterest({ id: 'target-1', name: 'Target 1', latitude: -27.59, longitude: -48.55, icon: 'mdi-flag' })
 * ```
 */
export function addPointOfInterest(poi: ExternalPoi): void {
  window.parent.postMessage({ type: 'cockpit:addPointOfInterest', poi }, '*')
}

/**
 * Changes the given fields of a point of interest. Latitude and longitude have to be sent together. Every update
 * is saved and synced to the vehicle, so use it for occasional changes rather than to stream a position.
 * @param {ExternalPoiUpdate} poi - The id of the point of interest and the fields to change
 */
export function updatePointOfInterest(poi: ExternalPoiUpdate): void {
  window.parent.postMessage({ type: 'cockpit:updatePointOfInterest', poi }, '*')
}

/**
 * Removes a point of interest from Cockpit.
 * @param {string} id - The id of the point of interest
 */
export function removePointOfInterest(id: string): void {
  window.parent.postMessage({ type: 'cockpit:removePointOfInterest', id }, '*')
}

/**
 * Draws a GeoJSON overlay on Cockpit's maps, replacing any overlay already using its id. Features are styled by
 * their simplestyle-spec properties (`stroke`, `stroke-width`, `stroke-opacity`, `fill`, `fill-opacity`,
 * `marker-color`, `marker-size`). A point with a `radius` property is drawn as a circle of that radius in metres,
 * styled like a polygon. The overlay is saved on the computer running Cockpit, unless `live` is true,
 * which suits data that is re-sent as it changes.
 * @param {ExternalMapOverlay} overlay - The overlay. Every sender shares the same ids, so prefix it with your
 * extension's name
 * @example
 * ```typescript
 * setMapOverlay({
 *   id: 'my-extension-route',
 *   name: 'Route',
 *   geojson: {
 *     type: 'FeatureCollection',
 *     features: [{
 *       type: 'Feature',
 *       properties: { stroke: '#FFFF00' },
 *       geometry: { type: 'LineString', coordinates: [[-48.5585, -27.5935], [-48.5575, -27.5925]] },
 *     }],
 *   },
 * })
 * ```
 */
export function setMapOverlay(overlay: ExternalMapOverlay): void {
  window.parent.postMessage({ type: 'cockpit:setMapOverlay', overlay }, '*')
}

/**
 * Adds features to a map overlay without re-sending the ones it already has, for a track that grows as the
 * vehicle moves.
 * @param {string} id - The id of an overlay already sent with `setMapOverlay`
 * @param {ExternalMapOverlay['geojson']['features']} features - The GeoJSON features to add
 */
export function appendMapOverlayFeatures(id: string, features: ExternalMapOverlay['geojson']['features']): void {
  window.parent.postMessage({ type: 'cockpit:appendMapOverlayFeatures', id, features }, '*')
}

/**
 * Removes every feature from a map overlay, keeping the overlay itself to be appended to again.
 * @param {string} id - The id of the overlay
 */
export function clearMapOverlay(id: string): void {
  window.parent.postMessage({ type: 'cockpit:clearMapOverlay', id }, '*')
}

/**
 * Has Cockpit download a GeoTIFF and show it on its maps, replacing the one already using its id. The file is
 * downloaded once and saved like a GeoTIFF the operator loaded, so send it again to update it. The server must
 * allow Cockpit's origin through CORS.
 * @param {ExternalMapGeoTiff} geoTiff - Id, name, URL and render mode of the overlay. Data-lake inputs in the URL
 * are resolved, so `{{ vehicle-address }}` becomes the address Cockpit reaches the vehicle at
 * @example
 * ```typescript
 * setMapGeoTiff({
 *   id: 'my-extension-depth',
 *   name: 'Depth',
 *   url: 'http://{{ vehicle-address }}:9000/survey/depth.tif',
 *   renderMode: 'bathymetry',
 * })
 * ```
 */
export function setMapGeoTiff(geoTiff: ExternalMapGeoTiff): void {
  window.parent.postMessage({ type: 'cockpit:setMapGeoTiff', geoTiff }, '*')
}

/**
 * Removes a map overlay from Cockpit, GeoJSON or GeoTIFF, including its saved copy.
 * @param {string} id - The id of the overlay
 */
export function removeMapOverlay(id: string): void {
  window.parent.postMessage({ type: 'cockpit:removeMapOverlay', id }, '*')
}
