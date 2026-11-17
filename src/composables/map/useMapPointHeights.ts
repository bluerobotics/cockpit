import { useMissionTerrain } from '@/composables/terrain/useMissionTerrain'
import { useDataLakeVariable } from '@/composables/useDataLakeVariable'
import { useResolvedDataLakeTemplate } from '@/composables/useResolvedDataLakeTemplate'
import { amslAltitudeVariableId } from '@/libs/data-sources/altitude'
import { sampleTerrain } from '@/libs/terrain/elevation-service'
import { pointAltitudesAmsl } from '@/libs/terrain/mission-profile'
import { missionProfilePoints } from '@/libs/terrain/mission-terrain'
import { convertValueTo } from '@/libs/units'
import type { Waypoint, WaypointCoordinates } from '@/types/mission'

/** Return type of {@link useMapPointHeights}. */
export interface UseMapPointHeightsReturn {
  /** The vehicle's altitude above sea level, in meters, null while unknown. */
  vehicleAltitudeAmslM: () => number | null
  /** A waypoint's height above sea level, in meters, resolving terrain-relative ones against the terrain. */
  waypointAltitudeAmslM: (waypoint: Waypoint, home: WaypointCoordinates | undefined) => Promise<number | null>
}

/**
 * Heights above sea level of the vehicle and of waypoints, as the map's readouts report them.
 * @returns {UseMapPointHeightsReturn} The height readers.
 */
export const useMapPointHeights = (): UseMapPointHeightsReturn => {
  const terrain = useMissionTerrain()
  const altitudeId = useResolvedDataLakeTemplate(() => amslAltitudeVariableId)
  const { value: rawAltitude, unit: rawAltitudeUnit } = useDataLakeVariable(altitudeId)

  const vehicleAltitudeAmslM = (): number | null =>
    altitudeId.value === undefined || typeof rawAltitude.value !== 'number'
      ? null
      : convertValueTo(rawAltitude.value, rawAltitudeUnit.value, 'm')

  const waypointAltitudeAmslM = async (
    waypoint: Waypoint,
    home: WaypointCoordinates | undefined
  ): Promise<number | null> => {
    const points = missionProfilePoints([waypoint], home)
    const ground = await sampleTerrain(
      points.map((point) => point.coordinates),
      { mode: 'bilinear' }
    )
    return pointAltitudesAmsl(points, ground, terrain.context()).at(-1) ?? null
  }

  return { vehicleAltitudeAmslM, waypointAltitudeAmslM }
}
