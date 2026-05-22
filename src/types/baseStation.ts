import type { WaypointCoordinates } from '@/types/mission'

export type BaseStationConfig = {
  /**
   * Whether the base station is placed on the map. False until the user sets a position.
   */
  enabled: boolean
  /**
   * Geographical position of the base station as [latitude, longitude].
   */
  position: WaypointCoordinates | null
}

export const DEFAULT_BASE_STATION_CONFIG: BaseStationConfig = {
  enabled: false,
  position: null,
}
