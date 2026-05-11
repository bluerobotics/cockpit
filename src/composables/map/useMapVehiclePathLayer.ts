import L, { type LatLngExpression, type LayerGroup, type Map, type Polyline } from 'leaflet'
import { type ShallowRef, onBeforeUnmount, watch } from 'vue'

import { isLeafletMapReady } from '@/libs/map/utils-map'
import type { WaypointCoordinates } from '@/types/mission'

const vehiclePathColor = '#ffff00'
const VEHICLE_PATH_PANE = 'vehiclePathPane'
// Bounds the points one trail update reconverts and reprojects, while keeping a 500k-point history to a few hundred
// layers.
export const VEHICLE_PATH_SEGMENT_SIZE = 2048

/**
 * Reactive inputs driving the vehicle-path layer. Getters so the composable can watch them.
 */
export interface UseMapVehiclePathLayerOptions {
  /**
   * Trail coordinates in order; typically the mission store's vehicle position history. Mutate it in place only by
   * appending and shifting off the oldest points, and replace the array for any other change.
   */
  path: () => WaypointCoordinates[]
  /** Revision counter bumped on every `path` mutation, so the layer redraws without deep-watching it. */
  revision: () => number
  /** Whether the trail is currently drawn. */
  show: () => boolean
}

/**
 * What {@link useMapVehiclePathLayer} hands back to its owner.
 */
export interface UseMapVehiclePathLayerReturn {
  /** Group holding the drawn trail segments, for hit-testing the trail from a map click. */
  layer: LayerGroup
}

/**
 * One bounded piece of the drawn trail.
 */
interface VehiclePathSegment {
  /** Leaflet line drawing this piece. */
  line: Polyline
  /** Coordinates the line is set to; the first one repeats the previous segment's last, so the trail has no gaps. */
  points: WaypointCoordinates[]
}

/**
 * Draws the vehicle's traveled path on the given map, split into bounded polylines on a dedicated Canvas renderer.
 * Each revision bump only touches the tail segment (new points) and the head segment (points evicted at the history
 * cap), so a long-running trail does not reconvert or reproject its whole length on every GPS update. Falls back to a
 * full rebuild on first draw or when the history array is replaced (clear/simplify), and removes the layers when
 * hidden, emptied or the owner unmounts.
 * @param {ShallowRef<Map | undefined>} map - The Leaflet map to draw on; the layer (re)draws once available.
 * @param {UseMapVehiclePathLayerOptions} options - Reactive getters for the path, its revision and visibility.
 * @returns {UseMapVehiclePathLayerReturn} The group holding the trail segments.
 */
export const useMapVehiclePathLayer = (
  map: ShallowRef<Map | undefined>,
  options: UseMapVehiclePathLayerOptions
): UseMapVehiclePathLayerReturn => {
  // A dedicated Canvas renderer keeps the growing trail off the SVG pane, which otherwise stutters as points accumulate.
  const renderer = L.canvas({ pane: VEHICLE_PATH_PANE })
  const group = L.layerGroup()
  let segments: VehiclePathSegment[] = []
  let drawnPath: WaypointCoordinates[] | undefined
  let drawnLength = 0
  let drawnTail: WaypointCoordinates | undefined

  const reset = (): void => {
    group.clearLayers()
    segments = []
    drawnPath = undefined
    drawnLength = 0
    drawnTail = undefined
  }

  const removeLine = (): void => {
    reset()
    group.remove()
  }

  const appendPoints = (points: WaypointCoordinates[], from: number): void => {
    let next = from
    const tail = segments[segments.length - 1]
    if (tail && tail.points.length < VEHICLE_PATH_SEGMENT_SIZE && next < points.length) {
      const room = VEHICLE_PATH_SEGMENT_SIZE - tail.points.length
      tail.points.push(...points.slice(next, next + room))
      tail.line.setLatLngs(tail.points as LatLngExpression[])
      next += room
    }
    while (next < points.length) {
      const previous = segments[segments.length - 1]?.points
      const joint = previous ? [previous[previous.length - 1]] : []
      const take = VEHICLE_PATH_SEGMENT_SIZE - joint.length
      const segmentPoints = [...joint, ...points.slice(next, next + take)]
      const line = L.polyline(segmentPoints as LatLngExpression[], { color: vehiclePathColor, renderer })
      segments.push({ line, points: segmentPoints })
      group.addLayer(line)
      next += take
    }
  }

  const evictHead = (count: number): void => {
    let remaining = count
    while (remaining > 0) {
      const head = segments[0]
      // A segment's last point is the next one's first, so only the last segment can lose it.
      if (remaining < head.points.length - 1 || segments.length === 1) {
        head.points = head.points.slice(remaining)
        head.line.setLatLngs(head.points as LatLngExpression[])
        return
      }
      remaining -= head.points.length - 1
      group.removeLayer(head.line)
      segments.shift()
    }
  }

  // The store appends new tuples and may shift the oldest ones off in place, so finding the last drawn tuple near
  // the end tells how many points were appended without scanning the whole history.
  const countAppendedPoints = (points: WaypointCoordinates[]): number | undefined => {
    if (points !== drawnPath || drawnTail === undefined) return undefined
    const oldest = Math.max(0, points.length - 1 - VEHICLE_PATH_SEGMENT_SIZE)
    for (let i = points.length - 1; i >= oldest; i--) {
      if (points[i] === drawnTail) return points.length - 1 - i
    }
    return undefined
  }

  const redraw = (): void => {
    if (!isLeafletMapReady(map.value)) return

    const points = options.path()
    if (!options.show() || points.length === 0) {
      removeLine()
      return
    }

    if (!map.value.hasLayer(group)) {
      // A canvas takes the pointer across its whole box, so the non-interactive trail sits in a pane that lets
      // hovers and clicks through to the map layers beneath it.
      if (!map.value.getPane(VEHICLE_PATH_PANE)) {
        const pane = map.value.createPane(VEHICLE_PATH_PANE)
        pane.style.zIndex = '400'
        pane.style.pointerEvents = 'none'
      }
      removeLine()
      group.addTo(map.value)
    }

    const appended = countAppendedPoints(points)
    const evicted = appended === undefined ? 0 : drawnLength + appended - points.length
    if (appended === undefined || evicted < 0 || evicted >= drawnLength) {
      reset()
      appendPoints(points, 0)
    } else {
      appendPoints(points, points.length - appended)
      evictHead(evicted)
    }
    drawnPath = points
    drawnLength = points.length
    drawnTail = points[points.length - 1]
  }

  watch([() => options.revision(), () => options.show()], redraw)
  watch(
    map,
    (instance) => {
      if (isLeafletMapReady(instance)) redraw()
    },
    { immediate: true }
  )

  onBeforeUnmount(removeLine)

  return { layer: group }
}
