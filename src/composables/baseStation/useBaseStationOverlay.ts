import './baseStationOverlay.css'

import * as turf from '@turf/turf'
import L from 'leaflet'
import { type Ref, type ShallowRef, onBeforeUnmount, shallowRef, watch } from 'vue'

import { useBaseStation } from '@/composables/baseStation/useBaseStation'
import {
  type BaseStationConfig,
  AntennaType,
  BaseStationCommsType,
  effectiveAntennaRangeMeters,
} from '@/types/baseStation'
import type { WaypointCoordinates } from '@/types/mission'

const SECTOR_ARC_STEPS = 64

// Concentric coverage rings with decreasing radius. Stacking them at the same per-layer opacity
// produces a smooth radial fade that mimics the pattern published in BR's directional antenna
// guide while keeping the brightest band where the signal is strongest.
const COVERAGE_GRADIENT_STEPS = 12
const COVERAGE_STEP_OPACITY = 0.045

const sectorPolygonLatLngs = (
  center: WaypointCoordinates,
  rangeMeters: number,
  bearingDeg: number,
  beamwidthDeg: number
): L.LatLngExpression[] => {
  const halfBeam = beamwidthDeg / 2
  const startBearing = bearingDeg - halfBeam
  const endBearing = bearingDeg + halfBeam
  const rangeKm = rangeMeters / 1000
  const turfCenter = turf.point([center[1], center[0]])

  const arc = turf.lineArc(turfCenter, rangeKm, startBearing, endBearing, { steps: SECTOR_ARC_STEPS })
  const arcPoints = arc.geometry.coordinates.map(([lng, lat]) => [lat, lng] as L.LatLngExpression)
  return [center as L.LatLngExpression, ...arcPoints, center as L.LatLngExpression]
}

const bearingHandlePosition = (
  center: WaypointCoordinates,
  rangeMeters: number,
  bearingDeg: number
): WaypointCoordinates => {
  const dest = turf.destination(turf.point([center[1], center[0]]), rangeMeters / 1000, bearingDeg, {
    units: 'kilometers',
  })
  const [lng, lat] = dest.geometry.coordinates
  return [lat, lng]
}

// 180° front-facing arc at the antenna's max range, used to preview where the signal will land
// as the operator rotates the antenna.
const aimingArcLatLngs = (
  center: WaypointCoordinates,
  rangeMeters: number,
  bearingDeg: number
): L.LatLngExpression[] => {
  const turfCenter = turf.point([center[1], center[0]])
  const arc = turf.lineArc(turfCenter, rangeMeters / 1000, bearingDeg - 90, bearingDeg + 90, {
    steps: SECTOR_ARC_STEPS,
  })
  return arc.geometry.coordinates.map(([lng, lat]) => [lat, lng] as L.LatLngExpression)
}

const bearingFromCenter = (center: WaypointCoordinates, point: WaypointCoordinates): number => {
  return turf.bearing(turf.point([center[1], center[0]]), turf.point([point[1], point[0]]))
}

/* eslint-disable jsdoc/require-jsdoc -- internal helper return shape, name is self-describing. */
type BaseStationOverlayApi = { openConfigPanel: () => void }
/* eslint-enable jsdoc/require-jsdoc */

const baseStationMarkerHtml = (label: string): string => `
  <div class="base-station-marker-container">
    <div class="base-station-marker-background"></div>
    <i class="v-icon notranslate mdi mdi-radio-tower" style="color: white; position: relative; z-index: 2; font-size: 16px;"></i>
    <div class="base-station-marker-label">${label}</div>
  </div>
`

/**
 * Renders the base-station marker, antenna coverage and tether circle on a Leaflet map and
 * keeps them in sync with the {@link useBaseStation} state. Mounting and unmounting are
 * handled automatically.
 * @param {ShallowRef<L.Map | undefined>} map Reactive reference to the Leaflet map instance.
 * @param {Ref<boolean>} mapReady Reactive flag that becomes true once the map is initialized.
 * @returns {BaseStationOverlayApi} Helpers to drive the overlay from the host view.
 */
export const useBaseStationOverlay = (
  map: ShallowRef<L.Map | undefined>,
  mapReady: Ref<boolean>
): BaseStationOverlayApi => {
  const store = useBaseStation()

  const marker = shallowRef<L.Marker | undefined>()
  const coverageLayer = shallowRef<L.LayerGroup | undefined>()
  const coverageSteps = shallowRef<(L.Circle | L.Polygon)[]>([])
  const coverageAntennaType = shallowRef<AntennaType | undefined>()
  const tetherLayer = shallowRef<L.Circle | undefined>()
  const bearingHandle = shallowRef<L.Marker | undefined>()
  const bearingLine = shallowRef<L.Polyline | undefined>()
  const aimingArc = shallowRef<L.Polyline | undefined>()

  const openConfigPanel = (): void => {
    store.configPanelOpen = true
  }

  const removeLayer = (layer: L.Layer | undefined): void => {
    if (layer && map.value) map.value.removeLayer(layer)
  }

  const buildMarkerIcon = (): L.DivIcon =>
    L.divIcon({
      className: 'base-station-marker-icon',
      html: baseStationMarkerHtml('Base'),
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    })

  const buildBearingHandleIcon = (): L.DivIcon =>
    L.divIcon({
      className: 'base-station-bearing-handle',
      html: '<div class="base-station-bearing-handle-dot"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    })

  const ensureMarker = (config: BaseStationConfig): void => {
    if (!map.value || !config.position) return
    if (marker.value) {
      marker.value.setLatLng(config.position)
      applyMarkerColor(config.coverageColor)
      return
    }
    const m = L.marker(config.position, {
      icon: buildMarkerIcon(),
      draggable: true,
      zIndexOffset: 600,
      // The marker owns its own right-click popup; don't propagate to the map context menu.
      bubblingMouseEvents: false,
    })
    m.on('drag', (event: L.LeafletEvent) => {
      const target = event.target as L.Marker
      const { lat, lng } = target.getLatLng()
      store.setPosition([lat, lng])
    })
    m.on('contextmenu', (event: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(event)
      event.originalEvent.stopPropagation()
      event.originalEvent.preventDefault()
      store.openContextPopup(event.originalEvent.clientX, event.originalEvent.clientY)
    })
    m.addTo(map.value)
    marker.value = m
    applyMarkerColor(config.coverageColor)
  }

  // Marker stays fully visible regardless of the opacity slider — only the coverage and
  // bearing/arc dotted lines fade with `coverageOpacity`. The trailing `cc` keeps the
  // marker's original 80% fill so the icon underneath stays legible against the map.
  const applyMarkerColor = (color: string): void => {
    const el = marker.value?.getElement()
    if (!el) return
    const bg = el.querySelector('.base-station-marker-background') as HTMLElement | null
    if (bg) bg.style.backgroundColor = `${color.slice(0, 7)}cc`
  }

  const updateCoverage = (config: BaseStationConfig): void => {
    if (!map.value || !store.showCoverage || !config.position || config.commsType !== BaseStationCommsType.RadioLink) {
      removeLayer(coverageLayer.value)
      coverageLayer.value = undefined
      coverageSteps.value = []
      coverageAntennaType.value = undefined
      return
    }

    const position = config.position
    const isOmni = config.antenna.type === AntennaType.Omni
    const rangeMeters = effectiveAntennaRangeMeters(config)
    const stepStyle = {
      color: config.coverageColor,
      weight: 0,
      fillColor: config.coverageColor,
      fillOpacity: COVERAGE_STEP_OPACITY * config.coverageOpacity,
      interactive: false,
    }
    const stepRadius = (step: number): number => (rangeMeters * step) / COVERAGE_GRADIENT_STEPS

    // Recreating every gradient layer on each config change thrashes Leaflet during a bearing
    // drag, so reuse the existing step layers in place and only rebuild when the shape changes.
    const canUpdateInPlace =
      coverageLayer.value !== undefined &&
      coverageAntennaType.value === config.antenna.type &&
      coverageSteps.value.length === COVERAGE_GRADIENT_STEPS

    if (canUpdateInPlace) {
      coverageSteps.value.forEach((layer, index) => {
        const radius = stepRadius(index + 1)
        if (isOmni) {
          const circle = layer as L.Circle
          circle.setLatLng(position)
          circle.setRadius(radius)
          circle.setStyle(stepStyle)
        } else {
          const polygon = layer as L.Polygon
          polygon.setLatLngs(sectorPolygonLatLngs(position, radius, config.antenna.bearing, config.antenna.beamwidth))
          polygon.setStyle(stepStyle)
        }
      })
      return
    }

    removeLayer(coverageLayer.value)
    const group = L.layerGroup()
    const steps: (L.Circle | L.Polygon)[] = []
    for (let step = 1; step <= COVERAGE_GRADIENT_STEPS; step++) {
      const radius = stepRadius(step)
      const layer = isOmni
        ? L.circle(position, { ...stepStyle, radius })
        : L.polygon(sectorPolygonLatLngs(position, radius, config.antenna.bearing, config.antenna.beamwidth), stepStyle)
      layer.addTo(group)
      steps.push(layer)
    }
    group.addTo(map.value)
    coverageLayer.value = group
    coverageSteps.value = steps
    coverageAntennaType.value = config.antenna.type
  }

  const updateTether = (config: BaseStationConfig): void => {
    removeLayer(tetherLayer.value)
    tetherLayer.value = undefined

    if (!map.value || !store.showCoverage || !config.position) return
    if (config.commsType !== BaseStationCommsType.Tethered) return

    tetherLayer.value = L.circle(config.position, {
      radius: config.tetherLengthMeters,
      color: config.coverageColor,
      weight: 1,
      opacity: config.coverageOpacity,
      fillColor: config.coverageColor,
      fillOpacity: 0.1 * config.coverageOpacity,
      dashArray: '4 4',
      interactive: false,
    }).addTo(map.value)
  }

  const updateBearingHandle = (config: BaseStationConfig): void => {
    const shouldShow =
      map.value !== undefined &&
      config.position !== null &&
      config.commsType === BaseStationCommsType.RadioLink &&
      config.antenna.type !== AntennaType.Omni

    if (!shouldShow) {
      removeLayer(bearingHandle.value)
      removeLayer(bearingLine.value)
      removeLayer(aimingArc.value)
      bearingHandle.value = undefined
      bearingLine.value = undefined
      aimingArc.value = undefined
      return
    }

    const rangeMeters = effectiveAntennaRangeMeters(config)
    const handleLatLng = bearingHandlePosition(config.position!, rangeMeters, config.antenna.bearing)
    const lineLatLngs = [config.position!, handleLatLng] as L.LatLngExpression[]
    const arcLatLngs = aimingArcLatLngs(config.position!, rangeMeters, config.antenna.bearing)
    const lineOpacity = 0.3 * config.coverageOpacity
    const arcOpacity = 0.25 * config.coverageOpacity

    if (bearingLine.value) {
      bearingLine.value.setLatLngs(lineLatLngs)
      bearingLine.value.setStyle({ color: config.coverageColor, opacity: lineOpacity })
    } else {
      bearingLine.value = L.polyline(lineLatLngs, {
        color: config.coverageColor,
        weight: 1,
        dashArray: '6 4',
        opacity: lineOpacity,
        interactive: false,
      }).addTo(map.value!)
    }

    if (aimingArc.value) {
      aimingArc.value.setLatLngs(arcLatLngs)
      aimingArc.value.setStyle({ color: config.coverageColor, opacity: arcOpacity })
    } else {
      aimingArc.value = L.polyline(arcLatLngs, {
        color: config.coverageColor,
        weight: 1,
        dashArray: '6 4',
        opacity: arcOpacity,
        interactive: false,
      }).addTo(map.value!)
    }

    // Update in place; recreating during drag would destroy the handle Leaflet is tracking
    // and stop the rotation after a single drag step.
    if (bearingHandle.value) {
      bearingHandle.value.setLatLng(handleLatLng)
      return
    }

    const handle = L.marker(handleLatLng, {
      icon: buildBearingHandleIcon(),
      draggable: true,
      zIndexOffset: 700,
      bubblingMouseEvents: true,
    })
    handle.on('drag', (event: L.LeafletEvent) => {
      const center = store.config.position
      if (!center) return
      const target = event.target as L.Marker
      const { lat, lng } = target.getLatLng()
      store.setBearing(bearingFromCenter(center, [lat, lng]))
    })
    handle.addTo(map.value!)
    bearingHandle.value = handle
  }

  const refreshAll = (): void => {
    if (!mapReady.value || !(map.value instanceof L.Map)) return
    const config = store.config

    if (!config.enabled || !config.position) {
      removeLayer(marker.value)
      removeLayer(coverageLayer.value)
      removeLayer(tetherLayer.value)
      removeLayer(bearingHandle.value)
      removeLayer(bearingLine.value)
      removeLayer(aimingArc.value)
      marker.value = undefined
      coverageLayer.value = undefined
      tetherLayer.value = undefined
      bearingHandle.value = undefined
      bearingLine.value = undefined
      aimingArc.value = undefined
      return
    }

    ensureMarker(config)
    updateCoverage(config)
    updateTether(config)
    updateBearingHandle(config)
  }

  watch([map, mapReady], refreshAll, { immediate: true })
  watch(() => store.config, refreshAll, { deep: true })

  onBeforeUnmount(() => {
    removeLayer(marker.value)
    removeLayer(coverageLayer.value)
    removeLayer(tetherLayer.value)
    removeLayer(bearingHandle.value)
    removeLayer(bearingLine.value)
    removeLayer(aimingArc.value)
    marker.value = undefined
    coverageLayer.value = undefined
    tetherLayer.value = undefined
    bearingHandle.value = undefined
    bearingLine.value = undefined
    aimingArc.value = undefined
  })

  return { openConfigPanel }
}
