import { median } from 'mathjs'

import { type IpInfo, isTetheredInterfaceType, isWirelessInterfaceName } from '@/libs/blueos'

/**
 * Watches the upload rate of the vehicle network interfaces and tells when heavy traffic has been
 * flowing through a wireless link for long enough to be worth warning the user about.
 */
export interface WirelessTrafficWatcher {
  /**
   * Records a new round of readings and evaluates the traffic condition against them.
   * @param {Record<string, number>} uploadMbpsPerInterface Upload rate of each vehicle network interface, in Mbps, keyed by interface name.
   * @param {number} timestamp Moment the readings were taken, in milliseconds since the epoch.
   * @returns {boolean} True when a wireless interface has been busy over enough of the recent readings and no warning was shown yet.
   */
  shouldWarn: (uploadMbpsPerInterface: Record<string, number>, timestamp: number) => boolean
  /**
   * Silences the watcher, so a warning that reached the user is not repeated.
   */
  registerWarningShown: () => void
}

// eslint-disable-next-line jsdoc/require-jsdoc
type RateSample = { timestamp: number; mbps: number }

const analysisWindowMs = 10000
const busyWirelessThresholdMbps = 5

// The readings come from a poll that shares the link being measured, so they are lost exactly when the
// link is congested. Judging a window by the span its samples cover, instead of by how many arrived,
// keeps a lossy link from silencing the warning altogether.
const minAnalysisSpanMs = 6000
const minSamplesPerWindow = 4

const coversAnalysisSpan = (samples: RateSample[]): boolean =>
  samples.length >= minSamplesPerWindow &&
  samples[samples.length - 1].timestamp - samples[0].timestamp >= minAnalysisSpanMs

/**
 * Tells if it makes sense to suggest the user to reach the vehicle through the cable, which is only the
 * case when the vehicle is currently reached over a wireless link and also has a cabled address. An
 * address that is not one of the reported ones, like an mDNS host name, leaves the current link kind
 * undetermined, and an unsubstantiated warning is worse than none.
 * @param {IpInfo[]} ipsInfo Addresses the vehicle is reachable on, as reported by the beacon.
 * @param {string} currentAddress Address the vehicle is currently being reached on.
 * @returns {boolean} True when the current link is wireless and a cabled one is available.
 */
export const canSuggestCabledLink = (ipsInfo: IpInfo[], currentAddress: string): boolean => {
  const currentType = ipsInfo.find((ipInfo) => ipInfo.ipv4Address === currentAddress)?.interfaceType
  if (currentType === undefined || isTetheredInterfaceType(currentType)) return false
  return ipsInfo.some((ipInfo) => isTetheredInterfaceType(ipInfo.interfaceType))
}

/**
 * Creates a watcher holding the rate history the traffic condition is evaluated against.
 * @returns {WirelessTrafficWatcher} A watcher with no readings recorded yet.
 */
export const createWirelessTrafficWatcher = (): WirelessTrafficWatcher => {
  const samplesPerInterface = new Map<string, RateSample[]>()
  let warningShown = false

  return {
    shouldWarn: (uploadMbpsPerInterface, timestamp) => {
      const windowStart = timestamp - analysisWindowMs
      samplesPerInterface.forEach((samples, interfaceName) => {
        samplesPerInterface.set(
          interfaceName,
          samples.filter((sample) => sample.timestamp > windowStart)
        )
      })
      Object.entries(uploadMbpsPerInterface).forEach(([interfaceName, mbps]) => {
        const samples = samplesPerInterface.get(interfaceName) ?? []
        samples.push({ timestamp, mbps })
        samplesPerInterface.set(interfaceName, samples)
      })

      // A vehicle can expose several wireless interfaces, so any of them being busy is enough.
      const wirelessMedians = [...samplesPerInterface.entries()]
        .filter(([interfaceName, samples]) => isWirelessInterfaceName(interfaceName) && coversAnalysisSpan(samples))
        .map(([, samples]) => median(samples.map((sample) => sample.mbps)))
      return !warningShown && wirelessMedians.some((rate) => rate >= busyWirelessThresholdMbps)
    },
    registerWarningShown: () => {
      warningShown = true
    },
  }
}
