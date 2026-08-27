import L, { type Map as LeafletMap } from 'leaflet'
import { type ComputedRef, type Ref, computed, onBeforeUnmount, ref, shallowRef } from 'vue'

import { isOverSurveyHandle } from '@/libs/map/survey-polygon-edges'
import {
  type SurveyRectangleSpec,
  rectangleCorners,
  rectangleFromBaselineAndCursor,
  rectangleLinesAngle,
  rectangleSpec,
} from '@/libs/map/survey-rectangle'
import { clampExtent } from '@/libs/map/typed-extent'
import { formatMetersShort } from '@/libs/mission/general-estimates'
import { isTouchDevice } from '@/libs/utils'
import type { WaypointCoordinates } from '@/types/mission'

import { type UseMeasureExtentInputReturn } from './useMeasureExtentInput'
import { useMeasurePillOverlay } from './useMeasurePillOverlay'
import { type RectangleHandlesTarget } from './useRectangleHandles'

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
  /** The on-map extent boxes, shared with the view so only one stage offers typing at a time. */
  extentInput: UseMeasureExtentInputReturn
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
  /** Corners of a rectangle being sized that has been taken hold of, whose edges resize it like a polygon's. */
  heldRectangleVertices: ComputedRef<L.LatLng[]>
  /** The rectangle to offer move and turn handles on, being the one under the cursor or the square draft. */
  rectangleHandles: ComputedRef<RectangleHandlesTarget | null>
  /** Extents of the draft polygon while it is a rectangle; null otherwise. */
  dimensions: ComputedRef<SurveyRectangleDimensions | null>
  /** Switches the draw shape. */
  setShape: (shape: SurveyDrawShape) => void
  /** Handles a map click, returning whether the rectangle tool consumed it. */
  consumeSurveyClick: (latlng: L.LatLng) => boolean
  /** Rebuilds the draft rectangle at the given extents, around the same baseline. */
  applyDimensions: (dimensions: SurveyRectangleDimensions) => void
  /** Takes the rectangle being sized as a handle or an edge has left it, which the cursor stops sweeping. */
  freezeSizingRectangle: (corners: WaypointCoordinates[]) => void
  /** Reports the draft rectangle moved bodily, returning the scan angle to follow, or null to leave it alone. */
  rectangleMovedTo: (corners: WaypointCoordinates[]) => number | null
  /** Hands the scan angle to the user, so it stops being derived from the longer axis. */
  releaseLinesAngle: () => void
  /** Abandons a rectangle being sized, returning whether there was one. */
  cancelSizing: () => boolean
  /** Binds the tool to a Leaflet map. */
  initRectangleDrawing: (map: LeafletMap) => void
}

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
  const { vertices, extentInput, onRectangleDrawn, onRectangleResized, onShapeChanged } = options

  const { initMeasurePillOverlay, renderMeasurePills, destroyMeasurePillOverlay } = useMeasurePillOverlay()

  const shape = ref<SurveyDrawShape>('free-form')
  const phase = ref<'idle' | 'baseline' | 'sizing'>('idle')
  const sizingSpec = ref<SurveyRectangleSpec | null>(null)
  const sizingAxisIndex = ref<0 | 1>(0)
  // Set once the rectangle has been taken hold of by a handle or an edge, from when on it is the shape itself
  // that is being placed rather than one still being swept out.
  const frozenSpec = shallowRef<SurveyRectangleSpec | null>(null)

  let mapRef: LeafletMap | undefined
  let baseline: RectangleBaseline | null = null
  let previewLayer: L.Polygon | null = null
  let lastCursor: WaypointCoordinates | null = null
  // A rectangle implies its own scan direction, so the derived angle keeps following the longer axis until the
  // user dials in one of their own. Held as the corners it was derived from, so a polygon the user has reshaped
  // by hand no longer matches and takes the angle over as well.
  let derivedCorners: WaypointCoordinates[] | null = null

  const asCoordinates = (latLng: L.LatLng): WaypointCoordinates => [latLng.lat, latLng.lng]

  const isSameSpot = (a: WaypointCoordinates, b: WaypointCoordinates): boolean => a[0] === b[0] && a[1] === b[1]

  const areSameCorners = (a: WaypointCoordinates[], b: WaypointCoordinates[]): boolean =>
    a.length === b.length && a.every(([lat, lng], index) => b[index][0] === lat && b[index][1] === lng)

  // A rectangle read back from its own corners, walking the drawn edge from whichever end leaves the area on its
  // right, so one grown to the left of that edge is described exactly like one grown to the right instead of
  // being turned inside out the next time its corners are built from the description.
  const specFromCorners = (corners: WaypointCoordinates[]): SurveyRectangleSpec =>
    rectangleFromBaselineAndCursor(corners[0], corners[1], corners[2])

  const setVertices = (corners: WaypointCoordinates[]): void => {
    vertices.value = corners.map(([lat, lng]) => L.latLng(lat, lng))
  }

  const sweptSpec = (): SurveyRectangleSpec | null =>
    baseline && lastCursor ? rectangleFromBaselineAndCursor(baseline.start, baseline.end, lastCursor) : null

  // A pill on the drawn edge and one on the edge across it, so both extents are readable on the map itself
  // rather than only in the panel the user is not looking at while drawing.
  const renderExtents = (corners: L.LatLng[], extents: SurveyRectangleDimensions): void => {
    renderMeasurePills([
      { from: corners[0], to: corners[1], text: extents.length < 1 ? null : formatMetersShort(extents.length) },
      { from: corners[1], to: corners[2], text: extents.width < 1 ? null : formatMetersShort(extents.width) },
    ])
    extentInput.setExtentTarget('length', {
      label: 'survey length',
      from: corners[0],
      to: corners[1],
      liveValue: extents.length,
      refresh: onSizingViewChange,
      // The width is the extent still open, so a settled length hands the keyboard on to it.
      apply: () => extentInput.focusExtentInput('width'),
    })
    extentInput.setExtentTarget('width', {
      label: 'survey width',
      from: corners[1],
      to: corners[2],
      liveValue: extents.width,
      refresh: onSizingViewChange,
      apply: () => commitSizing(),
    })
  }

  const renderPreview = (cursor?: WaypointCoordinates): void => {
    if (cursor) lastCursor = cursor
    const drawn = frozenSpec.value ?? sweptSpec()
    if (!drawn || !mapRef) return

    // Whichever extent has been typed holds the size the cursor would otherwise sweep, leaving the cursor to
    // choose the side and the extent that has not.
    const spec = {
      ...drawn,
      length: extentInput.lockedExtent('length') ?? drawn.length,
      width: extentInput.lockedExtent('width') ?? drawn.width,
    }
    sizingSpec.value = spec
    // The rectangle is walked from whichever end of the drawn edge leaves it on the cursor's side, so the corner
    // it turns about has to be looked up rather than assumed to lead the ring.
    if (!frozenSpec.value && baseline) sizingAxisIndex.value = isSameSpot(spec.origin, baseline.start) ? 0 : 1
    const corners = rectangleCorners(spec).map(([lat, lng]) => L.latLng(lat, lng))
    if (previewLayer) {
      previewLayer.setLatLngs(corners)
    } else {
      previewLayer = L.polygon(corners, previewStyle).addTo(mapRef)
    }
    // Read as distances, since a negative extent says which side of the baseline to grow to rather than measuring
    // anything backwards.
    renderExtents(corners, { length: Math.abs(spec.length), width: Math.abs(spec.width) })
  }

  const onSizingMouseMove = (event: L.LeafletMouseEvent): void => {
    // A rectangle taken hold of is the user's to place, so the cursor is left with nothing to sweep and only the
    // click that fixes it still counts. A move on one of its handles belongs to that handle, and leaflet reports it
    // before the drag it starts, so sweeping it would collapse the rectangle onto the corner being grabbed.
    if (frozenSpec.value || isOverSurveyHandle(event.originalEvent.target)) return
    renderPreview(asCoordinates(event.latlng))
  }

  // The pills are placed in container pixels, so a pan or zoom has to redraw them against the new viewport.
  const onSizingViewChange = (): void => renderPreview()

  const freezeSizingRectangle = (corners: WaypointCoordinates[]): void => {
    const spec = specFromCorners(corners)
    if (spec.length === 0) return

    const axis = corners[sizingAxisIndex.value]
    frozenSpec.value = spec
    // Reading the corners back can walk the drawn edge the other way round, which puts the corner the rectangle
    // turns about at the other end of the ring.
    sizingAxisIndex.value = isSameSpot(spec.origin, axis) ? 0 : 1
    // These corners already carry whatever was typed, so the boxes go back to reading the extents out instead of
    // holding them, leaving the drag free to change them.
    if (extentInput.lockedExtent('length') !== null) extentInput.setExtentValue('length', null)
    if (extentInput.lockedExtent('width') !== null) extentInput.setExtentValue('width', null)
    renderPreview()
  }

  const stopSizing = (): void => {
    mapRef?.off('mousemove', onSizingMouseMove)
    mapRef?.off('moveend zoomend', onSizingViewChange)
    lastCursor = null
    previewLayer?.remove()
    previewLayer = null
    destroyMeasurePillOverlay()
    extentInput.setExtentTarget('length', null)
    extentInput.setExtentTarget('width', null)
    extentInput.closeExtentInputs()
    baseline = null
    frozenSpec.value = null
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

  // A rectangle sized back onto its baseline leaves no area to survey, so a commit of one keeps sizing instead of
  // fixing a degenerate polygon the survey generator would produce no lines for.
  const commitSizing = (): void => {
    const spec = sizingSpec.value
    if (!spec || spec.width === 0 || spec.length === 0) return

    const extents = `${Math.abs(spec.length).toFixed(1)} m by ${Math.abs(spec.width).toFixed(1)} m`
    logUserAction(`Drew a survey rectangle of ${extents}`)
    // Stored as the corners of a rectangle read back from itself, so an area grown to the left of the drawn edge
    // keeps reading its extents back the way it was drawn.
    const corners = rectangleCorners(specFromCorners(rectangleCorners(spec)))
    stopSizing()
    setVertices(corners)
    derivedCorners = corners
    onRectangleDrawn(rectangleLinesAngle(corners))
  }

  const consumeSurveyClick = (latlng: L.LatLng): boolean => {
    if (shape.value !== 'rectangle') return false

    if (phase.value === 'sizing') {
      commitSizing()
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
      // The width is the extent still to be chosen, so it is the one the keyboard lands on. A finger has no
      // keyboard to land on it, so there the box is left to be asked for by tapping the pill it belongs to.
      if (!isTouchDevice()) extentInput.openExtentInputs('width')
      renderPreview(asCoordinates(latlng))
      return true
    }

    // The baseline's first corner is an ordinary vertex, so the view places it and its live measure and undo
    // step come along with it.
    if (vertices.value.length === 0) phase.value = 'baseline'
    return false
  }

  const draftSpec = computed(() => {
    const corners = vertices.value.map(asCoordinates)
    return rectangleSpec(corners) === null ? null : specFromCorners(corners)
  })

  // Only the finished draft's extents, since the ones being swept by the cursor are typed on the map boxes next
  // to their pills rather than in the panel.
  const dimensions = computed<SurveyRectangleDimensions | null>(() => {
    const spec = draftSpec.value
    return spec ? { length: spec.length, width: spec.width } : null
  })

  // Empty until the rectangle stands still, since one still being swept has the cursor sitting on the very edge a
  // press would otherwise grab instead of fixing the area.
  const heldRectangleVertices = computed<L.LatLng[]>(() =>
    frozenSpec.value && sizingSpec.value
      ? rectangleCorners(sizingSpec.value).map(([lat, lng]) => L.latLng(lat, lng))
      : []
  )

  const rectangleHandles = computed<RectangleHandlesTarget | null>(() => {
    const sizing = sizingSpec.value
    if (sizing) return { corners: rectangleCorners(sizing), axisIndex: sizingAxisIndex.value }
    // A draft is handled by the corners it already has, whether it was drawn as a rectangle or typed into one.
    return draftSpec.value ? { corners: vertices.value.map(asCoordinates), axisIndex: 0 } : null
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

  const rectangleMovedTo = (corners: WaypointCoordinates[]): number | null => {
    const follows = !!derivedCorners && areSameCorners(derivedCorners, vertices.value.map(asCoordinates))
    if (!follows) return null

    // The same rectangle in a new place, so an angle that was following its longer axis keeps doing so.
    derivedCorners = corners
    return rectangleLinesAngle(corners)
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
    heldRectangleVertices,
    rectangleHandles,
    dimensions,
    setShape,
    consumeSurveyClick,
    applyDimensions,
    freezeSizingRectangle,
    rectangleMovedTo,
    releaseLinesAngle,
    cancelSizing,
    initRectangleDrawing,
  }
}
