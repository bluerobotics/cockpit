import { afterEach, describe, expect, test, vi } from 'vitest'

import { useExternalMapMeshes } from '@/composables/map/useExternalMapMeshes'
import type { ExternalMapCapabilities, ExternalMapMeshResult } from '@/libs/map/external-map-mesh-api'

vi.mock('@/libs/generic-websocket', () => ({ listenToGenericWebSocketJsonMessages: vi.fn() }))
let hasWebGl2 = true
vi.mock('@/libs/map/external-map-meshes-gl', () => ({ mapMeshGlRenderer: () => (hasWebGl2 ? {} : undefined) }))

const { handleExternalMapMeshMessage, meshes } = useExternalMapMeshes()

// `count` quads of about 10 m side, side by side eastwards from Florianópolis, each with a 1-texel strip.
const quads = (count: number): Record<string, ArrayBufferView> => {
  const corners = new Float64Array(count * 8)
  for (let i = 0; i < count; i++) {
    const lon = -48.55 + i * 0.0001
    corners.set([lon, -27.59, lon + 0.0001, -27.59, lon + 0.0001, -27.5901, lon, -27.5901], i * 8)
  }
  return { corners, uv: new Float32Array(count * 8).fill(0.5), texels: new Uint8Array(count) }
}

const mesh = (id: string, capacity = 4): Record<string, unknown> => ({
  id,
  name: 'Test',
  capacity,
  texels: { format: 'r8', width: 1, height: 1 },
})

const send = (...messages: Record<string, unknown>[]): ExternalMapMeshResult[] => {
  const answers: (ExternalMapMeshResult | ExternalMapCapabilities)[] = []
  messages.forEach((message) => handleExternalMapMeshMessage(message, (answer) => answers.push(answer)))
  return answers as ExternalMapMeshResult[]
}

afterEach(() => {
  vi.restoreAllMocks()
  hasWebGl2 = true
})

describe('cockpit:getMapCapabilities', () => {
  test('tells the mesh version, limits and formats, and whether meshes are drawn', () => {
    const [capabilities] = send({ type: 'cockpit:getMapCapabilities', requestId: 'caps' }) as unknown[]
    expect(capabilities).toEqual({
      type: 'cockpit:mapCapabilities',
      requestId: 'caps',
      meshes: {
        version: 1,
        drawn: true,
        maxCapacity: 1 << 20,
        maxQuadsPerMessage: 4096,
        maxMessageBytes: 2 * 1024 * 1024,
        maxTexelSide: 2048,
        maxStripBytes: 2 * 1024 * 1024 - 96,
        formats: ['r8', 'rgba8'],
      },
    })
  })

  test('says meshes are not drawn without WebGL2, while mesh commands are still applied', () => {
    hasWebGl2 = false
    const answers = send(
      { type: 'cockpit:getMapCapabilities', requestId: 'caps' },
      { type: 'cockpit:setMapMesh', requestId: 'set', mesh: mesh('capabilities-undrawn') },
      { type: 'cockpit:setMapMeshQuads', requestId: 'write', id: 'capabilities-undrawn', ...quads(2) }
    )
    expect((answers[0] as unknown as ExternalMapCapabilities).meshes.drawn).toBe(false)
    expect(answers[1]).toMatchObject({ ok: true })
    expect(answers[2]).toMatchObject({ ok: true, first: 0, count: 2, head: 2 })
  })

  test('needs a requestId, since its only purpose is the answer', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(send({ type: 'cockpit:getMapCapabilities' })).toEqual([])
    expect(warn).toHaveBeenCalledOnce()
  })
})

describe('mesh command answers', () => {
  test('tell an auto-index sender which slots it wrote, wrapping at the capacity', () => {
    const answers = send(
      { type: 'cockpit:setMapMesh', requestId: 'a', mesh: mesh('answers-ring') },
      { type: 'cockpit:setMapMeshQuads', requestId: 'b', id: 'answers-ring', ...quads(3) },
      { type: 'cockpit:setMapMeshQuads', requestId: 'c', id: 'answers-ring', ...quads(3) },
      { type: 'cockpit:setMapMeshQuads', requestId: 'd', id: 'answers-ring', first: 0, ...quads(1) }
    )
    const result = { type: 'cockpit:mapMeshResult', id: 'answers-ring', ok: true, capacity: 4 }
    expect(answers).toEqual([
      { ...result, requestId: 'a', head: 0 },
      { ...result, requestId: 'b', first: 0, count: 3, head: 3 },
      { ...result, requestId: 'c', first: 3, count: 3, head: 2 },
      { ...result, requestId: 'd', first: 0, count: 1, head: 1 },
    ])
  })

  test('report the head a redefined mesh kept, so a restarted sender knows where auto-index writes go', () => {
    send({ type: 'cockpit:setMapMesh', mesh: mesh('answers-kept') })
    send({ type: 'cockpit:setMapMeshQuads', id: 'answers-kept', ...quads(2) })
    const [kept] = send({ type: 'cockpit:setMapMesh', requestId: 'again', mesh: mesh('answers-kept') })
    expect(kept).toMatchObject({ ok: true, head: 2 })
    const [cleared] = send({ type: 'cockpit:clearMapMesh', requestId: 'clear', id: 'answers-kept' })
    expect(cleared).toMatchObject({ ok: true, head: 0, capacity: 4 })
  })

  test('are never sent without a requestId, and a malformed one rejects the command unanswered', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const answers = send(
      { type: 'cockpit:setMapMesh', mesh: mesh('answers-quiet') },
      { type: 'cockpit:setMapMeshQuads', id: 'answers-quiet', ...quads(1) },
      { type: 'cockpit:setMapMeshQuads', requestId: 7.5, id: 'answers-quiet', ...quads(1) },
      { type: 'cockpit:setMapMeshQuads', requestId: '', id: 'answers-quiet', ...quads(1) }
    )
    expect(answers).toEqual([])
    expect(meshes.meshes.get('answers-quiet')?.head).toBe(1)
  })

  test('echo an integer requestId as a number, for rejected commands and capability queries too', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const answers = send(
      { type: 'cockpit:setMapMesh', requestId: 1, mesh: mesh('answers-numeric') },
      { type: 'cockpit:setMapMeshQuads', requestId: 0, id: 'answers-numeric', ...quads(1) },
      { type: 'cockpit:setMapMeshQuads', requestId: 2, id: 'answers-numeric', ...quads(1), uv: new Float32Array(2) },
      { type: 'cockpit:getMapCapabilities', requestId: -7 }
    ) as unknown as {
      /**
       *
       */
      requestId: unknown
      /**
       *
       */
      ok?: boolean
    }[]
    expect(answers.map(({ requestId, ok }) => [requestId, ok])).toEqual([
      [1, true],
      [0, true],
      [2, false],
      [-7, undefined],
    ])
  })

  test('explain rejections in the order the commands were sent, warning once per mesh and kind of rejection', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const answers = send(
      { type: 'cockpit:setMapMesh', requestId: '1', mesh: mesh('answers-rejected') },
      { type: 'cockpit:setMapMeshQuads', requestId: '2', id: 'answers-rejected', ...quads(1), uv: new Float32Array(2) },
      { type: 'cockpit:setMapMeshQuads', requestId: '3', id: 'answers-rejected', first: 3, ...quads(2) },
      { type: 'cockpit:removeMapMeshQuads', id: 'answers-rejected', first: 4, count: 1 },
      { type: 'cockpit:setMapMeshQuads', requestId: '4', id: 'answers-rejected', ...quads(1) }
    )
    expect(answers.map(({ requestId, ok }) => [requestId, ok])).toEqual([
      ['1', true],
      ['2', false],
      ['3', false],
      ['4', true],
    ])
    expect(answers[1].error).toContain('8 numbers per quad')
    expect(answers[2].error).toContain('do not fit')
    expect(answers[1]).not.toHaveProperty('head')
    // The removal fails like write 3, only with other slot numbers, so it is the same kind of rejection.
    expect(warn.mock.calls.map(([warning]) => warning)).toEqual([
      expect.stringContaining("mesh 'answers-rejected'. Invalid command. uv"),
      expect.stringContaining("mesh 'answers-rejected'. Slots 3 to 4 do not fit"),
    ])
  })

  test('warn once for each mesh rejected for the same kind of reason', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const badUv = (id: string): Record<string, unknown> => ({
      type: 'cockpit:setMapMeshQuads',
      id,
      ...quads(1),
      uv: new Float32Array(2),
    })
    send({ type: 'cockpit:setMapMesh', mesh: mesh('warned-1') }, { type: 'cockpit:setMapMesh', mesh: mesh('warned-2') })
    send(badUv('warned-1'), badUv('warned-2'), badUv('warned-1'), badUv('warned-2'))
    expect(warn.mock.calls.map(([warning]) => warning)).toEqual([
      expect.stringContaining("mesh 'warned-1'. Invalid command. uv"),
      expect.stringContaining("mesh 'warned-2'. Invalid command. uv"),
    ])
  })

  test('reject commands for a mesh that does not exist, and stop reporting a removed one', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const answers = send(
      { type: 'cockpit:clearMapMesh', requestId: 'missing', id: 'answers-missing' },
      { type: 'cockpit:setMapMesh', mesh: mesh('answers-removed') },
      { type: 'cockpit:removeMapMesh', requestId: 'removed', id: 'answers-removed' }
    )
    expect(answers[0]).toMatchObject({
      id: 'answers-missing',
      ok: false,
      error: "Mesh 'answers-missing' does not exist.",
    })
    expect(answers[1]).toEqual({ type: 'cockpit:mapMeshResult', requestId: 'removed', id: 'answers-removed', ok: true })
  })
})

describe('texel arrays', () => {
  test("write a canvas's Uint8ClampedArray as is, and answer any other type with the types they can be", () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const write = (texels: unknown): ExternalMapMeshResult =>
      send({
        type: 'cockpit:setMapMeshQuads',
        requestId: 'write',
        id: 'texel-arrays',
        ...quads(1),
        first: 0,
        texels,
      })[0]
    const [created] = send({ type: 'cockpit:setMapMesh', requestId: 'set', mesh: mesh('texel-arrays') })
    expect(created).toMatchObject({ ok: true })
    expect(write(Uint8ClampedArray.of(200))).toMatchObject({ ok: true, first: 0, count: 1 })
    expect(meshes.meshes.get('texel-arrays')?.pages[0]?.texels[0]).toBe(200)
    for (const texels of [new Float32Array(1), [200], new ArrayBuffer(1)]) {
      expect(write(texels)).toEqual({
        type: 'cockpit:mapMeshResult',
        requestId: 'write',
        id: 'texel-arrays',
        ok: false,
        error: 'Invalid command. texels: Expected a Uint8Array or Uint8ClampedArray, or base64 of its bytes.',
      })
    }
  })
})

describe('strip sizes', () => {
  // `count` quads as in `quads`, each with a strip of `stripBytes` texel bytes and, when asked, a tint.
  const stripQuads = (count: number, stripBytes: number, tinted = false): Record<string, ArrayBufferView> => ({
    ...quads(count),
    texels: new Uint8Array(count * stripBytes),
    ...(tinted ? { tint: new Uint8Array(count * 4).fill(255) } : {}),
  })
  const stripMesh = (id: string, format: string, width: number, height: number): Record<string, unknown> => ({
    ...mesh(id, 2),
    texels: { format, width, height },
  })

  test('accept the largest strips that fit a message as one quad, write them, and allow a tint only where it fits', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    for (const [format, width, height] of [
      ['r8', 1846, 1136],
      ['rgba8', 923, 568],
    ] as const) {
      const id = `strips-largest-${format}`
      const stripBytes = width * height * (format === 'r8' ? 1 : 4)
      const [created, written, tinted] = send(
        { type: 'cockpit:setMapMesh', requestId: 'set', mesh: stripMesh(id, format, width, height) },
        { type: 'cockpit:setMapMeshQuads', requestId: 'write', id, ...stripQuads(1, stripBytes) },
        { type: 'cockpit:setMapMeshQuads', requestId: 'tinted', id, ...stripQuads(1, stripBytes, true) }
      )
      expect(created).toMatchObject({ ok: true, capacity: 2 })
      expect(written).toMatchObject({ ok: true, first: 0, count: 1, head: 1 })
      expect(tinted).toMatchObject({ ok: false })
      expect(tinted.error).toContain('at most 2097152 bytes')
    }

    const tintable = 1846 * 1135
    const [created, tinted] = send(
      { type: 'cockpit:setMapMesh', requestId: 'set', mesh: stripMesh('strips-tintable', 'r8', 1846, 1135) },
      { type: 'cockpit:setMapMeshQuads', requestId: 'tinted', id: 'strips-tintable', ...stripQuads(1, tintable, true) }
    )
    expect(created).toMatchObject({ ok: true })
    expect(tinted).toMatchObject({ ok: true, count: 1 })
  })

  test('refuse a strip no message could carry, leaving the mesh already under that id as it was', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const [created, written, refused] = send(
      { type: 'cockpit:setMapMesh', requestId: 'set', mesh: mesh('strips-refused') },
      { type: 'cockpit:setMapMeshQuads', requestId: 'write', id: 'strips-refused', ...quads(1) },
      { type: 'cockpit:setMapMesh', requestId: 'huge', mesh: stripMesh('strips-refused', 'r8', 2048, 1024) }
    )
    expect(created).toMatchObject({ ok: true })
    expect(written).toMatchObject({ ok: true, head: 1 })
    expect(refused).toMatchObject({ ok: false, id: 'strips-refused' })
    expect(refused.error).toContain('mesh.texels')
    expect(meshes.meshes.get('strips-refused')).toMatchObject({ stripWidth: 1, stripHeight: 1, capacity: 4, head: 1 })
  })
})
