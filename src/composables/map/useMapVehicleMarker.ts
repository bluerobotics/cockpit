import L, { type LatLngTuple, type Map, type Marker, type MarkerOptions } from 'leaflet'
import { t } from 'ttag'
import { type ShallowRef, onBeforeUnmount, shallowRef, watch } from 'vue'

import { useDataLakeVariable } from '@/composables/useDataLakeVariable'
import { useResolvedDataLakeTemplate } from '@/composables/useResolvedDataLakeTemplate'
import { defaultAltitudeIndicatorVariableId } from '@/libs/data-sources/altitude'
import { defaultPitchVariableId, defaultRollVariableId } from '@/libs/data-sources/attitude'
import {
  attachVehicleModel,
  setVehicleModelArmed,
  setVehicleModelAttitude,
} from '@/libs/map/shared-vehicle-attitude-model'
import { vehicleIconAttributes } from '@/libs/vehicle/vehicle-marker'
import type { VehicleIconAppearance } from '@/types/mission'

const VEHICLE_ICON_SIZE_PX = 64

const altitudeTagClasses = [
  'vehicle-altitude-tag absolute left-full top-1/2 -translate-y-1/2 ml-1 whitespace-nowrap rounded-full px-2 py-0.5',
  'flex items-center gap-1 text-xs font-semibold pointer-events-none',
].join(' ')

// A landed aircraft reads as smaller, nearer the ground, than the same one flying.
const groundScale = 0.9

// The altitude tag's glass box-shadow as drop-shadows, so it follows the model's outline; drop-shadow has no spread.
const groundShadowLayers = [
  { offsetY: 4, blur: 4, color: '#00000033' },
  { offsetY: 8, blur: 12, color: '#00000016' },
]

// The marker body turns with the heading, so the offsets are turned back to keep the shadow falling down the screen.
const groundShadowFilter = (headingInDegrees: number): string => {
  const angle = (headingInDegrees * Math.PI) / 180
  return groundShadowLayers
    .map(({ offsetY, blur, color }) => {
      const x = (offsetY * Math.sin(angle)).toFixed(1)
      const y = (offsetY * Math.cos(angle)).toFixed(1)
      return `drop-shadow(${x}px ${y}px ${blur}px ${color})`
    })
    .join(' ')
}

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
  /** Whether the icon is the vehicle's picture, the picture with a heading arrow, an arrow alone or its 3D model, and its colors. */
  iconAppearance: () => VehicleIconAppearance
  /** The vehicle's 3D model, or undefined when there is none for its type and the picture is shown instead. */
  modelUrl: () => string | undefined
  /** Whether the vehicle is armed, which spins the 3D model's propellers; undefined until its first heartbeat. */
  isArmed: () => boolean | undefined
  /** Whether the vehicle flies, so its 3D model shows its altitude, and shrinks and casts a shadow on the ground. */
  isAerial: () => boolean
  /** Leaflet class name for the tooltip, so each map keeps its own styling. */
  tooltipClassName: string
  /** Pane to draw the marker in; Leaflet's own marker pane when omitted. */
  paneName?: string
  /** CSS z-index given to `paneName`, applied only when the composable has to create that pane. */
  paneZIndex?: string
}

/**
 * Draws the vehicle on the given map and keeps its position, rotation and tooltip in sync, so the map
 * widget and the planning view share one copy of the marker logic instead of each keeping its own. The
 * marker appears as soon as both the map and a position exist, rather than on the next position change.
 * @param {ShallowRef<Map | undefined>} map - The Leaflet map to draw on; the marker appears once available.
 * @param {UseMapVehicleMarkerOptions} options - Reactive getters for the position, icon, tooltip and heading.
 * @returns {ShallowRef<Marker | undefined>} The marker, undefined until the map and a position exist.
 */
export const useMapVehicleMarker = (
  map: ShallowRef<Map | undefined>,
  options: UseMapVehicleMarkerOptions
): ShallowRef<Marker | undefined> => {
  const marker = shallowRef<Marker>()

  const dataLakeVariable = (template: string): ReturnType<typeof useDataLakeVariable> =>
    useDataLakeVariable(useResolvedDataLakeTemplate(template))
  const { value: landedState } = dataLakeVariable('/mavlink/{{autopilotSystemId}}/1/EXTENDED_SYS_STATE/landed_state')
  const { value: roll } = dataLakeVariable(defaultRollVariableId)
  const { value: pitch } = dataLakeVariable(defaultPitchVariableId)
  const { displayValue: altitude, displayUnit: altitudeUnit } = dataLakeVariable(defaultAltitudeIndicatorVariableId)

  const radians = (value: unknown): number => (typeof value === 'number' ? value : 0)
  const altitudeLabel = (): string | undefined =>
    altitude.value === undefined ? undefined : `${altitude.value.toFixed(1)} ${altitudeUnit.value}`.trim()

  let detachModel: (() => void) | undefined
  let modelFailed = false

  const showsModel = (): boolean =>
    options.iconAppearance().style === '3d-model' && options.modelUrl() !== undefined && !modelFailed

  // Autopilots that do not stream the landed state are taken to be on the ground while disarmed.
  const isOnGround = (): boolean => {
    if (!options.isAerial()) return false
    if (landedState.value !== undefined) return landedState.value === 'MAV_LANDED_STATE_ON_GROUND'
    return options.isArmed() !== true
  }

  const applyGroundState = (): void => {
    const canvas = marker.value?.getElement()?.querySelector<HTMLElement>('.vehicle-attitude-model')
    if (!canvas) return
    const onGround = showsModel() && isOnGround()
    canvas.style.filter = onGround ? groundShadowFilter(options.headingInDegrees()) : ''
    canvas.style.transform = onGround ? `scale(${groundScale})` : ''
  }

  const applyTooltipAndRotation = (content: string, headingInDegrees: number): void => {
    if (!marker.value) return

    marker.value.getTooltip()?.setContent(content)

    const iconElement = marker.value.getElement()?.querySelector<HTMLElement>('.vehicle-marker-body')
    if (iconElement) iconElement.style.transform = `rotate(${headingInDegrees}deg)`
    applyGroundState()
  }

  const applyIconAppearance = (appearance: VehicleIconAppearance): void => {
    const iconElement = marker.value?.getElement()?.querySelector<HTMLElement>('.vehicle-marker-body')
    if (!iconElement) return

    const { iconStyle, cssVariables } = vehicleIconAttributes(appearance)
    iconElement.dataset.iconStyle = showsModel() ? '3d-model' : iconStyle
    Object.entries(cssVariables).forEach(([name, value]) => iconElement.style.setProperty(name, value))
  }

  const applyAltitudeLabel = (label: string | undefined): void => {
    const tag = marker.value?.getElement()?.querySelector<HTMLElement>('.vehicle-altitude-tag')
    if (!tag) return
    const text = tag.querySelector<HTMLElement>('.vehicle-altitude-text')
    if (text) text.textContent = label ?? ''
    tag.style.display = showsModel() && options.isAerial() && label !== undefined ? '' : 'none'
  }

  const updateModel = (): void => {
    detachModel?.()
    detachModel = undefined
    const canvas = marker.value?.getElement()?.querySelector<HTMLCanvasElement>('.vehicle-attitude-model')
    const modelUrl = options.modelUrl()
    if (canvas && modelUrl !== undefined && showsModel()) {
      detachModel = attachVehicleModel(canvas, modelUrl, () => {
        modelFailed = true
        updateModel()
      })
      setVehicleModelAttitude(radians(roll.value), radians(pitch.value))
      setVehicleModelArmed(options.isArmed() ?? false)
    }
    applyIconAppearance(options.iconAppearance())
    applyAltitudeLabel(altitudeLabel())
    applyGroundState()
  }

  const create = (position: LatLngTuple): void => {
    if (!map.value) return

    const iconSizeStyle = `width: ${VEHICLE_ICON_SIZE_PX}px; height: ${VEHICLE_ICON_SIZE_PX}px;`
    const arrowAndImage = `<div class="vehicle-heading-arrow"></div><img src="${options.iconUrl()}" style="${iconSizeStyle}">`
    const model = '<canvas class="vehicle-attitude-model"></canvas>'
    const altitudeIcon = '<span class="mdi mdi-altimeter text-sm leading-none"></span>'
    const altitudeTag = `<span class="${altitudeTagClasses}" style="display: none">${altitudeIcon}<span class="vehicle-altitude-text"></span></span>`
    const markerOptions: MarkerOptions = {
      icon: L.divIcon({
        className: 'vehicle-marker',
        html: `<div class="vehicle-marker-body" style="position: relative; ${iconSizeStyle}">${arrowAndImage}${model}</div>${altitudeTag}`,
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
      L.tooltip({ content: t`No data available`, className: options.tooltipClassName, offset: [40, 0] })
    )
    map.value.addLayer(marker.value)
  }

  // Driven by the map as well as the position, and immediate, so a vehicle that is already connected and
  // holding station gets its marker on mount instead of waiting for its coordinates to change.
  watch(
    [() => options.position(), map],
    () => {
      const position = options.position()
      if (!map.value || !position) return

      if (marker.value === undefined) {
        create(position)
        // A station-keeping vehicle may never fire the telemetry watch below, which would leave the
        // placeholder tooltip in place for as long as it holds position.
        applyTooltipAndRotation(options.tooltipContent(), options.headingInDegrees())
        updateModel()
      }

      marker.value?.setLatLng(position)
    },
    { immediate: true }
  )

  watch([() => options.tooltipContent(), () => options.headingInDegrees()], ([content, heading]) =>
    applyTooltipAndRotation(content, heading)
  )

  watch(() => options.iconAppearance(), applyIconAppearance, { deep: true })

  watch([() => options.iconAppearance().style, () => options.modelUrl()], () => {
    modelFailed = false
    updateModel()
  })

  watch([roll, pitch], () => {
    if (detachModel) setVehicleModelAttitude(radians(roll.value), radians(pitch.value))
  })

  watch(
    () => options.isArmed(),
    (isArmed) => detachModel && setVehicleModelArmed(isArmed ?? false)
  )

  watch(altitudeLabel, applyAltitudeLabel)

  watch([landedState, () => options.isAerial(), () => options.isArmed()], applyGroundState)

  onBeforeUnmount(() => {
    detachModel?.()
    detachModel = undefined
    if (marker.value && map.value) map.value.removeLayer(marker.value)
    marker.value = undefined
  })

  return marker
}
