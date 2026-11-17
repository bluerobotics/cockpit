import { useThrottleFn } from '@vueuse/core'
import L, { type Map as LeafletMap } from 'leaflet'
import { t } from 'ttag'
import { type ComputedRef, type Ref, type ShallowRef, computed, onBeforeUnmount, shallowRef, watch } from 'vue'

import { useBaseStation } from '@/composables/baseStation/useBaseStation'
import { useMapPointHeights } from '@/composables/map/useMapPointHeights'
import { useMissionTerrain } from '@/composables/terrain/useMissionTerrain'
import { nearestSnapTarget } from '@/libs/map/measure'
import {
  CLICK_SLOP_PX,
  clickedDelete,
  deleteButtonHtml,
  isOnMap,
  MAP_TAG_CLASS,
  showDeleteOnHover,
} from '@/libs/map/measure-layers'
import { metersPerPixel } from '@/libs/map/utils-map'
import { bearingBetween, calculateHaversineDistance, formatBearing } from '@/libs/mission/general-estimates'
import { sampleTerrain } from '@/libs/terrain/elevation-service'
import { surfaceHeight } from '@/libs/terrain/mission-profile'
import { formatDistance, formatValueWithUnit } from '@/libs/units'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { BaseStationCommsType } from '@/types/baseStation'
import type { Waypoint, WaypointCoordinates } from '@/types/mission'

/** What {@link useMapCursorTerrain} reads its readout from. */
export interface UseMapCursorTerrainOptions {
  /** Whether the readout is shown. */
  enabled: () => boolean
  /** Where the vehicle is, when known. */
  vehiclePosition: () => WaypointCoordinates | undefined
  /** Where home is, when known. */
  home: () => WaypointCoordinates | undefined
  /** Waypoints this map draws. */
  waypoints: () => Waypoint[]
  /** Whether another drawing mode owns the map's clicks, so a click places no flag. */
  isBlocked: () => boolean
}

/** Return type of {@link useMapCursorTerrain}. */
export interface UseMapCursorTerrainReturn {
  /** Whether any terrain flag is on the map. */
  hasFlags: ComputedRef<boolean>
  /** Takes every terrain flag off the map. */
  clearFlags: () => void
}

type TerrainFlag = {
  /** Stable identifier. */
  id: number
  /** Where it stands. */
  coordinates: WaypointCoordinates
  /** Terrain heights read there, null while they are read. */
  lines: string[] | null
}

type SurfaceReading = {
  /** Terrain height above sea level, null without terrain data. */
  ground: number | null
  /** The surface's height above sea level, and above home when home is known. */
  lines: string[]
}

type FlagMarker = {
  /** The flag on the map. */
  marker: L.Marker
  /** The pill reading its height. */
  pill: HTMLElement
}

type HeightTarget = {
  /** Where it is. */
  coordinates: WaypointCoordinates
  /** Name read back on the readout. */
  label: string
  /** Reads its height above sea level, null when unknown. */
  heightAmslM: () => Promise<number | null>
}

// Terrain tiles are cached, so this only bounds how often the readout is rebuilt while the mouse moves.
const SAMPLE_INTERVAL_MS = 120
const NEAR_TOLERANCE_PX = 14
// Above the measurement panes, so the readout is never hidden under the vertices and tags it is read beside.
const TOOLTIP_PANE = 'cursorTerrainTooltipPane'

const FLAG_SVG = `
  <svg width="26" height="40" viewBox="0 0 26 40" fill="none" xmlns="http://www.w3.org/2000/svg"
       class="drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
    <ellipse cx="4" cy="38" rx="4" ry="1.5" fill="white"/>
    <rect x="3" y="5" width="2" height="33" rx="1" fill="white"/>
    <circle cx="4" cy="4" r="2.5" fill="white"/>
    <path d="M6 7 L24 12 Q15 13 6 18 Z" fill="#2563eb" stroke="white" stroke-width="1.2" stroke-linejoin="round"/>
  </svg>`

/**
 * Shows the terrain under the mouse cursor, or where a finger last dragged the map: the ground height or the water
 * depth, how high the vehicle or a waypoint there is above it, and the range and bearing from the vehicle. A click or
 * tap plants a flag reading the terrain height there, which stays on the map until deleted.
 * @param {ShallowRef<LeafletMap | undefined>} map The map to read.
 * @param {Ref<boolean>} mapReady Whether the map is ready.
 * @param {UseMapCursorTerrainOptions} options What the map draws.
 * @returns {UseMapCursorTerrainReturn} The flags on the map.
 */
export const useMapCursorTerrain = (
  map: ShallowRef<LeafletMap | undefined>,
  mapReady: Ref<boolean>,
  options: UseMapCursorTerrainOptions
): UseMapCursorTerrainReturn => {
  const interfaceStore = useAppInterfaceStore()
  const baseStation = useBaseStation()
  const terrain = useMissionTerrain()

  const { vehicleAltitudeAmslM, waypointAltitudeAmslM } = useMapPointHeights()

  const flags = shallowRef<TerrainFlag[]>([])
  let nextFlagId = 1
  let boundMap: LeafletMap | undefined
  let flagLayer: L.LayerGroup | undefined
  const flagMarkers = new Map<number, FlagMarker>()
  let tooltip: L.Tooltip | undefined
  let pressedAt: L.Point | undefined
  let latestRun = 0

  const heightTargets = (): HeightTarget[] => {
    const targets: HeightTarget[] = []
    const vehicle = options.vehiclePosition()
    if (vehicle) {
      const heightAmslM = async (): Promise<number | null> => vehicleAltitudeAmslM()
      targets.push({ coordinates: vehicle, label: t`Vehicle`, heightAmslM })
    }
    options.waypoints().forEach((waypoint, index) => {
      const number = index + 1
      const heightAmslM = (): Promise<number | null> => waypointAltitudeAmslM(waypoint, options.home())
      targets.push({ coordinates: waypoint.coordinates, label: t`Waypoint ${number}`, heightAmslM })
    })
    return targets
  }

  const surfaceLine = (ground: number | null, waterLevelM: number): string => {
    const preferences = interfaceStore.displayUnitPreferences
    if (ground === null) return t`No terrain data here`
    if (ground < waterLevelM) {
      const depth = formatValueWithUnit(waterLevelM - ground, 'm', preferences)
      return t`Depth ${depth}`
    }
    const height = formatValueWithUnit(ground, 'm', preferences)
    return t`Ground ${height} above sea level`
  }

  const homeLine = (ground: number, homeGround: number, waterLevelM: number): string => {
    const differenceM = ground - surfaceHeight(homeGround, waterLevelM)
    const height = formatValueWithUnit(Math.abs(differenceM), 'm', interfaceStore.displayUnitPreferences)
    const above = differenceM >= 0
    if (ground < waterLevelM) return above ? t`Seabed ${height} above home` : t`Seabed ${height} below home`
    return above ? t`Ground ${height} above home` : t`Ground ${height} below home`
  }

  const surfaceReading = async (point: WaypointCoordinates): Promise<SurfaceReading> => {
    const home = options.home()
    const [ground, homeGround] = await sampleTerrain(home ? [point, home] : [point], { mode: 'bilinear' })
    const waterLevelM = terrain.context().waterLevelM
    const lines = [surfaceLine(ground, waterLevelM)]
    if (ground !== null && typeof homeGround === 'number') lines.push(homeLine(ground, homeGround, waterLevelM))
    return { ground, lines }
  }

  const readout = async (point: WaypointCoordinates, toleranceM: number): Promise<string[]> => {
    const preferences = interfaceStore.displayUnitPreferences
    const lines = [`${point[0].toFixed(6)}, ${point[1].toFixed(6)}`]
    const { ground, lines: surface } = await surfaceReading(point)
    const waterLevelM = terrain.context().waterLevelM
    const overWater = ground !== null && ground < waterLevelM
    lines.push(...surface)

    const near = nearestSnapTarget(heightTargets(), point, toleranceM)
    const nearHeight = near && ground !== null ? await near.heightAmslM() : null
    if (near && nearHeight !== null && ground !== null) {
      const above = formatValueWithUnit(nearHeight - ground, 'm', preferences)
      const label = near.label
      lines.push(overWater ? t`${label} ${above} above the seabed` : t`${label} ${above} above the ground`)
    }

    const vehicle = options.vehiclePosition()
    if (vehicle) {
      const range = formatDistance(calculateHaversineDistance(vehicle, point), preferences)
      const bearing = formatBearing(bearingBetween(vehicle, point))
      lines.push(t`From the vehicle ${range} · ${bearing}`)
    }

    const base = baseStation.activePosition
    if (base && baseStation.config.commsType === BaseStationCommsType.Tethered) {
      const range = formatDistance(calculateHaversineDistance(base, point), preferences)
      const length = formatDistance(baseStation.config.tetherLengthMeters, preferences)
      lines.push(t`Base station ${range} of ${length} tether`)
    }
    return lines
  }

  const contentFor = (lines: string[]): HTMLElement => {
    const element = document.createElement('div')
    lines.forEach((line) => {
      const paragraph = document.createElement('p')
      paragraph.textContent = line
      element.append(paragraph)
    })
    return element
  }

  const show = (latlng: L.LatLng): void => {
    if (!boundMap) return
    tooltip ??= L.tooltip({
      className: 'vehicle-tooltip',
      direction: 'auto',
      offset: [18, 0],
      interactive: false,
      pane: TOOLTIP_PANE,
    }).setContent(contentFor([t`Reading the terrain…`]))
    tooltip.setLatLng(latlng)
    if (!boundMap.hasLayer(tooltip)) tooltip.addTo(boundMap)
  }

  const hide = (): void => {
    latestRun++
    tooltip?.remove()
  }

  const sample = useThrottleFn(
    (latlng: L.LatLng) => {
      if (!boundMap) return
      const run = ++latestRun
      const toleranceM = metersPerPixel(latlng.lat, boundMap.getZoom()) * NEAR_TOLERANCE_PX
      readout([latlng.lat, latlng.lng], toleranceM)
        .then((lines) => run === latestRun && tooltip?.setContent(contentFor(lines)))
        .catch((error) => console.warn('Could not read the terrain under the cursor:', error))
    },
    SAMPLE_INTERVAL_MS,
    true,
    true
  )

  const onPointerMove = (event: PointerEvent): void => {
    if (!boundMap || event.pointerType !== 'mouse') return
    if (!isOnMap(boundMap, event)) return hide()
    const latlng = boundMap.mouseEventToLatLng(event)
    show(latlng)
    sample(latlng)
  }

  const onPointerDown = (event: PointerEvent): void => {
    pressedAt = L.point(event.clientX, event.clientY)
  }

  // A finger has no hover, so the readout lands where it lifted at the end of a pan, while a tap plants a flag.
  const onPointerUp = (event: PointerEvent): void => {
    if (!boundMap || event.pointerType === 'mouse' || !isOnMap(boundMap, event)) return
    const travelled = pressedAt?.distanceTo(L.point(event.clientX, event.clientY)) ?? 0
    if (travelled <= CLICK_SLOP_PX) return hide()
    const latlng = boundMap.mouseEventToLatLng(event)
    show(latlng)
    sample(latlng)
  }

  const removeFlag = (id: number): void => {
    flags.value = flags.value.filter((flag) => flag.id !== id)
    logUserAction('Removed a terrain height flag from the map')
  }

  const createFlagMarker = (flag: TerrainFlag): FlagMarker => {
    const element = document.createElement('div')
    element.className = 'relative'
    element.innerHTML = `${FLAG_SVG}${deleteButtonHtml(t`Remove this flag`)}`
    const pill = document.createElement('div')
    pill.className =
      `${MAP_TAG_CLASS} absolute left-[28px] top-[2px] whitespace-nowrap rounded-2xl border border-white/20 ` +
      'bg-[#00000044] px-2 py-[3px] text-[12px] leading-4 text-white backdrop-blur-[10px]'
    element.append(pill)
    const icon = L.divIcon({ html: element, className: '', iconSize: [26, 40], iconAnchor: [4, 38] })
    const marker = showDeleteOnHover(L.marker(flag.coordinates, { icon, keyboard: false }))
    marker.on('click', (event) => {
      if (clickedDelete(event as L.LeafletMouseEvent)) removeFlag(flag.id)
    })
    return { marker, pill }
  }

  // Markers are kept across renders, so a flag's first hover after it was planted is the only one skipped.
  const renderFlags = (): void => {
    const wanted = new Set(flags.value.map((flag) => flag.id))
    flagMarkers.forEach(({ marker }, id) => {
      if (wanted.has(id)) return
      marker.remove()
      flagMarkers.delete(id)
    })
    flags.value.forEach((flag) => {
      let entry = flagMarkers.get(flag.id)
      if (!entry && flagLayer) {
        entry = createFlagMarker(flag)
        flagLayer.addLayer(entry.marker)
        flagMarkers.set(flag.id, entry)
      }
      entry?.pill.replaceChildren(contentFor(flag.lines ?? [t`Reading the terrain…`]))
    })
  }

  const placeFlag = (event: L.LeafletMouseEvent): void => {
    if (options.isBlocked()) return
    const flag: TerrainFlag = { id: nextFlagId++, coordinates: [event.latlng.lat, event.latlng.lng], lines: null }
    flags.value = [...flags.value, flag]
    logUserAction('Flagged the terrain height at a point on the map')
    surfaceReading(flag.coordinates)
      .then(({ lines }) => {
        flags.value = flags.value.map((current) => (current.id === flag.id ? { ...current, lines } : current))
      })
      .catch((error) => console.warn('Could not read the terrain under a flag:', error))
  }

  const unbindInput = (): void => {
    const container = boundMap?.getContainer()
    container?.removeEventListener('pointermove', onPointerMove)
    container?.removeEventListener('pointerdown', onPointerDown)
    container?.removeEventListener('pointerup', onPointerUp)
    container?.removeEventListener('pointerleave', hide)
    boundMap?.off('click', placeFlag)
    hide()
  }

  const bindInput = (): void => {
    const container = boundMap?.getContainer()
    container?.addEventListener('pointermove', onPointerMove)
    container?.addEventListener('pointerdown', onPointerDown)
    container?.addEventListener('pointerup', onPointerUp)
    container?.addEventListener('pointerleave', hide)
    boundMap?.on('click', placeFlag)
  }

  watch(
    [map, mapReady, options.enabled],
    ([current, ready, enabled]) => {
      unbindInput()
      const next = current && ready ? current : undefined
      if (next !== boundMap) {
        flagLayer?.remove()
        flagMarkers.clear()
        flagLayer = next ? L.layerGroup().addTo(next) : undefined
        if (next && !next.getPane(TOOLTIP_PANE)) next.createPane(TOOLTIP_PANE).style.zIndex = '670'
      }
      boundMap = next
      renderFlags()
      if (boundMap && enabled) bindInput()
    },
    { immediate: true }
  )
  watch(flags, renderFlags)

  onBeforeUnmount(() => {
    unbindInput()
    flagLayer?.remove()
    flagLayer = undefined
    flagMarkers.clear()
    boundMap = undefined
  })

  return {
    hasFlags: computed(() => flags.value.length > 0),
    clearFlags: () => {
      flags.value = []
    },
  }
}
