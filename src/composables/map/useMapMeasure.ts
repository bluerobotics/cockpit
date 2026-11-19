import { watchThrottled } from '@vueuse/core'
import L, { type Map as LeafletMap } from 'leaflet'
import { t } from 'ttag'
import { type ComputedRef, type Ref, type ShallowRef, computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'

import { useBaseStation } from '@/composables/baseStation/useBaseStation'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { useMissionTerrain } from '@/composables/terrain/useMissionTerrain'
import { useDataLakeVariable } from '@/composables/useDataLakeVariable'
import { usePointsOfInterest } from '@/composables/usePointsOfInterest'
import { useResolvedDataLakeTemplate } from '@/composables/useResolvedDataLakeTemplate'
import { altitudeSourceOptions } from '@/libs/data-sources/altitude'
import {
  type MeasureVertex,
  type ScreenBox,
  type ScreenPoint,
  type SnapTarget,
  formatTravelTime,
  nearestPointOnLines,
  nearestSnapTarget,
  polygonStats,
  polylineStats,
  segmentCrossesBox,
} from '@/libs/map/measure'
import { metersPerPixel, outwardPillTransform } from '@/libs/map/utils-map'
import {
  bearingBetween,
  calculateHaversineDistance,
  centroidLatLng,
  formatBearing,
} from '@/libs/mission/general-estimates'
import { sampleTerrain } from '@/libs/terrain/elevation-service'
import { pointAltitudesAmsl, surfaceHeight } from '@/libs/terrain/mission-profile'
import { missionProfilePoints } from '@/libs/terrain/mission-terrain'
import { convertValueTo, formatArea, formatDistance, formatValueWithUnit } from '@/libs/units'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useHazardStore } from '@/stores/hazards'
import type { Waypoint, WaypointCoordinates } from '@/types/mission'

import { type VertexAngleTriple, useVertexAngleOverlay } from './useVertexAngleOverlay'

/** Which measurement the map is taking. */
export type MeasureTool = 'distance' | 'area'

/** What a measured point was snapped to, which is what its height is read from. */
type MeasureVertexKind = 'point' | 'vehicle' | 'home' | 'base-station' | 'waypoint' | 'poi' | 'hazard'

/** A measured point, with what its height is read from. */
export interface MapMeasureVertex extends MeasureVertex {
  /** What it was snapped to. */
  kind: MeasureVertexKind
  /** Index into the map's waypoints, for a point snapped to one. */
  waypointIndex?: number
}

/** A measurement on the map. */
export interface MapMeasurement {
  /** Stable identifier. */
  id: number
  /** What it measures. */
  tool: MeasureTool
  /** Number it is called by among the measurements of its tool, from 1. */
  number: number
  /** Its points, in order. */
  vertices: MapMeasureVertex[]
  /** Whether it was confirmed, which keeps it on the map; the one not yet confirmed is being taken. */
  pinned: boolean
}

type MeasureSnapTarget = SnapTarget & Pick<MapMeasureVertex, 'kind' | 'waypointIndex'>

/** What {@link useMapMeasure} needs from the map it measures on. */
export interface UseMapMeasureOptions {
  /** Where the vehicle is, when known. */
  vehiclePosition: () => WaypointCoordinates | undefined
  /** Where home is, when known. */
  home: () => WaypointCoordinates | undefined
  /** Waypoints this map draws. */
  waypoints: () => Waypoint[]
  /** Speed the distances are timed at, in meters per second. */
  cruiseSpeedMps: () => number
  /** Whether another drawing mode owns the map's clicks, which ends any measurement being taken. */
  isBlocked: () => boolean
  /** Hull color the measurements are drawn in. */
  colorScheme: () => MeasureColorScheme
}

/** Return type of {@link useMapMeasure}. */
export interface UseMapMeasureReturn {
  /** Measurement being taken, null for none. */
  tool: Ref<MeasureTool | null>
  /** Measurements on the map, the confirmed ones and the one being taken. */
  measurements: ShallowRef<MapMeasurement[]>
  /** Ruler whose terrain profile was asked for from its readout, null for none. */
  profiled: ComputedRef<MapMeasurement | null>
  /** Whether anything is measured on the map. */
  hasMeasurement: ComputedRef<boolean>
  /** Starts taking a measurement, or stops with null, discarding the one not yet confirmed. */
  setTool: (tool: MeasureTool | null) => void
  /** Takes every measurement off the map, keeping the tool. */
  clear: () => void
  /** Closes the terrain profile of the {@link UseMapMeasureReturn.profiled} ruler. */
  closeProfile: () => void
}

type SummaryTag = {
  /** The readout beside the ruler's last point. */
  tooltip: L.Tooltip
  /** Holds its text lines. */
  lines: HTMLElement
  /** Holds the confirm and discard buttons, shown while the ruler is being taken. */
  draftActions: HTMLElement
  /** When the line being drawn started covering it, null while it is clear. */
  coveredSince: number | null
  /** When its glide to a new side ends. */
  glideEndsAt: number
}

const MEASURE_PANE = 'measureToolPane'
const VERTEX_PANE = 'measureVertexPane'
const HANDLE_PANE = 'measureHandlePane'
// Room between a point's dot and a readout pinned beside it.
const VERTEX_CLEARANCE_PX = 8
/** Readouts in the order they are kept when two would overlap, the rest hidden. */
type PillsByRank = {
  /** An area's surface and perimeter. */
  area: L.Marker[]
  /** Length and bearing of a side. */
  segment: L.Marker[]
  /** Running length at a ruler's corner, kept after the angle tags. */
  total: L.Marker[]
}
const HANDLE_CLASS = 'measure-handle'
/** Marks a readout on the map that a ruler's readout opens clear of. */
export const MAP_TAG_CLASS = 'map-tag'
type TagPlacement = 'left' | 'right' | 'top' | 'bottom'
const TAG_OFFSETS: Record<TagPlacement, L.PointTuple> = {
  left: [-18, 0],
  right: [18, 0],
  top: [0, -18],
  bottom: [0, 18],
}
const rectsOverlap = (a: ScreenBox, b: ScreenBox): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
// Where the delete button a point shows on hover sits around it, in pixels.
const DELETE_BUTTON_BOX: ScreenBox = { left: -32, top: -32, right: -4, bottom: -4 }
// A pointer this close to a ruler's readout is reaching for its buttons, so the line it drags along stops moving it.
const TAG_REACH_PX = 24
// The line being drawn sweeps across a readout as the pointer moves, so only covering it this long moves it.
const TAG_HOLD_MS = 350
// Matches the transition of `measure-tag-glide` in `global.css`.
const TAG_GLIDE_MS = 420
const TAG_GLIDE_CLASS = 'measure-tag-glide'
/** What a ruler's readout keeps clear of, in page pixels. */
type TagObstacles = {
  /** Readouts, pills, points and buttons. */
  boxes: ScreenBox[]
  /** Measured sides, the one being drawn included. */
  sides: [ScreenPoint, ScreenPoint][]
}
// Important, since views rewrite the container's inline cursor on every pointer move and Leaflet points at markers.
const CROSSHAIR_CLASS = '!cursor-crosshair'
/** BlueBoat hull colors the measurements can be drawn in. */
export type MeasureColorScheme = 'blue' | 'garibaldi-orange' | 'axolotl-pink' | 'moray-green'
/** Hull color each scheme draws its measurements in. */
export const MEASURE_SCHEME_COLORS: Record<MeasureColorScheme, string> = {
  'blue': '#2c5cc4',
  'garibaldi-orange': '#ec882c',
  'axolotl-pink': '#ce40a4',
  'moray-green': '#9cc83a',
}
const FLOATING_LINE_CLASS = 'drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]'
// A finger lands up to about this far from what it aims at, so closer than this counts as on it.
const SNAP_TOLERANCE_PX = 14
/** A press that travels farther than this, in pixels, before it lifts was a pan, not a point. */
export const CLICK_SLOP_PX = 6

/**
 * Creates the pane the measurement readouts draw on, once per map.
 * @param {LeafletMap} map The map to create it on.
 * @returns {string} The pane's name.
 */
export const ensureMeasurePane = (map: LeafletMap): string => {
  if (map.getPane(MEASURE_PANE)) return MEASURE_PANE
  const pane = map.createPane(MEASURE_PANE)
  pane.style.zIndex = '655'
  pane.style.pointerEvents = 'none'
  return MEASURE_PANE
}

/**
 * A measurement line, lifted off the map by a slight shadow.
 * @param {WaypointCoordinates[]} points The line's points, in order.
 * @param {L.PolylineOptions} style Its stroke.
 * @returns {L.Polyline} The line, not yet on a map.
 */
export const measureLine = (points: WaypointCoordinates[], style: L.PolylineOptions): L.Polyline =>
  L.polyline(points, { ...style, className: FLOATING_LINE_CLASS })

/**
 * A text-only readout pinned to the map, one line per entry, built without HTML so labels from POIs and hazards
 * render as text.
 * @param {L.LatLngExpression} at Where it is pinned.
 * @param {string[]} lines Its lines, top to bottom.
 * @param {string} className Pill style, `measure-angle-pill` centered on the point or `live-measure-pill` beside it.
 * @returns {L.Marker} The readout, not yet on a map.
 */
export const measurePill = (at: L.LatLngExpression, lines: string[], className: string): L.Marker => {
  const element = document.createElement('div')
  element.className = className
  lines.forEach((line, index) => {
    if (index > 0) element.append(document.createElement('br'))
    element.append(line)
  })
  const icon = L.divIcon({ html: element, className: 'live-measure-tag', iconSize: [0, 0], iconAnchor: [0, 0] })
  return L.marker(at, { icon, interactive: false, keyboard: false, pane: MEASURE_PANE })
}

/**
 * The red trash button the survey polygon's corners show on hover, hidden until {@link showDeleteOnHover} reveals it.
 * @param {string} label What pressing it removes, read by screen readers and shown on hover.
 * @returns {string} Its markup, for a marker's icon.
 */
export const deleteButtonHtml = (label: string): string => `
  <div class="delete-popup" style="display: none;">
    <button type="button" class="delete-button" aria-label="${label}" title="${label}">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 4h12M4 4v10a2 2 0 002 2h4a2 2 0 002-2V4M6 4V2h4v2"
              stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>`

const setDeleteShown = (marker: L.Marker, shown: boolean): void => {
  const popup = marker.getElement()?.querySelector<HTMLElement>('.delete-popup')
  if (popup) popup.style.display = shown ? 'block' : 'none'
}

/**
 * Shows a marker's {@link deleteButtonHtml} while the pointer is over it, skipping the hover a marker gets when it is
 * placed right under the pointer.
 * @param {L.Marker} marker The marker.
 * @returns {L.Marker} The same marker.
 */
export const showDeleteOnHover = (marker: L.Marker): L.Marker => {
  let justCreated = true
  return marker
    .on('mouseover', () => {
      if (!justCreated) setDeleteShown(marker, true)
      justCreated = false
    })
    .on('mouseout dragstart', () => {
      justCreated = false
      setDeleteShown(marker, false)
    })
}

/**
 * Whether a marker click landed on its {@link deleteButtonHtml}.
 * @param {L.LeafletMouseEvent} event The marker's click.
 * @returns {boolean} True for the trash button.
 */
export const clickedDelete = (event: L.LeafletMouseEvent): boolean =>
  !!(event.originalEvent.target as Element | null)?.closest('.delete-popup')

/**
 * Whether a pointer event landed on the map itself, rather than on a control or panel the map hosts.
 * @param {LeafletMap} map The map.
 * @param {Event} event The pointer event.
 * @returns {boolean} True for the map's background, tiles, and layers.
 */
export const isOnMap = (map: LeafletMap, event: Event): boolean => {
  const target = event.target as HTMLElement | null
  return target === map.getContainer() || !!target?.closest('.leaflet-map-pane')
}

/**
 * Halfway between two points, where a segment's readout sits.
 * @param {WaypointCoordinates} from One end.
 * @param {WaypointCoordinates} to The other end.
 * @returns {L.LatLng} The point halfway between them.
 */
export const midpoint = (from: WaypointCoordinates, to: WaypointCoordinates): L.LatLng =>
  L.latLng((from[0] + to[0]) / 2, (from[1] + to[1]) / 2)

const isOverHandle = (target: EventTarget | null): boolean =>
  !!(target as HTMLElement | null)?.closest?.(`.${HANDLE_CLASS}`)

const minimumVertices = (tool: MeasureTool): number => (tool === 'area' ? 3 : 2)

const vertexIcon = (scheme: MeasureColorScheme): L.DivIcon =>
  L.divIcon({
    html: `
      <div class="relative">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="5" fill="${MEASURE_SCHEME_COLORS[scheme]}" stroke="white" stroke-width="2"/>
        </svg>
        ${deleteButtonHtml(t`Delete this point`)}
      </div>`,
    className: HANDLE_CLASS,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })

const MAP_BUTTON_CLASS =
  'flex h-7 w-7 items-center justify-center rounded-full border border-white/30 bg-[#00000055] text-white ' +
  'shadow backdrop-blur-[10px] hover:bg-[#FFFFFF33]'
// Sits inside a glass readout whose body lets presses through to the map, so only the button takes them.
const TAG_BUTTON_CLASS =
  'pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full bg-[#FFFFFF22] text-white ' +
  'hover:bg-[#FFFFFF44]'

const actionButton = (
  icon: string,
  label: string,
  onPress: () => void,
  className = MAP_BUTTON_CLASS
): HTMLButtonElement => {
  const button = document.createElement('button')
  button.type = 'button'
  button.title = label
  button.setAttribute('aria-label', label)
  button.className = className
  const glyph = document.createElement('i')
  glyph.className = `mdi ${icon} text-[16px] leading-none`
  button.append(glyph)
  button.addEventListener('click', (event) => {
    event.stopPropagation()
    onPress()
  })
  return button
}

/**
 * Takes distance and area measurements on a Leaflet map: clicks or taps place points, snapping to the vehicle, home,
 * the base station, waypoints, points of interest, hazard areas and the shore, and the map reads back each segment's
 * length and bearing, running totals, the time at the planned speed, the slant range where heights are known, and
 * the area and perimeter of a closed shape. A confirmed measurement stays on the map, and its points can still be
 * dragged or deleted.
 * @param {ShallowRef<LeafletMap | undefined>} map The map to measure on.
 * @param {Ref<boolean>} mapReady Whether the map is ready.
 * @param {UseMapMeasureOptions} options What the map draws.
 * @returns {UseMapMeasureReturn} The measurements and the controls to take them.
 */
export const useMapMeasure = (
  map: ShallowRef<LeafletMap | undefined>,
  mapReady: Ref<boolean>,
  options: UseMapMeasureOptions
): UseMapMeasureReturn => {
  const interfaceStore = useAppInterfaceStore()
  const hazardStore = useHazardStore()
  const baseStation = useBaseStation()
  const { resolvedPointsOfInterest } = usePointsOfInterest()
  const terrain = useMissionTerrain()
  const angleOverlay = useVertexAngleOverlay(() => MEASURE_SCHEME_COLORS[options.colorScheme()])
  const rubberAngle = useVertexAngleOverlay(() => MEASURE_SCHEME_COLORS[options.colorScheme()])
  const { confirmAction } = useInteractionDialog()

  const vehicleAltitudeId = useResolvedDataLakeTemplate(() => altitudeSourceOptions[2].value)
  const { value: rawVehicleAltitude, unit: rawVehicleAltitudeUnit } = useDataLakeVariable(vehicleAltitudeId)
  const vehicleAltitudeAmslM = (): number | null =>
    vehicleAltitudeId.value === undefined || typeof rawVehicleAltitude.value !== 'number'
      ? null
      : convertValueTo(rawVehicleAltitude.value, rawVehicleAltitudeUnit.value, 'm')

  const tool = ref<MeasureTool | null>(null)
  const measurements = shallowRef<MapMeasurement[]>([])
  const profiledId = ref<number | null>(null)
  const selectedVertex = ref<[id: number, index: number] | null>(null)
  const draft = computed(() => measurements.value.find((measurement) => !measurement.pinned))
  const profiled = computed(
    () =>
      measurements.value.find(
        (measurement) => measurement.id === profiledId.value && measurement.tool === 'distance'
      ) ?? null
  )
  const hasMeasurement = computed(() => measurements.value.length > 0)

  let nextId = 1
  let boundMap: LeafletMap | undefined
  let layers: L.LayerGroup | undefined
  let rubberLine: L.Polyline | undefined
  let rubberPill: L.Marker | undefined
  let pressedAt: L.Point | undefined
  let pointerFrame: number | null = null
  const vertexMarkers = new Map<string, L.Marker>()
  const summaryTags = new Map<number, SummaryTag>()
  let actionsMarker: L.Marker | undefined
  let pills: PillsByRank = { area: [], segment: [], total: [] }
  let resumedFrom: MapMeasurement | undefined
  let offeringArea = false
  let confirmButton: HTMLButtonElement | undefined

  const snapTargets = (): MeasureSnapTarget[] => {
    const targets: MeasureSnapTarget[] = []
    const vehicle = options.vehiclePosition()
    if (vehicle) targets.push({ coordinates: vehicle, label: t`Vehicle`, kind: 'vehicle' })
    const home = options.home()
    if (home) targets.push({ coordinates: home, label: t`Home`, kind: 'home' })
    const base = baseStation.activePosition
    if (base) targets.push({ coordinates: base, label: t`Base station`, kind: 'base-station' })
    options.waypoints().forEach((waypoint, waypointIndex) => {
      const number = waypointIndex + 1
      targets.push({ coordinates: waypoint.coordinates, label: t`Waypoint ${number}`, kind: 'waypoint', waypointIndex })
    })
    resolvedPointsOfInterest.value.forEach((poi) => {
      targets.push({ coordinates: poi.coordinates, label: poi.name, kind: 'poi' })
    })
    return targets
  }

  const snap = (latlng: L.LatLng): MapMeasureVertex => {
    const point: WaypointCoordinates = [latlng.lat, latlng.lng]
    const toleranceM = boundMap ? metersPerPixel(latlng.lat, boundMap.getZoom()) * SNAP_TOLERANCE_PX : 0
    const target = nearestSnapTarget(snapTargets(), point, toleranceM)
    if (target) return { ...target, heightAmslM: null }
    const areas = hazardStore.visibleAreas
    const lines = areas.map((area) =>
      area.kind === 'polygon' ? [...area.coordinates, area.coordinates[0]] : area.coordinates
    )
    const onLine = nearestPointOnLines(lines, point, toleranceM)
    if (!onLine) return { coordinates: point, kind: 'point', heightAmslM: null }
    const area = areas[onLine.lineIndex]
    const label = area.sourceId === 'coastline' ? t`Shore` : area.label
    return { coordinates: onLine.coordinates, label, kind: 'hazard', heightAmslM: null }
  }

  const resolveHeight = async (vertex: MapMeasureVertex): Promise<number | null> => {
    if (vertex.kind === 'vehicle') return vehicleAltitudeAmslM()
    const waterLevelM = terrain.context().waterLevelM
    if (vertex.kind === 'waypoint' && vertex.waypointIndex !== undefined) {
      const waypoint = options.waypoints()[vertex.waypointIndex]
      if (!waypoint) return null
      const points = missionProfilePoints([waypoint], options.home())
      const ground = await sampleTerrain(
        points.map((point) => point.coordinates),
        { mode: 'bilinear' }
      )
      return pointAltitudesAmsl(points, ground, terrain.context()).at(-1) ?? null
    }
    const [ground] = await sampleTerrain([vertex.coordinates], { mode: 'bilinear' })
    if (ground === null) return null
    const surfaceM = surfaceHeight(ground, waterLevelM)
    if (vertex.kind !== 'base-station') return surfaceM
    return surfaceM + baseStation.config.baseStationAntennaHeightMeters
  }

  const updateVertices = (id: number, vertices: MapMeasureVertex[]): void => {
    measurements.value = measurements.value.map((measurement) =>
      measurement.id === id ? { ...measurement, vertices } : measurement
    )
  }

  // A point moved or deleted before its height arrives is no longer in any measurement, so the late height is dropped.
  const fillHeight = (vertex: MapMeasureVertex): void => {
    resolveHeight(vertex)
      .then((heightAmslM) => {
        if (heightAmslM === null) return
        measurements.value = measurements.value.map((measurement) =>
          measurement.vertices.includes(vertex)
            ? {
                ...measurement,
                vertices: measurement.vertices.map((current) =>
                  current === vertex ? { ...vertex, heightAmslM } : current
                ),
              }
            : measurement
        )
      })
      .catch((error) => console.warn('Could not read the height of a measured point:', error))
  }

  const removeRubberBand = (): void => {
    rubberLine?.remove()
    rubberPill?.remove()
    rubberAngle.clearVertexAngles()
    rubberLine = undefined
    rubberPill = undefined
  }

  const addPill = (group: L.LayerGroup, rank: keyof PillsByRank, pill: L.Marker): L.Marker => {
    group.addLayer(pill)
    pills[rank].push(pill)
    return pill
  }

  const pillElement = (pill: L.Marker): HTMLElement | null =>
    (pill.getElement()?.firstElementChild as HTMLElement | null | undefined) ?? null

  // Points and the readouts carrying buttons are never hidden, so a pill that would cover one of them, or a pill
  // ranked before it, is the one hidden.
  // ponytail: checks each pill against every one kept, fine for the few dozen a map holds; a grid index past that.
  const declutterPills = (shownOn: LeafletMap): void => {
    const ranked = [...pills.area, ...pills.segment]
      .map(pillElement)
      .concat(angleOverlay.tagElements(), pills.total.map(pillElement))
      .filter((element): element is HTMLElement => element !== null)
    ranked.forEach((element) => (element.style.visibility = ''))
    const dots = Array.from(vertexMarkers.values(), (marker) => marker.getElement()?.querySelector('circle'))
    const kept = [...dots, ...Array.from(shownOn.getContainer().querySelectorAll(`.${MAP_TAG_CLASS}`))]
      .filter((element): element is Element => !!element)
      .map((element) => element.getBoundingClientRect())
    const rects = ranked.map((element) => element.getBoundingClientRect())
    ranked.forEach((element, index) => {
      if (kept.some((other) => rectsOverlap(rects[index], other))) element.style.visibility = 'hidden'
      else kept.push(rects[index])
    })
  }

  const segmentLabel = (from: WaypointCoordinates, to: WaypointCoordinates): string => {
    const distance = formatDistance(calculateHaversineDistance(from, to), interfaceStore.displayUnitPreferences)
    return `${distance} · ${formatBearing(bearingBetween(from, to))}`
  }

  const distanceSummary = (vertices: MapMeasureVertex[]): string[] => {
    const stats = polylineStats(vertices)
    const preferences = interfaceStore.displayUnitPreferences
    const speedMps = options.cruiseSpeedMps()
    const total = formatDistance(stats.totalM, preferences)
    const endLabel = vertices.at(-1)?.label
    const lines = [endLabel ? `${endLabel} · ${total}` : total]
    const travel = formatTravelTime(stats.totalM, speedMps)
    const speed = formatValueWithUnit(speedMps, 'm/s', preferences)
    if (travel) lines.push(t`${travel} at ${speed}`)
    if (stats.totalSlantM !== null && stats.totalSlantM - stats.totalM >= 1) {
      const slant = formatDistance(stats.totalSlantM, preferences)
      lines.push(t`3D ${slant}`)
    }
    return lines
  }

  const renderArea = (group: L.LayerGroup, corners: WaypointCoordinates[], pinned: boolean): void => {
    group.addLayer(
      L.polygon(corners, {
        stroke: false,
        fillColor: MEASURE_SCHEME_COLORS[options.colorScheme()],
        fillOpacity: 0.12,
        interactive: false,
      })
    )
    const color = MEASURE_SCHEME_COLORS[options.colorScheme()]
    const outline = { color, weight: 2, dashArray: pinned ? undefined : '6 6', interactive: false }
    group.addLayer(measureLine([...corners, corners[0]], outline))
    if (corners.length < 3) return
    const { areaM2, perimeterM } = polygonStats(corners)
    const preferences = interfaceStore.displayUnitPreferences
    const perimeter = formatDistance(perimeterM, preferences)
    const lines = [formatArea(areaM2, preferences), t`Perimeter ${perimeter}`]
    addPill(group, 'area', measurePill(centroidLatLng(corners), lines, 'measure-angle-pill !rounded-lg'))
  }

  // On-screen direction leaving a corner away from both of its sides, the side its angle arc is not drawn on.
  const awayFromSides = (shownOn: LeafletMap, corner: WaypointCoordinates, sides: WaypointCoordinates[]): L.Point => {
    const at = shownOn.latLngToContainerPoint(corner)
    const [toPrevious, toNext] = sides.map((side) => {
      const offset = shownOn.latLngToContainerPoint(side).subtract(at)
      return offset.divideBy(Math.hypot(offset.x, offset.y) || 1)
    })
    const inward = toPrevious.add(toNext)
    // A straight corner draws its arc clockwise from the previous side, so this takes the counterclockwise one.
    if (Math.hypot(inward.x, inward.y) < 0.01) return L.point(toPrevious.y, -toPrevious.x)
    return inward.multiplyBy(-1)
  }

  const renderDistance = (group: L.LayerGroup, vertices: MapMeasureVertex[], triples: VertexAngleTriple[]): void => {
    const corners = vertices.map((vertex) => vertex.coordinates)
    group.addLayer(
      measureLine(corners, { color: MEASURE_SCHEME_COLORS[options.colorScheme()], weight: 3, interactive: false })
    )
    const { cumulativeM } = polylineStats(vertices)
    vertices.slice(1, -1).forEach((vertex, index) => {
      const total = formatDistance(cumulativeM[index + 1], interfaceStore.displayUnitPreferences)
      const lines = vertex.label ? [vertex.label, total] : [total]
      const element = pillElement(addPill(group, 'total', measurePill(vertex.coordinates, lines, 'measure-angle-pill')))
      if (!element || !boundMap) return
      const away = awayFromSides(boundMap, vertex.coordinates, [corners[index], corners[index + 2]])
      element.style.transform = outwardPillTransform(away.x, away.y, VERTEX_CLEARANCE_PX)
    })
    corners.slice(1, -1).forEach((corner, index) => triples.push([corners[index], corner, corners[index + 2]]))
  }

  // An area being drawn reads its newest corner as selected until another one of it is picked.
  const selectedCorner = (area: MapMeasurement): number | null => {
    if (selectedVertex.value?.[0] === area.id) return selectedVertex.value[1]
    return area.pinned ? null : area.vertices.length - 1
  }

  const renderMeasurement = (group: L.LayerGroup, measurement: MapMeasurement, triples: VertexAngleTriple[]): void => {
    const corners = measurement.vertices.map((vertex) => vertex.coordinates)
    if (corners.length === 0) return
    const closed = measurement.tool === 'area' && measurement.pinned
    const edges = closed ? [...corners, corners[0]] : corners
    // Areas only label the two sides of their selected corner, so a detailed outline stays readable.
    const corner = measurement.tool === 'area' ? selectedCorner(measurement) : undefined
    edges.slice(1).forEach((to, index) => {
      const from = edges[index]
      const touchesCorner = corner === undefined || corner === index || corner === (index + 1) % corners.length
      if (!touchesCorner || calculateHaversineDistance(from, to) < 1) return
      addPill(group, 'segment', measurePill(midpoint(from, to), [segmentLabel(from, to)], 'measure-angle-pill'))
    })
    if (measurement.tool === 'area') renderArea(group, corners, measurement.pinned)
    else renderDistance(group, measurement.vertices, triples)
  }

  const logFinished = (measurement: MapMeasurement): void => {
    const preferences = interfaceStore.displayUnitPreferences
    if (measurement.tool === 'area') {
      const { areaM2 } = polygonStats(measurement.vertices.map((vertex) => vertex.coordinates))
      logUserAction(`Measured an area of ${formatArea(areaM2, preferences)} on the map`)
      return
    }
    const { totalM } = polylineStats(measurement.vertices)
    const segments = measurement.vertices.length - 1
    logUserAction(`Measured ${formatDistance(totalM, preferences)} over ${segments} segments on the map`)
  }

  // A resumed ruler that is discarded goes back to how it was, instead of being lost.
  const discardDraft = (): void => {
    const restored = resumedFrom
    resumedFrom = undefined
    measurements.value = measurements.value.flatMap((measurement) => {
      if (measurement.pinned) return [measurement]
      return restored?.id === measurement.id ? [restored] : []
    })
    removeRubberBand()
  }

  const nextNumber = (of: MeasureTool): number =>
    Math.max(0, ...measurements.value.filter((measurement) => measurement.tool === of).map(({ number }) => number)) + 1

  const removeVertex = (id: number, index: number): void => {
    const measurement = measurements.value.find((current) => current.id === id)
    if (!measurement) return
    const remaining = measurement.vertices.filter((_, current) => current !== index)
    const keeps = remaining.length >= (measurement.pinned ? minimumVertices(measurement.tool) : 2)
    if (keeps) updateVertices(id, remaining)
    else measurements.value = measurements.value.filter((current) => current.id !== id)
    if (selectedVertex.value?.[0] === id && (!keeps || measurement.tool === 'area')) selectedVertex.value = null
    removeRubberBand()
    logUserAction(keeps ? 'Deleted a point of a measurement on the map' : 'Deleted a measurement from the map')
  }

  const moveVertex = (id: number, index: number, latlng: L.LatLng, settled: boolean): void => {
    const measurement = measurements.value.find((current) => current.id === id)
    if (!measurement) return
    const point: WaypointCoordinates = [latlng.lat, latlng.lng]
    const vertex: MapMeasureVertex = settled ? snap(latlng) : { coordinates: point, kind: 'point', heightAmslM: null }
    updateVertices(
      id,
      measurement.vertices.map((current, currentIndex) => (currentIndex === index ? vertex : current))
    )
    if (!settled) return
    fillHeight(vertex)
    logUserAction('Moved a point of a measurement on the map')
  }

  const pin = (): void => {
    const current = draft.value
    if (!current || current.vertices.length < minimumVertices(current.tool)) return
    measurements.value = measurements.value.map((measurement) =>
      measurement === current ? { ...measurement, pinned: true } : measurement
    )
    resumedFrom = undefined
    if (current.tool === 'distance') selectedVertex.value = [current.id, current.vertices.length - 1]
    logFinished(current)
    setTool(null)
  }

  const discardFromButton = (): void => {
    logUserAction('Discarded the measurement being taken on the map')
    setTool(null)
  }

  const closeIntoArea = (ruler: MapMeasurement, confirmed: boolean): void => {
    const current = draft.value
    if (!confirmed || current?.id !== ruler.id) {
      logUserAction('Kept the closed ruler on the map as a ruler')
      return
    }
    const area: MapMeasurement = { ...current, tool: 'area', number: nextNumber('area'), pinned: true }
    measurements.value = measurements.value.map((measurement) => (measurement === current ? area : measurement))
    resumedFrom = undefined
    logUserAction(`Turned ruler ${ruler.number} into area ${area.number} on the map`)
    setTool(null)
  }

  const offerArea = (ruler: MapMeasurement): void => {
    if (offeringArea) return
    offeringArea = true
    logUserAction('Closed a ruler on its first point on the map')
    confirmAction(
      t`Measure the enclosed area?`,
      t`Ruler ${ruler.number} ends where it started. Turn it into an area to read the area and perimeter it encloses.`,
      t`Measure the area`,
      '480px',
      t`Keep the ruler`
    )
      .then((confirmed) => closeIntoArea(ruler, confirmed))
      .catch((error) => console.error('Could not offer to close the ruler into an area:', error))
      .finally(() => (offeringArea = false))
  }

  // With the ruler tool on and nothing being taken, pressing either end of a ruler carries on from that end.
  const resumeRuler = (id: number, index: number): void => {
    const ruler = measurements.value.find((measurement) => measurement.id === id)
    if (tool.value !== 'distance' || ruler?.tool !== 'distance') return
    const fromStart = index === 0
    if (!fromStart && index !== ruler.vertices.length - 1) return
    const vertices = fromStart ? [...ruler.vertices].reverse() : ruler.vertices
    measurements.value = measurements.value.map((measurement) =>
      measurement === ruler ? { ...ruler, vertices, pinned: false } : measurement
    )
    resumedFrom = ruler
    logUserAction(`Resumed ruler ${ruler.number} on the map`)
  }

  const selectVertex = (id: number, index: number): void => {
    const measurement = measurements.value.find((current) => current.id === id)
    const [selectedId, selectedIndex] = selectedVertex.value ?? []
    if (!measurement || (selectedId === id && selectedIndex === index)) return
    selectedVertex.value = [id, index]
    const { tool: kind, number } = measurement
    logUserAction(
      kind === 'area' ? `Selected a corner of area ${number} on the map` : `Selected ruler ${number} on the map`
    )
  }

  const deselectVertex = (): void => {
    if (!selectedVertex.value) return
    selectedVertex.value = null
    logUserAction('Cleared the selected measurement on the map')
  }

  const onVertexClick = (id: number, index: number, event: L.LeafletMouseEvent): void => {
    if (clickedDelete(event)) return removeVertex(id, index)
    selectVertex(id, index)
    const current = draft.value
    if (!current) return resumeRuler(id, index)
    if (current.id !== id || current.vertices.length < minimumVertices(current.tool)) return
    if (current.tool === 'distance' && index === 0 && current.vertices.length >= 3) return offerArea(current)
    const isLast = index === current.vertices.length - 1
    const closesArea = current.tool === 'area' && index === 0
    if (isLast || closesArea) pin()
  }

  const createVertexMarker = (id: number, index: number, at: WaypointCoordinates): L.Marker =>
    showDeleteOnHover(
      L.marker(at, { icon: vertexIcon(options.colorScheme()), draggable: true, keyboard: false, pane: VERTEX_PANE })
    )
      .on('dragstart', () => {
        removeRubberBand()
        selectVertex(id, index)
      })
      .on('drag', (event) => moveVertex(id, index, (event.target as L.Marker).getLatLng(), false))
      .on('dragend', (event) => moveVertex(id, index, (event.target as L.Marker).getLatLng(), true))
      .on('click', (event) => onVertexClick(id, index, event as L.LeafletMouseEvent))

  // Markers are kept across renders and only moved, so the one being dragged is never rebuilt under the pointer.
  const syncVertexMarkers = (): void => {
    const shownOn = boundMap
    if (!shownOn) return
    const wanted = new Set<string>()
    const startsRuler = tool.value === 'distance' && !draft.value
    measurements.value.forEach((measurement) => {
      measurement.vertices.forEach((vertex, index) => {
        const key = `${measurement.id}:${index}`
        wanted.add(key)
        let marker = vertexMarkers.get(key)
        if (!marker) {
          marker = createVertexMarker(measurement.id, index, vertex.coordinates).addTo(shownOn)
          vertexMarkers.set(key, marker)
        } else if (!marker.getLatLng().equals(vertex.coordinates)) {
          marker.setLatLng(vertex.coordinates)
          setDeleteShown(marker, false)
        }
        const atEnd = index === 0 || index === measurement.vertices.length - 1
        const resumes = startsRuler && measurement.tool === 'distance' && atEnd
        const element = marker.getElement()
        element?.classList.toggle(CROSSHAIR_CLASS, resumes)
        element?.querySelector('circle')?.setAttribute('fill', MEASURE_SCHEME_COLORS[options.colorScheme()])
      })
    })
    vertexMarkers.forEach((marker, key) => {
      if (wanted.has(key)) return
      marker.remove()
      vertexMarkers.delete(key)
    })
  }

  const createActionsMarker = (at: WaypointCoordinates): L.Marker => {
    const element = document.createElement('div')
    element.className = 'flex w-max translate-x-[22px] -translate-y-1/2 gap-1'
    confirmButton = actionButton('mdi-check', t`Keep the measurement on the map`, pin)
    element.append(confirmButton, actionButton('mdi-close', t`Discard the measurement`, discardFromButton))
    L.DomEvent.disableClickPropagation(element)
    const icon = L.divIcon({ html: element, className: HANDLE_CLASS, iconSize: [0, 0], iconAnchor: [0, 0] })
    return L.marker(at, { icon, keyboard: false, pane: HANDLE_PANE })
  }

  const toggleProfile = (id: number): void => {
    const opening = profiledId.value !== id
    profiledId.value = opening ? id : null
    logUserAction(`${opening ? 'Opened' : 'Closed'} the terrain profile of a ruler on the map`)
  }

  const closeProfile = (): void => {
    if (profiledId.value === null) return
    profiledId.value = null
    logUserAction('Closed the terrain profile of a ruler on the map')
  }

  const createSummaryTag = (id: number): SummaryTag => {
    const lines = document.createElement('div')
    const draftActions = document.createElement('div')
    draftActions.className = 'flex gap-1'
    draftActions.append(
      actionButton('mdi-check', t`Keep the measurement on the map`, pin, TAG_BUTTON_CLASS),
      actionButton('mdi-close', t`Discard the measurement`, discardFromButton, TAG_BUTTON_CLASS)
    )
    const buttons = document.createElement('div')
    buttons.className = 'flex gap-1'
    const terrainLabel = t`Show the terrain along the ruler`
    buttons.append(
      draftActions,
      actionButton('mdi-image-filter-hdr', terrainLabel, () => toggleProfile(id), TAG_BUTTON_CLASS)
    )
    const content = document.createElement('div')
    content.className = 'flex items-end gap-x-3'
    content.append(lines, buttons)
    L.DomEvent.disableClickPropagation(content)
    const className = `vehicle-tooltip ${HANDLE_CLASS} ${MAP_TAG_CLASS}`
    const tooltip = L.tooltip({ className, pane: HANDLE_PANE, direction: 'right', offset: TAG_OFFSETS.right })
    tooltip.setContent(content)
    return { tooltip, lines, draftActions, coveredSince: null, glideEndsAt: 0 }
  }

  const setTagPlacement = (tooltip: L.Tooltip, direction: TagPlacement): void => {
    tooltip.options.direction = direction
    tooltip.options.offset = TAG_OFFSETS[direction]
    tooltip.update()
  }

  const tagObstacles = (
    shownOn: LeafletMap,
    element: HTMLElement,
    last: WaypointCoordinates,
    withLiveLine: boolean
  ): TagObstacles => {
    const container = shownOn.getContainer()
    const origin = container.getBoundingClientRect()
    const onPage = (at: L.LatLngExpression): L.Point =>
      shownOn.latLngToContainerPoint(at).add([origin.left, origin.top])
    const boxes: ScreenBox[] = Array.from(container.querySelectorAll(`.${MAP_TAG_CLASS}, .measure-angle-pill`))
      .filter((other) => other !== element)
      .map((other) => other.getBoundingClientRect())
    vertexMarkers.forEach((marker) => {
      const dot = marker.getElement()?.querySelector('circle')
      if (dot) boxes.push(dot.getBoundingClientRect())
    })
    const at = onPage(last)
    const { left, top, right, bottom } = DELETE_BUTTON_BOX
    boxes.push({ left: at.x + left, top: at.y + top, right: at.x + right, bottom: at.y + bottom })
    const lines: L.LatLngExpression[][] = measurements.value.map(({ tool: kind, vertices }) => {
      const corners = vertices.map((vertex) => vertex.coordinates)
      return kind === 'area' ? [...corners, corners[0]] : corners
    })
    if (withLiveLine && rubberLine) lines.push(rubberLine.getLatLngs() as L.LatLng[])
    const sides = lines.flatMap((line) =>
      line.slice(1).map((to, index): [ScreenPoint, ScreenPoint] => [onPage(line[index]), onPage(to)])
    )
    return { boxes, sides }
  }

  // Opens on the side the last segment does not come from, then below, above or opposite, and only leaves the side
  // it is on for one covering strictly less.
  const bestPlacement = (
    shownOn: LeafletMap,
    tag: SummaryTag,
    [before, last]: WaypointCoordinates[],
    covered: () => number
  ): TagPlacement => {
    const current = tag.tooltip.options.direction as TagPlacement
    const leftward = shownOn.latLngToContainerPoint(before).x > shownOn.latLngToContainerPoint(last).x
    const placements: TagPlacement[] = leftward
      ? ['left', 'bottom', 'top', 'right']
      : ['right', 'bottom', 'top', 'left']
    let [best, fewest] = [current, covered()]
    for (const direction of placements.filter((placement) => placement !== current)) {
      if (fewest === 0) break
      setTagPlacement(tag.tooltip, direction)
      const count = covered()
      if (count < fewest) [best, fewest] = [direction, count]
    }
    return best
  }

  // Leaflet places a readout with a transform, so it goes back to its old side and is laid out there before the
  // glide is switched on, which is what gives the transition somewhere to start from.
  const glideSummaryTag = (tag: SummaryTag, element: HTMLElement, from: TagPlacement, to: TagPlacement): void => {
    setTagPlacement(tag.tooltip, from)
    element.getBoundingClientRect()
    element.classList.add(TAG_GLIDE_CLASS)
    element.addEventListener('transitionend', () => element.classList.remove(TAG_GLIDE_CLASS), { once: true })
    setTagPlacement(tag.tooltip, to)
    tag.glideEndsAt = performance.now() + TAG_GLIDE_MS
  }

  // A readout stays where it is while that is clear. Followed as the line being drawn moves, it waits for that line
  // to keep covering it and glides to its new side, instead of jumping every time the line sweeps past.
  const settleSummaryTag = (shownOn: LeafletMap, tag: SummaryTag, ruler: MapMeasurement, followsLine = false): void => {
    const element = tag.tooltip.getElement()
    const ends = ruler.vertices.slice(-2).map((vertex) => vertex.coordinates)
    const now = performance.now()
    if (!element || ends.length < 2 || (followsLine && now < tag.glideEndsAt)) return
    element.classList.remove(TAG_GLIDE_CLASS)
    const { boxes, sides } = tagObstacles(shownOn, element, ends[1], followsLine)
    const covered = (): number => {
      const rect = element.getBoundingClientRect()
      const boxesHit = boxes.filter((box) => rectsOverlap(rect, box)).length
      return boxesHit + sides.filter(([from, to]) => segmentCrossesBox(from, to, rect)).length
    }
    if (covered() === 0) {
      tag.coveredSince = null
      return
    }
    tag.coveredSince ??= now
    if (followsLine && now - tag.coveredSince < TAG_HOLD_MS) return
    tag.coveredSince = null
    const from = tag.tooltip.options.direction as TagPlacement
    const to = bestPlacement(shownOn, tag, ends, covered)
    if (to === from) setTagPlacement(tag.tooltip, from)
    else if (followsLine) glideSummaryTag(tag, element, from, to)
    else setTagPlacement(tag.tooltip, to)
  }

  const isReachingFor = (shownOn: LeafletMap, tag: SummaryTag, pointer: L.Point): boolean => {
    const rect = tag.tooltip.getElement()?.getBoundingClientRect()
    if (!rect) return false
    const origin = shownOn.getContainer().getBoundingClientRect()
    const [x, y] = [pointer.x + origin.left, pointer.y + origin.top]
    const withinX = x > rect.left - TAG_REACH_PX && x < rect.right + TAG_REACH_PX
    return withinX && y > rect.top - TAG_REACH_PX && y < rect.bottom + TAG_REACH_PX
  }

  const settleDraftTag = (shownOn: LeafletMap, pointer: L.Point): void => {
    const current = draft.value
    const tag = current && summaryTags.get(current.id)
    if (current && tag && !isReachingFor(shownOn, tag, pointer)) settleSummaryTag(shownOn, tag, current, true)
  }

  const placeSummaryTag = (shownOn: LeafletMap, tag: SummaryTag, ruler: MapMeasurement): void => {
    const last = ruler.vertices.at(-1)!.coordinates
    const title = document.createElement('p')
    title.className = 'font-semibold'
    title.textContent = t`Ruler ${ruler.number}`
    tag.lines.replaceChildren(
      title,
      ...distanceSummary(ruler.vertices).map((line) => {
        const paragraph = document.createElement('p')
        paragraph.textContent = line
        return paragraph
      })
    )
    tag.draftActions.style.display = ruler.pinned ? 'none' : ''
    tag.tooltip.getElement()?.classList.remove(TAG_GLIDE_CLASS)
    tag.tooltip.setLatLng(last)
    if (!shownOn.hasLayer(tag.tooltip)) tag.tooltip.addTo(shownOn)
    settleSummaryTag(shownOn, tag, ruler)
  }

  // Readouts are kept across renders and only refreshed, so their buttons are never rebuilt under the pointer.
  const syncSummaryTags = (): void => {
    const shownOn = boundMap
    if (!shownOn) return
    const rulers = measurements.value.filter(
      ({ id, tool: kind, vertices, pinned }) =>
        kind === 'distance' && vertices.length > 1 && (!pinned || selectedVertex.value?.[0] === id)
    )
    const wanted = new Set(rulers.map((ruler) => ruler.id))
    summaryTags.forEach(({ tooltip }, id) => {
      if (wanted.has(id)) return
      tooltip.remove()
      summaryTags.delete(id)
    })
    rulers.forEach((ruler) => {
      const tag = summaryTags.get(ruler.id) ?? createSummaryTag(ruler.id)
      summaryTags.set(ruler.id, tag)
      placeSummaryTag(shownOn, tag, ruler)
    })
  }

  // A ruler being taken carries its confirm and discard buttons in its readout once it has one.
  const syncActions = (): void => {
    const current = draft.value
    const last = current?.vertices.at(-1)
    if (!boundMap || !current || !last || summaryTags.has(current.id)) {
      actionsMarker?.remove()
      return
    }
    actionsMarker ??= createActionsMarker(last.coordinates)
    actionsMarker.setLatLng(last.coordinates)
    if (confirmButton) {
      confirmButton.style.display = current.vertices.length < minimumVertices(current.tool) ? 'none' : ''
    }
    if (!boundMap.hasLayer(actionsMarker)) actionsMarker.addTo(boundMap)
  }

  const render = (): void => {
    if (!layers || !boundMap) return
    layers.clearLayers()
    pills = { area: [], segment: [], total: [] }
    const triples: VertexAngleTriple[] = []
    measurements.value.forEach((measurement) => renderMeasurement(layers!, measurement, triples))
    angleOverlay.renderVertexAngles(triples)
    syncVertexMarkers()
    syncSummaryTags()
    syncActions()
    declutterPills(boundMap)
  }

  const renderRubberBand = (cursor: L.LatLng): void => {
    const placed = draft.value?.vertices ?? []
    const last = placed.at(-1)
    const previous = placed.at(-2)
    if (!boundMap || !last) return removeRubberBand()
    const cursorPx = boundMap.latLngToContainerPoint(cursor)
    if (cursorPx.distanceTo(boundMap.latLngToContainerPoint(last.coordinates)) < SNAP_TOLERANCE_PX) {
      return removeRubberBand()
    }
    const to: WaypointCoordinates = [cursor.lat, cursor.lng]
    const label = segmentLabel(last.coordinates, to)
    if (previous) rubberAngle.renderVertexAngle(previous.coordinates, last.coordinates, to)
    if (!rubberLine || !rubberPill) {
      rubberLine = measureLine([last.coordinates, to], {
        color: MEASURE_SCHEME_COLORS[options.colorScheme()],
        weight: 2,
        dashArray: '10 10',
        interactive: false,
      }).addTo(boundMap)
      rubberPill = measurePill(midpoint(last.coordinates, to), [label], 'measure-angle-pill').addTo(boundMap)
    } else {
      rubberLine.setLatLngs([last.coordinates, to])
      rubberPill.setLatLng(midpoint(last.coordinates, to))
      const pill = rubberPill.getElement()?.querySelector('.measure-angle-pill')
      if (pill) pill.textContent = label
    }
    settleDraftTag(boundMap, cursorPx)
  }

  const clear = (): void => {
    measurements.value = []
    profiledId.value = null
    selectedVertex.value = null
    removeRubberBand()
  }

  const pixelsBetween = (from: WaypointCoordinates, to: WaypointCoordinates): number => {
    if (!boundMap) return Infinity
    return boundMap.latLngToContainerPoint(from).distanceTo(boundMap.latLngToContainerPoint(to))
  }

  const placePoint = (latlng: L.LatLng): void => {
    const measuring = tool.value
    if (!boundMap || !measuring) return
    const point: WaypointCoordinates = [latlng.lat, latlng.lng]
    const current = draft.value
    const placed = current?.vertices ?? []
    const last = placed.at(-1)
    if (last && placed.length >= 2 && pixelsBetween(last.coordinates, point) <= SNAP_TOLERANCE_PX) return pin()
    const closesPath = placed.length >= 3 && pixelsBetween(placed[0].coordinates, point) <= SNAP_TOLERANCE_PX
    if (closesPath && current) return measuring === 'area' ? pin() : offerArea(current)
    const vertex = snap(latlng)
    if (current) updateVertices(current.id, [...placed, vertex])
    else {
      const started = {
        id: nextId++,
        tool: measuring,
        number: nextNumber(measuring),
        vertices: [vertex],
        pinned: false,
      }
      measurements.value = [...measurements.value, started]
    }
    fillHeight(vertex)
  }

  // Taken in the capture phase, so a point placed on a marker measures to it instead of selecting it, while presses
  // on the buttons and panels the map hosts, and on the measurement's own handles, keep reaching them.
  const onPointerDown = (event: PointerEvent): void => {
    pressedAt = L.point(event.clientX, event.clientY)
  }

  const onClick = (event: MouseEvent): void => {
    if (!boundMap || !isOnMap(boundMap, event) || isOverHandle(event.target)) return
    const travelled = pressedAt?.distanceTo(L.point(event.clientX, event.clientY)) ?? 0
    if (travelled > CLICK_SLOP_PX) return
    event.stopPropagation()
    placePoint(boundMap.mouseEventToLatLng(event))
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') return
    if (isOverHandle(event.target)) return removeRubberBand()
    if (pointerFrame !== null) return
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = null
      if (boundMap) renderRubberBand(boundMap.mouseEventToLatLng(event))
    })
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement | null
    if (offeringArea) return
    if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return
    const container = boundMap?.getContainer()
    if (!container || getComputedStyle(container).visibility !== 'visible') return
    const current = draft.value
    if (event.key === 'Escape') {
      if (!current) return setTool(null)
      discardDraft()
      logUserAction('Discarded the measurement being taken on the map')
    } else if (event.key === 'Enter') {
      pin()
    } else if (event.key === 'Backspace' && current) {
      removeVertex(current.id, current.vertices.length - 1)
    }
  }

  const unbindInput = (): void => {
    const container = boundMap?.getContainer()
    container?.removeEventListener('pointerdown', onPointerDown, true)
    container?.removeEventListener('click', onClick, true)
    container?.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('keydown', onKeyDown)
    container?.classList.remove(CROSSHAIR_CLASS)
    if (pointerFrame !== null) cancelAnimationFrame(pointerFrame)
    pointerFrame = null
  }

  const bindInput = (): void => {
    const container = boundMap?.getContainer()
    container?.addEventListener('pointerdown', onPointerDown, true)
    container?.addEventListener('click', onClick, true)
    container?.addEventListener('pointermove', onPointerMove)
    window.addEventListener('keydown', onKeyDown)
    container?.classList.add(CROSSHAIR_CLASS)
  }

  const setTool = (next: MeasureTool | null): void => {
    if (next === tool.value) return
    unbindInput()
    discardDraft()
    tool.value = next
    if (next) bindInput()
    if (next === 'distance') logUserAction('Started measuring distances on the map')
    else if (next === 'area') logUserAction('Started measuring an area on the map')
    else logUserAction('Stopped measuring on the map')
  }

  const unbindMap = (): void => {
    unbindInput()
    removeRubberBand()
    layers?.remove()
    layers = undefined
    vertexMarkers.forEach((marker) => marker.remove())
    vertexMarkers.clear()
    summaryTags.forEach(({ tooltip }) => tooltip.remove())
    summaryTags.clear()
    actionsMarker?.remove()
    actionsMarker = undefined
    confirmButton = undefined
    angleOverlay.destroyAngleOverlay()
    rubberAngle.destroyAngleOverlay()
    boundMap?.off('click', deselectVertex)
    boundMap?.off('zoomend', render)
    boundMap = undefined
  }

  const bindMap = (next: LeafletMap): void => {
    boundMap = next
    ensureMeasurePane(next)
    // Points sit over the waypoint numbers (650) and under every readout, so a pill beside one is never covered.
    if (!next.getPane(VERTEX_PANE)) next.createPane(VERTEX_PANE).style.zIndex = '652'
    if (!next.getPane(HANDLE_PANE)) next.createPane(HANDLE_PANE).style.zIndex = '665'
    layers = L.layerGroup().addTo(next)
    angleOverlay.initAngleOverlay(next)
    rubberAngle.initAngleOverlay(next)
    // Presses that place a point stop before reaching this, so it only fires on a click that measured nothing.
    next.on('click', deselectVertex)
    // Arcs and pills are sized and kept apart on screen, so a zoom lays them out again.
    next.on('zoomend', render)
    if (tool.value) bindInput()
    render()
  }

  watch(
    [map, mapReady],
    ([current, ready]) => {
      if (current === boundMap && ready) return
      unbindMap()
      if (current && ready) bindMap(current)
    },
    { immediate: true }
  )
  watch([measurements, selectedVertex, tool, () => interfaceStore.displayUnitPreferences], render)
  // Angle arcs and the line to the pointer are recycled rather than restyled, so a new color rebuilds them.
  watch(options.colorScheme, () => {
    angleOverlay.clearVertexAngles()
    removeRubberBand()
    render()
  })
  watch(options.isBlocked, (blocked) => blocked && setTool(null))
  // A point snapped to the vehicle goes where it goes, so a measurement from it reads live.
  watchThrottled(
    options.vehiclePosition,
    (position) => {
      const followsVehicle = (vertex: MapMeasureVertex): boolean => vertex.kind === 'vehicle'
      if (!position || !measurements.value.some((measurement) => measurement.vertices.some(followsVehicle))) return
      const heightAmslM = vehicleAltitudeAmslM()
      measurements.value = measurements.value.map((measurement) => ({
        ...measurement,
        vertices: measurement.vertices.map((vertex) =>
          followsVehicle(vertex) ? { ...vertex, coordinates: position, heightAmslM } : vertex
        ),
      }))
    },
    { throttle: 500 }
  )

  onBeforeUnmount(unbindMap)

  return { tool, measurements, profiled, hasMeasurement, setTool, clear, closeProfile }
}
