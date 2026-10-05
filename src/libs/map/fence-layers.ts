import { type MapMarker, divIconMarker } from '@/libs/map/cesium-marker'

/**
 * Class on every geofence marker element, both the committed handles and the ones drawn while a fence is in
 * progress, so the planning view's fence-mode dimming can spare them.
 */
export const FENCE_MARKER_CLASS = 'cockpit-fence-marker'

// Prefix every fence layer id carries, so fence-mode dimming can tell fence layers from the rest.
const fenceLayerPrefix = 'cockpit-fence-'

/**
 * Id for a geofence layer, recognizable by {@link isFenceLayerId}.
 * @param {string} name - A name unique within the map.
 * @returns {string} The layer id, in the fence stacking slot.
 */
export const fenceLayerId = (name: string): string => `fence::${fenceLayerPrefix}${name}`

/**
 * Whether a layer draws geofence geometry.
 * @param {string} id - The layer id.
 * @returns {boolean} True for layers created through {@link fenceLayerId}.
 */
export const isFenceLayerId = (id: string): boolean => id.includes(fenceLayerPrefix)

// Fence markers stack above the other markers but below the vehicle and the tooltips, as their Leaflet pane did.
const fenceMarkerZIndex = '610'

/**
 * Looks of a round fence handle, in the terms of Leaflet's circle markers.
 */
export interface FenceHandleStyle {
  /** Radius of the circle, in pixels, with the stroke centered on it. */
  radius: number
  /** Fill color. */
  fillColor: string
  /** Fill opacity. */
  fillOpacity: number
  /** Stroke color. */
  color: string
  /** Stroke width, in pixels. */
  weight: number
  /** Stroke opacity. */
  opacity: number
  /** Class names of the handle element, which carry its cursor. */
  className?: string
}

const hexAlpha = (color: string, alpha: number): string =>
  `${color}${Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
    .toString(16)
    .padStart(2, '0')}`

/**
 * A round handle drawn as Leaflet drew a circle marker, as an element that can take the pointer.
 * @param {FenceHandleStyle} style - The handle's looks.
 * @returns {MapMarker} The marker, not yet on a map.
 */
export const fenceHandleMarker = (style: FenceHandleStyle): MapMarker => {
  // Leaflet centered the stroke on the radius, so the circle reached half the stroke past it.
  const size = 2 * style.radius + style.weight
  const marker = divIconMarker({ className: [FENCE_MARKER_CLASS, style.className].join(' '), size: [size, size] })
  const element = marker.getElement()
  Object.assign(element.style, {
    boxSizing: 'border-box',
    borderRadius: '50%',
    background: hexAlpha(style.fillColor, style.fillOpacity),
    border: `${style.weight}px solid ${hexAlpha(style.color, style.opacity)}`,
    zIndex: fenceMarkerZIndex,
  } satisfies Partial<CSSStyleDeclaration>)
  return marker
}

/**
 * Marks a marker element as geofence UI, stacked with the other fence markers.
 * @param {MapMarker} marker - The marker to mark.
 * @returns {MapMarker} The same marker.
 */
export const asFenceMarker = (marker: MapMarker): MapMarker => {
  const element = marker.getElement()
  element.classList.add(FENCE_MARKER_CLASS)
  element.style.zIndex = fenceMarkerZIndex
  return marker
}
