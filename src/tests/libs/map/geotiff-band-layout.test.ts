import { fromArrayBuffer, writeArrayBuffer } from 'geotiff'
import { describe, expect, it } from 'vitest'

import { rasterBandLayout } from '@/libs/map/geotiff-overlay'

// A 2x2 raster, pixel-interleaved, with `bands` 8-bit samples per pixel.
const tiff = (bands: number, extraSamples?: number[]): ArrayBuffer =>
  writeArrayBuffer(new Uint8Array(4 * bands).fill(200), {
    width: 2,
    height: 2,
    BitsPerSample: Array(bands).fill(8),
    SamplesPerPixel: [bands],
    PhotometricInterpretation: bands >= 3 ? 2 : 1,
    ...(extraSamples ? { ExtraSamples: extraSamples } : {}),
  })

describe('rasterBandLayout', () => {
  it('reads an 8-bit RGB raster as 8-bit, so its colors are drawn as-is', async () => {
    const image = await (await fromArrayBuffer(tiff(3))).getImage()
    expect(rasterBandLayout(image)).toEqual({ is8bit: true, alphaIndex: null })
  })

  it('finds the alpha band named by ExtraSamples', async () => {
    // RGB plus two extra samples, the first of them alpha: only the tag says it is band 3, as five bands have no
    // conventional alpha position to fall back on.
    const image = await (await fromArrayBuffer(tiff(5, [2, 0]))).getImage()
    expect(rasterBandLayout(image)).toEqual({ is8bit: true, alphaIndex: 3 })
  })
})
