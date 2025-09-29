import * as turf from '@turf/turf'
import type { Feature, Polygon } from 'geojson'
import * as L from 'leaflet'

import type { WaypointCoordinates } from '@/types/mission'

/**
 * Default target follower update interval in milliseconds.
 * @constant {number}
 */
const defaultUpdateIntervalMs = 500

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
  private onTargetChange: (newTarget: WhoToFollow | undefined) => void

  /**
   * Current target ref to follow.
   * @type {WhoToFollow | undefined}
   */
  private target: WhoToFollow | undefined

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

  /**
   * Constructor for the TargetFollower class.
   * @param {(newTarget: WhoToFollow | undefined) => void} onTargetChange - Sets current target to the component observing this follower.
   * @param {(newCenter: WaypointCoordinates) => void} onCenterChange - Sets current center for the map coupled to this follower.
   */
  constructor(
    onTargetChange: (newTarget: WhoToFollow | undefined) => void,
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
  private setCenter(target: WhoToFollow | undefined): void {
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
   * @param {WhoToFollow} target - The target to follow.
   * @param {boolean} toggleSameTarget - If should stop following current selected
   * target if the same target is selected again.
   * @returns {void}
   */
  public goToTarget(target: WhoToFollow, toggleSameTarget = false): void {
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
   * @param {WhoToFollow} target - The target that will receive this data
   * @param {() => WaypointCoordinates | undefined} compute - The function to compute the target data
   * coordinates.
   * @returns {void}
   */
  public setTrackableTarget(target: WhoToFollow, compute: () => WaypointCoordinates | undefined): void {
    this.trackables[target] = compute
  }

  /**
   * Update current map center ref based on the target to follow.
   * @returns {void}
   */
  public update(): void {
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
   * @param {WhoToFollow} target - The target to follow.
   * @param {boolean} navigateNow - If should navigate to the target now.
   * @returns {void}
   */
  public follow(target: WhoToFollow, navigateNow = true): void {
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
   * Returns the current target ref to follow.
   * @returns {WhoToFollow | undefined} The current target ref to follow.
   */
  public getCurrentTarget(): WhoToFollow | undefined {
    return this.target
  }
}

/**
 * Generates a survey path based on the given polygon and parameters.
 * @param {L.LatLng[]} polygonPoints - The points of the polygon.
 * @param {number} distanceBetweenLines - The distance between survey lines in meters.
 * @param {number} linesAngle - The angle of the survey lines in degrees.
 * @returns {L.LatLng[]} The generated survey path.
 */
export const generateSurveyPath = (
  polygonPoints: L.LatLng[],
  distanceBetweenLines: number,
  linesAngle: number
): L.LatLng[] => {
  if (polygonPoints.length < 4) return []

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
    let d = -diagonal
    let isReverse = false

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
        const coords = clipped.features.map((f) => f.geometry.coordinates)
        if (isReverse) coords.reverse()

        const linePoints = coords.map((c) => L.latLng(c[1], c[0]))

        if (continuousPath.length > 0) {
          const lastPoint = continuousPath[continuousPath.length - 1]
          const edgePath = moveAlongEdge(poly, lastPoint, linePoints[0], distanceBetweenLines / 111000)
          continuousPath.push(...edgePath)
        }

        continuousPath.push(...linePoints)
        isReverse = !isReverse
      }

      d += distanceBetweenLines / 111000
    }

    return continuousPath
  } catch (error) {
    console.error('Error in generateSurveyPath:', error)
    return []
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
