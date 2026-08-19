import { expect, test, vi } from 'vitest'

import { deviceUsingPort } from '@/libs/sensors/gnss'
import type { GnssDeviceInfo } from '@/types/gnss'

// The GNSS module reaches the settings manager through the data lake, and constructing the real one at
// import time needs a working localStorage that this environment does not provide.
vi.mock('@/libs/settings-management', () => ({
  settingsManager: { getKeyValue: () => undefined, setKeyValue: () => undefined },
}))

const device = (overrides: Partial<GnssDeviceInfo>): GnssDeviceInfo => ({
  id: 'gnss',
  name: 'GNSS',
  port: '/dev/ttyUSB0',
  baud: 9600,
  ...overrides,
})

test('deviceUsingPort', () => {
  const byPath = device({ id: 'by-path', port: '/dev/ttyUSB0' })
  const byModel = device({
    id: 'by-model',
    port: '/dev/ttyUSB9',
    usbMatch: { vendorId: '1546', productId: '01a8' },
  })

  expect(deviceUsingPort([byPath], { path: '/dev/ttyUSB0' })?.id).toBe('by-path')
  expect(deviceUsingPort([byPath], { path: '/dev/ttyUSB1' })).toBeUndefined()

  // The receiver moved to another path, but is still the same USB model.
  expect(deviceUsingPort([byModel], { path: '/dev/ttyUSB1', vendorId: '1546', productId: '01a8' })?.id).toBe('by-model')
  expect(deviceUsingPort([byModel], { path: '/dev/ttyUSB1', vendorId: '1546', productId: 'ffff' })).toBeUndefined()

  // The model match wins over the path one, as in `resolveDevicePort`.
  const pinnedByPath = device({ id: 'pinned', port: '/dev/ttyUSB1' })
  expect(
    deviceUsingPort([pinnedByPath, byModel], { path: '/dev/ttyUSB1', vendorId: '1546', productId: '01a8' })?.id
  ).toBe('by-model')

  // Ports without USB descriptors must not all match each other just by both being undefined.
  const noUsb = device({ id: 'no-usb', port: '/dev/ttyS0', usbMatch: undefined })
  expect(deviceUsingPort([noUsb], { path: '/dev/ttyS1' })).toBeUndefined()

  expect(deviceUsingPort([], { path: '/dev/ttyUSB0' })).toBeUndefined()
})
