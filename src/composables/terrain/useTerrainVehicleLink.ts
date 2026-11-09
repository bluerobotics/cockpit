import { type Ref, ref, shallowRef, watch } from 'vue'

import { sendMavlinkMessage } from '@/libs/communication/mavlink'
import type { Package } from '@/libs/connection/m2r/messages/mavlink2rest'
import { MAVLinkType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import type { Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'
import { sampleTerrain } from '@/libs/terrain/elevation-service'
import { surfaceHeight } from '@/libs/terrain/mission-profile'
import { terrainZoomForSpacing } from '@/libs/terrain/tiles'
import {
  checkTerrainProtocolOnce,
  requestedTerrainBlocks,
  terrainBlockData,
  terrainBlockPoints,
} from '@/libs/vehicle/mavlink/terrain-protocol'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import type { WaypointCoordinates } from '@/types/mission'
import type { TerrainSettings } from '@/types/terrain'

/**
 * The vehicle's answer about its terrain at one position.
 */
export interface VehicleTerrainCheck {
  /**
   * Position checked.
   */
  coordinates: WaypointCoordinates
  /**
   * Whether the vehicle holds terrain there.
   */
  available: boolean
  /**
   * Terrain height the vehicle holds, meters above sea level, when available.
   */
  vehicleHeightM: number | null
}

/**
 * The latest terrain report the vehicle sent, with when it arrived.
 */
export type ReceivedTerrainReport = Message.TerrainReport & {
  /**
   * Arrival time, in milliseconds since the epoch.
   */
  receivedAtMs: number
}

/**
 * Cockpit's side of the ArduPilot terrain protocol.
 */
export interface UseTerrainVehicleLinkReturn {
  /**
   * Terrain blocks sent to the vehicle this session.
   */
  servedBlocks: Ref<number>
  /**
   * When the vehicle last asked for terrain, in milliseconds since the epoch.
   */
  lastRequestAtMs: Ref<number | null>
  /**
   * The vehicle's latest terrain report.
   */
  lastReport: Ref<ReceivedTerrainReport | null>
  /**
   * Asks the vehicle, one position at a time, whether it holds terrain there and at what height.
   */
  checkVehicleTerrain: (points: WaypointCoordinates[]) => Promise<VehicleTerrainCheck[]>
}

const CHECK_TIMEOUT_MS = 1500

/**
 * Answers the vehicle's terrain requests from Cockpit's terrain model, as QGroundControl does, so an
 * ArduPilot vehicle without terrain on its SD card can follow terrain, and tracks its terrain reports.
 * Created once, by the terrain store, for the life of the application.
 * @param {Ref<TerrainSettings>} settings Terrain settings.
 * @returns {UseTerrainVehicleLinkReturn} Served counts, the latest report, and the terrain check.
 */
export const useTerrainVehicleLink = (settings: Ref<TerrainSettings>): UseTerrainVehicleLinkReturn => {
  const vehicleStore = useMainVehicleStore()
  const servedBlocks = ref(0)
  const lastRequestAtMs = ref<number | null>(null)
  const lastReport = shallowRef<ReceivedTerrainReport | null>(null)
  const answering = new Set<string>()
  let pendingCheck: ((report: Message.TerrainReport) => void) | undefined

  const answerTerrainRequest = async (pack: Package): Promise<void> => {
    if (!settings.value.serveTerrainToVehicle) return
    checkTerrainProtocolOnce()
    const request = pack.message as Message.TerrainRequest
    lastRequestAtMs.value = Date.now()
    // The vehicle repeats a request until every block arrives, so one still being answered is skipped.
    const key = `${request.lat}/${request.lon}/${request.grid_spacing}`
    if (answering.has(key)) return
    answering.add(key)
    try {
      const blocks = requestedTerrainBlocks(request.mask)
      const points = blocks.flatMap((block) =>
        terrainBlockPoints(request.lat, request.lon, request.grid_spacing, block)
      )
      // Four model pixels per grid step, so a widely spaced grid does not read hundreds of fine tiles.
      const metersPerDegree = 111320 * Math.max(0.01, Math.cos((request.lat * 1e-7 * Math.PI) / 180))
      const zoom = terrainZoomForSpacing(request.grid_spacing / metersPerDegree / 4)
      const heights = await sampleTerrain(points, { mode: 'highest', zoom })
      blocks.forEach((block, position) => {
        const blockHeights = heights.slice(position * 16, position * 16 + 16)
        const data = terrainBlockData(
          blockHeights.map((height) =>
            height === null ? null : surfaceHeight(height, settings.value.waterLevelOffsetM)
          )
        )
        if (!data) return
        const message: Message.TerrainData = {
          type: MAVLinkType.TERRAIN_DATA,
          lat: request.lat,
          lon: request.lon,
          grid_spacing: request.grid_spacing,
          gridbit: block,
          data,
        }
        sendMavlinkMessage(message)
        servedBlocks.value += 1
      })
    } catch (error) {
      console.error('Could not answer the vehicle terrain request:', error)
    } finally {
      answering.delete(key)
    }
  }

  const onTerrainRequest = (pack: Package): void => {
    void answerTerrainRequest(pack)
  }

  const onTerrainReport = (pack: Package): void => {
    const report = pack.message as Message.TerrainReport
    lastReport.value = { ...report, receivedAtMs: Date.now() }
    pendingCheck?.(report)
  }

  watch(
    () => vehicleStore.mainVehicle,
    (vehicle, previous) => {
      previous?.onIncomingMAVLinkMessage.remove(MAVLinkType.TERRAIN_REQUEST, onTerrainRequest)
      previous?.onIncomingMAVLinkMessage.remove(MAVLinkType.TERRAIN_REPORT, onTerrainReport)
      vehicle?.onIncomingMAVLinkMessage.add(MAVLinkType.TERRAIN_REQUEST, onTerrainRequest)
      vehicle?.onIncomingMAVLinkMessage.add(MAVLinkType.TERRAIN_REPORT, onTerrainReport)
      lastReport.value = null
    },
    { immediate: true }
  )

  const checkOne = (coordinates: WaypointCoordinates): Promise<VehicleTerrainCheck | null> => {
    const lat = Math.round(coordinates[0] * 1e7)
    const lon = Math.round(coordinates[1] * 1e7)
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pendingCheck = undefined
        resolve(null)
      }, CHECK_TIMEOUT_MS)
      pendingCheck = (report) => {
        if (Math.abs(report.lat - lat) > 2 || Math.abs(report.lon - lon) > 2) return
        clearTimeout(timer)
        pendingCheck = undefined
        const available = report.spacing !== 0
        resolve({ coordinates, available, vehicleHeightM: available ? report.terrain_height : null })
      }
      const message: Message.TerrainCheck = { type: MAVLinkType.TERRAIN_CHECK, lat, lon }
      sendMavlinkMessage(message)
    })
  }

  const checkVehicleTerrain = async (points: WaypointCoordinates[]): Promise<VehicleTerrainCheck[]> => {
    const results: VehicleTerrainCheck[] = []
    let unanswered = 0
    for (const coordinates of points) {
      // Two silences in a row mean the vehicle does not answer, so the rest are not waited for one by one.
      const answer = unanswered < 2 ? await checkOne(coordinates) : null
      unanswered = answer ? 0 : unanswered + 1
      results.push(answer ?? { coordinates, available: false, vehicleHeightM: null })
    }
    return results
  }

  return { servedBlocks, lastRequestAtMs, lastReport, checkVehicleTerrain }
}
