import type { Map as MapLibreMap, MapLayerMouseEvent } from 'maplibre-gl'
import { type ShallowRef, onBeforeUnmount, shallowRef, watch } from 'vue'

import {
  type DrawnLine,
  type LineStyle,
  beforeIdForSlot,
  lineFeature,
  removeLayersAndSource,
  setLineLayer,
  slottedLayerId,
  toLngLat,
  upsertGeoJsonSource,
} from '@/libs/map/maplibre'
import { isMapReady } from '@/libs/map/utils-map'
import type { Waypoint, WaypointCoordinates } from '@/types/mission'

const missionPathColor = '#358AC3'
const missionLayerId = slottedLayerId('mission', 'path')
const missionShadowLayerId = slottedLayerId('mission', 'path-shadow')
const missionDotsLayerId = slottedLayerId('mission', 'waypoint-dots')

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
  onDblClick?: (event: MapLayerMouseEvent) => void
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
 * @param {ShallowRef<MapLibreMap | undefined>} map - The map to draw on; the layer (re)draws once available.
 * @param {UseMapMissionLayerOptions} options - Reactive getters for the waypoints and visibility, plus styling.
 * @returns {UseMapMissionLayerReturn} The mission line reference.
 */
export const useMapMissionLayer = (
  map: ShallowRef<MapLibreMap | undefined>,
  options: UseMapMissionLayerOptions
): UseMapMissionLayerReturn => {
  const style: LineStyle = { color: options.color ?? missionPathColor }
  const polyline = shallowRef<DrawnLine | null>(null)
  let boundMap: MapLibreMap | undefined

  const coordinates = (): WaypointCoordinates[] => options.waypoints().map((waypoint) => waypoint.coordinates)

  const onDblClick = (event: MapLayerMouseEvent): void => {
    // Keeps the double-click from also zooming the map.
    event.preventDefault()
    options.onDblClick?.(event)
  }

  const clear = (): void => {
    if (boundMap && options.onDblClick) boundMap.off('dblclick', missionLayerId, onDblClick)
    removeLayersAndSource(boundMap, [missionDotsLayerId], missionDotsLayerId)
    removeLayersAndSource(boundMap, [missionShadowLayerId], missionShadowLayerId)
    removeLayersAndSource(boundMap, [missionLayerId], missionLayerId)
    boundMap = undefined
    polyline.value = null
  }

  const redraw = (): void => {
    if (!isMapReady(map.value)) return
    if (!options.show()) {
      clear()
      options.onRedraw?.()
      return
    }
    const line = lineFeature(coordinates())
    if (options.shadow) {
      setLineLayer(map.value, missionShadowLayerId, 'mission', line, {
        color: '#000000',
        opacity: 0.2,
        blur: 1,
        translate: [2, 3],
      })
    }
    setLineLayer(map.value, missionLayerId, 'mission', line, style)
    if (boundMap !== map.value) {
      boundMap = map.value
      if (options.onDblClick) boundMap.on('dblclick', missionLayerId, onDblClick)
    }
    polyline.value = { layerId: missionLayerId, coordinates, style }

    if (options.showWaypointDots) {
      upsertGeoJsonSource(map.value, missionDotsLayerId, {
        type: 'FeatureCollection',
        features: coordinates().map((coordinate) => ({
          type: 'Feature',
          properties: {},
          geometry: { type: 'Point', coordinates: toLngLat(coordinate) },
        })),
      })
      if (!map.value.getLayer(missionDotsLayerId)) {
        map.value.addLayer(
          {
            id: missionDotsLayerId,
            type: 'circle',
            source: missionDotsLayerId,
            paint: {
              // Leaflet's radius 3 dot had its 1px stroke centered on the edge, so it reached 3.5px.
              'circle-radius': 2.5,
              'circle-color': style.color,
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 1,
            },
          },
          beforeIdForSlot(map.value, 'mission')
        )
      }
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
