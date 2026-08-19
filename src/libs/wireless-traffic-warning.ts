import { type IpInfo, isTetheredInterfaceType, isWirelessInterfaceName } from '@/libs/blueos'

/**
 * Watches the upload rate of the vehicle network interfaces and tells when heavy traffic has been
 * flowing through a wireless link for long enough to be worth warning the user about.
 */
export interface WirelessTrafficWatcher {
  /**
   * Records a new round of readings and evaluates the traffic condition against them.
   * @param {Record<string, number>} totalUploadedBytesPerInterface Bytes each vehicle network interface has transmitted since boot, keyed by interface name.
   * @param {number} timestamp Moment the readings were taken, in milliseconds since the epoch.
   * @returns {boolean} True when a wireless interface has been busy across every window-long stretch of the recent readings and no warning was shown yet.
   */
  shouldWarn: (totalUploadedBytesPerInterface: Record<string, number>, timestamp: number) => boolean
  /**
   * Silences the watcher, so a warning that reached the user is not repeated.
   */
  registerWarningShown: () => void
}

// eslint-disable-next-line jsdoc/require-jsdoc
type CounterSample = { timestamp: number; totalUploadedBytes: number }

const analysisWindowMs = 10000
const busyWirelessThresholdMbps = 5

// A single large transfer — Cockpit pulls map tile archives and vehicle files over this same link — moves
// enough bytes to clear the threshold on one window while lasting only seconds, and the once-per-session
// warning would be spent on it. Asking every window-long stretch of the history to be busy leaves any
// transfer shorter than a window an idle stretch to fail on, but only once the history spans three windows:
// below that the transfer sits too close to both ends to leave a whole stretch clear of it. The fourth
// window is what makes that span reachable at the 1 Hz poll, at the cost of warning around 31 s in.
const analysisHistoryMs = 4 * analysisWindowMs

// The readings come from a poll that shares the link being measured, so they are lost exactly when the link
// is congested. Taking the stretches from the samples themselves, instead of from fixed timestamps, keeps a
// lossy link from silencing the warning, as long as the readings still inside the history span this much of
// it, which any cadence up to a third of the history guarantees.
const minHistorySpanMs = analysisHistoryMs - analysisWindowMs

// The vehicle refreshes these counters slower than we poll them, so the per-poll rate reads zero most of
// the time and spikes on the polls that catch a refresh, on an idle interface just as much as on a busy
// one. Taking the rate from how far the counter moved across a stretch instead of from what each poll
// reported is immune to that, and to readings arriving late or out of order.
const stretchUploadMbps = (from: CounterSample, to: CounterSample): number => {
  const uploadedBytes = to.totalUploadedBytes - from.totalUploadedBytes
  if (uploadedBytes < 0) return 0
  return (uploadedBytes * 8) / (1024 * 1024) / ((to.timestamp - from.timestamp) / 1000)
}

// Slowest of the stretches spanning at least a window, so an idle one pulls the verdict down with it.
const slowestSustainedUploadMbps = (samples: CounterSample[]): number => {
  if (samples.length < 2) return 0
  if (samples[samples.length - 1].timestamp - samples[0].timestamp < minHistorySpanMs) return 0
  const rates = samples.flatMap((from, fromIndex) =>
    samples
      .slice(fromIndex + 1)
      .filter((to) => to.timestamp - from.timestamp >= analysisWindowMs)
      .map((to) => stretchUploadMbps(from, to))
  )
  return Math.min(...rates)
}

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
  const samplesPerInterface = new Map<string, CounterSample[]>()
  let warningShown = false

  return {
    shouldWarn: (totalUploadedBytesPerInterface, timestamp) => {
      const historyStart = timestamp - analysisHistoryMs
      samplesPerInterface.forEach((samples, interfaceName) => {
        samplesPerInterface.set(
          interfaceName,
          samples.filter((sample) => sample.timestamp > historyStart)
        )
      })
      Object.entries(totalUploadedBytesPerInterface).forEach(([interfaceName, totalUploadedBytes]) => {
        const samples = samplesPerInterface.get(interfaceName) ?? []
        samples.push({ timestamp, totalUploadedBytes })
        samplesPerInterface.set(interfaceName, samples)
      })

      // A vehicle can expose several wireless interfaces, so any of them being busy is enough.
      const isBusy = ([interfaceName, samples]: [string, CounterSample[]]): boolean =>
        isWirelessInterfaceName(interfaceName) && slowestSustainedUploadMbps(samples) >= busyWirelessThresholdMbps
      return !warningShown && [...samplesPerInterface.entries()].some(isBusy)
    },
    registerWarningShown: () => {
      warningShown = true
    },
  }
}
