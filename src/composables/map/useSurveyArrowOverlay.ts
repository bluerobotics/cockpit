import L, { type Map as LeafletMap } from 'leaflet'
import { type WatchStopHandle, watch } from 'vue'

import {
  type SurveyArrowAnchor,
  computeSurveyArrowAnchors,
  partitionArrowsByLength,
  partitionArrowsByOrientation,
} from '@/libs/map/survey-arrows'
import type { Survey, WaypointCoordinates } from '@/types/mission'

const ARROW_PANE = 'surveyArrowPane'
const REFLY_PANE = 'surveyReflyPane'
const PRIMARY_PANE = 'surveyPrimaryPane'

// Preview legs match the dashed survey-path blue, crosshatch re-fly legs the purple crosshatch line, and
// generated-survey legs the mission path blue.
const previewArrowColor = '#2563eb'
const crosshatchArrowColor = '#a855f7'
const surveyArrowColor = '#3388ff'

// Legs shorter than this on screen would render an arrow bigger than the leg itself, so they are skipped.
const minArrowLegPixels = 44

// Legs at least this fraction of the longest leg get a full-opacity arrow so the transect sweeps read clearly;
// the shorter connector/turnaround legs still get an arrow, but faint, to avoid cluttering dense crosshatch grids.
const transectLengthRatio = 0.3

// Opacity of the arrows on the short connector legs (those below the transect-length threshold).
const faintArrowOpacity = 0.6

// A north-pointing arrowhead; CSS rotation aligns it with each leg's travel bearing and `currentColor` lets each
// arrow adopt its source's blue.
const arrowSvg = `<svg viewBox="0 0 14 14" width="24" height="24">
  <path d="M7 1.5 L11.5 11 L7 8.4 L2.5 11 Z" fill="currentColor" />
</svg>`

// Full size at close zoom, shrinking as the survey and path shrink so the arrows stop dominating when zoomed
// out, with a floor that keeps them legible. Kept gentler than the geometry's 2×-per-zoom scaling on purpose.
const referenceZoom = 19
const minArrowScale = 0.4
const arrowScaleForZoom = (zoom: number): number =>
  Math.min(1, Math.max(minArrowScale, 1 - Math.max(0, referenceZoom - zoom) * 0.15))

/** The survey being drawn, split into its primary pass and its optional 90° crosshatch re-fly pass. */
export interface SurveyPreview {
  /** Coordinates of the primary survey pass. */
  firstPass: WaypointCoordinates[]
  /** Coordinates of the crosshatch re-fly pass, empty when crosshatch is disabled. */
  crosshatch: WaypointCoordinates[]
}

/** Reactive sources the survey arrow overlay reads to decide which legs to decorate. */
export interface SurveyArrowSources {
  /** Ordered survey list; the legs between each survey's consecutive waypoints get arrows. */
  surveys: () => Survey[]
  /** The survey preview being drawn, or null when no survey preview is on the map. */
  previewPath: () => SurveyPreview | null
}

/**
 * Return type of {@link useSurveyArrowOverlay}.
 */
export interface UseSurveyArrowOverlayReturn {
  /** Binds the overlay to a Leaflet map, creates its pane, and starts reacting to the sources. */
  initArrowOverlay: (map: LeafletMap) => void
  /** Removes every arrow, stops the watchers, and unbinds the map. */
  destroyArrowOverlay: () => void
}

const metersPerPixel = (latitude: number, zoom: number): number =>
  (40075016.686 * Math.cos((latitude * Math.PI) / 180)) / Math.pow(2, zoom + 8)

/** An arrow anchor carrying the color and opacity of the leg it belongs to. */
interface ColoredArrowAnchor extends SurveyArrowAnchor {
  /** Hex color the arrow is drawn in. */
  color: string
  /** Opacity the arrow is drawn at (full for transect sweeps, faint for short connector legs). */
  opacity: number
}

/** A survey transect to overlay as a solid line, as a `[start, end]` coordinate pair. */
type LegSegment = [WaypointCoordinates, WaypointCoordinates]

/** Everything a single render tick draws: the colored arrows and the survey transect line segments. */
interface SurveyRenderData {
  /** Colored direction arrows to draw. */
  anchors: ColoredArrowAnchor[]
  /** Crosshatch-pass transects to overlay as purple lines, below the primary transects. */
  reflySegments: LegSegment[]
  /** Primary-pass transects to overlay as blue lines, above the crosshatch ones so they win the crossings. */
  primarySegments: LegSegment[]
}

/**
 * Draws direction-of-travel arrows at the middle of each survey leg (the survey being drawn and the legs of every
 * generated survey), never on plain waypoint-to-waypoint segments. For generated crosshatch surveys it also
 * repaints the transects over the blue base line: the crosshatch re-fly pass in purple and the primary pass in
 * blue on top, so the two passes read distinctly and the blue lines win every crossing. Owns its panes, watchers,
 * and teardown so a view only wires an init/destroy pair. Renders are coalesced to one per animation frame so the
 * overlay tracks the survey lines live during dial rotation and waypoint drags without redundant work.
 * @param {SurveyArrowSources} sources - Reactive getters for the survey list and the live survey preview path.
 * @returns {UseSurveyArrowOverlayReturn} Methods to initialize and tear down the overlay.
 */
export const useSurveyArrowOverlay = (sources: SurveyArrowSources): UseSurveyArrowOverlayReturn => {
  let mapRef: LeafletMap | undefined
  let markers: L.Marker[] = []
  let arrowEls: (HTMLElement | null)[] = []
  let reflyLines: L.Polyline[] = []
  let primaryLines: L.Polyline[] = []
  let stopWatch: WatchStopHandle | undefined
  let rafId: number | null = null

  const collectRenderData = (zoom: number): SurveyRenderData => {
    const anchors: ColoredArrowAnchor[] = []
    const reflySegments: LegSegment[] = []
    const primarySegments: LegSegment[] = []

    // Draws every leg of a single-color path: the long transect sweeps at full opacity, the short connector legs
    // faint so they stay unobtrusive.
    const addUniformArrows = (path: WaypointCoordinates[], color: string): void => {
      const { long, short } = partitionArrowsByLength(computeSurveyArrowAnchors(path), transectLengthRatio)
      long.forEach((anchor) => anchors.push({ ...anchor, color, opacity: 1 }))
      short.forEach((anchor) => anchors.push({ ...anchor, color, opacity: faintArrowOpacity }))
    }

    // The preview knows its exact primary/crosshatch split, and the view draws the preview's own re-fly line, so
    // only generated crosshatch surveys need their crosshatch legs both purple-arrowed and purple-lined here.
    const preview = sources.previewPath()
    if (preview) {
      if (preview.firstPass.length >= 2) addUniformArrows(preview.firstPass, previewArrowColor)
      if (preview.crosshatch.length >= 2) addUniformArrows(preview.crosshatch, crosshatchArrowColor)
    }
    sources.surveys().forEach((survey) => {
      if (survey.waypoints.length < 2) return
      const path = survey.waypoints.map((waypoint) => waypoint.coordinates)
      if (!survey.crosshatch) {
        addUniformArrows(path, surveyArrowColor)
        return
      }
      // Classify the transect sweeps by pass to color them and draw the crosshatch re-fly lines; short connectors
      // stay faint and uncolored-by-pass since they are not part of either sweep.
      const { long, short } = partitionArrowsByLength(computeSurveyArrowAnchors(path), transectLengthRatio)
      const crosshatchSweeps = new Set(partitionArrowsByOrientation(long).crosshatch)
      long.forEach((anchor) => {
        const isCrosshatch = crosshatchSweeps.has(anchor)
        anchors.push({ ...anchor, color: isCrosshatch ? crosshatchArrowColor : surveyArrowColor, opacity: 1 })
        ;(isCrosshatch ? reflySegments : primarySegments).push([anchor.start, anchor.end])
      })
      short.forEach((anchor) => anchors.push({ ...anchor, color: surveyArrowColor, opacity: faintArrowOpacity }))
    })

    return {
      anchors: anchors.filter((a) => a.lengthMeters / metersPerPixel(a.position[0], zoom) >= minArrowLegPixels),
      reflySegments,
      primarySegments,
    }
  }

  const render = (): void => {
    if (!mapRef) return
    const map = mapRef
    const zoom = map.getZoom()
    const scale = arrowScaleForZoom(zoom)
    const { anchors, reflySegments, primarySegments } = collectRenderData(zoom)

    while (markers.length > anchors.length) {
      markers.pop()?.remove()
      arrowEls.pop()
    }

    anchors.forEach((anchor, i) => {
      const transform = `rotate(${anchor.bearing}deg) scale(${scale})`
      if (markers[i]) {
        markers[i].setLatLng(anchor.position)
        const el = arrowEls[i]
        if (el) {
          el.style.transform = transform
          el.style.color = anchor.color
          el.style.opacity = String(anchor.opacity)
        }
      } else {
        const icon = L.divIcon({
          className: 'survey-arrow',
          html: `<div class="survey-arrow-glyph" style="transform: ${transform}; color: ${anchor.color}; opacity: ${anchor.opacity}">${arrowSvg}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        })
        const marker = L.marker(anchor.position, { icon, interactive: false, keyboard: false, pane: ARROW_PANE }).addTo(
          map
        )
        markers[i] = marker
        arrowEls[i] = marker.getElement()?.querySelector('.survey-arrow-glyph') ?? null
      }
    })

    // Both passes are drawn at the mission polyline's width and full opacity so each fully hides the blue base line
    // underneath it; the primary pane sits above the crosshatch pane so blue wins wherever the two passes cross.
    const renderLines = (lines: L.Polyline[], segments: LegSegment[], color: string, pane: string): void => {
      while (lines.length > segments.length) {
        lines.pop()?.remove()
      }
      segments.forEach((segment, i) => {
        const latLngs = [L.latLng(segment[0][0], segment[0][1]), L.latLng(segment[1][0], segment[1][1])]
        if (lines[i]) {
          lines[i].setLatLngs(latLngs)
        } else {
          lines[i] = L.polyline(latLngs, { color, weight: 3, opacity: 1, interactive: false, pane }).addTo(map)
        }
      })
    }

    renderLines(reflyLines, reflySegments, crosshatchArrowColor, REFLY_PANE)
    renderLines(primaryLines, primarySegments, surveyArrowColor, PRIMARY_PANE)
  }

  // Coalesce bursts (dial rotation, waypoint drag) into one render on the next frame, so arrows repaint in step
  // with the survey lines instead of lagging behind a debounce.
  const scheduleRender = (): void => {
    if (rafId !== null) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      render()
    })
  }

  const initArrowOverlay = (map: LeafletMap): void => {
    mapRef = map
    if (!map.getPane(ARROW_PANE)) {
      const pane = map.createPane(ARROW_PANE)
      // Above the mission path (overlay pane, 400) but below the waypoint-number tooltips (650).
      pane.style.zIndex = '620'
      pane.style.pointerEvents = 'none'
    }
    if (!map.getPane(REFLY_PANE)) {
      const pane = map.createPane(REFLY_PANE)
      // Just above the mission path so the purple crosshatch lines sit on it, but below the waypoint markers (600).
      pane.style.zIndex = '410'
      pane.style.pointerEvents = 'none'
    }
    if (!map.getPane(PRIMARY_PANE)) {
      const pane = map.createPane(PRIMARY_PANE)
      // Above the crosshatch pane so the blue primary lines paint over the purple ones at every crossing.
      pane.style.zIndex = '420'
      pane.style.pointerEvents = 'none'
    }

    map.on('zoomend', scheduleRender)
    stopWatch = watch([() => sources.previewPath(), () => sources.surveys()], () => scheduleRender(), {
      immediate: true,
    })
  }

  const destroyArrowOverlay = (): void => {
    stopWatch?.()
    stopWatch = undefined
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    mapRef?.off('zoomend', scheduleRender)
    markers.forEach((marker) => marker.remove())
    reflyLines.forEach((line) => line.remove())
    primaryLines.forEach((line) => line.remove())
    markers = []
    arrowEls = []
    reflyLines = []
    primaryLines = []
    mapRef = undefined
  }

  return { initArrowOverlay, destroyArrowOverlay }
}
