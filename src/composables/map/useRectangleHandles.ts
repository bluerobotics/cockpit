import L, { type Map as LeafletMap } from 'leaflet'
import { type Ref, onBeforeUnmount, ref, watch } from 'vue'

import { rectangleRotatedAbout, rectangleTranslatedBy } from '@/libs/map/survey-rectangle'
import type { WaypointCoordinates } from '@/types/mission'

/** The rectangle the handles stand on. */
export interface RectangleHandlesTarget {
  /** Its corners, in ring order. */
  corners: WaypointCoordinates[]
  /** Which end of the drawn edge the rectangle turns about, the other end being the corner that turns it. */
  axisIndex: 0 | 1
}

/** Wiring {@link useRectangleHandles} needs from the view that owns the rectangle. */
export interface UseRectangleHandlesOptions {
  /** The rectangle to put handles on, or null while there is none to offer them for. */
  target: Ref<RectangleHandlesTarget | null>
  /** Called once per drag, before the first move, so the rectangle can be snapshotted for undo. */
  onDragStart: () => void
  /** Called on every move, with the rectangle's corners as the handle has left them. */
  apply: (corners: WaypointCoordinates[]) => void
  /** Called when the handle is released, saying whether the rectangle ended up moving. */
  onDragEnd: (moved: boolean) => void
}

/** Return type of {@link useRectangleHandles}. */
export interface UseRectangleHandlesReturn {
  /** Whether a handle is being dragged, so work the rectangle at rest owns can stand down until it is released. */
  isDraggingHandle: Ref<boolean>
  /** Binds the handles to a Leaflet map. */
  initRectangleHandles: (map: LeafletMap) => void
  /** Takes the handles off the map. */
  destroyRectangleHandles: () => void
}

// Above the vertex markers, since the two corners of the drawn edge carry a handle each and it is the handle,
// rather than the vertex under it, that a press there is meant for.
const handleZIndexOffset = 1000

// The handles are grabbed rather than aimed at, and the dot they draw is far smaller than a fingertip, so the
// area that takes the press is made a good deal wider than the mark it carries.
const handleSize = 36
const handleCenter = handleSize / 2

const handleIcon = (color: string, title: string): L.DivIcon =>
  L.divIcon({
    html: `
      <div class="survey-vertex-icon" title="${title}">
        <svg width="${handleSize}" height="${handleSize}" viewBox="0 0 ${handleSize} ${handleSize}"
             fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="${handleCenter}" cy="${handleCenter}" r="5" fill="${color}" stroke="white" stroke-width="2"/>
        </svg>
      </div>
    `,
    className: 'custom-div-icon',
    iconSize: [handleSize, handleSize],
    iconAnchor: [handleCenter, handleCenter],
  })

/**
 * Puts the two corners of a rectangle's drawn edge to work: the one the edge was started from carries the whole
 * rectangle when dragged, and the one across it turns the rectangle about that first corner. Together they place
 * and aim an area whose extents have already been settled by drawing or typing them.
 * @param {UseRectangleHandlesOptions} options - The rectangle to handle and the callbacks to report moves through.
 * @returns {UseRectangleHandlesReturn} The drag state plus the methods to bind and unbind the map.
 */
export const useRectangleHandles = (options: UseRectangleHandlesOptions): UseRectangleHandlesReturn => {
  const { target, onDragStart, apply, onDragEnd } = options

  const isDraggingHandle = ref(false)

  let mapRef: LeafletMap | undefined
  let axisHandle: L.Marker | null = null
  let turnHandle: L.Marker | null = null
  // The rectangle as it was when the handle was taken hold of, so every move of the same drag is measured from
  // there rather than compounding the last one.
  let held: RectangleHandlesTarget | null = null

  const asCoordinates = (latLng: L.LatLng): WaypointCoordinates => [latLng.lat, latLng.lng]

  const axisCorner = (rectangle: RectangleHandlesTarget): WaypointCoordinates => rectangle.corners[rectangle.axisIndex]

  const turnCorner = (rectangle: RectangleHandlesTarget): WaypointCoordinates =>
    rectangle.corners[1 - rectangle.axisIndex]

  const startDrag = (action: string): void => {
    const rectangle = target.value
    if (!rectangle) return

    held = { corners: [...rectangle.corners], axisIndex: rectangle.axisIndex }
    isDraggingHandle.value = true
    logUserAction(action)
    onDragStart()
  }

  const endDrag = (): void => {
    const moved = held !== null
    held = null
    isDraggingHandle.value = false
    place()
    onDragEnd(moved)
  }

  const onAxisDrag = (): void => {
    if (!held || !axisHandle) return
    apply(rectangleTranslatedBy(held.corners, axisCorner(held), asCoordinates(axisHandle.getLatLng())))
  }

  const onTurnDrag = (): void => {
    if (!held || !turnHandle) return

    const turnedTo = asCoordinates(turnHandle.getLatLng())
    apply(rectangleRotatedAbout(held.corners, axisCorner(held), turnCorner(held), turnedTo))
  }

  const ensureHandles = (map: LeafletMap): void => {
    if (axisHandle && turnHandle) return

    axisHandle = L.marker([0, 0], {
      icon: handleIcon('#3B82F6', 'Drag to move the survey rectangle'),
      draggable: true,
      zIndexOffset: handleZIndexOffset,
    })
      .on('dragstart', () => startDrag('Moved the survey rectangle by its corner'))
      .on('drag', onAxisDrag)
      .on('dragend', endDrag)
      .addTo(map)

    turnHandle = L.marker([0, 0], {
      icon: handleIcon('#F97316', 'Drag to turn the survey rectangle'),
      draggable: true,
      zIndexOffset: handleZIndexOffset,
    })
      .on('dragstart', () => startDrag('Turned the survey rectangle about its corner'))
      .on('drag', onTurnDrag)
      .on('dragend', endDrag)
      .addTo(map)
  }

  // A handle taken off the map cannot be holding the rectangle any more, which is what a drag interrupted by the
  // draft being cleared would otherwise leave it believing.
  const removeHandles = (): void => {
    axisHandle?.remove()
    turnHandle?.remove()
    axisHandle = null
    turnHandle = null
    held = null
    isDraggingHandle.value = false
  }

  const place = (): void => {
    const rectangle = target.value
    if (!mapRef || !rectangle) {
      removeHandles()
      return
    }

    ensureHandles(mapRef)
    axisHandle?.setLatLng(axisCorner(rectangle))
    turnHandle?.setLatLng(turnCorner(rectangle))
  }

  const initRectangleHandles = (map: LeafletMap): void => {
    mapRef = map
    place()
  }

  const destroyRectangleHandles = (): void => {
    removeHandles()
    mapRef = undefined
  }

  watch(target, place)

  onBeforeUnmount(destroyRectangleHandles)

  return { isDraggingHandle, initRectangleHandles, destroyRectangleHandles }
}
