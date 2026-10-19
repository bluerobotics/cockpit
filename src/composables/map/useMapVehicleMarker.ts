import type { Map as MapLibreMap, Marker } from 'maplibre-gl'
import { type ShallowRef, onBeforeUnmount, shallowRef, watch } from 'vue'

import { type MarkerTooltip, bindTooltip, divIconMarker, toLngLat } from '@/libs/map/maplibre'
import type { WaypointCoordinates } from '@/types/mission'

const VEHICLE_ICON_SIZE_PX = 64

/**
 * Reactive inputs driving the vehicle marker. Getters so the composable can watch them.
 */
export interface UseMapVehicleMarkerOptions {
  /** The vehicle's current position, or undefined while it is unknown. */
  position: () => WaypointCoordinates | undefined
  /** Marker image representing the connected vehicle's type. */
  iconUrl: () => string
  /** Tooltip body, rebuilt whenever the telemetry behind it changes. */
  tooltipContent: () => string
  /** Vehicle heading in degrees, applied as the icon's rotation. */
  headingInDegrees: () => number
  /** Class name for the tooltip, so each map keeps its own styling. */
  tooltipClassName: string
  /** Stacking order of the marker among the map's other markers, which otherwise stack in creation order. */
  zIndex?: number
}

/**
 * Draws the vehicle on the given map and keeps its position, rotation and tooltip in sync, so the map
 * widget and the planning view share one copy of the marker logic instead of each keeping its own. The
 * marker appears as soon as both the map and a position exist, rather than on the next position change.
 * @param {ShallowRef<MapLibreMap | undefined>} map - The map to draw on; the marker appears once available.
 * @param {UseMapVehicleMarkerOptions} options - Reactive getters for the position, icon, tooltip and heading.
 * @returns {ShallowRef<Marker | undefined>} The marker, undefined until the map and a position exist.
 */
export const useMapVehicleMarker = (
  map: ShallowRef<MapLibreMap | undefined>,
  options: UseMapVehicleMarkerOptions
): ShallowRef<Marker | undefined> => {
  const marker = shallowRef<Marker>()
  let tooltip: MarkerTooltip | undefined

  const applyTooltipAndRotation = (content: string, headingInDegrees: number): void => {
    if (!marker.value) return

    tooltip?.setContent(content)

    const iconElement = marker.value.getElement().querySelector('img')
    if (iconElement) iconElement.style.transform = `rotate(${headingInDegrees}deg)`
  }

  const create = (position: WaypointCoordinates): void => {
    if (!map.value) return

    marker.value = divIconMarker({
      className: 'vehicle-marker',
      html: `<img src="${options.iconUrl()}" style="width: ${VEHICLE_ICON_SIZE_PX}px; height: ${VEHICLE_ICON_SIZE_PX}px;">`,
      size: [VEHICLE_ICON_SIZE_PX, VEHICLE_ICON_SIZE_PX],
      rotatesWithMap: true,
    })
    if (options.zIndex !== undefined) marker.value.getElement().style.zIndex = String(options.zIndex)
    marker.value.setLngLat(toLngLat(position)).addTo(map.value)
    tooltip = bindTooltip(map.value, marker.value, 'No data available', {
      className: options.tooltipClassName,
      offset: [40, 0],
    })
  }

  const remove = (): void => {
    tooltip?.remove()
    tooltip = undefined
    marker.value?.remove()
    marker.value = undefined
  }

  // Driven by the map as well as the position, and immediate, so a vehicle that is already connected and
  // holding station gets its marker on mount instead of waiting for its coordinates to change.
  watch(
    [() => options.position(), map],
    ([, instance], [, previousInstance]) => {
      // A marker belongs to the map it was added to, so a replaced map gets a new one.
      if (previousInstance && instance !== previousInstance) remove()

      const position = options.position()
      if (!map.value || !position) return

      if (marker.value === undefined) {
        create(position)
        // A station-keeping vehicle may never fire the telemetry watch below, which would leave the
        // placeholder tooltip in place for as long as it holds position.
        applyTooltipAndRotation(options.tooltipContent(), options.headingInDegrees())
      }

      marker.value?.setLngLat(toLngLat(position))
    },
    { immediate: true }
  )

  watch([() => options.tooltipContent(), () => options.headingInDegrees()], ([content, heading]) =>
    applyTooltipAndRotation(content, heading)
  )

  onBeforeUnmount(remove)

  return marker
}
