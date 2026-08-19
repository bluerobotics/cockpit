import { expect, test } from 'vitest'

import {
  canSuggestCabledLink,
  createWirelessTrafficWatcher,
  WirelessTrafficWatcher,
} from '@/libs/wireless-traffic-warning'

const feedSeconds = (
  watcher: WirelessTrafficWatcher,
  seconds: number,
  uploadMbpsPerInterface: Record<string, number>,
  firstSecond = 0
): boolean[] =>
  Array.from({ length: seconds }, (_, index) =>
    watcher.shouldWarn(uploadMbpsPerInterface, (firstSecond + index) * 1000)
  )

test('warns only once the wireless link has been busy over enough of the window', () => {
  const watcher = createWirelessTrafficWatcher()
  const verdicts = feedSeconds(watcher, 11, { eth0: 1, wlan0: 6 })

  expect(verdicts.slice(0, 6)).not.toContain(true)
  expect(verdicts[6]).toBe(true)

  // A verdict that never made it to the user does not count, so it keeps being offered until it does.
  expect(feedSeconds(watcher, 5, { eth0: 1, wlan0: 6 }, 11)).not.toContain(false)

  watcher.registerWarningShown()

  // The advice cannot be acted on without reloading Cockpit, so it is given once and never repeated.
  expect(feedSeconds(watcher, 400, { eth0: 1, wlan0: 6 }, 16)).not.toContain(true)
})

test('stays quiet below the busy threshold', () => {
  expect(feedSeconds(createWirelessTrafficWatcher(), 20, { eth0: 0, wlan0: 4.9 })).not.toContain(true)
})

test('still warns when part of the readings never arrive', () => {
  const watcher = createWirelessTrafficWatcher()
  const verdicts = Array.from({ length: 6 }, (_, index) => watcher.shouldWarn({ wlan0: 6 }, index * 2000))

  expect(verdicts).toContain(true)
})

test('takes the median, so brief bursts on an idle wireless link do not warn', () => {
  const watcher = createWirelessTrafficWatcher()
  const verdicts = Array.from({ length: 20 }, (_, second) =>
    watcher.shouldWarn({ eth0: 1, wlan0: second % 5 === 0 ? 50 : 0 }, second * 1000)
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
