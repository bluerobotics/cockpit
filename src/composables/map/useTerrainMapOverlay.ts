import L, { type Map as LeafletMap } from 'leaflet'
import { type Ref, onBeforeUnmount, watch } from 'vue'

import type { TerrainTileBounds } from '@/libs/terrain/tiles'
import type { WaypointCoordinates } from '@/types/mission'

/**
 * A stretch of the mission drawn over the map.
 */
export interface TerrainMapStretch {
  /**
   * Positions along the stretch; one position draws a dot.
   */
  path: WaypointCoordinates[]
  /**
   * Line color.
   */
  color: string
  /**
   * Shown on hover.
   */
  message: string
}

/**
 * What the terrain overlay draws.
 */
export interface UseTerrainMapOverlayOptions {
  /**
   * Mission stretches to mark.
   */
  stretches: Ref<TerrainMapStretch[]>
  /**
   * Position the profile chart is hovering, null for none.
   */
  hover: Ref<WaypointCoordinates | null>
  /**
   * Vehicle position of the ghost run, null when not running.
   */
  ghost: Ref<WaypointCoordinates | null>
}

/**
 * Drawing on the planning map for the terrain tools.
 */
export interface UseTerrainMapOverlayReturn {
  /**
   * Fits the map to some positions.
   */
  focus: (positions: WaypointCoordinates[]) => void
  /**
   * Area the map shows, null before it is created.
   */
  visibleBounds: () => TerrainTileBounds | null
}

const TOOLTIP_PANE = 'terrainTooltipPane'
const ABOVE_PATH_TOOLTIP: L.TooltipOptions = { direction: 'top', offset: [0, -18], pane: TOOLTIP_PANE }

/**
 * Draws the terrain tools' results on a map, keeping Leaflet out of the components.
 * @param {Ref<LeafletMap | undefined>} map Map to draw on.
 * @param {UseTerrainMapOverlayOptions} options What to draw.
 * @returns {UseTerrainMapOverlayReturn} Focusing and the visible area.
 */
export const useTerrainMapOverlay = (
  map: Ref<LeafletMap | undefined>,
  { stretches, hover, ghost }: UseTerrainMapOverlayOptions
): UseTerrainMapOverlayReturn => {
  const stretchLayer = L.layerGroup()
  let hoverMarker: L.CircleMarker | undefined
  let ghostMarker: L.CircleMarker | undefined

  // The tooltip pane sits outside the map pane's stacking context, so the tooltips stay above overlays a view lays
  // over the whole map, like the planning view's add-waypoint knob; it follows the map pane to keep its coordinates.
  const followMapPane = (): void => {
    const pane = map.value?.getPane(TOOLTIP_PANE)
    const mapPane = map.value?.getPane('mapPane')
    if (pane && mapPane) L.DomUtil.setPosition(pane, L.DomUtil.getPosition(mapPane))
  }

  watch(
    map,
    (current, previous) => {
      previous?.off('move viewreset zoomend', followMapPane)
      if (current && !current.getPane(TOOLTIP_PANE)) {
        current.createPane(TOOLTIP_PANE, current.getContainer()).style.zIndex = '650'
      }
      current?.on('move viewreset zoomend', followMapPane)
      followMapPane()
      if (previous) stretchLayer.remove()
      if (current) stretchLayer.addTo(current)
    },
    { immediate: true }
  )

  watch(stretches, (current) => {
    stretchLayer.clearLayers()
    current.forEach(({ path, color, message }) => {
      const layer =
        path.length === 1
          ? L.circleMarker(path[0], { radius: 6, color, weight: 3, fill: false })
          : L.polyline(path, { color, weight: 7, opacity: 0.9 })
      layer.bindTooltip(message, {
        ...ABOVE_PATH_TOOLTIP,
        sticky: true,
        className: '!whitespace-normal w-max max-w-[280px]',
      })
      stretchLayer.addLayer(layer)
    })
  })

  watch(hover, (position) => {
    if (!position) {
      hoverMarker?.remove()
      hoverMarker = undefined
      return
    }
    hoverMarker ??= L.circleMarker(position, {
      radius: 6,
      color: '#FFFFFF',
      weight: 2,
      fillColor: '#3B78A8',
      fillOpacity: 1,
    })
    hoverMarker.setLatLng(position)
    if (map.value && !map.value.hasLayer(hoverMarker)) hoverMarker.addTo(map.value)
  })

  watch(ghost, (position) => {
    if (!position) {
      ghostMarker?.remove()
      ghostMarker = undefined
      return
    }
    ghostMarker ??= L.circleMarker(position, {
      radius: 8,
      color: '#FFFFFF',
      weight: 2,
      fillColor: '#FFB300',
      fillOpacity: 0.9,
    })
    ghostMarker.setLatLng(position)
    if (map.value && !map.value.hasLayer(ghostMarker)) ghostMarker.addTo(map.value)
  })

  const focus = (positions: WaypointCoordinates[]): void => {
    if (!map.value || positions.length === 0) return
    if (positions.length === 1) {
      map.value.panTo(positions[0])
      return
    }
    map.value.fitBounds(L.latLngBounds(positions), { padding: [60, 60], maxZoom: 17 })
  }

  const visibleBounds = (): TerrainTileBounds | null => {
    const bounds = map.value?.getBounds()
    if (!bounds) return null
    return { north: bounds.getNorth(), south: bounds.getSouth(), west: bounds.getWest(), east: bounds.getEast() }
  }

  onBeforeUnmount(() => {
    map.value?.off('move viewreset zoomend', followMapPane)
    stretchLayer.remove()
    hoverMarker?.remove()
    ghostMarker?.remove()
  })

  return { focus, visibleBounds }
}
