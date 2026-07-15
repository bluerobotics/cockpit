import { MavCmd, MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { BatteryChemistry } from '@/libs/vehicle/types'

/**
 * Possible types for mission commands.
 */
export enum MissionCommandType {
  MAVLINK_NAV_COMMAND = 'MAVLINK_NAV_COMMAND',
  MAVLINK_NON_NAV_COMMAND = 'MAVLINK_NON_NAV_COMMAND',
}

export type MavlinkNavCommand = {
  /**
   * MAVLink navigation command type.
   */
  type: MissionCommandType.MAVLINK_NAV_COMMAND
  /**
   * The command to be executed by the mission.
   */
  command: MavCmd
  /**
   * The first parameter of the mission command.
   */
  param1: number
  /**
   * The second parameter of the mission command.
   */
  param2: number
  /**
   * The third parameter of the mission command.
   */
  param3: number
  /**
   * The fourth parameter of the mission command.
   */
  param4: number
}

export type MavlinkNonNavCommand = {
  /**
   * MAVLink non-navigation command type.
   */
  type: MissionCommandType.MAVLINK_NON_NAV_COMMAND
  /**
   * MAVLink non-navigation command.
   */
  command: MavCmd
  /**
   * The first parameter of the non-navigation command.
   */
  param1: number
  /**
   * The second parameter of the non-navigation command.
   */
  param2: number
  /**
   * The third parameter of the non-navigation command.
   */
  param3: number
  /**
   * The fourth parameter of the non-navigation command.
   */
  param4: number
  /**
   * The x parameter of the non-navigation command.
   */
  x: number
  /**
   * The y parameter of the non-navigation command.
   */
  y: number
  /**
   * The z parameter of the non-navigation command.
   */
  z: number
}

export type MissionCommand = MavlinkNavCommand | MavlinkNonNavCommand

/**
 * Possible types for waypoints. Usually used to decide what function should the waypoint perform.
 */
export enum AltitudeReferenceType {
  ABSOLUTE_RELATIVE_TO_MSL = 'Absolute (relative to mean sea level)',
  RELATIVE_TO_HOME = 'Relative to home',
  RELATIVE_TO_TERRAIN = 'Relative to terrain',
}

export type WaypointCoordinates = [number, number]

export type ContextMenuTypes = 'survey' | 'waypoint' | 'map'

export type Waypoint = {
  /**
   * Unique identification for the waypoint.
   */
  id: string
  /**
   * Geographical coordinates of the waypoint in the following format: [latitude, longitude].
   */
  coordinates: WaypointCoordinates
  /**
   * Altitude of the waypoint.
   */
  altitude: number
  /**
   * Type of reference to the altitude value.
   */
  altitudeReferenceType: AltitudeReferenceType
  /**
   * The commands to be executed by the waypoint, in sequence.
   */
  commands: MissionCommand[]
}

export type CockpitMission = {
  /**
   * Version of the mission file. Used for compatibility checking.
   */
  version: number
  /**
   * General Cockpit settings
   */
  settings: {
    /**
     * The coordinates of the map center when the user saved the file
     */
    mapCenter: WaypointCoordinates
    /**
     * The zoom of the map when the user saved the file
     */
    zoom: number
    /**
     * The altitude to be used for the next placed waypoint
     */
    currentWaypointAltitude: number
    /**
     * To use or not altitudes relative to the home altitude
     */
    currentWaypointAltitudeRefType: AltitudeReferenceType
    /**
     * The default speed to be used on the mission
     */
    defaultCruiseSpeed: number
  }
  /**
   * The waypoints of the mission
   */
  waypoints: Waypoint[]
  /**
   * Survey data associated with this mission.
   */
  surveys?: Survey[]
}

/**
 * Snapshot of the mission estimates panel values at the time the mission was saved.
 * All values are pre-formatted strings (matching the Mission Estimates UI).
 */
export type MissionEstimatesSnapshot = {
  /**
   * Total path length.
   */
  pathLength: string
  /**
   * Estimated time to complete the mission.
   */
  duration: string
  /**
   * Estimated energy consumption.
   */
  energy: string
  /**
   * Total area covered by surveys.
   */
  totalSurveyCoverage: string
  /**
   * Approximate area enclosed by the mission path when closed.
   */
  missionCoverageArea: string
}

/**
 * A mission saved into the local Mission Library.
 */
export type SavedMission = CockpitMission & {
  /**
   * Stable identifier for the saved mission entry.
   */
  id: string
  /**
   * User-facing mission name.
   */
  name: string
  /**
   * Optional user description for the mission.
   */
  description: string
  /**
   * Vehicle type the mission was planned for.
   */
  vehicleType?: MavType
  /**
   * Epoch milliseconds when the mission was first saved to the library.
   */
  createdAt: number
  /**
   * Epoch milliseconds when the mission was last updated in the library.
   */
  updatedAt: number
  /**
   * Mission estimates captured when the mission was saved.
   */
  estimates?: MissionEstimatesSnapshot
}

/**
 * Survey object that contains the information about the survey to be performed.
 */
export interface Survey {
  /**
   * Unique identification for the survey.
   */
  id: string
  /**
   * Coordinates of the polygon that will be surveyed.
   */
  polygonCoordinates: WaypointCoordinates[]
  /**
   * Density of the scan.
   */
  distanceBetweenLines: number
  /**
   * Angle of the survey lines.
   */
  surveyLinesAngle: number
  /**
   * Distance in meters to extend (positive) or inset (negative) from the polygon boundary before
   * the vehicle turns. Positive values fly past the edges; negative values keep the vehicle away.
   */
  turnaroundDistance: number
  /**
   * When true, the survey is flown a second time with the lines rotated 90 degrees, producing a
   * crosshatch grid. Useful for photogrammetry coverage. Optional for backwards compatibility.
   */
  crosshatch?: boolean
  /**
   * Executable mission waypoints.
   */
  waypoints: Waypoint[]
}

/**
 * Result of survey path generation, containing the full flight path
 * and optional turnaround segments at the polygon boundary.
 */
export interface SurveyPath {
  /**
   * The full continuous flight path including turnaround extensions or insets.
   */
  path: L.LatLng[]
  /**
   * Polyline segments representing the turnaround portions at the polygon boundary.
   * Each entry is a polyline connecting boundary ↔ turnaround points.
   */
  turnaroundSegments: L.LatLng[][]
  /**
   * Index in `path` where the crosshatch second pass (rotated 90°) begins. Undefined when crosshatch is disabled.
   */
  crosshatchStartIndex?: number
}

// TODO - Replace leaflet types with agnostic types
export type SurveyPolygon = {
  /**
   * The coordinates of the polygon that will be converted into a survey.
   */
  polygonPositions: WaypointCoordinates[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const instanceOfCockpitMission = (maybeMission: any): maybeMission is CockpitMission => {
  if (!maybeMission || typeof maybeMission !== 'object') {
    return false
  }

  const requiredKeys = ['version', 'settings', 'waypoints']
  const requiredSettingsKeys = [
    'mapCenter',
    'zoom',
    'currentWaypointAltitude',
    'currentWaypointAltitudeRefType',
    'defaultCruiseSpeed',
  ]

  const isValidMission =
    requiredKeys.every((key) => maybeMission[key] !== undefined) &&
    requiredSettingsKeys.every((key) => maybeMission.settings[key] !== undefined)

  return isValidMission
}

export type MissionLoadingCallback = (loadingPercentage: number) => Promise<void>
export const defaultLoadingCallback: MissionLoadingCallback = async (): Promise<void> => {
  return
}

/**
 * Geographical coordinates for a Point of Interest, in the format [latitude, longitude].
 */
export type PointOfInterestCoordinates = WaypointCoordinates

// For now, let's use string for icon and color. We can refine this later.
/**
 * Represents the icon for a Point of Interest.
 * For now, this is a string (e.g., mdi-icon-name or URL), but can be an enum later.
 */
export type PointOfInterestIcon = string
/**
 * Represents the color for a Point of Interest (e.g., hex code or color name).
 */
export type PointOfInterestColor = string

/**
 * Source for one of a POI's coordinates.
 * A `number` is a fixed/static value. A `string` is a data-lake expression (e.g.
 * "{{ mavlink/buoy/latitude }}") that is resolved live into the data lake.
 */
export type PoiCoordinateSource = number | string

/**
 * Interface representing a Point of Interest (POI) definition.
 * This is the persisted shape. The actual coordinates always live in the data lake (see
 * `poiLatitudeVariableId`/`poiLongitudeVariableId`); UI components consume `ResolvedPointOfInterest`.
 */
export interface PointOfInterest {
  /**
   * Unique identification for the POI.
   */
  id: string
  /**
   * Name of the POI.
   */
  name: string
  /**
   * Description of the POI.
   */
  description: string
  /**
   * Source for the POI latitude: a static number or a data-lake expression.
   */
  latitude: PoiCoordinateSource
  /**
   * Source for the POI longitude: a static number or a data-lake expression.
   */
  longitude: PoiCoordinateSource
  /**
   * Location shown before the live coordinates resolve, or when live data is unavailable.
   * For static POIs this matches the fixed coordinates.
   */
  fallbackCoordinates: PointOfInterestCoordinates
  /**
   * Icon representing the POI.
   */
  icon: PointOfInterestIcon
  /**
   * Color of the POI marker/icon.
   */
  color: PointOfInterestColor
  /** Timestamp of creation or last update */
  timestamp: number
}

/**
 * A POI with its coordinates resolved from the data lake. This is what UI components render.
 */
export interface ResolvedPointOfInterest extends PointOfInterest {
  /**
   * Current coordinates, read from the data lake. Falls back to `fallbackCoordinates` when the
   * live value is not available.
   */
  coordinates: PointOfInterestCoordinates
  /**
   * Whether any coordinate is driven by a live data-lake expression.
   */
  isLiveTracked: boolean
  /**
   * Whether live coordinates are currently available (always true for static POIs).
   */
  hasValidPosition: boolean
  /**
   * Id of the data-lake variable holding the POI's latitude.
   */
  latitudeVariableId: string
  /**
   * Id of the data-lake variable holding the POI's longitude.
   */
  longitudeVariableId: string
}

/**
 * CSS style properties for positioning a POI marker inside HUD components
 */
export interface PoiMarkerStyle {
  /**
   * Left position in pixels
   */
  left: string
  /**
   * Top position in pixels
   */
  top: string
  /**
   * CSS transform property
   */
  transform: string
  /**
   * Z-index for the marker
   */
  zIndex?: string
}

/**
 * Extended PointOfInterest interface with UI-specific rendering properties for use on HUD components
 */
export interface PoiMarker
  extends Omit<
    PointOfInterest,
    'id' | 'description' | 'timestamp' | 'coordinates' | 'latitude' | 'longitude' | 'fallbackCoordinates'
  > {
  /**
   * POI identifier (alias for PointOfInterest.id)
   */
  poiId: string
  /**
   * Size of the marker icon in pixels
   */
  size: number
  /**
   * Text to display for the distance to the POI
   */
  distanceText: string
  /**
   * Font size for the distance label in pixels
   */
  distanceFontSize: number
  /**
   * Opacity of the distance label (0-1 as string)
   */
  distanceLabelOpacity?: string
  /**
   * Z-index of the distance label
   */
  distanceLabelZIndex?: string
  /**
   * Whether the POI has been reached (within 1 meter)
   */
  isReached?: boolean
  /**
   * CSS style properties for positioning the marker on the HUD
   */
  style: PoiMarkerStyle
}

/**
 * Information about a highlighted POI marker
 */
export interface HighlightedPoiMarker {
  /**
   * POI identifier
   */
  poiId: string
  /**
   * Timestamp when the marker was highlighted
   */
  highlightedAt: number
  /**
   * Timestamp when the highlight expires
   */
  expiresAt: number
}

/**
 * Display information for a highlighted POI marker shown on the HUD side
 */
export interface HighlightedPoiMarkerDisplay {
  /**
   * Name of the POI
   */
  name: string
  /**
   * Text to display for the distance to the POI
   */
  distanceText: string
  /**
   * Whether the POI has been reached (within 1 meter)
   */
  isReached?: boolean
}

/**
 * Information about a reached POI marker
 */
export interface ReachedPoiMarker {
  /**
   * POI identifier
   */
  poiId: string
  /**
   * Timestamp when the POI was reached
   */
  reachedAt: number
  /**
   * Timestamp when the reached status expires
   */
  expiresAt: number
}

export type ClosestSegmentInfo = {
  /**
   * Index of the segment in the polyline.
   */
  segmentIndex: number
  /**
   * Closest point on the segment to the mouse cursor.
   */
  closestPointOnSegment: L.Point
  /**
   * Distance from the mouse cursor to the closest point on the segment.
   */
  distanceInPixels: number
}

/**
 * Interface representing a leg of a mission (a segment between two waypoints).
 */
export type MissionLeg = {
  /**
   * Distance of the leg in meters.
   */
  distanceMeters: number
  /**
   * Speed of the leg in meters per second.
   */
  speedMps: number
}

/**
 * Configuration for mission estimates.
 */
export interface MissionEstimatesByVehicleConfig {
  /**
   * Vehicle type as defined in MAVLink
   */
  vehicleType: MavType
  /**
   * The legs of the mission including speed and distance between waypoints.
   */
  legs: MissionLeg[]
  /**
   * The waypoints of the mission.
   */
  waypoints: Waypoint[]
  /**
   * Indicates if the vehicle has a high drag sensor.
   */
  hasHighDragSensor?: boolean
  /**
   * The extra payload weight in kilograms.
   */
  extraPayloadKg?: number
  /**
   * The battery capacity in watt-hours.
   */
  batteryCapacityWh?: number
  /**
   * The original battery mass in kilograms.
   */
  batteryChemistry?: BatteryChemistry
}

/**
 * Vehicle-specific mission estimates.
 */
export interface VehicleMissionEstimate {
  /**
   * Calculates the estimated time to complete the mission in seconds.
   */
  timeToCompleteMission: (inputs: MissionEstimatesByVehicleConfig) => number
  /**
   * Calculates the total energy consumption for the mission in watt-hours.
   */
  totalEnergy: (inputs: MissionEstimatesByVehicleConfig) => number
}

/**
 * Types of map tile providers supported.
 */
export type MapTileProvider = 'Esri World Imagery' | 'OpenStreetMap'

/**
 * User preference for the default map tile provider.
 * When set to 'Use last selected', the map opens with the last provider the user picked via the map's layer control.
 * Otherwise, the map is forced to open with the specified provider.
 */
export type MapTileProviderPreference = MapTileProvider | 'Use last selected'

/**
 * How a GeoTIFF map overlay's raster values are mapped to colors.
 * - `grayscale`: render RGB(A) rasters directly, or a single band as grey (sidescan mosaics, orthophotos).
 * - `intensity`: stretch a single band between its min/max as greyscale (backscatter).
 * - `bathymetry`: stretch a single band between its min/max onto a depth color ramp.
 */
export type MapOverlayRenderMode = 'grayscale' | 'intensity' | 'bathymetry'

/**
 * Geographic bounds of a map overlay in WGS84, as `[[south, west], [north, east]]`.
 */
export type MapOverlayBounds = [[number, number], [number, number]]

/**
 * Persisted metadata for a user-loaded GeoTIFF map overlay. The raster bytes are stored
 * separately (in IndexedDB) keyed by {@link MapOverlayMeta.id}.
 */
export interface MapOverlayMeta {
  /**
   * Unique id, also used as the storage key for the overlay's raster bytes.
   */
  id: string
  /**
   * User-facing name, derived from the original file name.
   */
  name: string
  /**
   * WGS84 bounds used to frame the overlay (e.g. "zoom to survey").
   */
  bounds: MapOverlayBounds
  /**
   * Layer opacity in the range [0, 1].
   */
  opacity: number
  /**
   * Whether the overlay is shown on the map by default.
   */
  visible: boolean
  /**
   * Color mapping applied to the raster values.
   */
  renderMode: MapOverlayRenderMode
  /**
   * Size of the stored raster in bytes.
   */
  fileSize: number
  /**
   * Creation timestamp (epoch milliseconds).
   */
  createdAt: number
}

export type IconDimensions = {
  /**
   * The size of the icon in pixels
   */
  iconSize: [number, number]
  /**
   * The anchor point of the icon in pixels
   */
  iconAnchor: [number, number]
}

export type MarkerSizes = 'xs' | 'sm' | 'md'
// POI Edge Arrows - Show arrows for POIs that are out of view
/**
 *
 */
export interface PoiEdgeArrow {
  /**
   * Unique identification for the POI.
   */
  poiId: string
  /**
   * CSS style object for the arrow.
   */
  style: {
    /**
     * Top position of the arrow.
     */
    top?: string
    /**
     * Bottom position of the arrow.
     */
    bottom?: string
    /**
     * Left position of the arrow.
     */
    left?: string
    /**
     * Right position of the arrow.
     */
    right?: string
    /**
     * Transform property for the arrow.
     */
    transform?: string
    /**
     * Margin around the arrow.
     */
    margin?: string
  }
  /**
   * Angle of the arrow.
   */
  angle: number
  /**
   * Tooltip text for the arrow.
   */
  tooltipText: string
  /**
   *
   */
  color: string
  /**
   * MDI icon class for the POI.
   */
  icon: string
}

export type Edge = 'top' | 'bottom' | 'left' | 'right'

// Edge intersection type for the edges of the map
export type EdgeIntersection = {
  /**
   * Intersection parameter
   */
  t: number
  /**
   * Edge name
   */
  edge: Edge
  /**
   * X coordinate
   */
  x: number
  /**
   * Y coordinate
   */
  y: number
}

/**
 * Edge arrow for a generic target (vehicle, home waypoint, or a second vehicle).
 */
export interface TargetEdgeArrow {
  /**
   * CSS style object for the arrow.
   */
  style: PoiEdgeArrow['style']
  /**
   * Angle of the arrow in degrees.
   */
  angle: number
  /**
   * Tooltip text for the arrow.
   */
  tooltipText: string
  /**
   * Color of the arrow.
   */
  color: string
}
