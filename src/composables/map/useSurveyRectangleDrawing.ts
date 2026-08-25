import L, { type Map as LeafletMap } from 'leaflet'
import { type ComputedRef, type Ref, computed, onBeforeUnmount, ref } from 'vue'

import {
  type SurveyRectangleSpec,
  rectangleCorners,
  rectangleFromBaselineAndCursor,
  rectangleLinesAngle,
  rectangleSpec,
} from '@/libs/map/survey-rectangle'
import { formatMetersShort } from '@/libs/mission/general-estimates'
import type { WaypointCoordinates } from '@/types/mission'

import { useMeasurePillOverlay } from './useMeasurePillOverlay'

/** Shape the draft survey polygon is drawn as. */
export type SurveyDrawShape = 'free-form' | 'rectangle'

/** Extents of a survey rectangle, in meters. */
export interface SurveyRectangleDimensions {
  /** Extent along the edge the user drew. */
  length: number
  /** Extent perpendicular to the edge the user drew. */
  width: number
}

/** Wiring {@link useSurveyRectangleDrawing} needs from the view that owns the survey draft. */
export interface UseSurveyRectangleDrawingOptions {
  /** Draft survey polygon vertices, replaced wholesale whenever a rectangle is built. */
  vertices: Ref<L.LatLng[]>
  /** Called once a rectangle has been drawn on the map, with the scan angle along its longer axis. */
  onRectangleDrawn: (linesAngle: number) => void
  /** Called once typed extents have been applied, with the new scan angle, or null once the user owns the angle. */
  onRectangleResized: (linesAngle: number | null) => void
  /** Called when the draw shape changes, so an unfinished draft can be dropped. */
  onShapeChanged: (shape: SurveyDrawShape) => void
}

/** The edge the user drew, which the rectangle is raised from. */
interface RectangleBaseline {
  /** Where the edge was started. */
  start: WaypointCoordinates
  /** Where the edge was ended. */
  end: WaypointCoordinates
}

/** Return type of {@link useSurveyRectangleDrawing}. */
export interface UseSurveyRectangleDrawingReturn {
  /** Shape the next survey polygon is drawn as. */
  shape: Ref<SurveyDrawShape>
  /** Whether the rectangle is currently being sized against the cursor. */
  isSizingRectangle: ComputedRef<boolean>
  /** Extents of the draft polygon while it is a rectangle; null otherwise. */
  dimensions: ComputedRef<SurveyRectangleDimensions | null>
  /** Switches the draw shape. */
  setShape: (shape: SurveyDrawShape) => void
  /** Handles a map click, returning whether the rectangle tool consumed it. */
  consumeSurveyClick: (latlng: L.LatLng) => boolean
  /** Rebuilds the draft rectangle at the given extents, around the same baseline. */
  applyDimensions: (dimensions: SurveyRectangleDimensions) => void
  /** Hands the scan angle to the user, so it stops being derived from the longer axis. */
  releaseLinesAngle: () => void
  /** Abandons a rectangle being sized, returning whether there was one. */
  cancelSizing: () => boolean
  /** Binds the tool to a Leaflet map. */
  initRectangleDrawing: (map: LeafletMap) => void
}

// A mistyped extra digit would otherwise rebuild the polygon at a size the path generator sweeps line by line,
// so both extents are held to a range a survey can be flown at.
const minExtentInMeters = 1
const maxExtentInMeters = 100000

const previewStyle: L.PolylineOptions = {
  color: '#3B82F6',
  fillColor: '#60A5FA',
  fillOpacity: 0.15,
  weight: 2,
  dashArray: '8,8',
  interactive: false,
  className: 'survey-rectangle-preview',
}

/**
 * Draws a survey area as a rectangle: the first two clicks lay down one edge, the cursor then sweeps the extent
 * perpendicular to it, and the third click fixes a polygon with square corners whose scan lines follow its
 * longer axis. The result is an ordinary four-vertex survey draft, so every existing survey option keeps
 * applying to it, and its extents stay editable because they are read back from the corners.
 * @param {UseSurveyRectangleDrawingOptions} options - The draft vertices and the view callbacks to drive.
 * @returns {UseSurveyRectangleDrawingReturn} The tool's state and the handlers the view routes input to.
 */
export const useSurveyRectangleDrawing = (
  options: UseSurveyRectangleDrawingOptions
): UseSurveyRectangleDrawingReturn => {
  const { vertices, onRectangleDrawn, onRectangleResized, onShapeChanged } = options

  const { initMeasurePillOverlay, renderMeasurePills, destroyMeasurePillOverlay } = useMeasurePillOverlay()

  const shape = ref<SurveyDrawShape>('free-form')
  const phase = ref<'idle' | 'baseline' | 'sizing'>('idle')
  const sizingSpec = ref<SurveyRectangleSpec | null>(null)

  let mapRef: LeafletMap | undefined
  let baseline: RectangleBaseline | null = null
  let previewLayer: L.Polygon | null = null
  let lastCursor: WaypointCoordinates | null = null
  // A rectangle implies its own scan direction, so the derived angle keeps following the longer axis until the
  // user dials in one of their own. Held as the corners it was derived from, so a polygon the user has reshaped
  // by hand no longer matches and takes the angle over as well.
  let derivedCorners: WaypointCoordinates[] | null = null

  const asCoordinates = (latLng: L.LatLng): WaypointCoordinates => [latLng.lat, latLng.lng]

  const areSameCorners = (a: WaypointCoordinates[], b: WaypointCoordinates[]): boolean =>
    a.length === b.length && a.every(([lat, lng], index) => b[index][0] === lat && b[index][1] === lng)

  const clampExtent = (value: number, fallback: number): number =>
    Number.isFinite(value) ? Math.min(maxExtentInMeters, Math.max(minExtentInMeters, value)) : fallback

  const setVertices = (corners: WaypointCoordinates[]): void => {
    vertices.value = corners.map(([lat, lng]) => L.latLng(lat, lng))
  }

  const renderPreview = (cursor: WaypointCoordinates): void => {
    if (!baseline || !mapRef) return

    lastCursor = cursor
    const spec = rectangleFromBaselineAndCursor(baseline.start, baseline.end, cursor)
    sizingSpec.value = spec
    const corners = rectangleCorners(spec).map(([lat, lng]) => L.latLng(lat, lng))
    if (previewLayer) {
      previewLayer.setLatLngs(corners)
    } else {
      previewLayer = L.polygon(corners, previewStyle).addTo(mapRef)
    }
    // A pill on the drawn edge and one on the edge across it, so both extents are readable on the map itself
    // rather than only in the panel the user is not looking at while drawing.
    renderMeasurePills([
      { from: corners[0], to: corners[1], text: spec.length < 1 ? null : formatMetersShort(spec.length) },
      { from: corners[1], to: corners[2], text: spec.width < 1 ? null : formatMetersShort(spec.width) },
    ])
  }

  const onSizingMouseMove = (event: L.LeafletMouseEvent): void => renderPreview(asCoordinates(event.latlng))

  // The pills are placed in container pixels, so a pan or zoom has to redraw them against the new viewport.
  const onSizingViewChange = (): void => {
    if (lastCursor) renderPreview(lastCursor)
  }

  const stopSizing = (): void => {
    mapRef?.off('mousemove', onSizingMouseMove)
    mapRef?.off('moveend zoomend', onSizingViewChange)
    lastCursor = null
    previewLayer?.remove()
    previewLayer = null
    destroyMeasurePillOverlay()
    baseline = null
    sizingSpec.value = null
    phase.value = 'idle'
  }

  const cancelSizing = (): boolean => {
    if (phase.value !== 'sizing') return false
    stopSizing()
    // The corner the baseline started from is still on the map, so the next click lays its far end again rather
    // than falling through as a free-form vertex.
    if (vertices.value.length > 0) phase.value = 'baseline'
    return true
  }

  const consumeSurveyClick = (latlng: L.LatLng): boolean => {
    if (shape.value !== 'rectangle') return false

    if (phase.value === 'sizing') {
      const spec = sizingSpec.value
      // A click back on the baseline leaves no area to survey, so keep sizing instead of fixing a degenerate
      // polygon the survey generator would produce no lines for.
      if (spec && spec.width > 0 && spec.length > 0) {
        logUserAction(`Drew a survey rectangle of ${spec.length.toFixed(1)} m by ${spec.width.toFixed(1)} m`)
        const corners = rectangleCorners(spec)
        stopSizing()
        setVertices(corners)
        derivedCorners = corners
        onRectangleDrawn(rectangleLinesAngle(corners))
      }
      return true
    }

    if (phase.value === 'baseline') {
      const anchor = vertices.value.at(-1)
      // The draft was emptied while the first corner was awaited (Clear Path, an undo, or the corner itself being
      // removed), so this click lays that corner down again instead of falling through as a free-form vertex.
      if (!anchor) return false
      // A double-click on the first corner would otherwise start sizing against an edge of no length, which
      // can never be finished into a polygon.
      if (anchor.equals(latlng)) return true

      logUserAction('Set the survey rectangle baseline')
      baseline = { start: asCoordinates(anchor), end: asCoordinates(latlng) }
      phase.value = 'sizing'
      mapRef?.on('mousemove', onSizingMouseMove)
      mapRef?.on('moveend zoomend', onSizingViewChange)
      renderPreview(asCoordinates(latlng))
      return true
    }

    // The baseline's first corner is an ordinary vertex, so the view places it and its live measure and undo
    // step come along with it.
    if (vertices.value.length === 0) phase.value = 'baseline'
    return false
  }

  const draftSpec = computed(() => rectangleSpec(vertices.value.map(asCoordinates)))

  // Only the finished draft's extents, since the ones being swept by the cursor cannot be typed over: they read
  // out on the map pills instead.
  const dimensions = computed<SurveyRectangleDimensions | null>(() => {
    const spec = draftSpec.value
    return spec ? { length: spec.length, width: spec.width } : null
  })

  const applyDimensions = (typed: SurveyRectangleDimensions): void => {
    const spec = draftSpec.value
    if (!spec) return

    const length = clampExtent(typed.length, spec.length)
    const width = clampExtent(typed.width, spec.width)
    if (length === spec.length && width === spec.width) return

    logUserAction(`Set the survey rectangle to ${length.toFixed(1)} m by ${width.toFixed(1)} m`)
    const follows = !!derivedCorners && areSameCorners(derivedCorners, vertices.value.map(asCoordinates))
    const corners = rectangleCorners({ ...spec, length, width })
    setVertices(corners)
    derivedCorners = follows ? corners : null
    onRectangleResized(follows ? rectangleLinesAngle(corners) : null)
  }

  const releaseLinesAngle = (): void => {
    derivedCorners = null
  }

  const setShape = (nextShape: SurveyDrawShape): void => {
    if (nextShape === shape.value) return

    logUserAction(`Switched the survey shape to ${nextShape === 'rectangle' ? 'rectangle' : 'free form'}`)
    stopSizing()
    shape.value = nextShape
    onShapeChanged(nextShape)
  }

  const initRectangleDrawing = (map: LeafletMap): void => {
    mapRef = map
    initMeasurePillOverlay(map)
  }

  onBeforeUnmount(() => {
    stopSizing()
    mapRef = undefined
  })

  return {
    shape,
    isSizingRectangle: computed(() => phase.value === 'sizing'),
    dimensions,
    setShape,
    consumeSurveyClick,
    applyDimensions,
    releaseLinesAngle,
    cancelSizing,
    initRectangleDrawing,
  }
}
