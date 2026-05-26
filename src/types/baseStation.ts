import type { WaypointCoordinates } from '@/types/mission'

/**
 * Topside computer mount type. Portable means the base station may move during deployment,
 * while fixed stays at a stationary location.
 */
export enum TopSideComputerType {
  Portable = 'Portable',
  Fixed = 'Fixed',
}

/**
 * Communication link type between the topside (base station) and the vehicle.
 */
export enum BaseStationCommsType {
  Tethered = 'Tethered',
  MobileData = 'Mobile data (4G/5G)',
  RadioLink = 'Radio link',
}

/**
 * Radio base station product family, used to seed antenna defaults.
 */
export enum RadioBaseStationKind {
  BlueRobotics = 'Blue Robotics BaseStation',
  Custom = 'Custom',
}

/**
 * Antenna form factor. Determines the shape of the coverage drawn on the map (full circle
 * for omni, sector/cone for directional ones) and seeds gain/beamwidth/range defaults.
 */
export enum AntennaType {
  Omni = 'Omnidirectional',
  Panel = 'Panel',
  Yagi = 'Yagi',
}

/**
 * Source of the cellular coverage overlay shown when {@link BaseStationCommsType.MobileData} is selected.
 */
export enum MobileCoverageProvider {
  OpenCellID = 'OpenCellID',
  OSMOverpass = 'OSM Overpass',
  Custom = 'Custom overlay',
}

export const MOBILE_COVERAGE_FETCH_DROP_MIME = 'application/x-cockpit-mobile-coverage-fetch'

/**
 * Visualization mode for the mobile coverage overlay.
 */
export enum MobileCoverageDisplayMode {
  Heatmap = 'Heatmap',
  CoverageRings = 'Coverage rings',
}

export type MobileCoverageConfig = {
  /**
   * Active coverage data provider.
   */
  provider: MobileCoverageProvider
  /**
   * OpenCellID API key. Required when {@link provider} is {@link MobileCoverageProvider.OpenCellID}.
   */
  openCellIdApiKey: string
  /**
   * Selected OpenCellID operator/network code label. Empty string keeps all returned networks.
   */
  openCellIdOperator: string
  /**
   * Leaflet `TileLayer` URL template (with `{z}/{x}/{y}` placeholders). Required when
   * {@link provider} is {@link MobileCoverageProvider.Custom}.
   */
  customTileUrl: string
  /**
   * OSM operator name to filter by when {@link provider} is {@link MobileCoverageProvider.OSMOverpass}.
   * Empty string keeps all operators.
   */
  osmOperator: string
  /**
   * Visualization mode for OpenCellID overlays.
   */
  displayMode: MobileCoverageDisplayMode
  /**
   * Opacity multiplier (0..1) applied to mobile coverage overlays.
   */
  overlayOpacity: number
  /**
   * Show the operator/technology labels rendered along the rim of each coverage ring.
   */
  showRingLabels: boolean
  /**
   * Heatmap intensity (0..1). Scales the heat radius so 0 keeps a tight, low-opacity blob and
   * 1 spreads it out to roughly match the coverage rings.
   */
  heatmapIntensity: number
}

/* eslint-disable jsdoc/require-jsdoc -- Self-describing geo bbox in WGS84 degrees. */
export type CoverageBbox = { south: number; west: number; north: number; east: number }
/* eslint-enable jsdoc/require-jsdoc */

/* eslint-disable jsdoc/require-jsdoc -- OpenCellID transport DTO; fields mirror the upstream API. */
export type CachedOpenCellIdSite = {
  lat: number
  lon: number
  rangeMeters: number
  radio?: string
  mcc?: number
  mnc?: number
  lac?: number
  cellId?: number
  samples?: number
  averageSignalStrength?: number
}
/* eslint-enable jsdoc/require-jsdoc */

/* eslint-disable jsdoc/require-jsdoc -- OSM Overpass transport DTO; fields mirror the upstream API. */
export type CachedOverpassTower = {
  id: number
  lat: number
  lon: number
  operator: string | null
  tags: Record<string, string>
}
/* eslint-enable jsdoc/require-jsdoc */

/* eslint-disable jsdoc/require-jsdoc -- Generic cache envelope; fields are self-describing. */
export type CachedMobileCoverageEntry<T> = {
  bbox: CoverageBbox
  fetchedAtMs: number
  data: T[]
}

export type MobileCoverageCache = {
  openCellId: CachedMobileCoverageEntry<CachedOpenCellIdSite>[]
  osmOverpass: CachedMobileCoverageEntry<CachedOverpassTower>[]
}
/* eslint-enable jsdoc/require-jsdoc */

export type AntennaSpec = {
  /**
   * Antenna form factor.
   */
  type: AntennaType
  /**
   * Antenna gain in dBi.
   */
  gain: number
  /**
   * Horizontal beamwidth in degrees. Use 360 for omnidirectional antennas.
   */
  beamwidth: number
  /**
   * Practical communication range in meters used to draw the coverage on the map.
   */
  range: number
  /**
   * Bearing/azimuth of the antenna boresight in degrees, where 0 = north and angles grow clockwise.
   * Ignored for omnidirectional antennas.
   */
  bearing: number
}

export type BaseStationConfig = {
  /**
   * Whether the base station is placed on the map. False until the user sets a position.
   */
  enabled: boolean
  /**
   * Optional label shown under the marker when non-empty.
   */
  name: string
  /**
   * Geographical position of the base station as [latitude, longitude].
   */
  position: WaypointCoordinates | null
  /**
   * Topside computer mount type.
   */
  topSideComputerType: TopSideComputerType
  /**
   * Whether to keep the base-station position synced with the operator's GPS (browser Geolocation API).
   */
  trackByGps: boolean
  /**
   * Communication link type between the topside and the vehicle.
   */
  commsType: BaseStationCommsType
  /**
   * Radio base station product family. Only used when {@link commsType} is RadioLink.
   */
  radioBaseStationKind: RadioBaseStationKind
  /**
   * Antenna parameters used to draw coverage. Only used when {@link commsType} is RadioLink.
   */
  antenna: AntennaSpec
  /**
   * Height of the base-station antenna above ground in meters. Map coverage scales with √height using
   * the radio-horizon model (see {@link baseStationAntennaHeightRangeMultiplier}).
   */
  baseStationAntennaHeightMeters: number
  /**
   * Whether the vehicle mounts the BlueBoat Antenna and Accessory Mast (vehicle-side extender).
   * When true, map coverage uses {@link BLUEBOAT_ANTENNA_MAST_RANGE_MULTIPLIER}× the entered range.
   */
  vehicleHasBlueBoatAntennaMast: boolean
  /**
   * Tether length in meters used to draw coverage. Only used when {@link commsType} is Tethered.
   */
  tetherLengthMeters: number
  /**
   * Cellular coverage overlay configuration. Only used when {@link commsType} is MobileData.
   */
  mobileCoverage: MobileCoverageConfig
  /**
   * Transmitter power in milliwatts. Drives a Friis-based range scaling
   * (range ∝ √P_t) when the operator picks a Custom radio.
   */
  txPowerMilliwatts: number
  /**
   * Hex color used to render the projected antenna signal coverage on the map.
   */
  coverageColor: string
  /**
   * Multiplier (0..1) applied to the coverage fill opacity. 1.0 keeps the default look, 0 makes it
   * invisible.
   */
  coverageOpacity: number
}

/**
 * Factory antenna specs derived from the BlueBoat BaseStation and Directional Antenna Kit guides.
 * Range values are the practical (rest-of-world) ranges from BR's tested data; gain values are
 * the rest-of-world recommended values that account for connector loss.
 *
 * Sources: bluerobotics.com/store/boat/blueboat-components-spares/basestation and
 * bluerobotics.com/learn/directional-antenna-guide.
 */
export const ANTENNA_FACTORY_DEFAULTS: Record<AntennaType, Omit<AntennaSpec, 'bearing'>> = {
  [AntennaType.Omni]: { type: AntennaType.Omni, gain: 7, beamwidth: 360, range: 250 },
  [AntennaType.Panel]: { type: AntennaType.Panel, gain: 12, beamwidth: 40, range: 500 },
  [AntennaType.Yagi]: { type: AntennaType.Yagi, gain: 16, beamwidth: 25, range: 800 },
}

/**
 * BlueRobotics BaseStation TX power (Microhard pMDDL/pDDL 900 MHz, 1 W max).
 */
export const BLUE_ROBOTICS_TX_POWER_MW = 1000

/**
 * Communication range multiplier with the BlueBoat Antenna and Accessory Mast on the vehicle.
 * @see https://bluerobotics.com/store/boat/blueboat-accessories/blueboat-antenna-and-accessory-mast/
 */
export const BLUEBOAT_ANTENNA_MAST_RANGE_MULTIPLIER = 1.75

/**
 * Reference base-station antenna height (m). Factory range values assume roughly this height on a
 * typical tripod or short mast.
 */
export const DEFAULT_BASE_STATION_ANTENNA_HEIGHT_METERS = 1

const MIN_BASE_STATION_ANTENNA_HEIGHT_METERS = 0.5
const MAX_BASE_STATION_ANTENNA_HEIGHT_METERS = 50

/**
 * Range multiplier from base-station antenna height. Over flat water/terrain, radio horizon distance
 * scales as √h (d_km ≈ 4.12·√h with standard 4/3 Earth-radius refraction), so practical range grows
 * with the square root of height relative to {@link DEFAULT_BASE_STATION_ANTENNA_HEIGHT_METERS}.
 * @param {number} heightMeters Antenna height above ground in meters.
 * @returns {number} Multiplier applied to the entered range for map coverage.
 */
export const baseStationAntennaHeightRangeMultiplier = (heightMeters: number): number => {
  const clamped = Math.min(
    MAX_BASE_STATION_ANTENNA_HEIGHT_METERS,
    Math.max(MIN_BASE_STATION_ANTENNA_HEIGHT_METERS, heightMeters)
  )
  return Math.sqrt(clamped / DEFAULT_BASE_STATION_ANTENNA_HEIGHT_METERS)
}

/**
 * Practical antenna range (m) used for map coverage, including height and vehicle mast adjustments.
 * @param {BaseStationConfig} config Current base-station configuration.
 * @returns {number} Range in meters for overlay geometry.
 */
export const effectiveAntennaRangeMeters = (config: BaseStationConfig): number => {
  if (config.commsType !== BaseStationCommsType.RadioLink) return config.antenna.range

  let range = config.antenna.range * baseStationAntennaHeightRangeMultiplier(config.baseStationAntennaHeightMeters)
  if (config.vehicleHasBlueBoatAntennaMast) range *= BLUEBOAT_ANTENNA_MAST_RANGE_MULTIPLIER

  return Math.max(1, Math.round(range))
}

export const DEFAULT_BASE_STATION_CONFIG: BaseStationConfig = {
  enabled: false,
  name: '',
  position: null,
  topSideComputerType: TopSideComputerType.Fixed,
  trackByGps: false,
  commsType: BaseStationCommsType.RadioLink,
  radioBaseStationKind: RadioBaseStationKind.BlueRobotics,
  antenna: { ...ANTENNA_FACTORY_DEFAULTS[AntennaType.Omni], bearing: 0 },
  baseStationAntennaHeightMeters: DEFAULT_BASE_STATION_ANTENNA_HEIGHT_METERS,
  vehicleHasBlueBoatAntennaMast: false,
  tetherLengthMeters: 150,
  txPowerMilliwatts: BLUE_ROBOTICS_TX_POWER_MW,
  mobileCoverage: {
    provider: MobileCoverageProvider.OpenCellID,
    openCellIdApiKey: '',
    openCellIdOperator: '',
    customTileUrl: '',
    osmOperator: '',
    displayMode: MobileCoverageDisplayMode.Heatmap,
    overlayOpacity: 0.3,
    showRingLabels: true,
    heatmapIntensity: 0.5,
  },
  coverageColor: '#3B82F6',
  coverageOpacity: 1,
}

export const DEFAULT_MOBILE_COVERAGE_CACHE: MobileCoverageCache = {
  openCellId: [],
  osmOverpass: [],
}

/**
 * Bounding box payload accepted by the OpenCellID `getInArea` endpoint, plus the API key the
 * caller wants to use (omitted to fall back to the anonymous public endpoint).
 */
/* eslint-disable jsdoc/require-jsdoc -- Field names mirror the OpenCellID HTTP contract. */
export type OpenCellIdBboxRequest = {
  west: number
  south: number
  east: number
  north: number
  apiKey?: string
}
/* eslint-enable jsdoc/require-jsdoc */

/**
 * Single OpenCellID cell record after normalization. `range` is the published reach in meters
 * and is preserved so callers can render proportionally sized rings or weight heatmaps.
 */
/* eslint-disable jsdoc/require-jsdoc -- Field names mirror the OpenCellID HTTP contract. */
export type NearbyOpenCellIdCell = {
  lat: number
  lon: number
  range?: number
  radio?: string
  mcc?: number
  mnc?: number
  lac?: number
  cellId?: number
  samples?: number
  averageSignalStrength?: number
}
/* eslint-enable jsdoc/require-jsdoc */
