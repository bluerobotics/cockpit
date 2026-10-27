import { expect, test } from 'vitest'

import { appSitlVersion, compareSitlVersions, versionedSimulatorUrl } from '@/libs/sitl-version'

const app = { sitl: 'aaaaaaaaaaaa', bluesim: 'bbbbbbbbbbbb', build: '2026-10-01T00:00:00.000Z' }
const deployed = { sitl: 'cccccccccccc', bluesim: 'bbbbbbbbbbbb', build: '2026-10-27T00:00:00.000Z' }

test('compareSitlVersions', () => {
  expect(compareSitlVersions(app, { ...app }, null)).toBe('current')
  expect(compareSitlVersions(app, deployed, null)).toBe('stale')
  // A deploy that left the SITL files alone still makes this copy old
  expect(compareSitlVersions(app, { ...app, build: deployed.build }, null)).toBe('stale')
  // Reloaded once to this build already, so it must not reload again
  expect(compareSitlVersions(app, deployed, deployed.build)).toBe('still-stale')
  // A reload to an earlier deploy does not hold back the reload to a later one
  expect(compareSitlVersions(app, deployed, app.build)).toBe('stale')
})

test('versionedSimulatorUrl', () => {
  const versioned = new URL(versionedSimulatorUrl('bluesim/index.html?level=reef'))
  expect(versioned.searchParams.get('level')).toBe('reef')
  expect(versioned.searchParams.get('v')).toBe(appSitlVersion.bluesim === 'none' ? null : appSitlVersion.bluesim)
  expect(versionedSimulatorUrl('https://example.com/sim.html?a=1')).toBe('https://example.com/sim.html?a=1')
})
