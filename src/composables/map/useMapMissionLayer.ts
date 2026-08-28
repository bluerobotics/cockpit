import L, { type LatLngTuple, type LayerGroup, type Map, type Polyline } from 'leaflet'
import { type ShallowRef, onBeforeUnmount, shallowRef, watch } from 'vue'

import { isLeafletMapReady } from '@/libs/map/utils-map'
import type { Waypoint } from '@/types/mission'

const missionPathColor = '#358AC3'

/**
 * Reactive inputs driving the mission layer. Getters so the composable can watch them.
 */
export interface UseMapMissionLayerOptions {
  /** Waypoints to connect, in order; typically the vehicle mission's navigation waypoints. */
  waypoints: () => Waypoint[]
  /** Whether the mission is currently drawn. */
  show: () => boolean
  /** Polyline color; defaults to the shared mission-path blue. */
  color?: string
  /** CSS class applied to the polyline (e.g. for a drop-shadow). */
  className?: string
  /** Draws a dot at each waypoint. Off by default; the interactive views render their own markers. */
  showWaypointDots?: boolean
  /** Handler for a double-click on the mission path (e.g. inserting a waypoint on the clicked segment). */
  onDblClick?: (event: L.LeafletMouseEvent) => void
  /** Called after every redraw, for surfaces that draw derived overlays on top of the path. */
  onRedraw?: () => void
}

/**
 * Handles exposed by the mission layer composable.
 */
export interface UseMapMissionLayerReturn {
  /** The mission polyline while it is on the map, for surfaces that restyle or measure it. */
  polyline: ShallowRef<Polyline | null>
}

/**
 * Draws a mission as a single connecting polyline on the given map, kept in sync with the source waypoints
 * and a show/hide toggle. The polyline is persistent and updated in place via `setLatLngs`, so it can carry a
 * double-click handler without being torn down on every waypoint change. Optionally renders a dot per waypoint
 * for display-only surfaces; the interactive views draw their own markers instead.
 * @param {ShallowRef<Map | undefined>} map - The Leaflet map to draw on; the layer (re)draws once available.
 * @param {UseMapMissionLayerOptions} options - Reactive getters for the waypoints and visibility, plus styling.
 * @returns {UseMapMissionLayerReturn} The mission polyline reference.
 */
export const useMapMissionLayer = (
  map: ShallowRef<Map | undefined>,
  options: UseMapMissionLayerOptions
): UseMapMissionLayerReturn => {
  const color = options.color ?? missionPathColor
  const polyline = shallowRef<Polyline | null>(null)
  const dots = shallowRef<LayerGroup>()

  const coordinates = (): LatLngTuple[] => options.waypoints().map((waypoint) => waypoint.coordinates as LatLngTuple)

  const clear = (): void => {
    if (map.value) {
      if (polyline.value) map.value.removeLayer(polyline.value)
      if (dots.value) map.value.removeLayer(dots.value)
    }
    polyline.value = null
    dots.value = undefined
  }

  const redraw = (): void => {
    if (!isLeafletMapReady(map.value)) return
    if (!options.show()) {
      clear()
      options.onRedraw?.()
      return
    }
    if (polyline.value === null) {
      polyline.value = L.polyline([], { color, ...(options.className ? { className: options.className } : {}) }).addTo(
        map.value
      )
      if (options.onDblClick) {
        polyline.value.on('dblclick', (event) => options.onDblClick?.(event))
      }
    }
    polyline.value.setLatLngs(coordinates())

    if (options.showWaypointDots) {
      if (dots.value === undefined) dots.value = L.layerGroup().addTo(map.value)
      const group = dots.value
      group.clearLayers()
      coordinates().forEach((coordinate) => {
        L.circleMarker(coordinate, { radius: 3, color: '#ffffff', weight: 1, fillColor: color, fillOpacity: 1 }).addTo(
          group
        )
      })
    }

    options.onRedraw?.()
  }

  watch([() => options.waypoints().map((waypoint) => waypoint.coordinates.slice()), () => options.show()], redraw, {
    deep: true,
  })
  watch(
    map,
    (instance) => {
      if (isLeafletMapReady(instance)) redraw()
    },
    { immediate: true }
  )

  onBeforeUnmount(clear)

  return { polyline }
}
