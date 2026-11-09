import L, { type Map as LeafletMap } from 'leaflet'
import { t } from 'ttag'
import { type Ref, onBeforeUnmount, watch } from 'vue'

import { terrainAttribution } from '@/libs/terrain/elevation-service'
import type { TerrainTileBounds } from '@/libs/terrain/tiles'
import type { WaypointCoordinates } from '@/types/mission'
import type { TerrainObserver } from '@/types/terrain'

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
  /**
   * Dashed, for stretches about the link or the sight rather than the terrain itself.
   */
  dashed?: boolean
  /**
   * Drawn thicker, for the stretches the operator is pointing at elsewhere.
   */
  highlighted?: boolean
}

/**
 * An image laid over a box of the map.
 */
export interface TerrainMapImage {
  /**
   * Box covered.
   */
  bounds: TerrainTileBounds
  /**
   * Image address, usually a data URL.
   */
  url: string
}

/**
 * A point drawn as a dot, such as a measured terrain cell.
 */
export interface TerrainMapDot {
  /**
   * Cell center.
   */
  coordinates: WaypointCoordinates
  /**
   * Dot color.
   */
  color: string
  /**
   * Tooltip text.
   */
  label: string
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
   * Visibility surface image, null for none.
   */
  image: Ref<TerrainMapImage | null>
  /**
   * Visual observers.
   */
  observers: Ref<TerrainObserver[]>
  /**
   * Vehicle position of the ghost run, null when not running.
   */
  ghost: Ref<WaypointCoordinates | null>
  /**
   * Measured terrain cells to show.
   */
  measured: Ref<TerrainMapDot[]>
  /**
   * Waypoints an upload adds to the mission.
   */
  uploadWaypoints: Ref<TerrainMapDot[]>
}

/**
 * Drawing and picking on the planning map for the terrain tools.
 */
export interface UseTerrainMapOverlayReturn {
  /**
   * Waits for the operator to click a point on the map; resolves null on Escape or when asked again.
   */
  pickPoint: () => Promise<WaypointCoordinates | null>
  /**
   * Fits the map to some positions.
   */
  focus: (positions: WaypointCoordinates[]) => void
  /**
   * Area the map shows, null before it is created.
   */
  visibleBounds: () => TerrainTileBounds | null
}

const IMAGE_OPACITY = 0.85
const TOOLTIP_PANE = 'terrainTooltipPane'
const ABOVE_PATH_TOOLTIP: L.TooltipOptions = { direction: 'top', offset: [0, -18], pane: TOOLTIP_PANE }

/**
 * Draws the terrain tools' results on a map, keeping Leaflet out of the components.
 * @param {Ref<LeafletMap | undefined>} map Map to draw on.
 * @param {UseTerrainMapOverlayOptions} options What to draw.
 * @returns {UseTerrainMapOverlayReturn} Point picking, focusing and the visible area.
 */
export const useTerrainMapOverlay = (
  map: Ref<LeafletMap | undefined>,
  { stretches, hover, image, observers, ghost, measured, uploadWaypoints }: UseTerrainMapOverlayOptions
): UseTerrainMapOverlayReturn => {
  const stretchLayer = L.layerGroup()
  const markerLayer = L.layerGroup()
  const measuredLayer = L.layerGroup()
  const uploadLayer = L.layerGroup()
  // The measured dots are only 3 px across, so hovering counts a few pixels around each one.
  const renderer = L.canvas({ padding: 0.2, tolerance: 4 })
  let imageLayer: L.ImageOverlay | undefined
  let hoverMarker: L.CircleMarker | undefined
  let ghostMarker: L.CircleMarker | undefined
  let cancelPick: (() => void) | undefined

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
      ;[stretchLayer, markerLayer, measuredLayer, uploadLayer].forEach((layer) => {
        if (previous) layer.remove()
        if (current) layer.addTo(current)
      })
      imageLayer?.remove()
      if (current && imageLayer) imageLayer.addTo(current)
    },
    { immediate: true }
  )

  watch(stretches, (current) => {
    stretchLayer.clearLayers()
    current.forEach(({ path, color, message, dashed, highlighted }) => {
      const weight = dashed && !highlighted ? 4 : 7
      const layer =
        path.length === 1
          ? L.circleMarker(path[0], { radius: 6, color, weight: 3, fill: false, attribution: terrainAttribution() })
          : L.polyline(path, {
              color,
              weight,
              opacity: highlighted ? 1 : 0.9,
              dashArray: dashed ? '6 6' : undefined,
              attribution: terrainAttribution(),
            })
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

  watch(image, (current) => {
    imageLayer?.remove()
    imageLayer = undefined
    if (!current) return
    const { south, west, north, east } = current.bounds
    imageLayer = L.imageOverlay(
      current.url,
      [
        [south, west],
        [north, east],
      ],
      { opacity: IMAGE_OPACITY, interactive: false, attribution: terrainAttribution() }
    )
    if (map.value) imageLayer.addTo(map.value)
  })

  watch(
    observers,
    (current) => {
      markerLayer.clearLayers()
      current.forEach(({ position, heightAboveGroundM }, index) => {
        const marker = L.circleMarker(position, {
          radius: 7,
          color: '#FFFFFF',
          weight: 2,
          fillColor: '#43A047',
          fillOpacity: 1,
        })
        const observerNumber = index + 1
        marker.bindTooltip(t`Observer ${observerNumber}, eyes ${heightAboveGroundM} m above the ground`)
        markerLayer.addLayer(marker)
      })
    },
    { deep: true, immediate: true }
  )

  watch(measured, (current) => {
    measuredLayer.clearLayers()
    current.forEach(({ coordinates, color, label }) => {
      measuredLayer.addLayer(
        L.circleMarker(coordinates, {
          renderer,
          radius: 3,
          stroke: false,
          fillColor: color,
          fillOpacity: 0.9,
        }).bindTooltip(label, ABOVE_PATH_TOOLTIP)
      )
    })
  })

  watch(uploadWaypoints, (current) => {
    uploadLayer.clearLayers()
    current.forEach(({ coordinates, color, label }) => {
      uploadLayer.addLayer(
        L.circleMarker(coordinates, {
          radius: 4,
          color,
          weight: 2,
          fillColor: '#0B1A24',
          fillOpacity: 1,
          attribution: terrainAttribution(),
        }).bindTooltip(label, ABOVE_PATH_TOOLTIP)
      )
    })
  })

  const pickPoint = (): Promise<WaypointCoordinates | null> => {
    cancelPick?.()
    const instance = map.value
    if (!instance) return Promise.resolve(null)
    return new Promise((resolve) => {
      const container = instance.getContainer()
      const previousCursor = container.style.cursor
      container.style.cursor = 'crosshair'
      const finish = (point: WaypointCoordinates | null): void => {
        container.removeEventListener('click', onClick, { capture: true })
        window.removeEventListener('keydown', onKey)
        container.style.cursor = previousCursor
        cancelPick = undefined
        resolve(point)
      }
      // Taken in the capture phase so the map's own click handlers, which add waypoints, never see it.
      const onClick = (event: MouseEvent): void => {
        event.stopPropagation()
        const { lat, lng } = instance.mouseEventToLatLng(event)
        finish([lat, lng])
      }
      const onKey = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') finish(null)
      }
      container.addEventListener('click', onClick, { capture: true })
      window.addEventListener('keydown', onKey)
      cancelPick = () => finish(null)
    })
  }

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
    cancelPick?.()
    map.value?.off('move viewreset zoomend', followMapPane)
    ;[stretchLayer, markerLayer, measuredLayer, uploadLayer].forEach((layer) => layer.remove())
    imageLayer?.remove()
    hoverMarker?.remove()
    ghostMarker?.remove()
  })

  return { pickPoint, focus, visibleBounds }
}
