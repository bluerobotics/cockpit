import type { DataDrivenPropertyValueSpecification, Map as MapLibreMap, Marker } from 'maplibre-gl'

import { divIconMarker, slotOfLayerId, slottedLayerId } from '@/libs/map/maplibre'

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
export const fenceLayerId = (name: string): string => slottedLayerId('fence', `${fenceLayerPrefix}${name}`)

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
 * @returns {Marker} The marker, not yet on a map.
 */
export const fenceHandleMarker = (style: FenceHandleStyle): Marker => {
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
 * @param {Marker} marker - The marker to mark.
 * @returns {Marker} The same marker.
 */
export const asFenceMarker = (marker: Marker): Marker => {
  const element = marker.getElement()
  element.classList.add(FENCE_MARKER_CLASS)
  element.style.zIndex = fenceMarkerZIndex
  return marker
}

/**
 * Registers the 45° stripe images exclusion fences are filled with, unless the map already has them.
 * @param {MapLibreMap} map - The map to register them on.
 * @param {string} name - The image name.
 * @param {string} color - The stripe color, as `#rrggbb`.
 * @param {number} opacity - The stripe opacity.
 */
export const ensureStripePattern = (map: MapLibreMap, name: string, color: string, opacity: number): void => {
  if (map.hasImage(name)) return
  // 6px stripes 12px apart, turned 45°, like the SVG pattern Leaflet's paths were filled with. A 45° stripe repeats
  // on a 12√2 square, which is rounded to 17 pixels.
  const size = 17
  const samples = 4
  const red = parseInt(color.slice(1, 3), 16)
  const green = parseInt(color.slice(3, 5), 16)
  const blue = parseInt(color.slice(5, 7), 16)
  const data = new Uint8ClampedArray(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let covered = 0
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const offset = (x + (sx + 0.5) / samples + y + (sy + 0.5) / samples) % size
          if (offset < size / 2) covered++
        }
      }
      const index = (y * size + x) * 4
      data[index] = red
      data[index + 1] = green
      data[index + 2] = blue
      data[index + 3] = Math.round((covered / samples ** 2) * opacity * 255)
    }
  }
  map.addImage(name, { width: size, height: size, data })
}

// The slots whose vectors shared the overlay pane with the fences, which is what fence-mode dimming faded.
const dimmedSlots = ['coverage', 'mission', 'survey-area', 'survey', 'grid']
type OpacityProperty = 'fill-opacity' | 'line-opacity' | 'circle-opacity' | 'circle-stroke-opacity'
const opacityProperties: Record<string, OpacityProperty[]> = {
  fill: ['fill-opacity'],
  line: ['line-opacity'],
  circle: ['circle-opacity', 'circle-stroke-opacity'],
}

/**
 * Fades the map's non-fence vector layers, so the fences being edited stand out, and returns how to undo it.
 * @param {MapLibreMap} map - The map to dim.
 * @param {number} factor - Opacity multiplier, in [0, 1].
 * @returns {() => void} Restores the opacities the layers had.
 */
export const dimNonFenceLayers = (map: MapLibreMap, factor: number): (() => void) => {
  const restores: (() => void)[] = []
  map.getLayersOrder().forEach((id) => {
    if (isFenceLayerId(id) || !dimmedSlots.includes(slotOfLayerId(id))) return
    const type = map.getLayer(id)?.type
    ;(opacityProperties[type ?? ''] ?? []).forEach((property) => {
      const original = (map.getPaintProperty(id, property) ?? 1) as DataDrivenPropertyValueSpecification<number>
      // A data-driven opacity is scaled as an expression, so each feature keeps its own share of the fade.
      const dimmed = (
        typeof original === 'number' ? original * factor : ['*', factor, original]
      ) as DataDrivenPropertyValueSpecification<number>
      map.setPaintProperty(id, property, dimmed)
      restores.push(() => map.getLayer(id) && map.setPaintProperty(id, property, original))
    })
  })
  return () => restores.forEach((restore) => restore())
}
