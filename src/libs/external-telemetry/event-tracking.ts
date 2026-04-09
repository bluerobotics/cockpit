import ky from 'ky'
import localforage from 'localforage'
import posthog from 'posthog-js'

import { app_version } from '../cosmos'
import { settingsManager } from '../settings-management'
import { isElectron } from '../utils'

const cockpitTelemetryEnabledKey = 'cockpit-enable-usage-statistics-telemetry'

type EventPayload = {
  /**
   * The name of the event
   */
  eventName: string
  /**
   * The moment the event was captured (in milliseconds since epoch)
   */
  timestamp: number
  /**
   * Arbitrary properties to be recorded with the event
   */
  properties?: Record<string, unknown>
}

/**
 *
 */
class EventTracker {
  private static enableEventTracking = false
  static postHogApiUrl = 'https://us.i.posthog.com'
  static postHogApiKey = 'phc_SfqVeZcpYHmhUn9NRizThxFxiI9fKqvjRjmBDB8ToRs'
  static posthog: ReturnType<typeof posthog.init> | undefined = undefined
  static eventTrackingInterval = 30000
  static eventTrackingTimeoutId: ReturnType<typeof setTimeout> | undefined = undefined
  eventTrackingQueue: LocalForage | undefined = undefined

  /**
   * Initialize the event tracking system
   */
  constructor() {
    // Only track usage statistics if the user has not opted out and the app is not in development mode
    const isRunningInProduction = import.meta.env.PROD
    const userHasExternalTelemetryEnabled = settingsManager.getKeyValue(cockpitTelemetryEnabledKey)
    EventTracker.enableEventTracking = isRunningInProduction && userHasExternalTelemetryEnabled

    if (!EventTracker.enableEventTracking) {
      console.info('Event tracking is disabled. Not initializing event tracker.')
      return
    }

    if (!EventTracker.posthog) {
      EventTracker.posthog = posthog.init(EventTracker.postHogApiKey, {
        api_host: EventTracker.postHogApiUrl,
        person_profiles: 'always', // Create profiles for anonymous users as well
      })
    }

    if (!this.eventTrackingQueue) {
      this.eventTrackingQueue = localforage.createInstance({
        driver: localforage.INDEXEDDB,
        name: 'Cockpit - Event-tracking Queue',
        storeName: 'cockpit-event-tracking-queue',
        version: 1.0,
        description: 'Queue of events to be sent to the event tracking system.',
      })
    }

    if (!EventTracker.eventTrackingTimeoutId) {
      EventTracker.eventTrackingTimeoutId = setTimeout(
        async () => await this.sendEvents(),
        EventTracker.eventTrackingInterval
      )
    }
  }

  /**
   * Capture an event
   * @param {string} eventName - The name of the event
   * @param {Record<string, unknown>} eventProperties - The properties of the event
   */
  async capture(eventName: string, eventProperties?: Record<string, unknown>): Promise<void> {
    if (!EventTracker.enableEventTracking || !this.eventTrackingQueue) return

    const eventId = `${eventName}-${Date.now()}`
    const eventPayload: EventPayload = {
      eventName,
      timestamp: Date.now(),
      properties: eventProperties,
    }
    await this.eventTrackingQueue.setItem(eventId, eventPayload)
  }

  /**
   * Send all events in the queue to the event tracking system
   */
  async sendEvents(): Promise<void> {
    if (!this.eventTrackingQueue) return

    const queuedEventsKeys = await this.eventTrackingQueue.keys()
    const successfullySentEventsKeys: string[] = []

    for (const eventId of queuedEventsKeys) {
      const eventPayload = await this.eventTrackingQueue.getItem<EventPayload>(eventId)
      if (!eventPayload) continue

      try {
        const body = {
          api_key: EventTracker.postHogApiKey,
          event: eventPayload.eventName,
          properties: eventPayload.properties,
          timestamp: new Date(eventPayload.timestamp).toISOString(),
          distinct_id: EventTracker.posthog?.get_distinct_id(),
        }

        await ky.post(`${EventTracker.postHogApiUrl}/i/v0/e`, { json: body, timeout: 5000 })
        successfullySentEventsKeys.push(eventId)
        console.log(`Tracking event '${eventId}' sent successfully.`)
      } catch (error) {
        console.error(`Error sending event '${eventId}' to PostHog:`, error)
      }
    }

    for (const eventId of successfullySentEventsKeys) {
      await this.eventTrackingQueue.removeItem(eventId)
    }

    EventTracker.eventTrackingTimeoutId = setTimeout(
      async () => await this.sendEvents(),
      EventTracker.eventTrackingInterval
    )
  }
}

const eventTracker = new EventTracker()

/**
 * Telemetry data about the system for analytics
 */
export interface SystemTelemetryInfo {
  /**
   * The version of the application
   */
  appVersion: string
  /**
   * Whether the application is running in Electron
   */
  isElectron: boolean
  /**
   * The platform of the system. Possibilities can be found in the Platform enum.
   */
  platform: string | null
  /**
   * The architecture of the system. Possibilities can be found in the Architecture enum.
   */
  arch: string | null
  /**
   * The width of the window in pixels
   */
  windowWidth: number
  /**
   * The height of the window in pixels
   */
  windowHeight: number
  /**
   * Information about all connected displays
   */
  displays: Array<{
    /**
     * The width of the display in pixels
     */
    width: number
    /**
     * The height of the display in pixels
     */
    height: number
    /**
     * The scale factor of the display (DPI scaling)
     */
    scaleFactor?: number
  }>
  /**
   * The locale of the system
   */
  locale: string
  /**
   * Whether the host reports touch input capability (touchscreen, tablet, etc.)
   */
  hasTouchSupport: boolean
}

/**
 * Get system information for telemetry purposes
 * @returns {Promise<SystemTelemetryInfo>} System information for analytics
 */
export const getSystemInfoForTelemetry = async (): Promise<SystemTelemetryInfo> => {
  const runningInElectron = isElectron()

  let platform: string | null = null
  let arch: string | null = null
  let displays: SystemTelemetryInfo['displays'] = []

  if (runningInElectron && window.electronAPI?.getSystemInfo) {
    const systemInfo = await window.electronAPI.getSystemInfo()
    platform = systemInfo.platform
    arch = systemInfo.arch
    displays = systemInfo.displays
  } else {
    platform = navigator.userAgentData?.platform ?? navigator.platform ?? null
    try {
      const uaData = await navigator.userAgentData?.getHighEntropyValues(['architecture'])
      arch = uaData?.architecture ?? null
    } catch {
      arch = null
    }
  }

  const hasTouchSupport = navigator.maxTouchPoints > 0 || window.matchMedia('(any-pointer: coarse)').matches

  return {
    appVersion: app_version.version,
    isElectron: runningInElectron,
    platform,
    arch,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    displays,
    locale: navigator.language,
    hasTouchSupport,
  }
}

export default eventTracker
