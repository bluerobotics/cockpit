import { escapeHtml } from '@/libs/utils'
import type { PointOfInterest, PointOfInterestCoordinates, ResolvedPointOfInterest } from '@/types/mission'

// Marker color used for live-tracked POIs that currently have no valid position data.
const stalePoiMarkerColor = '#808080'

// Marker opacity used for live-tracked POIs sitting on their fallback coordinates.
const stalePoiMarkerOpacity = 0.4

/**
 * Normalizes a POI heading read from the data lake into degrees clockwise from north, in 0-360.
 * @param {unknown} value The raw value the heading source resolved to
 * @returns {number | null} The normalized heading, or null when the value is not a usable number
 */
export const normalizePoiHeading = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return ((value % 360) + 360) % 360
}

/**
 * Whether a POI was given a heading source, regardless of whether it currently resolves to a value.
 * @param {PointOfInterest} poi The POI
 * @returns {boolean} True when the POI has a heading source
 */
export const poiHasHeading = (poi: PointOfInterest): boolean => poi.heading !== undefined && poi.heading !== null

// The teardrop pin's sharp corner is its bottom-left one, which points 225° clockwise from north.
const pinCornerBearing = 225

/**
 * CSS rotation that makes a POI teardrop pin point at the given bearing.
 * @param {number} bearing The bearing to point the pin at, in degrees clockwise from north
 * @returns {number} The rotation to apply to the pin shape, in degrees
 */
export const poiPinRotation = (bearing: number): number => bearing - pinCornerBearing

/**
 * Whether a live-tracked POI is currently positioned on its fallback coordinates (no live data).
 * @param {ResolvedPointOfInterest} poi The resolved POI
 * @returns {boolean} True when the POI is live-tracked but has no valid position
 */
export const isPoiOnFallbackCoordinates = (poi: ResolvedPointOfInterest): boolean =>
  poi.isLiveTracked && !poi.hasValidPosition

/**
 * Gets the status text to display in a POI tooltip.
 * @param {ResolvedPointOfInterest} poi The resolved POI
 * @returns {string} Status text, or an empty string for static POIs
 */
export const getPoiStatusText = (poi: ResolvedPointOfInterest): string => {
  if (!poi.isLiveTracked) return ''
  return poi.hasValidPosition ? 'Live tracking' : 'Coordinates unknown'
}

/**
 * Gets the marker color for a POI, graying out live-tracked POIs without valid position data.
 * @param {ResolvedPointOfInterest} poi The resolved POI
 * @returns {string} The color to use for the marker
 */
export const getPoiMarkerColor = (poi: ResolvedPointOfInterest): string => {
  if (!isPoiOnFallbackCoordinates(poi)) return poi.color
  return stalePoiMarkerColor
}

/**
 * Gets the marker opacity for a POI, dimming live-tracked POIs without valid position data.
 * @param {ResolvedPointOfInterest} poi The resolved POI
 * @returns {number} The opacity to use for the marker
 */
export const getPoiMarkerOpacity = (poi: ResolvedPointOfInterest): number =>
  isPoiOnFallbackCoordinates(poi) ? stalePoiMarkerOpacity : 1

/**
 * Builds a signature describing a POI marker's icon appearance. Used to avoid rebuilding the
 * Leaflet icon (which recreates its DOM element and breaks in-progress clicks) on every position
 * update of a live-tracked POI. Carries whether the POI has a heading, not the heading itself, since
 * the direction indicator is rotated in place once it exists.
 * @param {ResolvedPointOfInterest} poi The resolved POI
 * @returns {string} A signature that changes only when the icon appearance changes
 */
export const getPoiIconSignature = (poi: ResolvedPointOfInterest): string =>
  `${getPoiMarkerColor(poi)}|${poi.icon}|${poi.resolvedHeading !== null}`

/**
 * Builds the tooltip HTML for a POI marker. When a live-tracked POI has no valid position, the
 * coordinates line is replaced with an "unknown" notice instead of showing the fallback location.
 * @param {ResolvedPointOfInterest} poi The resolved POI
 * @param {PointOfInterestCoordinates} coordinates The coordinates to display (e.g. while dragging)
 * @returns {string} The tooltip HTML
 */
export const getPoiTooltipHtml = (poi: ResolvedPointOfInterest, coordinates: PointOfInterestCoordinates): string => {
  // POI names/descriptions are user-controlled, so escape them before embedding in tooltip HTML.
  const name = escapeHtml(poi.name)
  const description = poi.description ? `${escapeHtml(poi.description)}<br>` : ''
  const header = `<strong>${name}</strong><br>${description}`

  // A POI with a heading source that has no value yet is otherwise indistinguishable from one with no
  // heading at all, since neither draws a direction on the marker.
  const headingValue = poi.resolvedHeading === null ? 'unknown' : `${poi.resolvedHeading.toFixed(1)}°`
  const headingText = poiHasHeading(poi) ? `<br>Heading: ${headingValue}` : ''

  if (isPoiOnFallbackCoordinates(poi)) {
    return `${header}<em>Coordinates unknown</em>${headingText}`
  }

  const statusText = getPoiStatusText(poi)
  return `
    ${header}
    ${statusText ? `<em>${statusText}</em><br>` : ''}
    Lat: ${coordinates[0].toFixed(8)}, Lng: ${coordinates[1].toFixed(8)}${headingText}
  `
}
