import { afterEach, describe, expect, test, vi } from 'vitest'

import { type ValidatedMapMeshQuads, externalMapMeshCommandSchema } from '@/libs/map/external-map-mesh-api'
import {
  type MapMesh,
  type MapMeshPage,
  latToMercatorY,
  lonToMercatorX,
  MapMeshStore,
} from '@/libs/map/external-map-meshes'
import { MapMeshGlRenderer, mapMeshGlRenderer, meshMixWeight } from '@/libs/map/external-map-meshes-gl'

type GlCall = [string, unknown[]]

// A context recording every call, where constants are their own names and uniform locations the uniforms' names.
const recordingGl = (): [WebGL2RenderingContext, GlCall[]] => {
  const calls: GlCall[] = []
  const results: Record<string, unknown> = {
    getProgramParameter: true,
    isContextLost: false,
    getParameter: 0,
    getExtension: null,
  }
  const gl = new Proxy(
    {},
    {
      get: (_, name) => {
        if (/^[A-Z0-9_]+$/.test(String(name))) return name
        return (...args: unknown[]) => {
          calls.push([String(name), args])
          if (name === 'getUniformLocation') return args[1]
          return String(name) in results ? results[String(name)] : {}
        }
      },
    }
  )
  return [gl as unknown as WebGL2RenderingContext, calls]
}

const fragmentSource = (calls: GlCall[]): string => String(calls.filter(([name]) => name === 'shaderSource')[1][1][1])

const quad = (): Float64Array => Float64Array.of(-48.55, -27.59, -48.5499, -27.59, -48.5499, -27.5901, -48.55, -27.5901)

// Renders a ring of 6 quads written 5 then 3, so it wraps, with every quad in view.
const renderWrappedRing = (): GlCall[] => {
  const store = new MapMeshStore()
  const texels = { format: 'r8', width: 1024, height: 1024 } as const
  store.set({ id: 'scan', name: 'Scan', capacity: 6, texels, filter: 'nearest', opacity: 1 })
  const write = (count: number): void => {
    const corners = new Float64Array(count * 8).map((_, i) => quad()[i % 8])
    store.writeQuads('scan', {
      corners,
      uv: new Float32Array(count * 8),
      texels: new Uint8Array(count * 1024 * 1024),
    })
  }
  write(5)
  write(3)
  const [gl, calls] = recordingGl()
  const renderer = new MapMeshGlRenderer(document.createElement('canvas'), gl, store)
  const originX = lonToMercatorX(-48.55) - 100
  const originY = latToMercatorY(-27.59) + 100
  const mesh = store.meshes.get('scan') as MapMesh
  expect(renderer.render(mesh, { width: 400, height: 400, originX, originY, metresPerPixel: 1 }, [0.3, 0.7])).toBe(true)
  return calls
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('MapMeshGlRenderer', () => {
  test('outputs premultiplied color after the palette, tint and transparency range, discarding nothing', () => {
    const [gl, calls] = recordingGl()
    new MapMeshGlRenderer(document.createElement('canvas'), gl, new MapMeshStore())
    const fragment = fragmentSource(calls)
    expect(fragment).not.toContain('discard')
    const tinted = fragment.indexOf('straight *= quadTint;')
    expect(tinted).toBeGreaterThan(0)
    const clamped = fragment.indexOf('vec2 curve = clamp(alphaCurve, 0.0, 1.0);')
    expect(clamped).toBeGreaterThan(tinted)
    const ranged = fragment.indexOf(
      'float alpha = a > 0.0 ? (curve.y <= curve.x ? step(curve.x, a) : smoothstep(curve.x, curve.y, a)) : 0.0;'
    )
    expect(ranged).toBeGreaterThan(clamped)
    expect(fragment.indexOf('color = vec4(straight.rgb * alpha, alpha);')).toBeGreaterThan(ranged)
  })

  test("draws a wrapped ring oldest to newest, across pages, with the map's range, first exactly then mixed", () => {
    const calls = renderWrappedRing()
    expect(calls).toContainEqual(['uniform2f', ['alphaCurve', 0.3, 0.7]])
    expect(calls).toContainEqual(['clearStencil', [0]])

    // Pages hold 4 slots: slots 2 and 3 of the first page, 4 and 5 of the second, then 0 and 1 of the first.
    const ranges = [
      ['uniform2f', ['pageSize', 2048, 2048]],
      ['uniform1i', ['firstSlot', 2]],
      ['drawArraysInstanced', ['TRIANGLE_STRIP', 0, 4, 2]],
      ['uniform2f', ['pageSize', 2048, 1024]],
      ['uniform1i', ['firstSlot', 0]],
      ['drawArraysInstanced', ['TRIANGLE_STRIP', 0, 4, 2]],
      ['uniform2f', ['pageSize', 2048, 2048]],
      ['uniform1i', ['firstSlot', 0]],
      ['drawArraysInstanced', ['TRIANGLE_STRIP', 0, 4, 2]],
    ]
    const state = ['enable', 'disable', 'stencilFunc', 'stencilOp', 'blendColor', 'blendFunc', 'drawArraysInstanced']
    const drawn = calls.filter(
      ([name, args]) => state.includes(name) || ['pageSize', 'firstSlot'].includes(String(args[0]))
    )
    expect(drawn).toEqual([
      ['disable', ['BLEND']],
      ['enable', ['STENCIL_TEST']],
      ['stencilFunc', ['EQUAL', 0, 0xff]],
      ['stencilOp', ['KEEP', 'KEEP', 'INCR']],
      ...ranges,
      ['enable', ['BLEND']],
      ['blendColor', [0, 0, 0, meshMixWeight]],
      ['blendFunc', ['CONSTANT_ALPHA', 'ONE_MINUS_CONSTANT_ALPHA']],
      ['stencilFunc', ['EQUAL', 1, 0xff]],
      ['stencilOp', ['KEEP', 'KEEP', 'KEEP']],
      ...ranges,
    ])
  })
})

describe('MapMeshGlRenderer uploads', () => {
  // What the renderer uploads for one rgba8 2x2 quad sent as `texels`, through the same validation as a sender's.
  const texelUploads = (texels: Uint8Array | Uint8ClampedArray): unknown[][] => {
    const write = { type: 'cockpit:setMapMeshQuads', id: 'scan', corners: quad(), uv: new Float32Array(8), texels }
    const parsed = externalMapMeshCommandSchema.parse(write) as ValidatedMapMeshQuads
    const store = new MapMeshStore()
    const texelLayout = { format: 'rgba8', width: 2, height: 2 } as const
    store.set({ id: 'scan', name: 'Scan', capacity: 1, texels: texelLayout, filter: 'nearest', opacity: 1 })
    store.writeQuads('scan', parsed)
    const [gl, calls] = recordingGl()
    store.flush(new MapMeshGlRenderer(document.createElement('canvas'), gl, store))
    return calls
      .filter(([name, args]) => name === 'texSubImage2D' && args[8] !== store.meshes.get('scan')?.palette)
      .map(([, args]) => args.map((arg) => (arg instanceof Uint8Array ? [...arg] : arg)))
  }

  test('uploads a Uint8ClampedArray strip, even one viewing part of a buffer, byte for byte as a Uint8Array', () => {
    const strip = [0, 1, 2, 3, 127, 128, 129, 130, 200, 210, 220, 230, 252, 253, 254, 255]
    const clamped = new Uint8ClampedArray(strip.length + 16).fill(77).subarray(8, 8 + strip.length)
    clamped.set(strip)
    const uploads = texelUploads(clamped)
    expect(uploads).toHaveLength(1)
    expect(uploads).toEqual(texelUploads(Uint8Array.from(strip)))
    expect(String(uploads[0][8])).toContain(String(strip))
  })
})

describe('MapMeshGlRenderer releasing meshes', () => {
  const view = {
    width: 4,
    height: 4,
    originX: lonToMercatorX(-48.55) - 20,
    originY: latToMercatorY(-27.59) + 20,
    metresPerPixel: 10,
  }

  const tinyMesh = (id: string): Parameters<MapMeshStore['set']>[0] => ({
    id,
    name: id,
    capacity: 2,
    texels: { format: 'r8', width: 1, height: 1 },
    filter: 'nearest',
    opacity: 1,
  })

  // A store with one quad in each of the meshes, all of them drawn, so the renderer holds a GPU copy of each.
  const drawnMeshes = (ids: string[]): [MapMeshStore, MapMeshGlRenderer, GlCall[]] => {
    const store = new MapMeshStore()
    for (const id of ids) {
      store.set(tinyMesh(id))
      store.writeQuads(id, { corners: quad(), uv: new Float32Array(8), texels: new Uint8Array(1) })
    }
    const [gl, calls] = recordingGl()
    const renderer = new MapMeshGlRenderer(document.createElement('canvas'), gl, store)
    for (const id of ids) expect(renderer.render(store.meshes.get(id) as MapMesh, view, [0, 0])).toBe(true)
    return [store, renderer, calls]
  }

  const deleted = (calls: GlCall[]): unknown[] =>
    calls.filter(([name]) => name === 'deleteTexture' || name === 'deleteBuffer').map(([, args]) => args[0])
  // The GL objects made for meshes and not deleted since.
  const liveObjects = (calls: GlCall[]): number =>
    calls.filter(([name]) => name === 'createTexture' || name === 'createBuffer').length - deleted(calls).length

  test('frees only the removed mesh, and keeps drawing the others from their own GPU copies', () => {
    const [store, renderer, calls] = drawnMeshes(['scan', 'survey'])
    store.remove('scan')
    const freed = deleted(calls)
    // Its palette and page textures, and its page's instance buffer.
    expect(freed).toHaveLength(3)

    const drawnFrom = calls.length
    expect(renderer.render(store.meshes.get('survey') as MapMesh, view, [0, 0])).toBe(true)
    const bound = calls
      .slice(drawnFrom)
      .filter(([name]) => name === 'bindTexture' || name === 'bindBuffer')
      .map(([, args]) => args[1])
    expect(bound.length).toBeGreaterThan(0)
    expect(bound.filter((object) => freed.includes(object))).toEqual([])
    expect(deleted(calls)).toHaveLength(3)
  })

  test('keeps the GPU copy of a drawn mesh that is only written to', () => {
    const [store, renderer, calls] = drawnMeshes(['scan'])
    const from = calls.length
    store.writeQuads('scan', { first: 1, corners: quad(), uv: new Float32Array(8), texels: Uint8Array.of(9) })
    store.flush(renderer)
    expect(deleted(calls)).toHaveLength(0)
    expect(calls.slice(from).filter(([name]) => name.startsWith('create'))).toEqual([])
  })

  const ids = (count: number): string[] => Array.from({ length: count }, (_, i) => `mesh-${i}`)

  const uploaded = (calls: GlCall[]): unknown[] =>
    calls.flatMap(([name, args]) => (name === 'bufferSubData' ? [args[2]] : name === 'texSubImage2D' ? [args[8]] : []))

  test('uploads every mesh again when the context is restored', () => {
    const [store, renderer, calls] = drawnMeshes(['scan', 'survey'])
    renderer.canvas.dispatchEvent(new Event('webglcontextrestored'))
    const from = calls.length
    for (const id of ['scan', 'survey'])
      expect(renderer.render(store.meshes.get(id) as MapMesh, view, [0, 0])).toBe(true)
    expect(calls.slice(from).filter(([name]) => name === 'bufferSubData')).toHaveLength(2)
  })

  test('logs once when the context is lost and once when it is restored', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const renderer = new MapMeshGlRenderer(document.createElement('canvas'), recordingGl()[0], new MapMeshStore())
    const lost = new Event('webglcontextlost', { cancelable: true })
    renderer.canvas.dispatchEvent(lost)
    expect(lost.defaultPrevented).toBe(true)
    expect(warn.mock.calls).toEqual([[expect.stringContaining('context was lost')]])
    expect(info).not.toHaveBeenCalled()
    renderer.canvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(info.mock.calls).toEqual([[expect.stringContaining('context was restored')]])
    expect(warn).toHaveBeenCalledTimes(1)
  })

  test('does not log a restore whose setup fails', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    // jsdom reports the exception thrown in the listener through console.error
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let failing = false
    const [gl] = recordingGl()
    const failingGl = new Proxy(gl, {
      get: (target, name) => (failing && name === 'createProgram' ? () => null : Reflect.get(target, name)),
    })
    const renderer = new MapMeshGlRenderer(document.createElement('canvas'), failingGl, new MapMeshStore())
    failing = true
    renderer.canvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(info).not.toHaveBeenCalled()
  })

  test('deletes every GL object it made for a mesh of several pages and for one never written, once removed', () => {
    const store = new MapMeshStore()
    const [gl, calls] = recordingGl()
    const renderer = new MapMeshGlRenderer(document.createElement('canvas'), gl, store)
    // 4 strips of 1024x1024 texels fill a page, so 8 quads written make 2 pages.
    store.set({ ...tinyMesh('paged'), capacity: 8, texels: { format: 'r8', width: 1024, height: 1024 } })
    const corners = Float64Array.from({ length: 8 * 8 }, (_, i) => quad()[i % 8])
    store.writeQuads('paged', { corners, uv: new Float32Array(8 * 8), texels: new Uint8Array(8 * 1024 * 1024) })
    store.set(tinyMesh('palette-only'))
    store.flush(renderer)
    // 2 pages of a texture and a buffer, and a palette texture for each mesh.
    expect(liveObjects(calls)).toBe(6)
    store.remove('paged')
    expect(liveObjects(calls)).toBe(1)
    store.remove('palette-only')
    expect(liveObjects(calls)).toBe(0)
  })

  // The store's own bookkeeping, private, read as is rather than through a test-only API.
  const pending = (store: MapMeshStore): Set<string> => Reflect.get(store, 'dirty')
  // Ids held in any of the store's own sets and maps, whatever they are named, but for its listeners.
  const heldIds = (store: MapMeshStore): number =>
    Object.entries(store).reduce(
      (held, [key, value]) =>
        held + (key !== 'listeners' && (value instanceof Set || value instanceof Map) ? value.size : 0),
      0
    )
  const gpuMeshes = (renderer: MapMeshGlRenderer): Map<string, unknown> => Reflect.get(renderer, 'meshes')

  test('keeps nothing of 10,000 meshes defined and removed with no frame drawn in between or after', () => {
    const store = new MapMeshStore()
    const renderer = new MapMeshGlRenderer(document.createElement('canvas'), recordingGl()[0], store)
    let maxDirty = 0
    for (const id of ids(10000)) {
      store.set(tinyMesh(id))
      store.remove(id)
      maxDirty = Math.max(maxDirty, pending(store).size)
    }
    expect({
      maxDirty,
      held: heldIds(store),
      reserved: store.reservedBytes(),
      gpuMeshes: gpuMeshes(renderer).size,
    }).toEqual({ maxDirty: 0, held: 0, reserved: 0, gpuMeshes: 0 })
  })

  const churn = (store: MapMeshStore): void => {
    for (const id of ids(10000)) {
      store.set(tinyMesh(id))
      store.remove(id)
    }
  }

  test('keeps nothing of 10,000 meshes defined and removed with no renderer, as without WebGL2', () => {
    const store = new MapMeshStore()
    churn(store)
    expect({ held: heldIds(store), reserved: store.reservedBytes() }).toEqual({ held: 0, reserved: 0 })
  })

  test('gives a renderer created after that churn nothing to free, and draws and frees a mesh defined before it', () => {
    const store = new MapMeshStore()
    churn(store)
    store.set(tinyMesh('scan'))
    store.writeQuads('scan', { corners: quad(), uv: new Float32Array(8), texels: Uint8Array.of(7) })
    const [gl, calls] = recordingGl()
    const renderer = new MapMeshGlRenderer(document.createElement('canvas'), gl, store)
    const releaseMesh = vi.spyOn(renderer, 'releaseMesh')

    const mesh = store.meshes.get('scan') as MapMesh
    expect(renderer.render(mesh, view, [0, 0])).toBe(true)
    const page = mesh.pages[0] as MapMeshPage
    expect(uploaded(calls)).toEqual([mesh.palette, page.instances, page.texels])
    expect(releaseMesh).not.toHaveBeenCalled()
    expect(deleted(calls)).toHaveLength(0)

    store.remove('scan')
    expect(releaseMesh.mock.calls).toEqual([['scan']])
    expect(deleted(calls)).toHaveLength(3)
    expect(gpuMeshes(renderer).size).toBe(0)
  })

  test('frees the GPU copy of drawn meshes removed, cleared or laid out anew, and frees nothing for one never drawn', () => {
    const [store, renderer, calls] = drawnMeshes(['removed', 'cleared', 'redefined', ...ids(1000)])
    store.remove('removed')
    expect(deleted(calls)).toHaveLength(3)
    store.clear('cleared')
    expect(deleted(calls)).toHaveLength(6)
    store.set({ ...tinyMesh('redefined'), capacity: 4 })
    expect(deleted(calls)).toHaveLength(9)
    ids(1000).forEach((id) => store.remove(id))
    expect(gpuMeshes(renderer).size).toBe(0)

    const freed = deleted(calls).length
    store.set(tinyMesh('undrawn'))
    store.clear('undrawn')
    store.remove('undrawn')
    expect(deleted(calls)).toHaveLength(freed)
    ;['cleared', 'redefined'].forEach((id) => store.remove(id))
    expect(heldIds(store)).toBe(0)
  })

  test('tells the maps a mesh is gone only once it is no longer pending an upload', () => {
    const [store] = drawnMeshes(['scan'])
    store.writeQuads('scan', { first: 1, corners: quad(), uv: new Float32Array(8), texels: Uint8Array.of(9) })
    expect(pending(store).has('scan')).toBe(true)
    const dirtyWhenTold: boolean[] = []
    store.subscribe(({ id }) => dirtyWhenTold.push(pending(store).has(id)))
    store.remove('scan')
    expect(dirtyWhenTold).toEqual([false])
  })

  test('uploads and draws a mesh removed and defined again under its id, from a new GPU copy', () => {
    const [store, renderer, calls] = drawnMeshes(['scan'])
    store.writeQuads('scan', { first: 1, corners: quad(), uv: new Float32Array(8), texels: Uint8Array.of(9) })
    store.remove('scan')
    const freed = deleted(calls)
    expect(freed).toHaveLength(3)
    expect(gpuMeshes(renderer).size).toBe(0)

    store.set(tinyMesh('scan'))
    store.writeQuads('scan', { corners: quad(), uv: new Float32Array(8), texels: Uint8Array.of(7) })
    const from = calls.length
    expect(renderer.render(store.meshes.get('scan') as MapMesh, view, [0, 0])).toBe(true)
    const mesh = store.meshes.get('scan') as MapMesh
    const page = mesh.pages[0] as MapMeshPage
    expect(uploaded(calls.slice(from))).toEqual([mesh.palette, page.instances, page.texels])
    const bound = calls
      .slice(from)
      .filter(([name]) => name === 'bindTexture' || name === 'bindBuffer')
      .map(([, args]) => args[1])
    expect(bound.filter((object) => freed.includes(object))).toEqual([])
    expect(gpuMeshes(renderer).size).toBe(1)
    expect(pending(store).size).toBe(0)
    expect(deleted(calls)).toHaveLength(3)
  })

  test('frees the GPU copy an upload that threw left half made, once the mesh is removed', () => {
    const store = new MapMeshStore()
    store.set(tinyMesh('scan'))
    store.writeQuads('scan', { corners: quad(), uv: new Float32Array(8), texels: Uint8Array.of(7) })
    const [gl, calls] = recordingGl()
    const renderer = new MapMeshGlRenderer(document.createElement('canvas'), gl, store)
    vi.spyOn(renderer, 'uploadPage').mockImplementationOnce(() => {
      throw new Error('Context lost.')
    })
    const releaseMesh = vi.spyOn(renderer, 'releaseMesh')
    expect(() => renderer.render(store.meshes.get('scan') as MapMesh, view, [0, 0])).toThrow('Context lost.')
    expect(gpuMeshes(renderer).has('scan')).toBe(true)

    store.remove('scan')
    expect(releaseMesh.mock.calls).toEqual([['scan']])
    // Only its palette texture was made before the upload threw.
    expect(deleted(calls)).toHaveLength(1)
    expect(gpuMeshes(renderer).size).toBe(0)
    expect(heldIds(store)).toBe(0)
  })
})

describe('mapMeshGlRenderer', () => {
  test('asks for a stencil buffer', () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    expect(mapMeshGlRenderer(new MapMeshStore())).toBeUndefined()
    expect(getContext).toHaveBeenCalledWith('webgl2', expect.objectContaining({ stencil: true }))
    getContext.mockRestore()
  })
})
