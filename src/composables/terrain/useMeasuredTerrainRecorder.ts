import { useIntervalFn } from '@vueuse/core'
import { type Ref, markRaw, ref, watch } from 'vue'

import type { Package } from '@/libs/connection/m2r/messages/mavlink2rest'
import { MAVLinkType, MavSensorOrientation } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import type { Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'
import { setTerrainOverride } from '@/libs/terrain/elevation-service'
import {
  type MeasuredTerrain,
  addMeasurement,
  groundFromRange,
  loadMeasuredTerrain,
  measuredHeightAt,
  saveMeasuredTerrain,
} from '@/libs/terrain/measured-terrain'
import { terrainVehicleClass } from '@/libs/terrain/mission-profile'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import type { TerrainSettings } from '@/types/terrain'

/**
 * Terrain measured by the vehicle's own downward rangefinder or sonar.
 */
export interface UseMeasuredTerrainRecorderReturn {
  /**
   * Measured cells, changed in place; watch {@link measuredVersion} to follow them.
   */
  measured: MeasuredTerrain
  /**
   * Increases every time a measurement is added or the cells are cleared.
   */
  measuredVersion: Ref<number>
  /**
   * Whether a downward range reading arrived in the last few seconds.
   */
  receivingRange: Ref<boolean>
  /**
   * Forgets every measurement, here and in storage.
   */
  clearMeasured: () => Promise<void>
}

// Five a second is plenty at mission speeds and keeps a long survey to a few hundred thousand readings.
const MIN_READING_INTERVAL_MS = 200
const SAVE_INTERVAL_MS = 30000
const RANGE_STALE_MS = 3000
const MAX_POSE_AGE_MS = 1000

const enumType = (value: unknown): string | undefined =>
  (
    value as
      | {
          /**
           * Enum entry name, the way mavlink2rest sends enum fields.
           */
          type?: string
        }
      | undefined
  )?.type

/**
 * Records the ground or seabed the vehicle measures under itself while the setting is on, keeps it on
 * this computer, and lets it replace the model wherever it is known. Created once, by the terrain store.
 * @param {Ref<TerrainSettings>} settings Terrain settings.
 * @param {() => number} waterLevelNowM Water surface height now, tide included.
 * @returns {UseMeasuredTerrainRecorderReturn} Measured cells and whether readings are arriving.
 */
export const useMeasuredTerrainRecorder = (
  settings: Ref<TerrainSettings>,
  waterLevelNowM: () => number
): UseMeasuredTerrainRecorderReturn => {
  const vehicleStore = useMainVehicleStore()
  // Raw, because a long survey holds tens of thousands of cells that nothing needs to track one by one.
  const measured: MeasuredTerrain = markRaw(new Map())
  const measuredVersion = ref(0)
  const receivingRange = ref(false)
  let position: Message.GlobalPositionInt | undefined
  let attitude: Message.Attitude | undefined
  let positionAtMs = 0
  let attitudeAtMs = 0
  let lastReadingMs = 0
  let lastRecordedMs = 0
  let lastSavedMs = 0
  let changedSinceSave = false
  let loaded = false

  void loadMeasuredTerrain().then((stored) => {
    // Unreadable storage is left alone rather than saved over with this session's readings alone.
    if (!stored) return
    // Readings taken before storage answered are kept on top of what was stored, not replaced by it.
    stored.forEach((cell, key) => {
      if (!measured.has(key)) measured.set(key, cell)
    })
    loaded = true
    measuredVersion.value += 1
  })

  const onPosition = (pack: Package): void => {
    position = pack.message as Message.GlobalPositionInt
    positionAtMs = Date.now()
  }
  const onAttitude = (pack: Package): void => {
    attitude = pack.message as Message.Attitude
    attitudeAtMs = Date.now()
  }
  const onDistance = (pack: Package): void => {
    const reading = pack.message as Message.DistanceSensor
    if (enumType(reading.orientation) !== MavSensorOrientation.MAV_SENSOR_ROTATION_PITCH_270) return
    lastReadingMs = Date.now()
    receivingRange.value = true
    if (!settings.value.measuredTerrainEnabled || !settings.value.recordMeasuredTerrain || !position || !attitude)
      return
    // A pose from before a telemetry gap would place the reading where the vehicle no longer is.
    if (lastReadingMs - Math.min(positionAtMs, attitudeAtMs) > MAX_POSE_AGE_MS) return
    // A quality of 1 is the sensor itself reporting the reading as invalid; 0 means it does not say.
    if (reading.signal_quality === 1) return
    if (reading.current_distance <= reading.min_distance || reading.current_distance >= reading.max_distance) return
    if (lastReadingMs - lastRecordedMs < MIN_READING_INTERVAL_MS) return

    const vehicleClass = terrainVehicleClass(vehicleStore.vehicleType)
    const waterLevelM = waterLevelNowM()
    const vehicleAmslM =
      vehicleClass === 'underwater' ? waterLevelM + position.relative_alt / 1000 : position.alt / 1000
    const ground = groundFromRange({
      vehicleClass,
      vehicleAmslM,
      rangeM: reading.current_distance / 100,
      rollRad: attitude.roll,
      pitchRad: attitude.pitch,
      waterLevelM,
      transducerDepthM: settings.value.vesselDraftM,
    })
    if (ground === null) return
    addMeasurement(measured, [position.lat / 1e7, position.lon / 1e7], ground, lastReadingMs)
    lastRecordedMs = lastReadingMs
    measuredVersion.value += 1
    changedSinceSave = true
  }

  watch(
    () => vehicleStore.mainVehicle,
    (vehicle, previous) => {
      previous?.onIncomingMAVLinkMessage.remove(MAVLinkType.GLOBAL_POSITION_INT, onPosition)
      previous?.onIncomingMAVLinkMessage.remove(MAVLinkType.ATTITUDE, onAttitude)
      previous?.onIncomingMAVLinkMessage.remove(MAVLinkType.DISTANCE_SENSOR, onDistance)
      vehicle?.onIncomingMAVLinkMessage.add(MAVLinkType.GLOBAL_POSITION_INT, onPosition)
      vehicle?.onIncomingMAVLinkMessage.add(MAVLinkType.ATTITUDE, onAttitude)
      vehicle?.onIncomingMAVLinkMessage.add(MAVLinkType.DISTANCE_SENSOR, onDistance)
      position = undefined
      attitude = undefined
    },
    { immediate: true }
  )

  useIntervalFn(() => {
    receivingRange.value = Date.now() - lastReadingMs < RANGE_STALE_MS
    if (!changedSinceSave || !loaded || Date.now() - lastSavedMs < SAVE_INTERVAL_MS) return
    changedSinceSave = false
    lastSavedMs = Date.now()
    saveMeasuredTerrain(measured).catch((error) => console.warn('Could not keep the measured terrain:', error))
  }, SAVE_INTERVAL_MS / 10)

  watch(
    () => settings.value.measuredTerrainEnabled && settings.value.useMeasuredTerrain,
    (use) => setTerrainOverride(use ? (coordinates) => measuredHeightAt(measured, coordinates) : undefined),
    { immediate: true }
  )

  const clearMeasured = async (): Promise<void> => {
    measured.clear()
    changedSinceSave = false
    measuredVersion.value += 1
    await saveMeasuredTerrain(measured)
  }

  return { measured, measuredVersion, receivingRange, clearMeasured }
}
