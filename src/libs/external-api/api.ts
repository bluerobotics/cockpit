import type {
  ExternalMapCapabilities,
  ExternalMapMesh,
  ExternalMapMeshQuads,
  ExternalMapMeshResult,
} from '@/libs/map/external-map-mesh-api'
import type { ExternalMapGeoTiff, ExternalMapOverlay } from '@/libs/map/external-overlay-api'
import type { ExternalPoi, ExternalPoiUpdate } from '@/libs/poi/external-api'

import { CallbackRateLimiter } from './callback-rate-limiter'

export type { MapMeshQuadAround, MapMeshQuadBounds, MapMeshWedge } from './map-mesh-geometry'
export { quadAround, quadFromBounds, wedge } from './map-mesh-geometry'
export { mapMeshReservedBytes } from '@/libs/map/external-map-mesh-layout'

/**
 * Current version of the Cockpit Widget API
 */
export const COCKPIT_WIDGET_API_VERSION = '0.0.0'

/**
 * Listens to updates for a specific datalake variable.
 * This function sets up a message listener that receives updates from the parent window
 * and forwards them to the callback function, respecting the specified rate limit.
 * @param {string} variableId - The name of the datalake variable to listen to
 * @param {Function} callback - Called with the variable's current value right away, if it has one, and again on every change
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

/**
 * Options of the map mesh helpers that wait for Cockpit's answer
 */
export interface MapMeshRequestOptions {
  /**
   * How long to wait for the answer before rejecting, in milliseconds. Defaults to 5000.
   */
  timeoutMs?: number
}

/**
 * Options of a `setMapMeshQuads` that waits for Cockpit's answer
 */
export interface ConfirmedMapMeshQuadsOptions extends MapMeshRequestOptions {
  /**
   * Waits for Cockpit's answer, with the slots the write filled
   */
  confirm: true
}

/**
 * What a map mesh helper rejects with when Cockpit refuses its command
 */
export class MapMeshCommandError extends Error {
  /**
   * @param {ExternalMapMeshResult} result - Cockpit's answer: the `error`, and the `code` and byte counts of a budget
   * refusal
   */
  constructor(readonly result: ExternalMapMeshResult) {
    super(result.error)
    this.name = 'MapMeshCommandError'
  }
}

type MapMeshAnswer = ExternalMapMeshResult | ExternalMapCapabilities

/**
 * A map mesh command waiting for Cockpit's answer
 */
interface PendingMapMeshRequest {
  /**
   * Settles the helper's promise with the answer
   */
  resolve: (answer: MapMeshAnswer) => void
  /**
   * Rejects the helper's promise
   */
  reject: (error: unknown) => void
  /**
   * Rejects it once the helper stops waiting
   */
  timeout: ReturnType<typeof setTimeout>
}

const defaultMapMeshTimeoutMs = 5000
// Random per page, so answers meant for another copy of these helpers, or for ids a page picks itself, never match.
const mapMeshRequestIdPrefix = `cockpit-api-${Math.random().toString(36).slice(2)}-`
let mapMeshRequestCount = 0
let answeringMapMeshRequests = false
const pendingMapMeshRequests = new Map<string, PendingMapMeshRequest>()

// Sees every message this window receives, so anything but an answer to a pending request returns at once.
const settleMapMeshRequest = (event: MessageEvent): void => {
  const answer = event.data
  if (answer?.type !== 'cockpit:mapMeshResult' && answer?.type !== 'cockpit:mapCapabilities') return
  const pending = pendingMapMeshRequests.get(answer.requestId)
  if (!pending || event.source !== window.parent) return
  pendingMapMeshRequests.delete(answer.requestId)
  clearTimeout(pending.timeout)
  if (answer.ok === false) pending.reject(new MapMeshCommandError(answer))
  else pending.resolve(answer)
}

const askCockpit = <T extends MapMeshAnswer>(
  message: Record<string, unknown>,
  options?: MapMeshRequestOptions,
  transfer?: Transferable[]
): Promise<T> => {
  if (!answeringMapMeshRequests) {
    window.addEventListener('message', settleMapMeshRequest)
    answeringMapMeshRequests = true
  }
  const requestId = `${mapMeshRequestIdPrefix}${++mapMeshRequestCount}`
  const timeoutMs = options?.timeoutMs ?? defaultMapMeshTimeoutMs
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingMapMeshRequests.delete(requestId)
      const reasons =
        'Cockpit may predate map meshes, the command may be invalid, or this page is not in an IFrame widget.'
      reject(new Error(`Cockpit did not answer ${message.type} within ${timeoutMs} ms. ${reasons}`))
    }, timeoutMs)
    pendingMapMeshRequests.set(requestId, { resolve: resolve as (answer: MapMeshAnswer) => void, reject, timeout })
    message.requestId = requestId
    try {
      window.parent.postMessage(message, '*', transfer)
    } catch (error) {
      clearTimeout(timeout)
      pendingMapMeshRequests.delete(requestId)
      reject(error)
    }
  })
}

/**
 * Asks Cockpit which map mesh features and limits it supports. Resolves with its `cockpit:mapCapabilities` answer,
 * whose `meshes` object holds the `version` of the mesh commands (check that it is the version your code targets;
 * unknown fields may appear in either direction and are ignored), `drawn` (false without WebGL2: meshes are still kept
 * and their commands answered, but nothing is shown), the limits `maxCapacity`, `maxQuadsPerMessage`,
 * `maxMessageBytes`, `maxTexelSide` and `maxStripBytes` (the most texel bytes one untinted strip can have; subtract 4
 * when sending a tint, and keep a batch within `maxMessageBytes`), `budgetBytes` (the most all meshes together may
 * reserve for their full capacity on this computer, past which `setMapMesh` is refused with `code: 'budget'`,
 * `usedBytes`, `previousBytes`, `requestedBytes` and `budgetBytes`) and `usedBytes` (what they reserve now, the same
 * total a refusal reports), and the texel `formats`. Capabilities are a snapshot: another sender can reserve space
 * before your next `setMapMesh`. Size a mesh with `mapMeshReservedBytes`, the formula of version 1. To negotiate a
 * smaller capacity, start from a refusal's `requestedBytes` and `previousBytes` rather than dividing bytes by bytes per
 * strip.
 *
 * The mesh helpers that return a promise tag their command with a `requestId` of their own, and Cockpit answers
 * commands in the order they were sent. They reject with a {@link MapMeshCommandError} carrying Cockpit's answer when
 * it refuses the command, and with an `Error` when it does not answer in time, as a Cockpit that predates map meshes
 * never does. Senders posting the commands themselves, or sending them from a generic WebSocket server, pick the
 * `requestId`: an integer, or a string of 1 to 256 characters, echoed back as sent. A command with any other is
 * invalid, so it is neither applied nor answered.
 *
 * The mesh helpers work only from the page an IFrame widget loads: Cockpit applies and answers a mesh command only
 * when its `event.source` is that widget's own iframe. A DIY widget runs in Cockpit's own window, so what it posts is
 * dropped silently, with no warning and no answer, and the helpers time out as if Cockpit predated map meshes. Load
 * your page in an IFrame widget, or send the same commands from a generic WebSocket server.
 * @param {MapMeshRequestOptions} [options] - How long to wait for the answer
 * @returns {Promise<ExternalMapCapabilities>} Cockpit's answer
 */
export function getMapCapabilities(options?: MapMeshRequestOptions): Promise<ExternalMapCapabilities> {
  return askCockpit({ type: 'cockpit:getMapCapabilities' }, options)
}

/**
 * Creates a mesh of textured quads on Cockpit's maps, for georeferenced imagery sent many times a second. Sending it
 * again with the same capacity and texels keeps its quads and its head, changing only its name, filter, palette and
 * opacity; the optional ones you omit return to their defaults (`'nearest'` filter, gray ramp palette, opacity 1).
 * Any other layout empties it, while a refused one keeps its quads. To grow a mesh, keep your source data, wait for
 * the set to succeed, then replay oldest first. Meshes are drawn only where WebGL2 is available. A mesh reserves its
 * whole capacity when set, whatever is later written, so ask for no more slots than you will show: 1024 bytes for its
 * palette plus, per page, 68 bytes per slot and the page's texels, as `mapMeshReservedBytes` computes. All meshes
 * together may reserve 218 MiB unless this computer sets another limit (`budgetBytes`), and a set past it is refused
 * with `code: 'budget'`.
 *
 * Meshes are kept in memory only, so a Cockpit that reloads starts without them, while one whose connection to you
 * dropped keeps them as they were, without what you sent in between. Every sender shares them, so none is removed when
 * a connection closes. On every connection await `getMapCapabilities`, then `setMapMesh`. To replace what it shows,
 * await `clearMapMesh` once that set resolves (regardless of your slot numbering), then replay the quads you want
 * shown, oldest first, in messages of at most 4096 quads, with an explicit `first` so every Cockpit ends up with the
 * same quads in the same slots. To resume instead, send every write and removal it missed. Write quads only once the
 * set resolves: a write to a mesh that does not exist, because its set was refused or Cockpit reloaded since, is
 * refused with `Mesh '<id>' does not exist.`
 * @param {ExternalMapMesh} mesh - Id, name, capacity in quads, and the format and size of every quad's strip of texels.
 * An r8 mesh's texels index into its palette, 256 straight-alpha RGBA entries, an opaque gray ramp unless given. The
 * palette decides what shows through: give the entries for faint or empty readings zero alpha. Every sender shares the
 * same ids, so prefix the id with your extension's name.
 * `filter: 'linear'` interpolates r8 indices before the palette lookup, so use it only with a continuous ramp.
 * @param {MapMeshRequestOptions} [options] - How long to wait for Cockpit's answer
 * @returns {Promise<ExternalMapMeshResult>} Cockpit's answer, with the mesh's `capacity` and `head`. Rejects as
 * described on `getMapCapabilities`.
 * @example
 * ```typescript
 * await setMapMesh({ id: 'my-extension-scan', name: 'Scan', capacity: 4096, texels: { format: 'r8', width: 200, height: 1 } })
 * ```
 */
export function setMapMesh(mesh: ExternalMapMesh, options?: MapMeshRequestOptions): Promise<ExternalMapMeshResult> {
  return askCockpit({ type: 'cockpit:setMapMesh', mesh }, options)
}

/**
 * Writes quads into a map mesh, replacing those in their slots. A quad is drawn as two triangles split along its corner
 * 1 to corner 3 diagonal, its uv interpolated linearly across each. Its color is its texel's straight (not
 * premultiplied) RGBA, or for r8 its palette entry's, times its tint. Quads are drawn in slot order from the head on:
 * where a quad is the first to cover a pixel its color is drawn as it is, and each later quad mixes into what is there
 * with 60% weight for the newer one, on premultiplied color and alpha. As a result, identical overlapping readings draw
 * as one, while a changed reading (fully transparent texels included) pulls the pixel toward it, and a few later
 * readings all but replace it. With `filter: 'linear'`, r8 indices are interpolated before the palette lookup, so an
 * edge between index 0 and data samples the entries in between, and rgba8 straight colors are interpolated before
 * premultiplying, so a transparent texel's color bleeds into its neighbor's edge: give transparent texels their
 * neighbors' color, or use `'nearest'`, to avoid a dark fringe. The mesh's opacity fades the result once. Each map also
 * has a transparency range [hideBelow, opaqueAbove], applied to each texel's straight alpha a after the palette and
 * tint: a texel of zero alpha is never drawn, at any range, and one of alpha a > 0 is drawn with alpha
 * smoothstep(hideBelow, opaqueAbove, a), hidden below hideBelow and opaque from opaqueAbove. When opaqueAbove is not
 * above hideBelow the cut is hard instead, texels of alpha from hideBelow being opaque and the rest hidden, so [0, 0]
 * draws every texel of nonzero alpha opaque. Give silence and faint readings low alphas, and whatever should always
 * show high alphas. The typed arrays' whole buffers are transferred to Cockpit, even where an array views only part of
 * one, so they are empty here afterwards (`byteLength` 0), and sending one of them again throws a `DataCloneError`:
 * build new arrays for every send. Arrays over a `SharedArrayBuffer` are not transferred but shared, so they keep their
 * bytes here.
 *
 * The write is sent without waiting for an answer, so it suits streaming: a refused one only warns in Cockpit's logs.
 * Pass `{ confirm: true }` to get a promise of Cockpit's answer instead.
 * @param {string} id - The id of the mesh
 * @param {ExternalMapMeshQuads} quads - Per quad: `corners`, 4 (longitude, latitude) pairs in ring order, longitude
 * first unlike Leaflet's (lat, lng); `uv`, the 4 corners' (u, v) in texels of the quad's strip, not 0 to 1 (texel
 * centers at +0.5, with v counting rows from the first row sent), (0, 0), (width, 0), (width, height), (0, height)
 * when omitted, which with corners NW, NE, SE, SW shows the strip upright, its first row along the north edge, while
 * uv of 0 to 1 draws one texel's flat color; `texels`, its strip row by row, as a Uint8Array or a Uint8ClampedArray
 * such as a canvas's `getImageData(...).data`; and an optional RGBA `tint`. Without `first`, they follow the previous
 * write, wrapping around at the mesh's capacity
 * @example
 * ```typescript
 * // Text drawn on a canvas, shown upright on one 400 m by 100 m quad.
 * const [width, height] = [512, 128]
 * const canvas = Object.assign(document.createElement('canvas'), { width, height })
 * const context = canvas.getContext('2d')!
 * context.fillStyle = '#0b3d91'
 * context.fillRect(0, 0, width, height)
 * Object.assign(context, { fillStyle: '#fff', font: 'bold 72px sans-serif', textAlign: 'center' })
 * context.textBaseline = 'middle'
 * context.fillText('cockpit rules', width / 2, height / 2)
 * await setMapMesh({ id: 'my-extension-label', name: 'Label', capacity: 1, texels: { format: 'rgba8', width, height } })
 * const [west, east, north, south] = [-48.56057, -48.55651, -27.59305, -27.59395]
 * setMapMeshQuads('my-extension-label', {
 *   first: 0,
 *   corners: new Float64Array([west, north, east, north, east, south, west, south]),
 *   texels: context.getImageData(0, 0, width, height).data,
 * })
 * ```
 */
export function setMapMeshQuads(id: string, quads: ExternalMapMeshQuads): void
/**
 * Writes quads into a map mesh as the other overload does, waiting for Cockpit's answer.
 * @param {string} id - The id of the mesh
 * @param {ExternalMapMeshQuads} quads - The quads, as the other overload takes them
 * @param {ConfirmedMapMeshQuadsOptions} options - `confirm: true`, and how long to wait for the answer
 * @returns {Promise<ExternalMapMeshResult>} Cockpit's answer, with the `first` slot and `count` written and the `head`
 * the next write without `first` starts at, so you know which slots to remove later. Rejects as described on
 * `getMapCapabilities`.
 */
export function setMapMeshQuads(
  id: string,
  quads: ExternalMapMeshQuads,
  options: ConfirmedMapMeshQuadsOptions
): Promise<ExternalMapMeshResult>
/**
 * Implements both overloads: only a confirmed write tags its message and waits for the answer.
 * @param {string} id - The id of the mesh
 * @param {ExternalMapMeshQuads} quads - The quads
 * @param {ConfirmedMapMeshQuadsOptions} [options] - Whether, and how long, to wait for the answer
 * @returns {Promise<ExternalMapMeshResult> | void} Cockpit's answer, for a confirmed write
 */
export function setMapMeshQuads(
  id: string,
  quads: ExternalMapMeshQuads,
  options?: ConfirmedMapMeshQuadsOptions
): Promise<ExternalMapMeshResult> | void {
  // Every buffer once, since postMessage throws on a buffer listed twice. SharedArrayBuffers are shared, not moved.
  const transfer: ArrayBuffer[] = []
  for (const array of [quads.corners, quads.uv, quads.texels, quads.tint]) {
    const buffer = ArrayBuffer.isView(array) ? array.buffer : undefined
    if (buffer instanceof ArrayBuffer && !transfer.includes(buffer)) transfer.push(buffer)
  }
  const message = { type: 'cockpit:setMapMeshQuads', id, ...quads }
  if (options?.confirm) return askCockpit(message, options, transfer)
  window.parent.postMessage(message, '*', transfer)
}

/**
 * Empties consecutive slots of a map mesh, which then draw nothing.
 * @param {string} id - The id of the mesh
 * @param {number} first - The first slot
 * @param {number} count - How many slots
 * @param {MapMeshRequestOptions} [options] - How long to wait for Cockpit's answer
 * @returns {Promise<ExternalMapMeshResult>} Cockpit's answer. Rejects as described on `getMapCapabilities`.
 */
export function removeMapMeshQuads(
  id: string,
  first: number,
  count: number,
  options?: MapMeshRequestOptions
): Promise<ExternalMapMeshResult> {
  return askCockpit({ type: 'cockpit:removeMapMeshQuads', id, first, count }, options)
}

/**
 * Empties every slot of a map mesh, keeping the mesh to be written to again from slot 0.
 * @param {string} id - The id of the mesh
 * @param {MapMeshRequestOptions} [options] - How long to wait for Cockpit's answer
 * @returns {Promise<ExternalMapMeshResult>} Cockpit's answer. Rejects as described on `getMapCapabilities`.
 */
export function clearMapMesh(id: string, options?: MapMeshRequestOptions): Promise<ExternalMapMeshResult> {
  return askCockpit({ type: 'cockpit:clearMapMesh', id }, options)
}

/**
 * Removes a map mesh from Cockpit.
 * @param {string} id - The id of the mesh
 * @param {MapMeshRequestOptions} [options] - How long to wait for Cockpit's answer
 * @returns {Promise<ExternalMapMeshResult>} Cockpit's answer. Rejects as described on `getMapCapabilities`.
 */
export function removeMapMesh(id: string, options?: MapMeshRequestOptions): Promise<ExternalMapMeshResult> {
  return askCockpit({ type: 'cockpit:removeMapMesh', id }, options)
}
