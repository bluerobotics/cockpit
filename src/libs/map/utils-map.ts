import * as turf from '@turf/turf'
import type { Feature, Point, Polygon, Position } from 'geojson'
import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl'

import {
  fitMapBounds,
  fromLngLat,
  fromMapLibreZoom,
  projectToContainer,
  removeLayersAndSource,
  setLineLayer,
  setMapView,
  slottedLayerId,
  toLngLatBounds,
  unprojectFromContainer,
} from '@/libs/map/maplibre'
import type { ScreenPoint } from '@/libs/map/survey-polygon-edges'
import {
  bearingBetween,
  calculateHaversineDistance,
  deltaBearing,
  earthRadiusMeters,
} from '@/libs/mission/general-estimates'
import type { SurveyPath, WaypointCoordinates } from '@/types/mission'

/**
 * Default target follower update interval in milliseconds.
 * @constant {number}
 */
const defaultUpdateIntervalMs = 500

// Minimum distance, in pixels, the user must drag the map before tracking stops, so small or accidental drags don't disable following.
const defaultUnfollowDragThresholdPx = 150

/**
 * Whether a map reference already holds a usable map instance, which it may not while the owning component is still
 * mounting. Owners only publish the instance once its style has loaded, so holding one means layers can be added.
 * @param {MapLibreMap | undefined} instance - The map reference to check.
 * @returns {boolean} True when the instance exists and has not been removed.
 */
export const isMapReady = (instance: MapLibreMap | undefined): instance is MapLibreMap =>
  !!instance && typeof instance.getContainer === 'function' && !!instance.getContainer()

// Mean earth radius the map has always measured with, kept so every distance it shows stays the same.
const meanEarthRadiusMeters = 6371000

/**
 * Great-circle distance between two coordinates.
 * @param {WaypointCoordinates} from - The first coordinate pair ([latitude, longitude]).
 * @param {WaypointCoordinates} to - The second coordinate pair ([latitude, longitude]).
 * @returns {number} The distance between the two coordinates, in meters.
 */
export const distanceInMeters = (from: WaypointCoordinates, to: WaypointCoordinates): number =>
  calculateHaversineDistance(from, to) * (meanEarthRadiusMeters / earthRadiusMeters)

/**
 * Ground distance covered by one screen pixel on a Web Mercator map.
 * @param {number} latitude - Latitude of the point, in decimal degrees.
 * @param {number} zoom - Map zoom level.
 * @returns {number} The ground distance of one pixel, in meters.
 */
export const metersPerPixel = (latitude: number, zoom: number): number =>
  (40075016.686 * Math.cos((latitude * Math.PI) / 180)) / Math.pow(2, zoom + 8)

/**
 * A pointer position expressed both in a map container's pixel space and as a geographic coordinate.
 */
export type MapPointerPosition = {
  /**
   * Position relative to the map container's top-left corner, in pixels.
   */
  containerPoint: ScreenPoint
  /**
   * Geographic coordinate under that position.
   */
  latlng: WaypointCoordinates
}

/**
 * Resolves a viewport-space (client) pixel position against a map, which is what a pointer position
 * cached outside a map mouse handler needs before it can be treated as a coordinate.
 * @param {MapLibreMap} map - Map whose container the client position is measured against.
 * @param {number} clientX - Viewport-space horizontal position, in pixels.
 * @param {number} clientY - Viewport-space vertical position, in pixels.
 * @returns {MapPointerPosition} The position in container space and the coordinate under it.
 */
export const mapPointerPositionFromClient = (
  map: MapLibreMap,
  clientX: number,
  clientY: number
): MapPointerPosition => {
  const rect = map.getContainer().getBoundingClientRect()
  const containerPoint = { x: clientX - rect.left, y: clientY - rect.top }
  return { containerPoint, latlng: unprojectFromContainer(map, [containerPoint.x, containerPoint.y]) }
}

/**
 * Enum for the different types of targets that can be followed.
 * @enum {string}
 */
export enum WhoToFollow {
  HOME = 'Home',
  VEHICLE = 'Vehicle',
  BASE_STATION = 'BaseStation',
}

/**
 * Class responsible for following a target in a given map.
 * @class
 */
export class TargetFollower {
  /**
   * Sets current center for the map coupled to this follower.
   * @type {(center: WaypointCoordinates) => void}
   */
  private onCenterChange: (newCenter: WaypointCoordinates) => void

  /**
   * Sets current target to the component observing this follower.
   */
  private onTargetChange: (newTarget: string | undefined) => void

  /**
   * Current target ref to follow. A well-known {@link WhoToFollow} value or any registered target id.
   * @type {string | undefined}
   */
  private target: string | undefined

  /**
   * Targets available to be followed
   * @type {Record<string, () => WaypointCoordinates | undefined>}
   */
  private trackables: Record<string, () => WaypointCoordinates | undefined> = {}

  /**
   * Update interval task
   * @type {ReturnType<typeof setInterval> | undefined}
   */
  private updateInterval: ReturnType<typeof setInterval> | undefined

  // Whether the user is currently dragging the map, used to pause re-centering so the periodic update doesn't fight the drag.
  private isUserDragging = false
  // Box-zoom press pause, separate from map drag so clearing it cannot un-pause a pan already in progress.
  private isBoxPress = false

  /**
   * Constructor for the TargetFollower class.
   * @param {(newTarget: string | undefined) => void} onTargetChange - Sets current target to the component observing this follower.
   * @param {(newCenter: WaypointCoordinates) => void} onCenterChange - Sets current center for the map coupled to this follower.
   */
  constructor(
    onTargetChange: (newTarget: string | undefined) => void,
    onCenterChange: (newCenter: WaypointCoordinates) => void
  ) {
    this.onTargetChange = onTargetChange
    this.onCenterChange = onCenterChange
  }

  /**
   * Sets coupled map center to a given target.
   * @param {string | undefined} target - The target to follow (a {@link WhoToFollow} value or a registered target id).
   * @returns {void}
   */
  private setCenter(target: string | undefined): void {
    if (!target) return

    const updateOnValid = (newCenter: WaypointCoordinates | undefined): void => {
      if (newCenter) {
        this.onCenterChange(newCenter)
      }
    }

    updateOnValid(this.trackables[target]?.())
  }

  /**
   * Stops to follow current target and goes to a given target.
   * @param {string} target - The target to follow (a {@link WhoToFollow} value or a registered target id).
   * @param {boolean} toggleSameTarget - If should stop following current selected
   * target if the same target is selected again.
   * @returns {void}
   */
  public goToTarget(target: string, toggleSameTarget = false): void {
    // Saves a copy of target because unFollow will set it to undefined
    const oldTarget = this.target
    this.unFollow()

    if (toggleSameTarget && target === oldTarget) {
      return
    }

    this.setCenter(target)
  }

  /**
   * Sets a source of data for a given target to follow.
   * @param {string} target - The target that will receive this data (a {@link WhoToFollow} value or a target id)
   * @param {() => WaypointCoordinates | undefined} compute - The function to compute the target data
   * coordinates.
   * @returns {void}
   */
  public setTrackableTarget(target: string, compute: () => WaypointCoordinates | undefined): void {
    this.trackables[target] = compute
  }

  /**
   * Update current map center ref based on the target to follow.
   * @returns {void}
   */
  public update(): void {
    if (this.isUserDragging || this.isBoxPress) return
    this.setCenter(this.target)
  }

  /**
   * Pause or resume the periodic re-center while a box-zoom press owns the map.
   * @param {boolean} active Whether a box-zoom press currently owns the map.
   * @returns {void}
   */
  public setBoxPress(active: boolean): void {
    this.isBoxPress = active
  }

  /**
   * Enable auto update for the current target ref, don't forget to disable auto update
   * prior to object destruction or it can lead to intervals running forever.
   * @returns {void}
   */
  public enableAutoUpdate(): void {
    clearInterval(this.updateInterval)
    this.updateInterval = setInterval(() => this.update(), defaultUpdateIntervalMs)
  }

  /**
   * Disable auto update for the current target ref.
   * @returns {void}
   */
  public disableAutoUpdate(): void {
    clearInterval(this.updateInterval)
  }

  /**
   * Set the current target ref to follow.
   * @param {string} target - The target to follow (a {@link WhoToFollow} value or a registered target id).
   * @param {boolean} navigateNow - If should navigate to the target now.
   * @returns {void}
   */
  public follow(target: string, navigateNow = true): void {
    this.target = target
    this.onTargetChange(this.target)

    if (navigateNow) {
      this.setCenter(target)
    }
  }

  /**
   * Unset the current target ref to follow.
   * @returns {void}
   */
  public unFollow(): void {
    this.target = undefined
    this.onTargetChange(this.target)
  }

  /**
   * Stops following once the user pans the map past a pixel threshold. Map drag events
   * fire only for real user gestures, never for the follower's own panning, so there is no
   * feedback loop.
   * @param {MapLibreMap} map - The map whose user drags should break the follow.
   * @param {number} thresholdPixels - Minimum drag distance, in pixels, that stops following.
   * @returns {() => void} Disposer that removes the drag listeners; call it on teardown.
   */
  public unFollowOnUserDrag(map: MapLibreMap, thresholdPixels = defaultUnfollowDragThresholdPx): () => void {
    let dragStartCenter: WaypointCoordinates | undefined

    const onDragStart = (): void => {
      this.isUserDragging = true
      dragStartCenter = this.target ? fromLngLat(map.getCenter()) : undefined
    }

    const onDragEnd = (): void => {
      this.isUserDragging = false
      if (!dragStartCenter || !this.target) return
      const startPx = projectToContainer(map, dragStartCenter)
      const endPx = projectToContainer(map, fromLngLat(map.getCenter()))
      const draggedPixels = Math.hypot(endPx.x - startPx.x, endPx.y - startPx.y)
      dragStartCenter = undefined
      if (draggedPixels >= thresholdPixels) {
        this.unFollow()
      }
    }

    map.on('dragstart', onDragStart)
    map.on('dragend', onDragEnd)

    return () => {
      map.off('dragstart', onDragStart)
      map.off('dragend', onDragEnd)
    }
  }

  /**
   * Returns the current target ref to follow.
   * @returns {string | undefined} The current target ref to follow.
   */
  public getCurrentTarget(): string | undefined {
    return this.target
  }

  /**
   * Current follow-target coordinates, if a target is set and has a fix.
   * @returns {WaypointCoordinates | undefined} Lat/lng of the followed target.
   */
  public currentCoordinates(): WaypointCoordinates | undefined {
    if (!this.target) return undefined
    return this.trackables[this.target]?.()
  }
}

/**
 * Whether a lat/lng tuple has two finite numbers.
 * @param {WaypointCoordinates | undefined} pos Candidate coordinate
 * @returns {pos is WaypointCoordinates} True when both components are finite
 */
export const isFiniteLatLng = (pos: WaypointCoordinates | undefined): pos is WaypointCoordinates =>
  Array.isArray(pos) && Number.isFinite(pos[0]) && Number.isFinite(pos[1])

// Double-click zoom has no option to zoom about the center, so following maps swap it for this handler.
const centeredDoubleClickZoom = new WeakMap<MapLibreMap, (event: MapMouseEvent) => void>()

/**
 * Make the map's built-in handlers zoom about the view center while following.
 * Unfollowed maps keep zoom-around-cursor.
 * @param {MapLibreMap} map The map
 * @param {boolean} following Whether a follow target is locked
 * @returns {void}
 */
export const applyFollowZoomMode = (map: MapLibreMap, following: boolean): void => {
  const around = following ? { around: 'center' as const } : undefined
  // The handlers only take the option while being enabled, and ignore enabling once they are on.
  map.scrollZoom.disable()
  map.scrollZoom.enable(around)
  map.touchZoomRotate.disable()
  map.touchZoomRotate.enable(around)

  const existing = centeredDoubleClickZoom.get(map)
  if (following && !existing) {
    const zoomAboutCenter = (event: MapMouseEvent): void => {
      event.preventDefault()
      map.easeTo({ zoom: map.getZoom() + 1, duration: 300 })
    }
    centeredDoubleClickZoom.set(map, zoomAboutCenter)
    map.doubleClickZoom.disable()
    map.on('dblclick', zoomAboutCenter)
  } else if (!following && existing) {
    centeredDoubleClickZoom.delete(map)
    map.off('dblclick', existing)
    map.doubleClickZoom.enable()
  }
}

/**
 * Keep the follow target under the view when zoom changes, otherwise apply a plain zoom.
 * @param {MapLibreMap} map The map
 * @param {number} zoom Target zoom, on the tile scale
 * @param {WaypointCoordinates | undefined} pos Follow coordinate, if any
 * @returns {void}
 */
export const recenterMapOnFollowTarget = (
  map: MapLibreMap,
  zoom: number,
  pos: WaypointCoordinates | undefined
): void => {
  // A zoom the map reported itself is already applied, and writing it back would round a fractional zoom mid-scroll.
  const newZoom = fromMapLibreZoom(map.getZoom()) === zoom ? undefined : zoom
  if (isFiniteLatLng(pos)) {
    setMapView(map, pos, newZoom)
    return
  }
  if (newZoom !== undefined) setMapView(map, fromLngLat(map.getCenter()), newZoom)
}

/**
 * Adjusts the given map view so that all the provided waypoint coordinates
 * are visible at once. Coordinates with invalid lat/lng values are ignored.
 * @param {MapLibreMap} map - Map instance to adjust.
 * @param {WaypointCoordinates[]} coordinates - List of `[latitude, longitude]` tuples to fit.
 * @returns {boolean} `true` if the map view was adjusted, `false` if there were no valid
 *   coordinates to fit.
 */
export const fitMapToWaypoints = (map: MapLibreMap, coordinates: WaypointCoordinates[]): boolean => {
  const validCoordinates = coordinates.filter(isFiniteLatLng)
  if (validCoordinates.length === 0) return false

  fitMapBounds(map, toLngLatBounds(validCoordinates), { padding: 20, maxZoom: 22, animate: true })
  return true
}

/**
 * Persist the live map view into the shared last-position store.
 * Prefer the map instance when present so a leave mid-gesture still records the real center/zoom.
 * @param { (zoom: number, center: WaypointCoordinates) => void } save Writer for the shared last-view keys.
 * @param { MapLibreMap | undefined } map Live map, when still mounted.
 * @param { number } zoom Fallback zoom from the local ref.
 * @param { WaypointCoordinates } center Fallback center from the local ref.
 * @returns { void }
 */
export const persistLiveMapView = (
  save: (zoom: number, center: WaypointCoordinates) => void,
  map: MapLibreMap | undefined,
  zoom: number,
  center: WaypointCoordinates
): void => {
  if (map) {
    save(fromMapLibreZoom(map.getZoom()), fromLngLat(map.getCenter()))
    return
  }
  save(zoom, center)
}

/**
 * Generates a survey path based on the given polygon and parameters.
 * @param {WaypointCoordinates[]} polygonPoints - The points of the polygon.
 * @param {number} distanceBetweenLines - The distance between survey lines in meters.
 * @param {number} linesAngle - The angle of the survey lines in degrees.
 * @param {number} turnaroundDistance - Distance in meters to extend (positive) or inset (negative) from the polygon
 *   boundary before turning. Positive values make the vehicle fly past the edges; negative values keep it away.
 * @param {boolean} crosshatch - When true, appends a second pass rotated 90 degrees to form a crosshatch grid.
 * @param {number} crosshatchDistanceBetweenLines - Distance between lines for the crosshatch second pass, in
 *   meters. Falls back to `distanceBetweenLines` when unset.
 * @param {boolean} startReversed - When true, each transect starts from the opposite end (flips the line
 *   direction), moving the entry along the first line to the adjacent corner.
 * @param {boolean} reverseSweep - When true, the sweep runs from the far side of the area first, moving the
 *   entry to the opposite side. Combined with `startReversed` this reaches all four survey corners.
 * @returns {SurveyPath} The generated survey path and turnaround segments.
 */
export const generateSurveyPath = (
  polygonPoints: WaypointCoordinates[],
  distanceBetweenLines: number,
  linesAngle: number,
  turnaroundDistance = 0,
  crosshatch = false,
  crosshatchDistanceBetweenLines?: number,
  startReversed = false,
  reverseSweep = false
): SurveyPath => {
  if (polygonPoints.length < 4) return { path: [], turnaroundSegments: [] }

  const polygonCoords = polygonPoints.map(([lat, lng]) => [lng, lat])
  if (
    polygonCoords[0][0] !== polygonCoords[polygonCoords.length - 1][0] ||
    polygonCoords[0][1] !== polygonCoords[polygonCoords.length - 1][1]
  ) {
    polygonCoords.push(polygonCoords[0])
  }

  try {
    const poly = turf.polygon([polygonCoords])
    const bbox = turf.bbox(poly)
    const [minX, minY, maxX, maxY] = bbox
    const diagonal = Math.sqrt(Math.pow(maxX - minX, 2) + Math.pow(maxY - minY, 2))

    const adjustedAngle = linesAngle + 90
    const angleRad = (adjustedAngle * Math.PI) / 180

    const continuousPath: WaypointCoordinates[] = []
    const turnaroundSegments: WaypointCoordinates[][] = []
    let crosshatchStartIndex: number | undefined
    let isReverse = startReversed

    let prevExitBoundary: WaypointCoordinates | null = null
    let prevExitTurnaround: WaypointCoordinates | null = null

    const lineBearing = turf.bearing(
      turf.point([minX - diagonal * Math.sin(angleRad), minY + diagonal * Math.cos(angleRad)]),
      turf.point([minX + diagonal * Math.sin(angleRad), minY - diagonal * Math.cos(angleRad)])
    )

    const step = distanceBetweenLines / 111000
    const dValues: number[] = []
    for (let d = -diagonal; d <= diagonal * 2; d += step) dValues.push(d)
    if (reverseSweep) dValues.reverse()

    for (const d of dValues) {
      const lineStart = [
        minX + d * Math.cos(angleRad) - diagonal * Math.sin(angleRad),
        minY + d * Math.sin(angleRad) + diagonal * Math.cos(angleRad),
      ]
      const lineEnd = [
        minX + d * Math.cos(angleRad) + diagonal * Math.sin(angleRad),
        minY + d * Math.sin(angleRad) - diagonal * Math.cos(angleRad),
      ]

      const line = turf.lineString([lineStart, lineEnd])
      const clipped = turf.lineIntersect(poly, line)

      if (clipped.features.length >= 2) {
        const sortedFeatures = clipped.features.sort((a, b) => {
          const coordsA = a.geometry.coordinates
          const coordsB = b.geometry.coordinates
          const distA = Math.pow(coordsA[0] - lineStart[0], 2) + Math.pow(coordsA[1] - lineStart[1], 2)
          const distB = Math.pow(coordsB[0] - lineStart[0], 2) + Math.pow(coordsB[1] - lineStart[1], 2)
          return distA - distB
        })

        const coords = sortedFeatures.map((f) => f.geometry.coordinates)

        if (turnaroundDistance !== 0 && coords.length >= 2) {
          const origFirst: WaypointCoordinates = [coords[0][1], coords[0][0]]
          const origLast: WaypointCoordinates = [coords[coords.length - 1][1], coords[coords.length - 1][0]]

          if (turnaroundDistance < 0 && Math.abs(turnaroundDistance) * 2 >= distanceInMeters(origFirst, origLast)) {
            continue
          }

          const turnaroundKm = turnaroundDistance / 1000
          const extFirst = turf.destination(turf.point(coords[0]), turnaroundKm, lineBearing + 180, {
            units: 'kilometers',
          })
          coords[0] = extFirst.geometry.coordinates

          const lastIdx = coords.length - 1
          const extLast = turf.destination(turf.point(coords[lastIdx]), turnaroundKm, lineBearing, {
            units: 'kilometers',
          })
          coords[lastIdx] = extLast.geometry.coordinates

          const entryBoundary = isReverse ? origLast : origFirst
          const exitBoundary = isReverse ? origFirst : origLast

          if (isReverse) coords.reverse()

          const entryTurnaround: WaypointCoordinates = [coords[0][1], coords[0][0]]
          const exitTurnaround: WaypointCoordinates = [coords[coords.length - 1][1], coords[coords.length - 1][0]]

          if (prevExitBoundary && prevExitTurnaround) {
            turnaroundSegments.push([prevExitBoundary, prevExitTurnaround, entryTurnaround, entryBoundary])
          } else {
            turnaroundSegments.push([entryTurnaround, entryBoundary])
          }

          prevExitBoundary = exitBoundary
          prevExitTurnaround = exitTurnaround
        } else {
          if (isReverse) coords.reverse()
        }

        const linePoints = coords.map((c): WaypointCoordinates => [c[1], c[0]])

        if (continuousPath.length > 0 && turnaroundDistance === 0) {
          const lastPoint = continuousPath[continuousPath.length - 1]
          const edgePath = moveAlongEdge(poly, lastPoint, linePoints[0])
          continuousPath.push(...edgePath)
        }

        continuousPath.push(...linePoints)
        isReverse = !isReverse
      }
    }

    if (turnaroundDistance !== 0 && prevExitBoundary && prevExitTurnaround) {
      turnaroundSegments.push([prevExitBoundary, prevExitTurnaround])
    }

    if (crosshatch) {
      const passEnd = continuousPath[continuousPath.length - 1]
      // The second pass can start at any of its four boustrophedon corners: the two sweep directions crossed
      // with the two directions of the first survey line. Enter at the corner nearest the first pass exit so
      // the transit leg is short and does not double back, instead of always entering at a fixed path endpoint.
      const secondAngle = linesAngle + 90
      const crosshatchDistance = crosshatchDistanceBetweenLines ?? distanceBetweenLines
      const sweeps = [
        generateSurveyPath(
          polygonPoints,
          crosshatchDistance,
          secondAngle,
          turnaroundDistance,
          false,
          undefined,
          false,
          false
        ),
        generateSurveyPath(
          polygonPoints,
          crosshatchDistance,
          secondAngle,
          turnaroundDistance,
          false,
          undefined,
          true,
          false
        ),
        generateSurveyPath(
          polygonPoints,
          crosshatchDistance,
          secondAngle,
          turnaroundDistance,
          false,
          undefined,
          false,
          true
        ),
        generateSurveyPath(
          polygonPoints,
          crosshatchDistance,
          secondAngle,
          turnaroundDistance,
          false,
          undefined,
          true,
          true
        ),
      ]

      let bestPass: SurveyPath | null = null
      let bestTransit = Infinity
      for (const sweep of sweeps) {
        if (sweep.path.length === 0) continue
        const transit = passEnd ? distanceInMeters(passEnd, sweep.path[0]) : 0
        if (transit < bestTransit) {
          bestTransit = transit
          bestPass = sweep
        }
      }

      if (bestPass) {
        crosshatchStartIndex = continuousPath.length
        continuousPath.push(...bestPass.path)
        turnaroundSegments.push(...bestPass.turnaroundSegments)
      }
    }

    return { path: continuousPath, turnaroundSegments, crosshatchStartIndex }
  } catch (error) {
    console.error('Error in generateSurveyPath:', error)
    return { path: [], turnaroundSegments: [] }
  }
}

const cornersPerPass = 4

/**
 * Number of distinct entry points a survey path exposes. A crosshatch survey doubles the count because the
 * entry can sit on either pass's endpoint at each of the four physical corners.
 * @param {boolean} crosshatch - Whether the survey includes a crosshatch pass.
 * @returns {number} The number of selectable entry points (4 or 8).
 */
export const surveyEntryCornerCount = (crosshatch = false): number => (crosshatch ? cornersPerPass * 2 : cornersPerPass)

/**
 * Parameters shared by the entry-corner helpers, mirroring {@link generateSurveyPath} minus `startReversed`.
 */
interface SurveyGenerationParams {
  /** Polygon vertices to survey. */
  polygonPoints: WaypointCoordinates[]
  /** Distance between survey lines, in meters. */
  distanceBetweenLines: number
  /** Angle of the survey lines, in degrees. */
  linesAngle: number
  /** Turnaround extension/inset distance, in meters. */
  turnaroundDistance?: number
  /** Whether to append a 90° crosshatch pass. */
  crosshatch?: boolean
  /** Distance between lines for the crosshatch pass, in meters. */
  crosshatchDistanceBetweenLines?: number
}

/**
 * Generates a survey path that begins at the requested entry corner. Corners `0-3` decode into the two
 * orientation flips so the entry lands on each physical corner along the primary pass; for a crosshatch
 * survey, corners `4-7` fly the crosshatch pass first, so the entry sits on the perpendicular pass's endpoint
 * at those same four corners.
 * @param {SurveyGenerationParams} params - Survey generation parameters.
 * @param {number} entryCorner - Which entry point (0-3, or 0-7 for a crosshatch survey) to start from.
 * @returns {SurveyPath} The survey path (with turnaround segments and crosshatch index) whose first point sits on the chosen entry point.
 */
export const orderedSurveyPath = (params: SurveyGenerationParams, entryCorner = 0): SurveyPath => {
  const swapPasses = Boolean(params.crosshatch) && entryCorner >= cornersPerPass
  const corner = entryCorner % cornersPerPass
  const startReversed = corner % 2 === 1
  const reverseSweep = corner >= 2

  const crosshatchDistance = params.crosshatchDistanceBetweenLines ?? params.distanceBetweenLines
  const primaryDistance = swapPasses ? crosshatchDistance : params.distanceBetweenLines
  const secondaryDistance = swapPasses ? params.distanceBetweenLines : params.crosshatchDistanceBetweenLines
  const primaryAngle = swapPasses ? params.linesAngle + 90 : params.linesAngle

  return generateSurveyPath(
    params.polygonPoints,
    primaryDistance,
    primaryAngle,
    params.turnaroundDistance,
    params.crosshatch,
    secondaryDistance,
    startReversed,
    reverseSweep
  )
}

/**
 * Computes the outward bearing of the polygon edge nearest a survey entrance/exit, i.e. the direction
 * perpendicular to that edge pointing away from the polygon interior. A marker sitting on the boundary can
 * then be oriented relative to the edge it lies on.
 * @param {WaypointCoordinates[]} polygonPoints - The survey polygon vertices (open ring; the first vertex is not repeated).
 * @param {WaypointCoordinates} endpoint - The entrance or exit point, on or near the polygon boundary.
 * @returns {number} The outward compass bearing (degrees clockwise from north) of the nearest edge's normal.
 */
export const surveyEndpointEdgeBearing = (
  polygonPoints: WaypointCoordinates[],
  endpoint: WaypointCoordinates
): number => {
  const coords = polygonPoints.map(([lat, lng]) => [lng, lat] as Position)
  if (coords.length < 3) return 0

  const norm = (bearing: number): number => ((bearing % 360) + 360) % 360
  const point = turf.point([endpoint[1], endpoint[0]])

  let closestEdge = 0
  let closestDistance = Infinity
  for (let i = 0; i < coords.length; i++) {
    const edge = turf.lineString([coords[i], coords[(i + 1) % coords.length]])
    const distance = turf.pointToLineDistance(point, edge, { units: 'meters' })
    if (distance < closestDistance) {
      closestDistance = distance
      closestEdge = i
    }
  }

  const edgeBearing = turf.bearing(
    turf.point(coords[closestEdge]),
    turf.point(coords[(closestEdge + 1) % coords.length])
  )
  const towardCentroid = turf.bearing(point, turf.centroid(turf.polygon([[...coords, coords[0]]])))
  const normalA = norm(edgeBearing + 90)
  const normalB = norm(edgeBearing - 90)

  // Of the two edge normals, the outward one is the further from the direction toward the polygon centroid.
  return deltaBearing(normalA, towardCentroid) > deltaBearing(normalB, towardCentroid) ? normalA : normalB
}

/**
 * Finds the index of the polygon ring edge (the segment from coords[i] to coords[i + 1]) that a point lies on.
 * @param {Feature<Point>} point - The point to locate.
 * @param {Position[]} coords - The polygon ring coordinates (closed, first equals last).
 * @returns {number} The edge index, or -1 if the point does not lie on any edge.
 */
const findRingEdgeIndex = (point: Feature<Point>, coords: Position[]): number => {
  // Pick the metrically closest edge rather than booleanPointOnLine: a degree-based epsilon there treats a
  // point as "on" a near-axis-aligned edge even when it is tens of meters away, which sent transect
  // connectors detouring out to a far polygon corner.
  let closestEdge = -1
  let closestDistance = Infinity
  for (let i = 0; i < coords.length - 1; i++) {
    const distance = turf.pointToLineDistance(point, turf.lineString([coords[i], coords[i + 1]]), { units: 'meters' })
    if (distance < closestDistance) {
      closestDistance = distance
      closestEdge = i
    }
  }
  return closestDistance <= 1 ? closestEdge : -1
}

/**
 * Total length of the path start -> vertices -> end, in kilometers.
 * @param {WaypointCoordinates} start - The starting point.
 * @param {Position[]} vertices - The intermediate ring vertices.
 * @param {WaypointCoordinates} end - The ending point.
 * @returns {number} The path length, in kilometers.
 */
const pathLengthThroughVertices = (
  start: WaypointCoordinates,
  vertices: Position[],
  end: WaypointCoordinates
): number => turf.length(turf.lineString([[start[1], start[0]], ...vertices, [end[1], end[0]]]))

/**
 * Finds the shortest path hugging a polygon's boundary between two points that lie on that boundary, so
 * consecutive survey transects are connected without overshooting into a far corner.
 * @param {Feature<Polygon>} polygon - The polygon to move along.
 * @param {WaypointCoordinates} start - The starting point, expected to lie on the polygon boundary.
 * @param {WaypointCoordinates} end - The ending point, expected to lie on the polygon boundary.
 * @returns {WaypointCoordinates[]} The intermediate ring vertices between start and end, in the shorter direction. Empty
 *   when both points lie on the same edge, so the caller connects them with a direct segment.
 */
const moveAlongEdge = (
  polygon: Feature<Polygon>,
  start: WaypointCoordinates,
  end: WaypointCoordinates
): WaypointCoordinates[] => {
  const coords = polygon.geometry.coordinates[0]
  const startEdge = findRingEdgeIndex(turf.point([start[1], start[0]]), coords)
  const endEdge = findRingEdgeIndex(turf.point([end[1], end[0]]), coords)

  if (startEdge === -1 || endEdge === -1 || startEdge === endEdge) return []

  const vertexCount = coords.length - 1 // Ring is closed, so the last coordinate duplicates the first.

  const forwardVertices: Position[] = []
  for (let i = (startEdge + 1) % vertexCount; ; i = (i + 1) % vertexCount) {
    forwardVertices.push(coords[i])
    if (i === endEdge) break
  }

  const backwardVertices: Position[] = []
  for (let i = startEdge; ; i = (i - 1 + vertexCount) % vertexCount) {
    backwardVertices.push(coords[i])
    if (i === (endEdge + 1) % vertexCount) break
  }

  const shorterVertices =
    pathLengthThroughVertices(start, forwardVertices, end) <= pathLengthThroughVertices(start, backwardVertices, end)
      ? forwardVertices
      : backwardVertices

  return shorterVertices.map((c): WaypointCoordinates => [c[1], c[0]])
}

/**
 * Calculate grid spacing based on the scale control logic
 * This ensures the grid spacing matches what the scale control shows
 * @param {MapLibreMap} map - Map instance
 * @returns {number} The grid spacing in degrees
 */
export const getGridSpacingFromScale = (map: MapLibreMap): number => {
  if (!map) throw new Error('Map instance is required')

  // Get map bounds and center
  const center = map.getCenter()
  const zoom = fromMapLibreZoom(map.getZoom())

  // Standard scale control width in pixels (100px max)
  const maxWidth = 100
  const maxDistanceMeters = metersPerPixel(center.lat, zoom) * maxWidth

  // Round to nice numbers like the scale control does
  const niceDistances = [
    1, 2, 3, 5, 10, 20, 30, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000, 20000, 30000, 50000, 100000, 200000,
    300000, 500000, 1000000, 2000000, 3000000, 5000000, 10000000,
  ]

  // Find the largest nice distance that fits within maxWidth
  let distanceMeters = niceDistances[0]
  for (const distance of niceDistances) {
    if (distance <= maxDistanceMeters) {
      distanceMeters = distance
    } else {
      break
    }
  }

  // Convert distance to degrees for grid spacing
  // Approximate conversion: 1 degree ≈ 111,320 meters at equator
  const metersPerDegree = 111320 * Math.cos((center.lat * Math.PI) / 180)
  const spacing = distanceMeters / metersPerDegree

  return spacing
}

const gridLayerId = slottedLayerId('grid', 'coordinate-grid')

/**
 * Draws (or redraws, for the current view) a coordinate grid on the provided map
 * @param {MapLibreMap} map - Map instance
 */
export const createGridOverlay = (map: MapLibreMap): void => {
  if (!map) throw new Error('Map instance is required')

  const bounds = map.getBounds()

  // Get grid configuration based on the scale control
  const spacing = getGridSpacingFromScale(map)

  // Create grid lines
  const south = Math.floor(bounds.getSouth() / spacing) * spacing
  const north = Math.ceil(bounds.getNorth() / spacing) * spacing
  const west = Math.floor(bounds.getWest() / spacing) * spacing
  const east = Math.ceil(bounds.getEast() / spacing) * spacing

  const lines: number[][][] = []
  // Horizontal lines (latitude)
  for (let lat = south; lat <= north; lat += spacing) {
    lines.push([
      [west, lat],
      [east, lat],
    ])
  }
  // Vertical lines (longitude)
  for (let lng = west; lng <= east; lng += spacing) {
    lines.push([
      [lng, south],
      [lng, north],
    ])
  }

  setLineLayer(
    map,
    gridLayerId,
    'grid',
    { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: lines } },
    { color: '#ffffff', width: 1, opacity: 0.3, dashPattern: [2, 4] }
  )
}

/**
 * Removes the coordinate grid from the provided map
 * @param {MapLibreMap | undefined} map - Map instance
 */
export const removeGridOverlay = (map: MapLibreMap | undefined): void => {
  removeLayersAndSource(map, [gridLayerId], gridLayerId)
}

/**
 * Interior angle at a path vertex plus the geometry used to render it.
 */
interface VertexAngle {
  /** Interior angle between the two segments meeting at the vertex, in degrees. */
  angleDeg: number
  /** Lat/lng points making up the arc that visualizes the angle. */
  arc: WaypointCoordinates[]
  /** Arc midpoint used to anchor the degree label, or null when the arc has no points. */
  labelAt: WaypointCoordinates | null
}

/**
 * Interior angle at `curr` between segments `prev`→`curr` and `curr`→`next`, plus a small arc that visualizes it.
 * @param {WaypointCoordinates} prev - Vertex before the angle vertex.
 * @param {WaypointCoordinates} curr - Vertex where the angle is measured.
 * @param {WaypointCoordinates} next - Vertex after the angle vertex.
 * @param {number} mapZoom - Current map zoom, used to scale the arc radius.
 * @returns {VertexAngle} The angle in degrees, the arc points, and the arc midpoint to anchor a label.
 */
export const computeVertexAngle = (
  prev: WaypointCoordinates,
  curr: WaypointCoordinates,
  next: WaypointCoordinates,
  mapZoom: number
): VertexAngle => {
  const incomingBearing = bearingBetween(prev, curr)
  const outgoingBearing = bearingBetween(curr, next)
  const reverseIncomingBearing = (incomingBearing + 180) % 360
  const angleDeg = deltaBearing(reverseIncomingBearing, outgoingBearing)

  const radiusMeters = Math.max(15, Math.min(50, 1000 / mapZoom))
  const longerSegment = Math.max(calculateHaversineDistance(prev, curr), calculateHaversineDistance(curr, next))
  const arcRadius = Math.min(radiusMeters, longerSegment * 0.3) * 0.5

  const normalizedDiff = ((outgoingBearing - reverseIncomingBearing + 540) % 360) - 180
  const startBearing = normalizedDiff >= 0 ? reverseIncomingBearing : reverseIncomingBearing - angleDeg
  const endBearing = normalizedDiff >= 0 ? reverseIncomingBearing + angleDeg : reverseIncomingBearing

  const arc: WaypointCoordinates[] = []
  const steps = Math.max(8, Math.floor(angleDeg / 2))
  for (let i = 0; i <= steps; i++) {
    const bearing = (((startBearing + ((endBearing - startBearing) * i) / steps) % 360) + 360) % 360
    const rad = (bearing * Math.PI) / 180
    const latOffset = (arcRadius / 111320) * Math.cos(rad)
    const lngOffset = (arcRadius / (111320 * Math.cos((curr[0] * Math.PI) / 180))) * Math.sin(rad)
    arc.push([curr[0] + latOffset, curr[1] + lngOffset])
  }

  return { angleDeg, arc, labelAt: arc[Math.floor(arc.length / 2)] ?? null }
}

/**
 * Vertex triples whose interior angle is reshaped by moving the waypoint at `index`: the moved vertex and each
 * immediate neighbor that itself has two neighbors (endpoints have no interior angle).
 * @param {{ coordinates: WaypointCoordinates }[]} waypoints - The ordered path waypoints.
 * @param {number} index - Index of the waypoint being moved.
 * @returns {[WaypointCoordinates, WaypointCoordinates, WaypointCoordinates][]} The affected `[prev, curr, next]` triples.
 */
export const affectedAngleTriples = (
  waypoints: {
    /**
     * The waypoint coordinates.
     */
    coordinates: WaypointCoordinates
  }[],
  index: number
): [WaypointCoordinates, WaypointCoordinates, WaypointCoordinates][] => {
  const triples: [WaypointCoordinates, WaypointCoordinates, WaypointCoordinates][] = []
  for (const j of [index - 1, index, index + 1]) {
    if (j >= 1 && j <= waypoints.length - 2) {
      triples.push([waypoints[j - 1].coordinates, waypoints[j].coordinates, waypoints[j + 1].coordinates])
    }
  }
  return triples
}
