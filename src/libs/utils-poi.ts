import type { PointOfInterestCoordinates, ResolvedPointOfInterest } from '@/types/mission'

// Marker color used for live-tracked POIs that currently have no valid position data.
const stalePoiMarkerColor = '#808080'

// Marker opacity used for live-tracked POIs sitting on their fallback coordinates.
const stalePoiMarkerOpacity = 0.4

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

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
 * update of a live-tracked POI.
 * @param {ResolvedPointOfInterest} poi The resolved POI
 * @returns {string} A signature that changes only when the icon appearance changes
 */
export const getPoiIconSignature = (poi: ResolvedPointOfInterest): string => `${getPoiMarkerColor(poi)}|${poi.icon}`

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

  if (isPoiOnFallbackCoordinates(poi)) {
    return `${header}<em>Coordinates unknown</em>`
  }

  const statusText = getPoiStatusText(poi)
  return `
    ${header}
    ${statusText ? `<em>${statusText}</em><br>` : ''}
    Lat: ${coordinates[0].toFixed(8)}, Lng: ${coordinates[1].toFixed(8)}
  `
}
