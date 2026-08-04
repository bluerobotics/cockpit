import { describe, expect, it } from 'vitest'

import { parseChromiumSwitches } from '@/libs/chromium-switches'

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
