import * as turf from '@turf/turf'
import type { Feature, Polygon } from 'geojson'
import * as L from 'leaflet'

import type { SurveyPath, WaypointCoordinates } from '@/types/mission'

/**
 * Default target follower update interval in milliseconds.
 * @constant {number}
 */
const defaultUpdateIntervalMs = 500

// Minimum distance, in pixels, the user must drag the map before tracking stops, so small or accidental drags don't disable following.
const defaultUnfollowDragThresholdPx = 150

// Raise wheelPxPerZoomLevel so a single wheel notch/pinch step advances exactly one zoom level
// (Leaflet's default 60 lets a typical ~100px deltaY round up to 2 levels with zoomSnap: 1).
export const singleStepZoomMapOptions: Pick<
  L.MapOptions,
  'wheelPxPerZoomLevel' | 'wheelDebounceTime' | 'zoomSnap' | 'zoomDelta'
> = {
  wheelPxPerZoomLevel: 100,
  wheelDebounceTime: 100,
  zoomSnap: 1,
  zoomDelta: 1,
}

/**
 * Enum for the different types of targets that can be followed.
 * @enum {string}
 */
export enum WhoToFollow {
  HOME = 'Home',
  VEHICLE = 'Vehicle',
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

  /**
   * Constructor for the TargetFollower class.
   * @param {(newTarget: WhoToFollow | undefined) => void} onTargetChange - Sets current target to the component observing this follower.
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
   * @param {WhoToFollow} target - The target to follow.
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
    if (this.isUserDragging) return
    this.setCenter(this.target)
  }

  /**
   * Enable auto update for the current target ref, don't forget to disable auto update
   * prior to object destruction or it can lead to intervals running forever.
   * @returns {void}
   */
  public enableAutoUpdate(): void {
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
   * Stops following once the user pans the map past a pixel threshold. Leaflet drag events
   * fire only for real user gestures, never for the follower's own panning, so there is no
   * feedback loop.
   * @param {L.Map} map - The leaflet map whose user drags should break the follow.
   * @param {number} thresholdPixels - Minimum drag distance, in pixels, that stops following.
   * @returns {() => void} Disposer that removes the drag listeners; call it on teardown.
   */
  public unFollowOnUserDrag(map: L.Map, thresholdPixels = defaultUnfollowDragThresholdPx): () => void {
    let dragStartCenter: L.LatLng | undefined

    const onDragStart = (): void => {
      this.isUserDragging = true
      dragStartCenter = this.target ? map.getCenter() : undefined
    }

    const onDragEnd = (): void => {
      this.isUserDragging = false
      if (!dragStartCenter || !this.target) return
      const startPx = map.latLngToContainerPoint(dragStartCenter)
      const endPx = map.latLngToContainerPoint(map.getCenter())
      const draggedPixels = startPx.distanceTo(endPx)
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
}

/**
 * Adjusts the given map view so that all the provided waypoint coordinates
 * are visible at once. Coordinates with invalid lat/lng values are ignored.
 * @param {L.Map} map - Leaflet map instance to adjust.
 * @param {WaypointCoordinates[]} coordinates - List of `[latitude, longitude]` tuples to fit.
 * @param {L.FitBoundsOptions} [options] - Optional Leaflet `fitBounds` options. A sensible
 *   default padding is applied when none is provided.
 * @returns {boolean} `true` if the map view was adjusted, `false` if there were no valid
 *   coordinates to fit.
 */
export const fitMapToWaypoints = (
  map: L.Map,
  coordinates: WaypointCoordinates[],
  options?: L.FitBoundsOptions
): boolean => {
  const validCoordinates = coordinates.filter(
    (coord) => Array.isArray(coord) && Number.isFinite(coord[0]) && Number.isFinite(coord[1])
  )
  if (validCoordinates.length === 0) return false

  const bounds = L.latLngBounds(validCoordinates.map((coord) => L.latLng(coord[0], coord[1])))
  map.fitBounds(bounds, { padding: [20, 20], maxZoom: 22, animate: true, ...(options ?? {}) })
  return true
}

/**
 * Generates a survey path based on the given polygon and parameters.
 * @param {L.LatLng[]} polygonPoints - The points of the polygon.
 * @param {number} distanceBetweenLines - The distance between survey lines in meters.
 * @param {number} linesAngle - The angle of the survey lines in degrees.
 * @param {number} turnaroundDistance - Distance in meters to extend (positive) or inset (negative) from the polygon
 *   boundary before turning. Positive values make the vehicle fly past the edges; negative values keep it away.
 * @returns {SurveyPath} The generated survey path and turnaround segments.
 */
export const generateSurveyPath = (
  polygonPoints: L.LatLng[],
  distanceBetweenLines: number,
  linesAngle: number,
  turnaroundDistance = 0
): SurveyPath => {
  if (polygonPoints.length < 4) return { path: [], turnaroundSegments: [] }

  const polygonCoords = polygonPoints.map((p) => [p.lng, p.lat])
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

    const continuousPath: L.LatLng[] = []
    const turnaroundSegments: L.LatLng[][] = []
    let d = -diagonal
    let isReverse = false

    let prevExitBoundary: L.LatLng | null = null
    let prevExitTurnaround: L.LatLng | null = null

    const lineBearing = turf.bearing(
      turf.point([minX - diagonal * Math.sin(angleRad), minY + diagonal * Math.cos(angleRad)]),
      turf.point([minX + diagonal * Math.sin(angleRad), minY - diagonal * Math.cos(angleRad)])
    )

    while (d <= diagonal * 2) {
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
          const origFirst = L.latLng(coords[0][1], coords[0][0])
          const origLast = L.latLng(coords[coords.length - 1][1], coords[coords.length - 1][0])

          if (turnaroundDistance < 0 && Math.abs(turnaroundDistance) * 2 >= origFirst.distanceTo(origLast)) {
            d += distanceBetweenLines / 111000
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

          const entryTurnaround = L.latLng(coords[0][1], coords[0][0])
          const exitTurnaround = L.latLng(coords[coords.length - 1][1], coords[coords.length - 1][0])

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

        const linePoints = coords.map((c) => L.latLng(c[1], c[0]))

        if (continuousPath.length > 0 && turnaroundDistance === 0) {
          const lastPoint = continuousPath[continuousPath.length - 1]
          const edgePath = moveAlongEdge(poly, lastPoint, linePoints[0], diagonal)
          continuousPath.push(...edgePath)
        }

        continuousPath.push(...linePoints)
        isReverse = !isReverse
      }

      d += distanceBetweenLines / 111000
    }

    if (turnaroundDistance !== 0 && prevExitBoundary && prevExitTurnaround) {
      turnaroundSegments.push([prevExitBoundary, prevExitTurnaround])
    }

    return { path: continuousPath, turnaroundSegments }
  } catch (error) {
    console.error('Error in generateSurveyPath:', error)
    return { path: [], turnaroundSegments: [] }
  }
}

/**
 * Moves along the edge of a polygon from start to end point.
 * @param {Feature<Polygon>} polygon - The polygon to move along.
 * @param {L.LatLng} start - The starting point.
 * @param {L.LatLng} end - The ending point.
 * @param {number} maxDistance - The maximum distance to move.
 * @returns {L.LatLng[]} The path along the edge.
 */
export const moveAlongEdge = (
  polygon: Feature<Polygon>,
  start: L.LatLng,
  end: L.LatLng,
  maxDistance: number
): L.LatLng[] => {
  const coords = polygon.geometry.coordinates[0]
  const path: L.LatLng[] = []
  let remainingDistance = maxDistance
  let currentPoint = turf.point([start.lng, start.lat])

  for (let i = 0; i < coords.length; i++) {
    const nextPoint = turf.point(coords[(i + 1) % coords.length])
    const edgeLine = turf.lineString([coords[i], coords[(i + 1) % coords.length]])

    if (turf.booleanPointOnLine(currentPoint, edgeLine)) {
      while (remainingDistance > 0) {
        const distance = turf.distance(currentPoint, nextPoint)
        if (distance <= remainingDistance) {
          path.push(L.latLng(nextPoint.geometry.coordinates[1], nextPoint.geometry.coordinates[0]))
          remainingDistance -= distance
          currentPoint = nextPoint
          break
        } else {
          const move = turf.along(edgeLine, remainingDistance, { units: 'kilometers' })
          path.push(L.latLng(move.geometry.coordinates[1], move.geometry.coordinates[0]))
          break
        }
      }
    }

    if (turf.booleanPointOnLine(turf.point([end.lng, end.lat]), edgeLine)) {
      break
    }
  }

  return path
}

/**
 * Calculate grid spacing based on Leaflet's scale control logic
 * This ensures the grid spacing matches what the standard Leaflet scale control shows
 * @param {L.Map} map - Leaflet map instance
 * @returns {number} The grid spacing in meters
 */
export const getGridSpacingFromScale = (map: L.Map): number => {
  if (!map) throw new Error('Map instance is required')

  // Get map bounds and center
  const center = map.getCenter()
  const zoom = map.getZoom()

  // Calculate meters per pixel at current zoom level
  const earthCircumference = 40075017 // meters
  const latRad = (center.lat * Math.PI) / 180
  const metersPerPixel = (earthCircumference * Math.cos(latRad)) / Math.pow(2, zoom + 8)

  // Standard scale control width in pixels (Leaflet default is 100px max)
  const maxWidth = 100
  const maxDistanceMeters = metersPerPixel * maxWidth

  // Round to nice numbers like Leaflet scale control does
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
  const metersPerDegree = 111320 * Math.cos(latRad)
  const spacing = distanceMeters / metersPerDegree

  return spacing
}

/**
 * Creates a coordinate grid overlay on the provided map
 * @param {L.Map} map - Leaflet map instance
 * @param {L.LayerGroup} gridLayer - Reference to store the grid layer
 * @returns {L.LayerGroup} The created grid layer
 */
export const createGridOverlay = (map: L.Map, gridLayer?: L.LayerGroup): L.LayerGroup => {
  if (!map) throw new Error('Map instance is required')

  // Remove existing grid if provided
  if (gridLayer) {
    map.removeLayer(gridLayer as L.Layer)
  }

  const bounds = map.getBounds()

  // Get grid configuration based on Leaflet scale control
  const spacing = getGridSpacingFromScale(map)
  const lineOpacity = 0.3
  const lineWeight = 1

  const newGridLayer = L.layerGroup()

  // Create grid lines
  const south = Math.floor(bounds.getSouth() / spacing) * spacing
  const north = Math.ceil(bounds.getNorth() / spacing) * spacing
  const west = Math.floor(bounds.getWest() / spacing) * spacing
  const east = Math.ceil(bounds.getEast() / spacing) * spacing

  // Horizontal lines (latitude)
  for (let lat = south; lat <= north; lat += spacing) {
    const line = L.polyline(
      [
        [lat, west],
        [lat, east],
      ],
      {
        color: '#ffffff',
        weight: lineWeight,
        opacity: lineOpacity,
        dashArray: '2, 4',
        interactive: false,
      }
    )
    newGridLayer.addLayer(line)
  }

  // Vertical lines (longitude)
  for (let lng = west; lng <= east; lng += spacing) {
    const line = L.polyline(
      [
        [south, lng],
        [north, lng],
      ],
      {
        color: '#ffffff',
        weight: lineWeight,
        opacity: lineOpacity,
        dashArray: '2, 4',
        interactive: false,
      }
    )
    newGridLayer.addLayer(line)
  }

  newGridLayer.addTo(map)
  return newGridLayer
}
