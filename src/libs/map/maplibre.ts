import * as turf from '@turf/turf'
import type { Feature, LineString, Polygon } from 'geojson'
import {
  type GeoJSONSource,
  type LngLatBoundsLike,
  type LngLatLike,
  type MapMouseEvent,
  type Marker,
  type PointLike,
  Map as MapLibreMap,
  Popup,
  setWorkerUrl,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

import type { ScreenPoint } from '@/libs/map/survey-polygon-edges'
import type { MapOverlayBounds, WaypointCoordinates } from '@/types/mission'

/**
 * Zoom levels are kept on the 256-pixel tile scale everywhere outside the map instance (persisted views, marker size
 * thresholds, offline download ranges), which is one level above MapLibre's 512-pixel world for the same ground scale.
 * Converting only at the map boundary keeps every stored zoom meaning what it always meant.
 */
const tileScaleZoomOffset = 1

/**
 * Converts a tile-scale zoom (the scale Cockpit stores and reasons in) to the map instance's zoom.
 * @param {number} zoom - Zoom on the 256-pixel tile scale.
 * @returns {number} The equivalent MapLibre zoom.
 */
export const toMapLibreZoom = (zoom: number): number => zoom - tileScaleZoomOffset

/**
 * Converts the map instance's zoom to the tile-scale zoom Cockpit stores and reasons in.
 * @param {number} zoom - MapLibre zoom.
 * @returns {number} The equivalent zoom on the 256-pixel tile scale.
 */
export const fromMapLibreZoom = (zoom: number): number => zoom + tileScaleZoomOffset

/**
 * Converts a Cockpit `[latitude, longitude]` pair to MapLibre's `[longitude, latitude]` order.
 * @param {WaypointCoordinates} coordinates - The `[latitude, longitude]` pair.
 * @returns {[number, number]} The `[longitude, latitude]` pair.
 */
export const toLngLat = (coordinates: WaypointCoordinates): [number, number] => [coordinates[1], coordinates[0]]

/** A longitude/latitude pair as MapLibre reports it. */
export interface LngLatLiteral {
  /** Longitude, in decimal degrees. */
  lng: number
  /** Latitude, in decimal degrees. */
  lat: number
}

/**
 * Converts a MapLibre longitude/latitude to a Cockpit `[latitude, longitude]` pair.
 * @param {LngLatLiteral} lngLat - Anything exposing `lng` and `lat`, such as a MapLibre `LngLat`.
 * @returns {WaypointCoordinates} The `[latitude, longitude]` pair.
 */
export const fromLngLat = (lngLat: LngLatLiteral): WaypointCoordinates => [lngLat.lat, lngLat.lng]

/**
 * Bounds covering every coordinate, in MapLibre's `[[west, south], [east, north]]` order.
 * @param {WaypointCoordinates[]} coordinates - The `[latitude, longitude]` pairs to cover; must not be empty.
 * @returns {[[number, number], [number, number]]} The covering bounds.
 */
export const toLngLatBounds = (coordinates: WaypointCoordinates[]): [[number, number], [number, number]] => {
  const lats = coordinates.map((c) => c[0])
  const lngs = coordinates.map((c) => c[1])
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ]
}

/**
 * Corners of an overlay's bounds in the order a MapLibre image source expects (top-left, top-right, bottom-right,
 * bottom-left), each as `[longitude, latitude]`.
 * @param {MapOverlayBounds} bounds - The overlay bounds as `[[south, west], [north, east]]`.
 * @returns {[[number, number], [number, number], [number, number], [number, number]]} The four corners.
 */
export const overlayBoundsToImageCoordinates = (
  bounds: MapOverlayBounds
): [[number, number], [number, number], [number, number], [number, number]] => {
  const [[south, west], [north, east]] = bounds
  return [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ]
}

/**
 * The geographic coordinate of a map pointer event.
 * @param {MapMouseEvent} event - The MapLibre pointer event.
 * @returns {WaypointCoordinates} The `[latitude, longitude]` under the pointer.
 */
export const eventLatLng = (event: MapMouseEvent): WaypointCoordinates => fromLngLat(event.lngLat)

/**
 * Projects a coordinate to the map container's pixel space.
 * @param {MapLibreMap} map - The map to project on.
 * @param {WaypointCoordinates} coordinates - The `[latitude, longitude]` to project.
 * @returns {ScreenPoint} The position relative to the container's top-left corner, in pixels.
 */
export const projectToContainer = (map: MapLibreMap, coordinates: WaypointCoordinates): ScreenPoint =>
  map.project(toLngLat(coordinates))

/**
 * Coordinate under a position in the map container's pixel space.
 * @param {MapLibreMap} map - The map to unproject on.
 * @param {PointLike} point - The position relative to the container's top-left corner, in pixels.
 * @returns {WaypointCoordinates} The `[latitude, longitude]` at that position.
 */
export const unprojectFromContainer = (map: MapLibreMap, point: PointLike): WaypointCoordinates =>
  fromLngLat(map.unproject(point))

/**
 * Position of a mouse or pointer event relative to the map container's top-left corner.
 * @param {MapLibreMap} map - The map whose container the event is measured against.
 * @param {Pick<MouseEvent, 'clientX' | 'clientY'>} event - The DOM event, or anything carrying client coordinates.
 * @returns {ScreenPoint} The position in container pixels.
 */
export const containerPointFromClient = (
  map: MapLibreMap,
  event: Pick<MouseEvent, 'clientX' | 'clientY'>
): ScreenPoint => {
  const rect = map.getContainer().getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

/**
 * Ordered stacking slots for the map's style layers. These replace Leaflet's panes: each composable inserts its layers
 * below the first layer of any later slot, so stacking stays fixed whatever order the composables mount in.
 */
export const mapLayerSlots = [
  'base',
  'raster-overlay',
  'geotiff',
  'coverage',
  'fence',
  'mission',
  'survey-area',
  'survey',
  'vehicle-path',
  'survey-legs',
  'grid',
  'measure',
] as const

/**
 * One of the map's stacking slots.
 */
export type MapLayerSlot = (typeof mapLayerSlots)[number]

const slotSeparator = '::'

/**
 * Builds a layer id that records which stacking slot it belongs to.
 * @param {MapLayerSlot} slot - The stacking slot.
 * @param {string} name - A name unique within the map.
 * @returns {string} The layer id.
 */
export const slottedLayerId = (slot: MapLayerSlot, name: string): string => `${slot}${slotSeparator}${name}`

/**
 * The stacking slot a layer id was built for, by {@link slottedLayerId}.
 * @param {string} id - The layer id.
 * @returns {string} The slot name, or the whole id for a layer not built that way.
 */
export const slotOfLayerId = (id: string): string => id.split(slotSeparator)[0]

/**
 * Id of the first existing layer belonging to a slot above the given one, which is where a new layer of that slot has
 * to be inserted to keep the stacking order.
 * @param {MapLibreMap} map - The map holding the layers.
 * @param {MapLayerSlot} slot - The slot of the layer about to be added.
 * @returns {string | undefined} The id to pass as `beforeId`, or undefined to append on top.
 */
export const beforeIdForSlot = (map: MapLibreMap, slot: MapLayerSlot): string | undefined => {
  const slotIndex = mapLayerSlots.indexOf(slot)
  return map.getLayersOrder().find((id) => mapLayerSlots.indexOf(slotOfLayerId(id) as MapLayerSlot) > slotIndex)
}

/**
 * Creates or replaces the data of a GeoJSON source.
 * @param {MapLibreMap} map - The map holding the source.
 * @param {string} id - The source id.
 * @param {GeoJSON.GeoJSON} data - The data to show.
 */
export const upsertGeoJsonSource = (map: MapLibreMap, id: string, data: GeoJSON.GeoJSON): void => {
  const source = map.getSource<GeoJSONSource>(id)
  if (source) {
    source.setData(data)
    return
  }
  map.addSource(id, { type: 'geojson', data })
}

/**
 * Removes layers and then the source they draw, skipping any that are already gone. Safe to call while the map is
 * being torn down.
 * @param {MapLibreMap | undefined} map - The map holding them.
 * @param {string[]} layerIds - The layers to remove.
 * @param {string} [sourceId] - The source to remove once its layers are gone.
 */
export const removeLayersAndSource = (map: MapLibreMap | undefined, layerIds: string[], sourceId?: string): void => {
  if (!map?.style) return
  layerIds.forEach((id) => map.getLayer(id) && map.removeLayer(id))
  if (sourceId && map.getSource(sourceId)) map.removeSource(sourceId)
}

/**
 * A GeoJSON line through the given coordinates.
 * @param {WaypointCoordinates[]} coordinates - The `[latitude, longitude]` vertices.
 * @param {GeoJSON.GeoJsonProperties} [properties] - Feature properties, for data-driven styling.
 * @returns {Feature<LineString>} The line feature.
 */
export const lineFeature = (
  coordinates: WaypointCoordinates[],
  properties: GeoJSON.GeoJsonProperties = {}
): Feature<LineString> => ({
  type: 'Feature',
  properties,
  geometry: { type: 'LineString', coordinates: coordinates.map(toLngLat) },
})

/**
 * A GeoJSON polygon over the given ring, closed if it is not already.
 * @param {WaypointCoordinates[]} ring - The `[latitude, longitude]` vertices of the outer ring.
 * @param {GeoJSON.GeoJsonProperties} [properties] - Feature properties, for data-driven styling.
 * @returns {Feature<Polygon>} The polygon feature.
 */
export const polygonFeature = (
  ring: WaypointCoordinates[],
  properties: GeoJSON.GeoJsonProperties = {}
): Feature<Polygon> => {
  const coordinates = ring.map(toLngLat)
  const [first, last] = [coordinates[0], coordinates[coordinates.length - 1]]
  if (first && (first[0] !== last[0] || first[1] !== last[1])) coordinates.push(first)
  return { type: 'Feature', properties, geometry: { type: 'Polygon', coordinates: [coordinates] } }
}

/**
 * A polygon approximating a circle of a ground radius, which MapLibre cannot draw natively.
 * @param {WaypointCoordinates} center - The `[latitude, longitude]` center.
 * @param {number} radiusMeters - The ground radius, in meters.
 * @param {GeoJSON.GeoJsonProperties} [properties] - Feature properties, for data-driven styling.
 * @returns {Feature<Polygon>} The circle polygon.
 */
export const meterCircle = (
  center: WaypointCoordinates,
  radiusMeters: number,
  properties: GeoJSON.GeoJsonProperties = {}
): Feature<Polygon> => ({
  ...turf.circle(toLngLat(center), Math.max(radiusMeters, 0.01), { steps: 96, units: 'meters' }),
  properties,
})

/**
 * Where a hover tooltip opens relative to its marker.
 */
export type HoverTooltipDirection = 'top' | 'right' | 'bottom' | 'left'

const tooltipAnchorFor: Record<HoverTooltipDirection, 'bottom' | 'left' | 'top' | 'right'> = {
  top: 'bottom',
  right: 'left',
  bottom: 'top',
  left: 'right',
}

/**
 * Options for {@link bindHoverTooltip}.
 */
export interface HoverTooltipOptions {
  /** Extra class names for the tooltip, which carry its styling. */
  className?: string
  /** Offset from the marker, in pixels. */
  offset?: [number, number]
  /** Side of the marker the tooltip opens on. */
  direction?: HoverTooltipDirection
}

/**
 * A hover tooltip attached to a marker, with a way to change its content and to detach it.
 */
export interface HoverTooltip {
  /** Replaces the tooltip content, whether or not it is open. */
  setContent: (html: string) => void
  /** The tooltip element while it is open. */
  getElement: () => HTMLElement | undefined
  /** Removes the tooltip and its listeners. */
  remove: () => void
}

/**
 * Shows a tooltip while the pointer is over a marker, as Leaflet's non-permanent tooltips did.
 * @param {MapLibreMap} map - The map the marker is on.
 * @param {Marker} marker - The marker to attach to.
 * @param {string} html - The tooltip content.
 * @param {HoverTooltipOptions} [options] - Styling and placement.
 * @returns {HoverTooltip} Handle to update or detach the tooltip.
 */
export const bindHoverTooltip = (
  map: MapLibreMap,
  marker: Marker,
  html: string,
  options: HoverTooltipOptions = {}
): HoverTooltip => {
  let content = html
  const popup = new Popup({
    closeButton: false,
    closeOnClick: false,
    closeOnMove: false,
    focusAfterOpen: false,
    maxWidth: 'none',
    anchor: tooltipAnchorFor[options.direction ?? 'right'],
    offset: options.offset ?? [0, 0],
    className: ['cockpit-hover-tooltip', options.className].filter(Boolean).join(' '),
  })
  const element = marker.getElement()
  const show = (): void => {
    popup.setLngLat(marker.getLngLat()).setHTML(content).addTo(map)
  }
  const hide = (): void => {
    popup.remove()
  }
  const follow = (): void => {
    if (popup.isOpen()) popup.setLngLat(marker.getLngLat())
  }
  element.addEventListener('mouseenter', show)
  element.addEventListener('mouseleave', hide)
  marker.on('drag', follow)
  return {
    setContent: (newHtml) => {
      content = newHtml
      if (popup.isOpen()) popup.setHTML(newHtml)
    },
    getElement: () => (popup.isOpen() ? popup.getElement() : undefined),
    remove: () => {
      element.removeEventListener('mouseenter', show)
      element.removeEventListener('mouseleave', hide)
      marker.off('drag', follow)
      popup.remove()
    },
  }
}

/**
 * Options for {@link createMap}.
 */
export interface CreateMapOptions {
  /** Initial center, as `[latitude, longitude]`. */
  center: WaypointCoordinates
  /** Initial zoom, on the tile scale. */
  zoom: number
  /** Whether to show the attribution of the visible sources. */
  attribution?: boolean
}

let workerConfigured = false

/**
 * Creates a north-up, flat MapLibre map. Scroll and pinch zoom freely, while the buttons, keyboard and double-click
 * step by whole tile levels.
 * @param {HTMLElement} container - The element to draw the map into.
 * @param {CreateMapOptions} options - Initial view and controls.
 * @returns {MapLibreMap} The created map.
 */
export const createMap = (container: HTMLElement, options: CreateMapOptions): MapLibreMap => {
  if (!workerConfigured) {
    setWorkerUrl(workerUrl)
    workerConfigured = true
  }

  const map = new MapLibreMap({
    container,
    style: { version: 8, sources: {}, layers: [] },
    center: toLngLat(options.center),
    zoom: toMapLibreZoom(options.zoom),
    minZoom: toMapLibreZoom(0),
    maxZoom: toMapLibreZoom(23),
    maxPitch: 0,
    zoomSnap: 1,
    dragRotate: false,
    pitchWithRotate: false,
    boxZoom: false,
    attributionControl: options.attribution ? { compact: false } : false,
  })
  map.touchZoomRotate.disableRotation()
  map.touchPitch.disable()
  map.keyboard.disableRotation()

  return map
}

/** Options for {@link fitMapBounds}. */
export interface FitMapBoundsOptions {
  /** Space kept free around the bounds, in pixels. */
  padding?: number
  /** Highest zoom to land on, on the tile scale. */
  maxZoom?: number
  /** Whether to animate the move. */
  animate?: boolean
}

/**
 * Fits the map to bounds, landing on a whole zoom level that still shows all of them.
 * @param {MapLibreMap} map - The map to move.
 * @param {LngLatBoundsLike} bounds - The bounds to show.
 * @param {FitMapBoundsOptions} [options] - Padding and zoom limit.
 */
export const fitMapBounds = (map: MapLibreMap, bounds: LngLatBoundsLike, options: FitMapBoundsOptions = {}): void => {
  map.fitBounds(bounds, {
    padding: options.padding ?? 0,
    // An undefined key would override the map's own zoom limit and turn the fitted camera into NaN.
    ...(options.maxZoom === undefined ? {} : { maxZoom: toMapLibreZoom(options.maxZoom) }),
    animate: options.animate ?? true,
    linear: true,
  })
}

/**
 * Moves the map to a coordinate, optionally changing the zoom.
 * @param {MapLibreMap} map - The map to move.
 * @param {WaypointCoordinates} center - The `[latitude, longitude]` to center on.
 * @param {number} [zoom] - The tile-scale zoom to show, or undefined to keep the current one.
 * @param {boolean} [animate] - Whether to animate the move.
 */
export const setMapView = (map: MapLibreMap, center: WaypointCoordinates, zoom?: number, animate = false): void => {
  const camera = { center: toLngLat(center) as LngLatLike, zoom: zoom === undefined ? undefined : toMapLibreZoom(zoom) }
  if (animate) map.easeTo({ ...camera, duration: 250 })
  else map.jumpTo(camera)
}

/** A map view in Cockpit's terms. */
export interface MapViewState {
  /** The `[latitude, longitude]` at the center of the map. */
  center: WaypointCoordinates
  /** The zoom, on the tile scale. */
  zoom: number
}

/**
 * The map's current center as `[latitude, longitude]` and its zoom on the tile scale.
 * @param {MapLibreMap} map - The map to read.
 * @returns {MapViewState} The current view.
 */
export const mapView = (map: MapLibreMap): MapViewState => ({
  center: fromLngLat(map.getCenter()),
  zoom: fromMapLibreZoom(map.getZoom()),
})
