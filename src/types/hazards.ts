import type { GeoBbox } from '@/types/general'
import type { WaypointCoordinates } from '@/types/mission'

/**
 * External datasets the advisory layer can consult. None of them is an authoritative navigation
 * source, so everything derived from them is advisory only.
 */
export type HazardSourceId = 'coastline' | 'restricted-waters' | 'seamarks' | 'airspace' | 'terrain' | 'shallow-water'

/** Sources whose areas are traced from the sampled elevation grid rather than published ready-made. */
export type HazardGridSourceId = 'terrain' | 'shallow-water'

/** Sources that publish ready-made areas. */
export type HazardAreaSourceId = Exclude<HazardSourceId, HazardGridSourceId>

/**
 * A single area published by one of the hazard sources, in the shape the map draws, the mission
 * checks run against, and the fence conversion consumes.
 */
export interface HazardArea {
  /**
   * Stable identifier, derived from the source and the upstream element id.
   */
  id: string
  /**
   * Source this area came from.
   */
  sourceId: HazardSourceId
  /**
   * Whether the coordinates describe an open path (a coastline) or a closed ring (an area).
   */
  kind: 'line' | 'polygon'
  /**
   * Ordered `[latitude, longitude]` vertices. Rings are open: the closing vertex is implicit.
   */
  coordinates: WaypointCoordinates[]
  /**
   * Rings cut out of a polygon, open like `coordinates`. Only areas traced from the elevation grid have them.
   */
  holes?: WaypointCoordinates[][]
  /**
   * Operator-facing name, falling back to a source-derived description when the data is unnamed.
   */
  label: string
  /**
   * Lower edge of the declared vertical band, in meters above mean sea level, when the source
   * publishes one. Only airspace does.
   */
  lowerLimitM?: number
  /**
   * Upper edge of the declared vertical band, in meters above mean sea level, when published.
   */
  upperLimitM?: number
  /**
   * Further facts the source publishes about the area, one operator-readable line each.
   */
  details?: string[]
}

/**
 * How a mission interacts with a hazard. The ground kinds and `outside-coverage` are not tied to an area.
 */
export type HazardAdvisoryKind =
  | 'inside'
  | 'crossing'
  | 'proximity'
  | 'terrain-clearance'
  | 'shallow-water'
  | 'outside-coverage'

/**
 * One finding raised by checking a mission against the loaded hazard data.
 */
export interface HazardAdvisory {
  /**
   * Stable identifier for the finding, so repeated checks do not duplicate list entries.
   */
  id: string
  /**
   * Source that raised the finding, absent for findings about the loaded data as a whole.
   */
  sourceId?: HazardSourceId
  /**
   * Area the finding is about, absent for findings not tied to one (terrain clearance).
   */
  areaId?: string
  /**
   * What the mission does to the hazard.
   */
  kind: HazardAdvisoryKind
  /**
   * Operator-facing summary, naming the area and the waypoints involved.
   */
  message: string
  /**
   * Indices, within the checked waypoint list, of the waypoints the finding refers to.
   */
  waypointIndices: number[]
}

/**
 * A box hazard data was loaded for, less the parts of it the operator has cleared since.
 */
export interface HazardCoverage {
  /**
   * Area the data was loaded for.
   */
  bbox: GeoBbox
  /**
   * Boxes inside `bbox` whose data was cleared, which read as not loaded again.
   */
  clearedBboxes?: GeoBbox[]
  /**
   * Epoch milliseconds of the last clear, so the copy stored then replaces the one saved at the load.
   */
  clearedAtMs?: number
}

/**
 * The areas one source published for one bounding box, as returned by a fetch and as cached.
 */
export interface HazardFetchResult extends HazardCoverage {
  /**
   * Source the areas came from.
   */
  sourceId: HazardAreaSourceId
  /**
   * Area the fetch covered. Anything outside it is simply unknown, not clear.
   */
  bbox: GeoBbox
  /**
   * Epoch milliseconds the fetch completed at, shown to the operator as the data's age.
   */
  fetchedAtMs: number
  /**
   * Areas the source published inside `bbox`.
   */
  areas: HazardArea[]
  /**
   * True when the source had more areas than the fetch kept, so the operator knows the picture is
   * partial and should zoom in.
   */
  truncated: boolean
}

/**
 * Ground elevation sampled on a regular grid over one bounding box, from which terrain areas are traced.
 */
export interface TerrainGrid extends HazardCoverage {
  /**
   * Area the grid covers, its corners being the outermost samples.
   */
  bbox: GeoBbox
  /**
   * Epoch milliseconds the sampling completed at.
   */
  fetchedAtMs: number
  /**
   * Samples per row, west to east.
   */
  columns: number
  /**
   * Rows of samples, south to north.
   */
  rows: number
  /**
   * Ground elevation in meters above sea level, row-major from the south-west corner, `null` where
   * the elevation tile could not be loaded.
   */
  elevationsM: (number | null)[]
}

/**
 * Operator-tunable behavior of the advisory layer.
 */
export interface HazardAdvisorySettings {
  /**
   * Sources the operator wants consulted.
   */
  enabledSources: HazardSourceId[]
  /**
   * Flag a waypoint that comes within this distance of a hazard area, in meters.
   */
  proximityMarginMeters: number
  /**
   * Ground higher than this elevation above sea level, in meters, is marked and flagged under waypoints.
   */
  terrainClearanceMeters: number
  /**
   * Water this deep or less, in meters below sea level, is marked and flagged under waypoints.
   */
  shallowWaterDepthMeters: number
  /**
   * Alert the operator when the vehicle itself comes within the clearance margin of a loaded area.
   */
  liveAlerts: boolean
  /**
   * Largest number of vertices a hazard area may keep when converted into a fence exclusion
   * polygon, so a simplified coastline still fits the autopilot's fence storage.
   */
  exclusionVertexBudget: number
}
