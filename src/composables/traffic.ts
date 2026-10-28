import * as turf from '@turf/turf'
import { useDebounceFn, useStorage } from '@vueuse/core'
import { computed, watch } from 'vue'

import { openSnackbar } from '@/composables/snackbar'
import { kmToLatDegrees, kmToLngDegrees } from '@/libs/baseStation/coverageBbox'
import type { Package } from '@/libs/connection/m2r/messages/mavlink2rest'
import { MAVLinkType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import type { Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'
import { parseAdsbLolAircraft, parseAdsbVehicle } from '@/libs/traffic/adsb'
import { parseAisStreamReport, parseAisVessel } from '@/libs/traffic/ais'
import { pruneStaleTrafficContacts, upsertTrafficContact } from '@/libs/traffic/traffic'
import { isElectron } from '@/libs/utils'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import type { WaypointCoordinates } from '@/types/mission'
import type { AisStreamReport, AisStreamRequest } from '@/types/traffic'

const PRUNE_INTERVAL_MS = 10 * 1000
const AIR_TRAFFIC_POLL_INTERVAL_MS = 10 * 1000
const VESSEL_STREAM_RECENTER_INTERVAL_MS = 30 * 1000
const SETTINGS_SETTLE_MS = 800
const KM_PER_NAUTICAL_MILE = 1.852
const DEFAULT_SEARCH_RADIUS_KM = 50

/** The closest the public feeds are asked to look for traffic, in kilometers */
export const MIN_SEARCH_RADIUS_KM = 1

/**
 * The furthest the public feeds are asked to look for traffic, in kilometers. adsb.lol answers a point query up to
 * 250 nautical miles out, and a wider area than this is more traffic than an operator can read anyway.
 */
export const MAX_SEARCH_RADIUS_KM = 250

/**
 * Holds a search radius inside the range the public feeds answer over, falling back to the default when it is not a
 * number at all. An emptied input field reads as unset rather than as zero, which would otherwise search 1 km.
 * @param {number | string | null} radiusKm The radius to check, in kilometers, as the field may have left it
 * @returns {number} A radius the feeds can be asked for
 */
export const clampSearchRadiusKm = (radiusKm: number | string | null): number => {
  if (radiusKm === null || (typeof radiusKm === 'string' && radiusKm.trim() === '')) return DEFAULT_SEARCH_RADIUS_KM
  const parsed = Number(radiusKm)
  if (!Number.isFinite(parsed)) return DEFAULT_SEARCH_RADIUS_KM
  return Math.min(Math.max(parsed, MIN_SEARCH_RADIUS_KM), MAX_SEARCH_RADIUS_KM)
}

/** Whether the public traffic feeds can be reached at all, which only the standalone build can do */
export const isInternetTrafficSupported = isElectron()

/** Whether to show the aircraft the public ADS-B feed reports around the vehicle */
export const internetAirTrafficEnabled = useStorage('cockpit-traffic-internet-adsb-enabled', false)

/** Whether to show the vessels the public AIS feed reports around the vehicle */
export const internetVesselTrafficEnabled = useStorage('cockpit-traffic-internet-ais-enabled', false)

/** The operator's own aisstream.io key, without which the vessel feed refuses to stream */
export const aisStreamApiKey = useStorage('cockpit-traffic-aisstream-api-key', '')

/** How far around the vehicle to ask the public feeds for traffic, in kilometers */
export const trafficSearchRadiusKm = useStorage('cockpit-traffic-radius-km', DEFAULT_SEARCH_RADIUS_KM)

const clampedSearchRadiusKm = computed<number>(() => clampSearchRadiusKm(trafficSearchRadiusKm.value))

let reopenVesselStream: (() => void) | undefined

/**
 * Reopens the vessel feed with the key and area currently configured, so an operator who fixed a rejected key can
 * retry without toggling the whole feed off and on.
 * @returns {void}
 */
export const reloadVesselTraffic = (): void => reopenVesselStream?.()

// The feed takes one rectangle of plain coordinates, so an area reaching past a pole or over the date line is cut at
// it rather than wrapped around, which would otherwise be sent as coordinates no feed can answer.
const boundingBoxAround = (center: WaypointCoordinates, radiusKm: number): Omit<AisStreamRequest, 'apiKey'> => {
  const latSpan = kmToLatDegrees(radiusKm)
  const lngSpan = kmToLngDegrees(radiusKm, center[0])
  return {
    south: Math.max(center[0] - latSpan, -90),
    west: Math.max(center[1] - lngSpan, -180),
    north: Math.min(center[0] + latSpan, 90),
    east: Math.min(center[1] + lngSpan, 180),
  }
}

/**
 * Keeps the traffic contacts up to date app-wide: the aircraft and vessels the vehicle's own receivers report, the
 * ones the public feeds report around it when the operator asked for them, and the forgetting of those gone silent.
 * Runs with no map open, since the contacts are mirrored into the data lake either way.
 * @returns {void}
 */
export const initTraffic = (): void => {
  const vehicleStore = useMainVehicleStore()
  const missionStore = useMissionStore()

  const onAdsbVehicle = (pack: Package): void => {
    const contact = parseAdsbVehicle(pack.message as Message.AdsbVehicle, Date.now())
    if (contact) upsertTrafficContact(contact)
  }

  const onAisVessel = (pack: Package): void => {
    const contact = parseAisVessel(pack.message as Message.AisVessel, Date.now())
    if (contact) upsertTrafficContact(contact)
  }

  // The data lake keeps one value per field, so the flattened reports of several craft would overwrite each other
  // there, and the vehicle's receivers are read here instead.
  watch(
    () => vehicleStore.mainVehicle,
    (vehicle, previous) => {
      previous?.onIncomingMAVLinkMessage.remove(MAVLinkType.ADSB_VEHICLE, onAdsbVehicle)
      previous?.onIncomingMAVLinkMessage.remove(MAVLinkType.AIS_VESSEL, onAisVessel)
      vehicle?.onIncomingMAVLinkMessage.add(MAVLinkType.ADSB_VEHICLE, onAdsbVehicle)
      vehicle?.onIncomingMAVLinkMessage.add(MAVLinkType.AIS_VESSEL, onAisVessel)
    },
    { immediate: true }
  )

  setInterval(() => pruneStaleTrafficContacts(), PRUNE_INTERVAL_MS)

  // Traffic is asked for around the vehicle, falling back to where the map opens before it reports a position.
  const searchCenter = computed<WaypointCoordinates>(() => {
    const { latitude, longitude } = vehicleStore.coordinates
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) return [latitude, longitude]
    return missionStore.defaultMapCenter
  })

  if (!isInternetTrafficSupported) return

  let airTrafficPollTimer: ReturnType<typeof setInterval> | undefined
  const failureReported: Record<'air' | 'vessel', boolean> = { air: false, vessel: false }
  let vesselStreamedArea: WaypointCoordinates | undefined

  // A feed that is down stays down for as long as it takes to come back, so only the first failure of a streak is
  // reported and the next success clears the way for the following one.
  const reportFeedFailure = (feed: 'air' | 'vessel', reason: string): void => {
    if (failureReported[feed]) return
    failureReported[feed] = true
    const noun = feed === 'air' ? 'air traffic' : 'vessel traffic'
    const detail = reason.trim() === '' ? 'the feed did not say why.' : reason
    openSnackbar({ message: `Could not load ${noun}: ${detail}`, variant: 'error', closeButton: true })
  }

  // Electron wraps a rejection from its own process in a sentence about remote methods, which says nothing to an
  // operator reading a snackbar.
  const reasonOf = (error: unknown): string =>
    (error instanceof Error ? error.message : String(error)).replace(
      /^Error invoking remote method '[^']*': (Error: )?/,
      ''
    )

  const pollAirTraffic = async (): Promise<void> => {
    const [latitude, longitude] = searchCenter.value
    const radiusNauticalMiles = clampedSearchRadiusKm.value / KM_PER_NAUTICAL_MILE
    try {
      const aircraft = await window.electronAPI?.fetchNearbyAdsbAircraft({ latitude, longitude, radiusNauticalMiles })
      const receivedAtMs = Date.now()
      aircraft?.forEach((entry) => {
        const contact = parseAdsbLolAircraft(entry, receivedAtMs)
        if (contact) upsertTrafficContact(contact)
      })
      failureReported.air = false
    } catch (error) {
      reportFeedFailure('air', reasonOf(error))
    }
  }

  const syncAirTrafficPolling = (): void => {
    clearInterval(airTrafficPollTimer)
    airTrafficPollTimer = undefined
    if (!internetAirTrafficEnabled.value) return
    void pollAirTraffic()
    airTrafficPollTimer = setInterval(() => void pollAirTraffic(), AIR_TRAFFIC_POLL_INTERVAL_MS)
  }

  const syncVesselStream = async (): Promise<void> => {
    const apiKey = aisStreamApiKey.value.trim()
    if (!internetVesselTrafficEnabled.value || apiKey === '') {
      vesselStreamedArea = undefined
      await window.electronAPI?.stopAisStream()
      return
    }

    const center = searchCenter.value
    vesselStreamedArea = center
    try {
      await window.electronAPI?.startAisStream({ apiKey, ...boundingBoxAround(center, clampedSearchRadiusKm.value) })
    } catch (error) {
      reportFeedFailure('vessel', reasonOf(error))
    }
  }

  window.electronAPI?.onAisStreamReports((reports: AisStreamReport[]) => {
    const receivedAtMs = Date.now()
    reports.forEach((report) => {
      const contact = parseAisStreamReport(report, receivedAtMs)
      if (contact) upsertTrafficContact(contact)
    })
    failureReported.vessel = false
  })

  window.electronAPI?.onAisStreamError((message: string) => reportFeedFailure('vessel', message))

  // A retry asked for by hand has to be able to report the same failure again, or the operator gets nothing back.
  reopenVesselStream = (): void => {
    failureReported.vessel = false
    void syncVesselStream()
  }

  // The radius is typed in character by character, so the feeds are only reopened once the operator has stopped
  // editing it.
  const syncFeeds = useDebounceFn((): void => {
    syncAirTrafficPolling()
    void syncVesselStream()
  }, SETTINGS_SETTLE_MS)

  syncAirTrafficPolling()
  void syncVesselStream()
  watch([internetAirTrafficEnabled, internetVesselTrafficEnabled, aisStreamApiKey, clampedSearchRadiusKm], syncFeeds)

  // The stream is bound to the area it was opened with, so it is reopened once the vehicle has left enough of it
  // behind. Checked on a beat rather than on every position report, which arrives several times a second, and the
  // air traffic poll reads the position on its own tick instead and needs none of this.
  setInterval(() => {
    if (vesselStreamedArea === undefined) return
    const movedKm = turf.distance(
      turf.point([vesselStreamedArea[1], vesselStreamedArea[0]]),
      turf.point([searchCenter.value[1], searchCenter.value[0]])
    )
    if (movedKm < clampedSearchRadiusKm.value / 2) return
    void syncVesselStream()
  }, VESSEL_STREAM_RECENTER_INTERVAL_MS)
}
