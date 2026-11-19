import { watchThrottled } from '@vueuse/core'
import L, { type Map as LeafletMap } from 'leaflet'
import { t } from 'ttag'
import { type Ref, type ShallowRef, onBeforeUnmount, watch } from 'vue'

import { bearingBetween, calculateHaversineDistance, formatBearing } from '@/libs/mission/general-estimates'
import { formatDistance } from '@/libs/units'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMissionStore } from '@/stores/mission'
import type { WaypointCoordinates } from '@/types/mission'

import {
  type MeasureColorScheme,
  ensureMeasurePane,
  MEASURE_SCHEME_COLORS,
  measureLine,
  measurePill,
  midpoint,
} from './useMapMeasure'

/** What {@link useMapVehicleRange} reads the vehicle and home from. */
export interface UseMapVehicleRangeOptions {
  /** Whether the readout is shown. */
  enabled: () => boolean
  /** Where the vehicle is, when known. */
  vehiclePosition: () => WaypointCoordinates | undefined
  /** Where home is, when known. */
  home: () => WaypointCoordinates | undefined
  /** Hull color the lines are drawn in. */
  colorScheme: () => MeasureColorScheme
}

type RangeTarget = {
  /** Where it is. */
  coordinates: WaypointCoordinates
  /** Name read back on its line. */
  label: string
}

/**
 * Draws the range and bearing from the vehicle to home and to the waypoint it is heading for, so the operator knows
 * where to steer.
 * @param {ShallowRef<LeafletMap | undefined>} map The map to draw on.
 * @param {Ref<boolean>} mapReady Whether the map is ready.
 * @param {UseMapVehicleRangeOptions} options Where the vehicle and home are.
 */
export const useMapVehicleRange = (
  map: ShallowRef<LeafletMap | undefined>,
  mapReady: Ref<boolean>,
  options: UseMapVehicleRangeOptions
): void => {
  const interfaceStore = useAppInterfaceStore()
  const missionStore = useMissionStore()

  let boundMap: LeafletMap | undefined
  let layers: L.LayerGroup | undefined

  const targets = (): RangeTarget[] => {
    const list: RangeTarget[] = []
    const home = options.home()
    if (home) list.push({ coordinates: home, label: t`Home` })
    const index = missionStore.currentWpIndex
    const next = missionStore.vehicleMission[index]
    const number = index + 1
    if (next) list.push({ coordinates: next.coordinates, label: t`Waypoint ${number}` })
    return list
  }

  const render = (): void => {
    layers?.clearLayers()
    const vehicle = options.vehiclePosition()
    if (!layers || !vehicle || !options.enabled()) return
    targets().forEach(({ coordinates, label }) => {
      const distance = formatDistance(
        calculateHaversineDistance(vehicle, coordinates),
        interfaceStore.displayUnitPreferences
      )
      const bearing = formatBearing(bearingBetween(vehicle, coordinates))
      const style = {
        color: MEASURE_SCHEME_COLORS[options.colorScheme()],
        weight: 2,
        dashArray: '4 8',
        interactive: false,
      }
      layers!.addLayer(measureLine([vehicle, coordinates], style))
      layers!.addLayer(
        measurePill(midpoint(vehicle, coordinates), [label, `${distance} · ${bearing}`], 'measure-angle-pill')
      )
    })
  }

  const unbind = (): void => {
    layers?.remove()
    layers = undefined
    boundMap = undefined
  }

  watch(
    [map, mapReady],
    ([current, ready]) => {
      if (current === boundMap && ready) return
      unbind()
      if (!current || !ready) return
      boundMap = current
      ensureMeasurePane(current)
      layers = L.layerGroup().addTo(current)
      render()
    },
    { immediate: true }
  )
  watchThrottled(
    [
      options.enabled,
      options.vehiclePosition,
      options.home,
      () => missionStore.currentWpIndex,
      () => missionStore.vehicleMission,
      () => interfaceStore.displayUnitPreferences,
      options.colorScheme,
    ],
    render,
    { throttle: 500 }
  )

  onBeforeUnmount(unbind)
}
