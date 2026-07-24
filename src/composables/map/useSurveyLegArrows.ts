import L, { type Map as LeafletMap } from 'leaflet'

import type { SurveyLegArrow } from '@/libs/map/utils-map'

const ARROW_PANE = 'surveyLegArrowPane'

// A north-pointing arrowhead; CSS rotation aligns it with each leg's travel bearing.
const arrowGlyphHtml = `<svg viewBox="0 0 14 14" width="24" height="24" class="survey-leg-arrow-glyph">
  <path d="M7 1.5 L11.5 11 L7 8.4 L2.5 11 Z" fill="#3388ff" />
</svg>`

// Full size at close zoom, shrinking as the survey and path shrink so the arrows stop dominating when zoomed
// out, with a floor that keeps them legible. Kept gentler than the geometry's 2×-per-zoom scaling on purpose.
const referenceZoom = 19
const minArrowScale = 0.4
const arrowScaleForZoom = (zoom: number): number =>
  Math.min(1, Math.max(minArrowScale, 1 - Math.max(0, referenceZoom - zoom) * 0.15))

/**
 * Return type of {@link useSurveyLegArrows}.
 */
export interface UseSurveyLegArrowsReturn {
  /** Binds the overlay to a Leaflet map and creates the dedicated pane. */
  initSurveyLegArrows: (map: LeafletMap) => void
  /** Draws (or updates) a direction arrow at each given leg point, recycling markers. */
  renderSurveyLegArrows: (arrows: SurveyLegArrow[]) => void
  /** Removes every arrow currently on the map. */
  clearSurveyLegArrows: () => void
  /** Clears the overlay and unbinds the map. */
  destroySurveyLegArrows: () => void
}

/**
 * Draws small direction arrows on the legs entering and leaving surveys, so operators can tell at a glance
 * whether a connecting segment heads into a survey or back out. Recycles markers across updates to stay cheap
 * and scales the arrows down at far zoom so they stay proportional to the survey and path.
 * @returns {UseSurveyLegArrowsReturn} Methods to initialize, render, clear, and tear down the arrow overlay.
 */
export const useSurveyLegArrows = (): UseSurveyLegArrowsReturn => {
  let mapRef: LeafletMap | undefined
  let arrowMarkers: L.Marker[] = []
  let arrowGlyphEls: (HTMLElement | null)[] = []
  let arrowBearings: number[] = []
  let onZoomEnd: (() => void) | undefined

  const applyGlyphTransform = (index: number, scale: number): void => {
    const glyph = arrowGlyphEls[index]
    if (glyph) glyph.style.transform = `rotate(${arrowBearings[index]}deg) scale(${scale})`
  }

  const refreshArrowScale = (): void => {
    if (!mapRef) return
    const scale = arrowScaleForZoom(mapRef.getZoom())
    arrowGlyphEls.forEach((_, index) => applyGlyphTransform(index, scale))
  }

  const initSurveyLegArrows = (map: LeafletMap): void => {
    mapRef = map
    onZoomEnd = () => refreshArrowScale()
    map.on('zoomend', onZoomEnd)
    if (map.getPane(ARROW_PANE)) return
    // Above the mission path (overlay pane, 400) but below the waypoint-number tooltips (650).
    const pane = map.createPane(ARROW_PANE)
    pane.style.zIndex = '620'
    pane.style.pointerEvents = 'none'
  }

  const renderSurveyLegArrows = (arrows: SurveyLegArrow[]): void => {
    if (!mapRef) return
    const map = mapRef
    const scale = arrowScaleForZoom(map.getZoom())

    while (arrowMarkers.length > arrows.length) {
      arrowMarkers.pop()?.remove()
      arrowGlyphEls.pop()
      arrowBearings.pop()
    }

    arrows.forEach((arrow, index) => {
      const latLng = L.latLng(arrow.position[0], arrow.position[1])
      arrowBearings[index] = arrow.bearing
      if (arrowMarkers[index]) {
        arrowMarkers[index].setLatLng(latLng)
      } else {
        const icon = L.divIcon({
          className: 'survey-leg-arrow',
          html: arrowGlyphHtml,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        })
        const marker = L.marker(latLng, { icon, interactive: false, keyboard: false, pane: ARROW_PANE }).addTo(map)
        arrowMarkers[index] = marker
        arrowGlyphEls[index] = marker.getElement()?.querySelector<HTMLElement>('.survey-leg-arrow-glyph') ?? null
      }
      applyGlyphTransform(index, scale)
    })
  }

  const clearSurveyLegArrows = (): void => {
    arrowMarkers.forEach((marker) => marker.remove())
    arrowMarkers = []
    arrowGlyphEls = []
    arrowBearings = []
  }

  const destroySurveyLegArrows = (): void => {
    if (mapRef && onZoomEnd) mapRef.off('zoomend', onZoomEnd)
    onZoomEnd = undefined
    clearSurveyLegArrows()
    mapRef = undefined
  }

  return { initSurveyLegArrows, renderSurveyLegArrows, clearSurveyLegArrows, destroySurveyLegArrows }
}
