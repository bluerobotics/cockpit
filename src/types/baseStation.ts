import type { WaypointCoordinates } from '@/types/mission'

/**
 * Topside computer mount type. Mobile is typically a laptop or tablet, fixed is a stationary
 * computer at the base station.
 */
export enum TopSideComputerType {
  Mobile = 'Mobile',
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
   * the radio-horizon range model.
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

export const DEFAULT_BASE_STATION_CONFIG: BaseStationConfig = {
  enabled: false,
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
  coverageColor: '#3B82F6',
  coverageOpacity: 1,
}
