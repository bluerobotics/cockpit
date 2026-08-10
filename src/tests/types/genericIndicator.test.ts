import { describe, expect, it } from 'vitest'

import { veryGenericIndicatorPresets } from '@/types/genericIndicator'

describe('Very Generic Indicator presets', () => {
  // Data-lake ids are built as `${messageName}/${field}`, so a dotted id silently never resolves
  // and the preset shows no value until the widget's mount-time migration rewrites it.
  it('binds every preset to a slash-separated data-lake id', () => {
    const dotted = veryGenericIndicatorPresets.filter((preset) => preset.variableName.includes('.'))
    expect(dotted.map((preset) => preset.displayName)).toEqual([])
  })
})
