import { describe, expect, it } from 'vitest'

import {
  blockedChromiumSwitchNames,
  parseChromiumSwitches,
  predefinedChromiumSwitches,
  validateChromiumSwitchEntry,
} from '@/libs/chromium-switches'

describe('parseChromiumSwitches', () => {
  it('Parses switches with and without values, ignoring leading dashes', () => {
    expect(parseChromiumSwitches(['--disable-zero-copy-dxgi-video', 'use-angle=gl'])).toEqual([
      { name: 'disable-zero-copy-dxgi-video' },
      { name: 'use-angle', value: 'gl' },
    ])
  })

  it('Keeps commas inside values, as feature lists are comma-separated', () => {
    expect(parseChromiumSwitches('--enable-features=AcceleratedVideoDecodeLinuxGL,VaapiOnNvidiaGPUs')).toEqual([
      { name: 'enable-features', value: 'AcceleratedVideoDecodeLinuxGL,VaapiOnNvidiaGPUs' },
    ])
  })

  it('Splits a string on whitespace only', () => {
    expect(parseChromiumSwitches('  --use-angle=gl   --disable-gpu-compositing ')).toEqual([
      { name: 'use-angle', value: 'gl' },
      { name: 'disable-gpu-compositing' },
    ])
  })

  it('Drops empty and nameless entries', () => {
    expect(parseChromiumSwitches(['', '   ', '--', '=orphan', 'valid'])).toEqual([{ name: 'valid' }])
  })

  it('Returns nothing when unset', () => {
    expect(parseChromiumSwitches(undefined)).toEqual([])
  })
})

describe('validateChromiumSwitchEntry', () => {
  it('Accepts well-formed switches, with or without a value', () => {
    expect(validateChromiumSwitchEntry('--disable-gpu')).toBeUndefined()
    expect(validateChromiumSwitchEntry('enable-features=SomeFeature,OtherFeature')).toBeUndefined()
  })

  it('Accepts switches Chromium may not know, since unknown switches are ignored', () => {
    expect(validateChromiumSwitchEntry('not-a-real-chromium-switch')).toBeUndefined()
  })

  it('Rejects empty entries and entries containing spaces', () => {
    expect(validateChromiumSwitchEntry('  ')).toBeDefined()
    expect(validateChromiumSwitchEntry('--disable-gpu --disable-gpu-compositing')).toBeDefined()
  })

  it('Rejects names that cannot be Chromium switches', () => {
    expect(validateChromiumSwitchEntry('Disable_GPU')).toBeDefined()
    expect(validateChromiumSwitchEntry('--=value')).toBeDefined()
  })

  it('Rejects switches that would weaken security or stability', () => {
    blockedChromiumSwitchNames.forEach((name) => {
      expect(validateChromiumSwitchEntry(`--${name}`)).toBeDefined()
    })
    expect(validateChromiumSwitchEntry('--remote-debugging-port=9222')).toBeDefined()
  })
})

describe('predefinedChromiumSwitches', () => {
  it('Only offers switches that pass validation', () => {
    predefinedChromiumSwitches.forEach(({ entry }) => {
      expect(validateChromiumSwitchEntry(entry)).toBeUndefined()
    })
  })

  it('Describes every option and targets at least one platform', () => {
    predefinedChromiumSwitches.forEach(({ title, description, platforms }) => {
      expect(title.length).toBeGreaterThan(0)
      expect(description.length).toBeGreaterThan(0)
      expect(platforms.length).toBeGreaterThan(0)
    })
  })
})
