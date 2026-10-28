import { describe, expect, it } from 'vitest'

import {
  type ValidatedMapMeshQuads,
  externalMapMeshCommandSchema,
  externalMapMeshLimits,
  isExternalMapMeshCommand,
} from '@/libs/map/external-map-mesh-api'
import { MapMeshStore } from '@/libs/map/external-map-meshes'

type Quads = Required<Pick<ValidatedMapMeshQuads, 'corners' | 'uv' | 'texels'>>

const base64 = (view: ArrayBufferView): string => {
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
  let binary = ''
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)))
  return btoa(binary)
}

// `count` quads of about 10 m side, side by side eastwards from Florianópolis.
const quads = (count: number): Quads => {
  const corners = new Float64Array(count * 8)
  for (let i = 0; i < count; i++) {
    const lon = -48.55 + i * 0.0001
    corners.set([lon, -27.59, lon + 0.0001, -27.59, lon + 0.0001, -27.5901, lon, -27.5901], i * 8)
  }
  return { corners, uv: new Float32Array(count * 8).fill(0.5), texels: new Uint8Array(count) }
}

const parseQuads = (fields: Record<string, unknown>): ReturnType<typeof externalMapMeshCommandSchema.safeParse> =>
  externalMapMeshCommandSchema.safeParse({ type: 'cockpit:setMapMeshQuads', id: 'test-mesh', ...fields })

const firstIssue = (result: ReturnType<typeof parseQuads>): string => result.error?.issues[0]?.message ?? ''

describe('cockpit:setMapMesh', () => {
  const mesh = { id: 'test-mesh', name: 'Test', capacity: 16, texels: { format: 'r8', width: 4, height: 1 } }

  it('fills in the defaults', () => {
    const result = externalMapMeshCommandSchema.parse({ type: 'cockpit:setMapMesh', mesh })
    expect(result).toMatchObject({ mesh: { filter: 'nearest', opacity: 1 } })
  })

  it('accepts a palette as bytes or base64, for r8 only', () => {
    const palette = new Uint8Array(1024)
    expect(
      externalMapMeshCommandSchema.safeParse({ type: 'cockpit:setMapMesh', mesh: { ...mesh, palette } }).success
    ).toBe(true)
    const clamped = { ...mesh, palette: new Uint8ClampedArray(1024) }
    expect(externalMapMeshCommandSchema.parse({ type: 'cockpit:setMapMesh', mesh: clamped })).toMatchObject({
      mesh: { palette: expect.any(Uint8Array) },
    })
    const encoded = { ...mesh, palette: base64(palette) }
    expect(externalMapMeshCommandSchema.safeParse({ type: 'cockpit:setMapMesh', mesh: encoded }).success).toBe(true)
    const rgba = { ...mesh, texels: { format: 'rgba8', width: 4, height: 1 }, palette }
    expect(externalMapMeshCommandSchema.safeParse({ type: 'cockpit:setMapMesh', mesh: rgba }).success).toBe(false)
    const short = { ...mesh, palette: new Uint8Array(1000) }
    expect(externalMapMeshCommandSchema.safeParse({ type: 'cockpit:setMapMesh', mesh: short }).success).toBe(false)
  })

  it('rejects a capacity or strip beyond the limits', () => {
    const tooMany = { ...mesh, capacity: (1 << 20) + 1 }
    expect(externalMapMeshCommandSchema.safeParse({ type: 'cockpit:setMapMesh', mesh: tooMany }).success).toBe(false)
    const tooWide = { ...mesh, texels: { format: 'r8', width: 2049, height: 1 } }
    expect(externalMapMeshCommandSchema.safeParse({ type: 'cockpit:setMapMesh', mesh: tooWide }).success).toBe(false)
  })

  // A write carries at least one quad: its strip plus 64 bytes of corners and 32 of uv, its tint being optional.
  it('accepts a strip as long as one quad of it fits a message, in either format', () => {
    const parse = (format: string, width: number, height: number): ReturnType<typeof parseQuads> =>
      externalMapMeshCommandSchema.safeParse({
        type: 'cockpit:setMapMesh',
        mesh: { ...mesh, texels: { format, width, height } },
      })
    expect(parse('r8', 1846, 1136).success).toBe(true)
    expect(parse('r8', 1200, 1).success).toBe(true)
    expect(parse('rgba8', 923, 568).success).toBe(true)
    expect(parse('rgba8', 724, 724).success).toBe(true)

    // The smallest strips past that, 10 and 12 bytes over, and the ones the side limit alone would let through.
    for (const [format, width, height] of [
      ['r8', 1086, 1931],
      ['r8', 2048, 1024],
      ['r8', 2048, 2048],
      ['rgba8', 673, 779],
      ['rgba8', 725, 725],
      ['rgba8', 2048, 2048],
    ] as const) {
      const result = parse(format, width, height)
      expect(result.success, `${format} ${width}x${height}`).toBe(false)
      expect(result.error?.issues[0]?.path).toEqual(['mesh', 'texels'])
    }
  })
})

describe('cockpit:setMapMeshQuads', () => {
  it('accepts typed arrays', () => {
    expect(parseQuads(quads(3)).success).toBe(true)
  })

  it('accepts base64 of the same little-endian bytes, decoding it to typed arrays', () => {
    const { corners, uv, texels } = quads(2)
    const result = parseQuads({ corners: base64(corners), uv: base64(uv), texels: base64(texels), first: 4 })
    expect(result.success).toBe(true)
    const data = result.data as unknown as Quads
    expect(data.corners).toBeInstanceOf(Float64Array)
    expect([...data.corners]).toEqual([...corners])
    expect(data.uv).toBeInstanceOf(Float32Array)
  })

  it('takes a Uint8ClampedArray strip and tint, as getImageData gives, storing the same bytes as a Uint8Array', () => {
    const { corners, uv } = quads(2)
    const strips = [0, 1, 127, 128, 200, 254, 255, 3, 9, 30, 60, 90, 120, 150, 180, 210]
    // Views into the middle of larger buffers, whose other bytes must not leak in.
    const clamped = (bytes: number[]): Uint8ClampedArray => {
      const view = new Uint8ClampedArray(bytes.length + 16).fill(77).subarray(8, 8 + bytes.length)
      view.set(bytes)
      return view
    }
    const storedTexels = (texels: Uint8Array | Uint8ClampedArray, tint: Uint8Array | Uint8ClampedArray): Uint8Array => {
      const result = parseQuads({ corners, uv, texels, tint })
      expect(result.success).toBe(true)
      const data = result.data as unknown as ValidatedMapMeshQuads
      expect(data.texels).toBeInstanceOf(Uint8Array)
      expect([...data.texels]).toEqual(strips)
      expect(data.tint).toBeInstanceOf(Uint8Array)
      const store = new MapMeshStore()
      const texelLayout = { format: 'rgba8', width: 2, height: 1 } as const
      store.set({ id: 'test-mesh', name: 'Test', capacity: 2, texels: texelLayout, filter: 'nearest', opacity: 1 })
      store.writeQuads('test-mesh', data)
      return store.meshes.get('test-mesh')?.pages[0]?.texels ?? new Uint8Array()
    }
    const tint = [255, 255, 255, 255, 10, 20, 30, 40]
    const fromClamped = storedTexels(clamped(strips), clamped(tint))
    expect(fromClamped).toEqual(storedTexels(Uint8Array.from(strips), Uint8Array.from(tint)))
    expect(fromClamped.includes(255) && !fromClamped.includes(77)).toBe(true)
  })

  it('reads a Uint8ClampedArray in place, without copying its bytes', () => {
    const { corners, uv } = quads(2)
    const buffer = new ArrayBuffer(32)
    const texels = new Uint8ClampedArray(buffer, 8, 16)
    const data = parseQuads({ corners, uv, texels }).data as unknown as ValidatedMapMeshQuads
    expect(data.texels.buffer).toBe(buffer)
    expect([data.texels.byteOffset, data.texels.length]).toEqual([8, 16])
  })

  it('refuses texels of any other type, saying which types it takes', () => {
    const { corners, uv } = quads(2)
    for (const texels of [new Float32Array(2), [0, 0], new ArrayBuffer(2), new Int8Array(2)]) {
      expect(parseQuads({ corners, uv, texels }).error?.issues[0]).toMatchObject({
        path: ['texels'],
        message: 'Expected a Uint8Array or Uint8ClampedArray, or base64 of its bytes.',
      })
    }
  })

  it('takes quads without uv, leaving it out of the validated write', () => {
    const { corners, texels } = quads(2)
    const result = parseQuads({ corners, texels })
    expect(result.success).toBe(true)
    expect(result.data).not.toHaveProperty('uv')
    expect(parseQuads({ corners, texels, uv: undefined }).success).toBe(true)
  })

  it('rejects base64 that is not a whole number of elements', () => {
    const { corners, uv, texels } = quads(1)
    expect(firstIssue(parseQuads({ corners: base64(new Uint8Array(60)), uv, texels }))).toBe(
      'Needs a multiple of 8 bytes.'
    )
    expect(firstIssue(parseQuads({ corners, uv: base64(new Uint8Array(6)), texels }))).toBe(
      'Needs a multiple of 4 bytes.'
    )
  })

  it('tells a string that is not base64 why, rather than which types it takes', () => {
    const { corners, uv, texels } = quads(1)
    for (const fields of [{ corners: '!!!' }, { uv: 'abc' }, { texels: '!!!' }, { tint: 'abc' }]) {
      const issue = parseQuads({ corners, uv, texels, ...fields }).error?.issues[0]
      expect(issue?.path).toEqual(Object.keys(fields))
      expect(issue?.message).toMatch(/base64/)
      expect(issue?.message).not.toMatch(/^Expected/)
    }
  })

  it('rejects arrays of the wrong type or length', () => {
    const { corners, uv, texels } = quads(2)
    expect(firstIssue(parseQuads({ corners: new Float32Array(corners), uv, texels }))).toBe(
      'Expected a Float64Array or base64 of its bytes.'
    )
    expect(firstIssue(parseQuads({ corners, uv: uv.subarray(0, 8), texels }))).toContain('8 numbers per quad')
    expect(firstIssue(parseQuads({ corners: corners.subarray(0, 12), uv, texels }))).toContain('8 numbers')
    expect(firstIssue(parseQuads({ corners, uv, texels, tint: new Uint8Array(4) }))).toContain('4 bytes per quad')
  })

  it('reports the first quad with a bad corner', () => {
    const nan = quads(3)
    nan.corners[17] = NaN
    expect(firstIssue(parseQuads(nan))).toBe('Quad 2 has a corner that is not a finite number.')
    const polar = quads(3)
    polar.corners[9] = 86
    expect(firstIssue(parseQuads(polar))).toContain('Quad 1 has a latitude')
    const outside = quads(1)
    outside.corners[0] = 181
    expect(firstIssue(parseQuads(outside))).toContain('longitude')
  })

  it('rejects a quad more than 20 km across', () => {
    const huge = quads(1)
    huge.corners.set([-48.55, -27.59, -48.35, -27.59, -48.35, -27.79, -48.55, -27.79])
    expect(firstIssue(parseQuads(huge))).toContain('20 km')
  })

  it('rejects more than 4096 quads in a message', () => {
    expect(parseQuads(quads(4096)).success).toBe(true)
    expect(firstIssue(parseQuads(quads(4097)))).toContain('4096')
  })

  it('rejects messages over 2 MiB', () => {
    const { corners, uv } = quads(1)
    expect(firstIssue(parseQuads({ corners, uv, texels: new Uint8Array(2 * 1024 * 1024) }))).toContain('bytes')
  })
})

describe('cockpit:removeMapMeshQuads', () => {
  const remove = (count: number): boolean =>
    externalMapMeshCommandSchema.safeParse({ type: 'cockpit:removeMapMeshQuads', id: 'test-mesh', first: 0, count })
      .success

  it('removes at most a whole mesh', () => {
    expect(remove(externalMapMeshLimits.maxCapacity)).toBe(true)
    expect(remove(externalMapMeshLimits.maxCapacity + 1)).toBe(false)
    expect(remove(0)).toBe(false)
  })
})

describe('requestId', () => {
  const { corners, uv, texels } = quads(1)
  const meshCommands = [
    {
      type: 'cockpit:setMapMesh',
      mesh: { id: 'test-mesh', name: 'Test', capacity: 1, texels: { format: 'r8', width: 1, height: 1 } },
    },
    { type: 'cockpit:setMapMeshQuads', id: 'test-mesh', corners, uv, texels },
    { type: 'cockpit:removeMapMeshQuads', id: 'test-mesh', first: 0, count: 1 },
    { type: 'cockpit:clearMapMesh', id: 'test-mesh' },
    { type: 'cockpit:removeMapMesh', id: 'test-mesh' },
  ]

  it('is optional on every mesh command, and kept when sent', () => {
    for (const command of meshCommands) {
      expect(externalMapMeshCommandSchema.safeParse(command).success).toBe(true)
      expect(externalMapMeshCommandSchema.parse({ ...command, requestId: 'r-1' })).toMatchObject({
        requestId: 'r-1',
      })
    }
  })

  it('is a string of 1 to 256 characters or an integer, kept with its type', () => {
    const [command] = meshCommands
    for (const requestId of ['', 'x'.repeat(257), 7.5, NaN, Infinity, null, true, ['r-1']]) {
      expect(externalMapMeshCommandSchema.safeParse({ ...command, requestId }).success).toBe(false)
    }
    for (const requestId of ['x'.repeat(256), '7', 7, 0, -3]) {
      expect(externalMapMeshCommandSchema.parse({ ...command, requestId }).requestId).toBe(requestId)
    }
  })

  it('is required on cockpit:getMapCapabilities, which is recognized as a map command', () => {
    const query = { type: 'cockpit:getMapCapabilities', requestId: 'r-1' }
    expect(isExternalMapMeshCommand(query)).toBe(true)
    expect(externalMapMeshCommandSchema.safeParse(query).success).toBe(true)
    expect(externalMapMeshCommandSchema.safeParse({ type: query.type }).success).toBe(false)
  })
})
