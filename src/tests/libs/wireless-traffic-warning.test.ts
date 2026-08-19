import { expect, test } from 'vitest'

import {
  canSuggestCabledLink,
  createWirelessTrafficWatcher,
  WirelessTrafficWatcher,
} from '@/libs/wireless-traffic-warning'

const megabitsToBytes = (megabits: number): number => (megabits * 1024 * 1024) / 8

// Feeds one reading per second, of counters advancing at a steady rate on each interface.
const feedSteadySeconds = (
  watcher: WirelessTrafficWatcher,
  seconds: number,
  uploadMbpsPerInterface: Record<string, number>,
  firstSecond = 0
): boolean[] =>
  Array.from({ length: seconds }, (_, index) => {
    const second = firstSecond + index
    const counters = Object.entries(uploadMbpsPerInterface).map(([name, mbps]) => [
      name,
      megabitsToBytes(mbps * second),
    ])
    return watcher.shouldWarn(Object.fromEntries(counters), second * 1000)
  })

test('warns only once the wireless link has been busy across every stretch of the history', () => {
  const watcher = createWirelessTrafficWatcher()
  const verdicts = feedSteadySeconds(watcher, 31, { eth0: 1, wlan0: 6 })

  expect(verdicts.slice(0, 30)).not.toContain(true)
  expect(verdicts[30]).toBe(true)

  // A verdict that never made it to the user does not count, so it keeps being offered until it does.
  expect(feedSteadySeconds(watcher, 5, { eth0: 1, wlan0: 6 }, 31)).not.toContain(false)

  watcher.registerWarningShown()

  // The advice cannot be acted on without reloading Cockpit, so it is given once and never repeated.
  expect(feedSteadySeconds(watcher, 400, { eth0: 1, wlan0: 6 }, 36)).not.toContain(true)
})

test('stays quiet below the busy threshold', () => {
  expect(feedSteadySeconds(createWirelessTrafficWatcher(), 35, { eth0: 0, wlan0: 4.9 })).not.toContain(true)

  // The same run just above the threshold has to warn, or the silence above is only the history gate.
  expect(feedSteadySeconds(createWirelessTrafficWatcher(), 35, { eth0: 0, wlan0: 5.1 })).toContain(true)
})

test('still warns when the readings arrive five seconds apart', () => {
  const watcher = createWirelessTrafficWatcher()
  const verdicts = Array.from({ length: 8 }, (_, index) =>
    watcher.shouldWarn({ wlan0: megabitsToBytes(6 * index * 5) }, index * 5000)
  )

  expect(verdicts).toContain(true)
})

test('warns on a busy link whose counter only refreshes every few readings', () => {
  const watcher = createWirelessTrafficWatcher()

  // The vehicle refreshes the counter every third poll, so two out of three readings report no progress at
  // all and the third reports three seconds worth of it. The link is carrying 12 Mbps the whole time.
  const verdicts = Array.from({ length: 35 }, (_, second) =>
    watcher.shouldWarn({ eth0: 0, wlan0: megabitsToBytes(12 * (second - (second % 3))) }, second * 1000)
  )

  expect(verdicts).toContain(true)
})

test('a single transfer on an otherwise idle wireless link does not warn, however big it is', () => {
  const watcher = createWirelessTrafficWatcher()

  // 200 Mbit at 50 Mbps, spread over four readings so the history can be cut between them, which is the
  // shape a real transfer has and the one a rule made of fixed windows lets through. It starts off a window
  // boundary, so the verdict rests on the history being long enough rather than on the alignment.
  const uploadedMegabits = (second: number): number => Math.min(Math.max(second - 8, 0), 4) * 50
  const verdicts = Array.from({ length: 60 }, (_, second) =>
    watcher.shouldWarn({ eth0: 0, wlan0: megabitsToBytes(uploadedMegabits(second)) }, second * 1000)
  )

  expect(verdicts).not.toContain(true)
})

test('only suggests the cable when the vehicle is reached wirelessly and a cabled address exists', () => {
  const wireless = { ipv4Address: '192.168.10.5', interfaceType: 'WIFI' }
  const wired = { ipv4Address: '192.168.2.2', interfaceType: 'WIRED' }

  expect(canSuggestCabledLink([wireless, wired], wireless.ipv4Address)).toBe(true)
  expect(canSuggestCabledLink([wireless, wired], wired.ipv4Address)).toBe(false)
  expect(canSuggestCabledLink([wireless], wireless.ipv4Address)).toBe(false)

  // An mDNS host name matches none of the reported addresses, leaving the current link kind unknown.
  expect(canSuggestCabledLink([wireless, wired], 'blueos-avahi.local')).toBe(false)
})
