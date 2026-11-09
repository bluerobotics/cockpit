import { t } from 'ttag'
import { type Ref, ref, watch } from 'vue'

import { openSnackbar } from '@/composables/snackbar'
import {
  type PlacementAltitude,
  defaultPlacementAltitude,
  settlePlacementAltitude,
} from '@/libs/mission/waypoint-altitude'
import { sampleTerrain } from '@/libs/terrain/elevation-service'
import { type TerrainVehicleClass, terrainVehicleClass } from '@/libs/terrain/mission-profile'
import { useMissionStore } from '@/stores/mission'
import { useTerrainStore } from '@/stores/terrain'
import { type AltitudeReferenceType, type Waypoint } from '@/types/mission'

/**
 * The height the next waypoint laid on the map is placed at.
 */
export interface UseNextWaypointAltitudeReturn {
  /**
   * Height the next waypoint takes, in meters.
   */
  altitude: Ref<number>
  /**
   * What that height is measured from.
   */
  referenceType: Ref<AltitudeReferenceType>
  /**
   * Puts the height back to the default for the planned vehicle, dropping whatever was last used.
   */
  reset: () => void
  /**
   * Takes a height the user set on a waypoint, so the ones placed after it start there too.
   */
  adopt: (altitude: number, referenceType: AltitudeReferenceType) => void
  /**
   * Settles a waypoint just placed against the ground under it, writing the height back onto it.
   */
  settle: (waypoint: Waypoint) => Promise<void>
}

// Laying a path across a hillside settles every waypoint, and one notice covers the run.
const NOTICE_GAP_MS = 5000

/**
 * Keeps the height that newly placed waypoints take: 30 m over home for an aircraft, the
 * home-relative zero for everything else, following a height the user sets on a waypoint and
 * settling each placement against the terrain under it.
 * @returns {UseNextWaypointAltitudeReturn} The height, and the actions that move it.
 */
export const useNextWaypointAltitude = (): UseNextWaypointAltitudeReturn => {
  const missionStore = useMissionStore()
  const terrainStore = useTerrainStore()

  const vehicleClass = (): TerrainVehicleClass => terrainVehicleClass(missionStore.effectiveVehicleType)

  const initial = defaultPlacementAltitude(vehicleClass())
  const altitude = ref(initial.altitude)
  const referenceType = ref(initial.altitudeReferenceType)

  const reset = (): void => {
    const next = defaultPlacementAltitude(vehicleClass())
    altitude.value = next.altitude
    referenceType.value = next.altitudeReferenceType
  }

  const adopt = (newAltitude: number, newReferenceType: AltitudeReferenceType): void => {
    altitude.value = newAltitude
    referenceType.value = newReferenceType
  }

  // Planning offline for a boat and then connecting an aircraft would otherwise leave the aircraft on the
  // boat's zero. Only an empty mission re-defaults; a started one keeps the heights it was planned at.
  watch(vehicleClass, () => missionStore.currentPlanningWaypoints.length === 0 && reset())

  let lastNoticeMs = 0

  const notify = (settled: PlacementAltitude): void => {
    if (Date.now() - lastNoticeMs < NOTICE_GAP_MS) return
    lastNoticeMs = Date.now()
    const message = t`Waypoint raised to ${settled.altitude} m, to keep it clear of the terrain.`
    openSnackbar({ variant: 'info', message, duration: 4000 })
  }

  const settle = async (waypoint: Waypoint): Promise<void> => {
    if (vehicleClass() !== 'air') return
    const home = missionStore.plannedHomePosition ?? missionStore.homeMarkerPosition
    const wanted: PlacementAltitude = {
      altitude: waypoint.altitude,
      altitudeReferenceType: waypoint.altitudeReferenceType,
    }
    // A model that cannot be read leaves the waypoint at the height it was placed at, as no data does.
    const [groundAtWaypointM, groundAtHomeM = null] = await sampleTerrain(
      home ? [waypoint.coordinates, home] : [waypoint.coordinates],
      { mode: 'bilinear' }
    ).catch(() => [null, null])
    const settled = settlePlacementAltitude(wanted, {
      vehicleClass: vehicleClass(),
      groundAtWaypointM,
      groundAtHomeM,
      waterLevelM: terrainStore.waterLevelNowM(),
      clearanceM: terrainStore.settings.minimumClearanceM + terrainStore.effectiveSource.verticalUncertaintyM,
    })
    if (settled === wanted) return
    // The waypoint may be gone or already edited by now: the tiles take a moment to read.
    const live = missionStore.currentPlanningWaypoints.find(({ id }) => id === waypoint.id)
    const untouched = live?.altitude === wanted.altitude && live.altitudeReferenceType === wanted.altitudeReferenceType
    if (!live || !untouched) return
    live.altitude = settled.altitude
    live.altitudeReferenceType = settled.altitudeReferenceType
    notify(settled)
  }

  return { altitude, referenceType, reset, adopt, settle }
}
