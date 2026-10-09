import { type ShallowRef, onBeforeUnmount, shallowRef, watch } from 'vue'

import type { CockpitMap, MapPointerEvent } from '@/libs/map/cesium-map'
import { type DrawnLine, type LineStyle, lineFeature, pointFeature } from '@/libs/map/cesium-vectors'
import { isMapReady } from '@/libs/map/utils-map'
import type { Waypoint, WaypointCoordinates } from '@/types/mission'

const missionPathColor = '#358AC3'
const missionLayerId = 'mission::path'
const missionShadowLayerId = 'mission::path-shadow'
const missionDotsLayerId = 'mission::waypoint-dots'
// Leaflet's CSS drop shadow under the path: offset down-right, in pixels.
const shadowOffset = { x: 2, y: 3 }

/**
 * Reactive inputs driving the mission layer. Getters so the composable can watch them.
 */
export interface UseMapMissionLayerOptions {
  /** Waypoints to connect, in order; typically the vehicle mission's navigation waypoints. */
  waypoints: () => Waypoint[]
  /** Whether the mission is currently drawn. */
  show: () => boolean
  /** Line color; defaults to the shared mission-path blue. */
  color?: string
  /** Draws a soft drop shadow under the path. */
  shadow?: boolean
  /** Draws a dot at each waypoint. Off by default; the interactive views render their own markers. */
  showWaypointDots?: boolean
  /** Handler for a double-click on the mission path (e.g. inserting a waypoint on the clicked segment). */
  onDblClick?: (event: MapPointerEvent) => void
  /** Called after every redraw, for surfaces that draw derived overlays on top of the path. */
  onRedraw?: () => void
}

/**
 * Handles exposed by the mission layer composable.
 */
export interface UseMapMissionLayerReturn {
  /** The mission line while it is on the map, for surfaces that restyle or measure it. */
  polyline: ShallowRef<DrawnLine | null>
}

/**
 * Draws a mission as a single connecting line on the given map, kept in sync with the source waypoints and a
 * show/hide toggle. The line is persistent and updated in place, so it can carry a double-click handler without being
 * torn down on every waypoint change. Optionally renders a dot per waypoint for display-only surfaces; the
 * interactive views draw their own markers instead.
 * @param {ShallowRef<CockpitMap | undefined>} map - The map to draw on; the layer (re)draws once available.
 * @param {UseMapMissionLayerOptions} options - Reactive getters for the waypoints and visibility, plus styling.
 * @returns {UseMapMissionLayerReturn} The mission line reference.
 */
export const useMapMissionLayer = (
  map: ShallowRef<CockpitMap | undefined>,
  options: UseMapMissionLayerOptions
): UseMapMissionLayerReturn => {
  const style: LineStyle = { color: options.color ?? missionPathColor }
  const polyline = shallowRef<DrawnLine | null>(null)
  let boundMap: CockpitMap | undefined

  const coordinates = (): WaypointCoordinates[] => options.waypoints().map((waypoint) => waypoint.coordinates)

  const onDblClick = (event: MapPointerEvent): void => {
    // Keeps the double-click from also zooming the map.
    event.preventDefault()
    options.onDblClick?.(event)
  }

  const clear = (): void => {
    if (boundMap) {
      if (options.onDblClick) boundMap.offLayer('dblclick', missionLayerId, onDblClick)
      if (options.shadow) boundMap.off('zoomend', drawShadow)
      boundMap.removeVectors(missionDotsLayerId)
      boundMap.removeVectors(missionShadowLayerId)
      boundMap.removeVectors(missionLayerId)
    }
    boundMap = undefined
    polyline.value = null
  }

  // Cesium lines have no pixel offset, so the shadow is the path moved by the offset at the current zoom, redrawn
  // once a zoom settles.
  const drawShadow = (): void => {
    if (!boundMap || !options.show()) return
    const instance = boundMap
    const shifted = coordinates().map((coordinate) => {
      const point = instance.project(coordinate)
      return instance.unproject({ x: point.x + shadowOffset.x, y: point.y + shadowOffset.y })
    })
    instance.setVectors(missionShadowLayerId, 'mission', [
      lineFeature(shifted, { color: '#000000', opacity: 0.2, width: (style.width ?? 3) + 1 }),
    ])
  }

  const redraw = (): void => {
    if (!isMapReady(map.value)) return
    if (!options.show()) {
      clear()
      options.onRedraw?.()
      return
    }
    if (boundMap !== map.value) {
      clear()
      boundMap = map.value
      if (options.onDblClick) boundMap.onLayer('dblclick', missionLayerId, onDblClick)
      if (options.shadow) boundMap.on('zoomend', drawShadow)
    }
    // The shadow is created first, so the path, in the same slot, stacks above it.
    if (options.shadow) drawShadow()
    map.value.setVectors(missionLayerId, 'mission', [lineFeature(coordinates(), style)])
    polyline.value = { layerId: missionLayerId, coordinates, style }

    if (options.showWaypointDots) {
      // Leaflet's radius 3 dot had its 1px stroke centered on the edge, so it reached 3.5px.
      const dot = { radius: 2.5, fillColor: style.color, color: '#ffffff', weight: 1 }
      map.value.setVectors(
        missionDotsLayerId,
        'mission',
        coordinates().map((coordinate) => pointFeature(coordinate, dot))
      )
    }

    options.onRedraw?.()
  }

  watch([() => options.waypoints().map((waypoint) => waypoint.coordinates.slice()), () => options.show()], redraw, {
    deep: true,
  })
  watch(
    map,
    (instance) => {
      if (isMapReady(instance)) redraw()
    },
    { immediate: true }
  )

  onBeforeUnmount(clear)

  return { polyline }
}
