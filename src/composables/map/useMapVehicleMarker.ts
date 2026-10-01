import L, { type LatLngTuple, type Map, type Marker, type MarkerOptions } from 'leaflet'
import { type ShallowRef, onBeforeUnmount, shallowRef, watch } from 'vue'

const VEHICLE_ICON_SIZE_PX = 64

/**
 * Reactive inputs driving the vehicle marker. Getters so the composable can watch them.
 */
export interface UseMapVehicleMarkerOptions {
  /** The vehicle's current position, or undefined while it is unknown. */
  position: () => LatLngTuple | undefined
  /** Marker image representing the connected vehicle's type. */
  iconUrl: () => string
  /** Tooltip body, rebuilt whenever the telemetry behind it changes. */
  tooltipContent: () => string
  /** Vehicle heading in degrees, applied as the icon's rotation. */
  headingInDegrees: () => number
  /** Leaflet class name for the tooltip, so each map keeps its own styling. */
  tooltipClassName: string
  /** Pane to draw the marker in; Leaflet's own marker pane when omitted. */
  paneName?: string
  /** CSS z-index given to `paneName`, applied only when the composable has to create that pane. */
  paneZIndex?: string
}

/**
 * Draws the vehicle on the given map and keeps its position, rotation and tooltip in sync, so the map
 * widget and the planning view share one copy of the marker logic instead of each keeping its own.
 * @param {ShallowRef<Map | undefined>} map - The Leaflet map to draw on.
 * @param {UseMapVehicleMarkerOptions} options - Reactive getters for the position, icon, tooltip and heading.
 * @returns {ShallowRef<Marker | undefined>} The marker, undefined until the map and a position exist.
 */
export const useMapVehicleMarker = (
  map: ShallowRef<Map | undefined>,
  options: UseMapVehicleMarkerOptions
): ShallowRef<Marker | undefined> => {
  const marker = shallowRef<Marker>()

  const applyTooltipAndRotation = (content: string, headingInDegrees: number): void => {
    if (!marker.value) return

    marker.value.getTooltip()?.setContent(content)

    const iconElement = marker.value.getElement()?.querySelector('img')
    if (iconElement) iconElement.style.transform = `rotate(${headingInDegrees}deg)`
  }

  const create = (position: LatLngTuple): void => {
    if (!map.value) return

    const markerOptions: MarkerOptions = {
      icon: L.divIcon({
        className: 'vehicle-marker',
        html: `<img src="${options.iconUrl()}" style="width: ${VEHICLE_ICON_SIZE_PX}px; height: ${VEHICLE_ICON_SIZE_PX}px;">`,
        iconSize: [VEHICLE_ICON_SIZE_PX, VEHICLE_ICON_SIZE_PX],
        iconAnchor: [VEHICLE_ICON_SIZE_PX / 2, VEHICLE_ICON_SIZE_PX / 2],
      }),
    }

    // Leaflet copies every own key of the options object, so a `pane: undefined` would replace its default
    // marker pane and leave the icon with nowhere to attach.
    if (options.paneName) {
      if (!map.value.getPane(options.paneName)) {
        const pane = map.value.createPane(options.paneName)
        if (options.paneZIndex) pane.style.zIndex = options.paneZIndex
      }
      markerOptions.pane = options.paneName
    }

    marker.value = L.marker(position, markerOptions)
    marker.value.bindTooltip(
      L.tooltip({ content: 'No data available', className: options.tooltipClassName, offset: [40, 0] })
    )
    map.value.addLayer(marker.value)
  }

  watch(
    () => options.position(),
    () => {
      const position = options.position()
      if (!map.value || !position) return

      if (marker.value === undefined) create(position)
      marker.value?.setLatLng(position)
    }
  )

  watch([() => options.tooltipContent(), () => options.headingInDegrees()], ([content, heading]) =>
    applyTooltipAndRotation(content, heading)
  )

  onBeforeUnmount(() => {
    if (marker.value && map.value) map.value.removeLayer(marker.value)
    marker.value = undefined
  })

  return marker
}
