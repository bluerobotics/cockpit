import type { CockpitMap } from '@/libs/map/cesium-map'
import { calculateHaversineDistance } from '@/libs/mission/general-estimates'

/**
 * A control put in one of the map's corners, with what it takes to stop it following the map.
 */
export interface MapControl {
  /** The control element, for {@link CockpitMap.addControl}. */
  element: HTMLElement
  /** Stops the control and takes it off the map. */
  remove: () => void
}

/**
 * Zoom in and out buttons, drawn as Leaflet's were: two stacked 30-pixel squares with bold +/- glyphs, disabled at the
 * map's zoom limits.
 * @param {CockpitMap} map - The map they zoom.
 * @returns {MapControl} The control.
 */
export const zoomControl = (map: CockpitMap): MapControl => {
  const element = document.createElement('div')
  element.className = 'cockpit-map-zoom'
  const button = (className: string, glyph: string, label: string, onClick: () => void): HTMLButtonElement => {
    const control = document.createElement('button')
    control.type = 'button'
    control.className = className
    control.textContent = glyph
    control.title = label
    control.setAttribute('aria-label', label)
    control.addEventListener('click', onClick)
    element.appendChild(control)
    return control
  }
  const zoomIn = button('cockpit-map-zoom-in', '+', 'Zoom in', () => map.zoomIn())
  const zoomOut = button('cockpit-map-zoom-out', '−', 'Zoom out', () => map.zoomOut())
  const update = (): void => {
    const zoom = map.getZoom()
    zoomIn.disabled = zoom >= map.getMaxZoom() - 1e-6
    zoomOut.disabled = zoom <= map.getMinZoom() + 1e-6
  }
  update()
  map.on('zoom', update)
  return {
    element,
    remove: () => {
      map.off('zoom', update)
      element.remove()
    },
  }
}

// Leaflet's L.Control.Scale._getRoundNum: the largest 1, 2, 3 or 5 times a power of ten below the distance.
const roundScaleDistance = (meters: number): number => {
  const power = 10 ** (String(Math.floor(meters)).length - 1)
  const digit = meters / power
  return power * (digit >= 10 ? 10 : digit >= 5 ? 5 : digit >= 3 ? 3 : digit >= 2 ? 2 : 1)
}

/**
 * A metric scale bar of at most 100 pixels, laid out as Leaflet's was: a `cockpit-scale-control` container holding a
 * `cockpit-scale-line` bar, so the maps can frame the container and keep the bar's own look.
 * @param {CockpitMap} map - The map it measures.
 * @returns {MapControl} The control.
 */
export const scaleControl = (map: CockpitMap): MapControl => {
  const maxWidth = 100
  const element = document.createElement('div')
  element.className = 'cockpit-scale-control'
  const line = document.createElement('div')
  line.className = 'cockpit-scale-line'
  element.appendChild(line)
  const update = (): void => {
    // Measured across the middle of the map, as Leaflet measured it.
    const y = map.getContainer().clientHeight / 2
    const maxMeters = calculateHaversineDistance(map.unproject({ x: 0, y }), map.unproject({ x: maxWidth, y }))
    if (!Number.isFinite(maxMeters) || maxMeters <= 0) return
    const meters = roundScaleDistance(maxMeters)
    line.style.width = `${Math.round((maxWidth * meters) / maxMeters)}px`
    line.textContent = meters < 1000 ? `${meters} m` : `${meters / 1000} km`
  }
  update()
  map.on('move', update)
  map.on('resize', update)
  return {
    element,
    remove: () => {
      map.off('move', update)
      map.off('resize', update)
      element.remove()
    },
  }
}

/**
 * A flat line crediting the imagery currently shown, as Leaflet's attribution control did.
 * @param {CockpitMap} map - The map whose imagery it credits.
 * @returns {MapControl} The control.
 */
export const attributionControl = (map: CockpitMap): MapControl => {
  const element = document.createElement('div')
  element.className = 'cockpit-map-attribution'
  const update = (): void => {
    const attributions = map.visibleAttributions()
    // Attributions are the providers' own HTML, links included, as Leaflet rendered them.
    element.innerHTML = attributions.join(' | ')
    element.style.display = attributions.length ? '' : 'none'
  }
  update()
  map.on('layers', update)
  return {
    element,
    remove: () => {
      map.off('layers', update)
      element.remove()
    },
  }
}
