import { watchThrottled } from '@vueuse/core'
import L, { type Map as LeafletMap } from 'leaflet'
import { t } from 'ttag'
import { type ComputedRef, type Ref, type ShallowRef, computed, onBeforeUnmount, watch } from 'vue'

import { useBaseStation } from '@/composables/baseStation/useBaseStation'
import { useDataLakeVariable } from '@/composables/useDataLakeVariable'
import { useResolvedDataLakeTemplate } from '@/composables/useResolvedDataLakeTemplate'
import { relativeAltitudeVariableId } from '@/libs/data-sources/altitude'
import { type TetherReach, TETHER_WARNING_RATIO, tetherReach } from '@/libs/map/measure'
import {
  type MeasureColorScheme,
  ensureMeasurePane,
  MEASURE_SCHEME_COLORS,
  measureLine,
  measurePill,
  midpoint,
} from '@/libs/map/measure-layers'
import { convertValueTo, formatDistance } from '@/libs/units'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { BaseStationCommsType } from '@/types/baseStation'
import { type Waypoint, type WaypointCoordinates, AltitudeReferenceType } from '@/types/mission'

/** What {@link useMapTetherReach} checks against the tether. */
export interface UseMapTetherReachOptions {
  /** Whether the readout is shown. */
  enabled: () => boolean
  /** Where the vehicle is, when known. */
  vehiclePosition: () => WaypointCoordinates | undefined
  /** Waypoints this map draws. */
  waypoints: () => Waypoint[]
  /** Hull color the tether is drawn in while within reach. */
  colorScheme: () => MeasureColorScheme
}

/** Return type of {@link useMapTetherReach}. */
export interface UseMapTetherReachReturn {
  /** Whether a tethered base station is placed, which is what the readout measures from. */
  available: ComputedRef<boolean>
}

const reachColor = (reach: TetherReach): string => (reach.ratio > 1 ? '#ef4444' : '#f59e0b')

// ponytail: the base station is taken to sit at home level, so a waypoint's depth is its home or sea-level altitude,
// and a terrain-relative one counts as flat; sample the terrain under it if tethered terrain-following missions appear.
const waypointDepthM = (waypoint: Waypoint): number =>
  waypoint.altitudeReferenceType === AltitudeReferenceType.RELATIVE_TO_TERRAIN ? 0 : Math.abs(waypoint.altitude)

/**
 * Measures the tether from the base station: the live slant range to the vehicle, counting its depth, against the
 * tether length, and the planned waypoints the tether cannot reach.
 * @param {ShallowRef<LeafletMap | undefined>} map The map to draw on.
 * @param {Ref<boolean>} mapReady Whether the map is ready.
 * @param {UseMapTetherReachOptions} options What to check.
 * @returns {UseMapTetherReachReturn} Whether there is a tether to measure.
 */
export const useMapTetherReach = (
  map: ShallowRef<LeafletMap | undefined>,
  mapReady: Ref<boolean>,
  options: UseMapTetherReachOptions
): UseMapTetherReachReturn => {
  const interfaceStore = useAppInterfaceStore()
  const baseStation = useBaseStation()

  const relativeAltitudeId = useResolvedDataLakeTemplate(() => relativeAltitudeVariableId)
  const { value: rawRelativeAltitude, unit: rawRelativeAltitudeUnit } = useDataLakeVariable(relativeAltitudeId)
  const vehicleDepthM = (): number =>
    relativeAltitudeId.value === undefined || typeof rawRelativeAltitude.value !== 'number'
      ? 0
      : Math.abs(convertValueTo(rawRelativeAltitude.value, rawRelativeAltitudeUnit.value, 'm'))

  const available = computed(
    () => baseStation.config.commsType === BaseStationCommsType.Tethered && baseStation.activePosition !== undefined
  )

  let boundMap: LeafletMap | undefined
  let layers: L.LayerGroup | undefined

  const renderVehicle = (group: L.LayerGroup, base: WaypointCoordinates, lengthM: number): void => {
    const vehicle = options.vehiclePosition()
    if (!vehicle) return
    const reach = tetherReach(base, vehicle, vehicleDepthM(), lengthM)
    const preferences = interfaceStore.displayUnitPreferences
    const slant = formatDistance(reach.slantM, preferences)
    const length = formatDistance(lengthM, preferences)
    const percent = Math.round(reach.ratio * 100)
    const color = reach.ratio < TETHER_WARNING_RATIO ? MEASURE_SCHEME_COLORS[options.colorScheme()] : reachColor(reach)
    group.addLayer(measureLine([base, vehicle], { color, weight: 3, interactive: false }))
    group.addLayer(
      measurePill(midpoint(base, vehicle), [t`Tether ${slant} of ${length} (${percent}%)`], 'measure-angle-pill')
    )
  }

  const renderWaypoints = (group: L.LayerGroup, base: WaypointCoordinates, lengthM: number): void => {
    const reaches = options
      .waypoints()
      .map((waypoint) => tetherReach(base, waypoint.coordinates, waypointDepthM(waypoint), lengthM))
    reaches.forEach((reach, index) => {
      if (reach.ratio < TETHER_WARNING_RATIO) return
      const color = reachColor(reach)
      const coordinates = options.waypoints()[index].coordinates
      group.addLayer(L.circleMarker(coordinates, { radius: 16, color, weight: 3, fill: false, interactive: false }))
    })
    const farthest = reaches.reduce(
      (best, reach, index) => (best < 0 || reach.slantM > reaches[best].slantM ? index : best),
      -1
    )
    if (farthest < 0) return
    const preferences = interfaceStore.displayUnitPreferences
    const slant = formatDistance(reaches[farthest].slantM, preferences)
    const length = formatDistance(lengthM, preferences)
    group.addLayer(
      measurePill(
        options.waypoints()[farthest].coordinates,
        [t`Farthest point ${slant} of ${length} tether`],
        'live-measure-pill'
      )
    )
  }

  const render = (): void => {
    layers?.clearLayers()
    const base = baseStation.activePosition
    if (!layers || !base || !available.value || !options.enabled()) return
    const lengthM = baseStation.config.tetherLengthMeters
    renderWaypoints(layers, base, lengthM)
    renderVehicle(layers, base, lengthM)
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
      available,
      options.vehiclePosition,
      () =>
        options.enabled()
          ? options
              .waypoints()
              .map((w) => `${w.coordinates},${w.altitude}`)
              .join('|')
          : '',
      rawRelativeAltitude,
      () => baseStation.activePosition,
      () => baseStation.config.tetherLengthMeters,
      () => interfaceStore.displayUnitPreferences,
      options.colorScheme,
    ],
    render,
    { throttle: 500 }
  )

  onBeforeUnmount(unbind)

  return { available }
}
