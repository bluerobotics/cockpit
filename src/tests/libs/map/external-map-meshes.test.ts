import L from 'leaflet'
import { describe, expect, it, vi } from 'vitest'

import type { ValidatedMapMesh, ValidatedMapMeshQuads } from '@/libs/map/external-map-mesh-api'
import {
  defaultMapMeshBudgetBytes,
  MapMeshBudgetError,
  mapMeshBudgetFromMiB,
} from '@/libs/map/external-map-mesh-budget'
import { mapMeshReservedBytes, meshInstanceBytes } from '@/libs/map/external-map-mesh-layout'
import {
  type MapMesh,
  type MapMeshChange,
  type MapMeshPage,
  type MapMeshRenderer,
  type MercatorPoint,
  latToMercatorY,
  lonToMercatorX,
  MapMeshStore,
  meshDrawRanges,
  stripPlace,
} from '@/libs/map/external-map-meshes'

const definition = (overrides: Partial<ValidatedMapMesh> = {}): ValidatedMapMesh => ({
  id: 'test-mesh',
  name: 'Test',
  capacity: 8,
  texels: { format: 'r8', width: 2, height: 1 },
  filter: 'nearest',
  opacity: 1,
  ...overrides,
})

// `count` quads of about 10 m side, side by side eastwards, each strip filled with its quad's index plus `value`.
const quads = (count: number, first?: number, value = 0, stripBytes = 2): ValidatedMapMeshQuads => {
  const corners = new Float64Array(count * 8)
  for (let i = 0; i < count; i++) {
    const lon = -48.55 + i * 0.0001
    corners.set([lon, -27.59, lon + 0.0001, -27.59, lon + 0.0001, -27.5901, lon, -27.5901], i * 8)
  }
  const texels = new Uint8Array(count * stripBytes)
  for (let i = 0; i < count; i++) texels.fill(i + value, i * stripBytes, (i + 1) * stripBytes)
  return { first, corners, uv: new Float32Array(count * 8).fill(0.5), texels }
}

const meshOf = (store: MapMeshStore): MapMesh => store.meshes.get('test-mesh') as MapMesh

const slotTexels = (mesh: MapMesh, slot: number): number[] => {
  const { page, x, y } = stripPlace(mesh, slot)
  const data = mesh.pages[page] as MapMeshPage
  const at = (y * data.width + x) * mesh.bytesPerTexel
  return [...data.texels.subarray(at, at + mesh.stripWidth * mesh.bytesPerTexel)]
}

const slotCorners = (mesh: MapMesh, slot: number): number[] => {
  const page = mesh.pages[stripPlace(mesh, slot).page] as MapMeshPage
  const at = ((slot - page.firstSlot) * meshInstanceBytes) / 4
  return [...page.instanceFloats.subarray(at, at + 8)]
}

const allocatedBytes = (store: MapMeshStore): number => {
  let bytes = 0
  for (const mesh of store.meshes.values()) {
    bytes += mesh.palette.byteLength
    mesh.pages.forEach((page) => page && (bytes += page.instances.byteLength + page.texels.byteLength))
  }
  return bytes
}

describe('MapMeshStore', () => {
  it('keeps the quads when a mesh is set again with the same layout, and empties it otherwise', () => {
    const store = new MapMeshStore()
    store.set(definition())
    store.writeQuads('test-mesh', quads(3))
    const palette = new Uint8Array(1024).fill(7)
    store.set(definition({ name: 'Renamed', opacity: 0.5, filter: 'linear', palette }))
    expect(meshOf(store)).toMatchObject({ name: 'Renamed', opacity: 0.5, filter: 'linear', palette, highWater: 3 })
    expect(slotTexels(meshOf(store), 2)).toEqual([2, 2])

    store.set(definition())
    const grayRamp = Uint8Array.from({ length: 1024 }, (_, i) => (i % 4 === 3 ? 255 : i >> 2))
    expect(meshOf(store)).toMatchObject({ palette: grayRamp, highWater: 3 })

    store.set(definition({ capacity: 16 }))
    expect(meshOf(store)).toMatchObject({ capacity: 16, head: 0, highWater: 0 })
    expect(meshOf(store).pages.filter(Boolean)).toHaveLength(0)
  })

  it('writes after the previous write without `first`, wrapping around at the capacity', () => {
    const store = new MapMeshStore()
    store.set(definition({ capacity: 4 }))
    expect(store.writeQuads('test-mesh', quads(3))).toEqual({ first: 0, count: 3 })
    expect(store.writeQuads('test-mesh', quads(2, undefined, 10))).toEqual({ first: 3, count: 2 })
    const mesh = meshOf(store)
    expect(slotTexels(mesh, 3)).toEqual([10, 10])
    expect(slotTexels(mesh, 0)).toEqual([11, 11])
    expect(slotTexels(mesh, 1)).toEqual([1, 1])
    expect(mesh).toMatchObject({ head: 1, highWater: 4 })
  })

  it('writes at an explicit `first`, and writes nothing when the quads do not fit', () => {
    const store = new MapMeshStore()
    store.set(definition())
    expect(store.writeQuads('test-mesh', quads(2, 5, 20))).toEqual({ first: 5, count: 2 })
    const mesh = meshOf(store)
    expect(slotTexels(mesh, 5)).toEqual([20, 20])
    expect(slotTexels(mesh, 6)).toEqual([21, 21])
    expect(mesh).toMatchObject({ head: 7, highWater: 7 })

    expect(() => store.writeQuads('test-mesh', quads(2, 7, 30))).toThrow('do not fit')
    expect(slotTexels(mesh, 7)).toEqual([0, 0])
    expect(mesh).toMatchObject({ head: 7, highWater: 7 })
  })

  it('writes nothing when a page the write needs cannot be allocated, even into the pages it already has', () => {
    // Four 1024x1024 strips to a page, so slots 3 to 8 span pages 0, 1 and 2.
    const strip = 1024 * 1024
    const store = new MapMeshStore()
    store.set(definition({ capacity: 12, texels: { format: 'r8', width: 1024, height: 1024 } }))
    const mesh = meshOf(store)
    store.writeQuads('test-mesh', quads(1, 3, 5, strip))
    const before = { head: mesh.head, highWater: mesh.highWater, page: mesh.pages[0], bytes: allocatedBytes(store) }
    const changes: MapMeshChange[] = []
    store.subscribe((change) => changes.push(change))
    // Fails on the second new page, as a typed array too large for the memory left does.
    const internals = store as unknown as Record<'allocatePage', (mesh: MapMesh, index: number) => MapMeshPage>
    const allocate = internals.allocatePage.bind(store)
    let allocations = 0
    vi.spyOn(internals, 'allocatePage').mockImplementation((target, index) => {
      if (++allocations === 2) throw new RangeError('Array buffer allocation failed')
      return allocate(target, index)
    })

    expect(() => store.writeQuads('test-mesh', quads(6, 3, 9, strip))).toThrow(RangeError)
    expect(allocations).toBe(2)
    expect(Array.from(mesh.pages, (page) => page?.index)).toEqual([0, undefined, undefined])
    expect(mesh.pages[0]).toBe(before.page)
    expect(new Set(slotTexels(mesh, 3))).toEqual(new Set([5]))
    expect(mesh).toMatchObject({ head: before.head, highWater: before.highWater })
    expect(allocatedBytes(store)).toBe(before.bytes)
    expect(changes).toEqual([])
  })

  it('rejects texels that do not match the strip size', () => {
    const store = new MapMeshStore()
    store.set(definition())
    expect(() => store.writeQuads('test-mesh', quads(2, 0, 0, 3))).toThrow('texel bytes per quad')
    expect(meshOf(store).highWater).toBe(0)
  })

  it('empties removed slots into degenerate quads, reporting where they were', () => {
    const store = new MapMeshStore()
    store.set(definition())
    store.writeQuads('test-mesh', quads(4))
    const changes: MapMeshChange[] = []
    store.subscribe((change) => changes.push(change))
    store.removeQuads('test-mesh', 1, 2)
    const mesh = meshOf(store)
    expect(slotCorners(mesh, 1)).toEqual(Array(8).fill(0))
    expect(slotCorners(mesh, 2)).toEqual(Array(8).fill(0))
    expect(slotCorners(mesh, 3)).not.toEqual(Array(8).fill(0))
    expect(changes[0].bounds?.minX).toBeCloseTo(lonToMercatorX(-48.5499), 3)
    expect(changes[0].bounds?.maxX).toBeCloseTo(lonToMercatorX(-48.5497), 3)
  })

  it('reports a rewritten slot where its old quad was as well as where the new one is', () => {
    const store = new MapMeshStore()
    store.set(definition())
    store.writeQuads('test-mesh', quads(1, 0))
    const changes: MapMeshChange[] = []
    store.subscribe((change) => changes.push(change))
    const moved = quads(1, 0)
    moved.corners.forEach((value, i) => i % 2 === 0 && (moved.corners[i] = value + 0.01))
    store.writeQuads('test-mesh', moved)
    expect(changes[0].bounds?.minX).toBeCloseTo(lonToMercatorX(-48.55), 3)
    expect(changes[0].bounds?.maxX).toBeCloseTo(lonToMercatorX(-48.5399), 3)
  })

  it('draws a wrapped ring from the head to the high-water mark, then from the start to the head', () => {
    const store = new MapMeshStore()
    store.set(definition({ capacity: 6 }))
    store.writeQuads('test-mesh', quads(5))
    store.writeQuads('test-mesh', quads(3))
    const ranges = meshDrawRanges(meshOf(store)).map(({ first, count }) => [first, count])
    expect(ranges).toEqual([
      [2, 4],
      [0, 2],
    ])
  })

  it('places strips in pages of 2048 texels, splitting draws at page boundaries', () => {
    const store = new MapMeshStore()
    store.set(definition({ capacity: 50_000, texels: { format: 'r8', width: 200, height: 1 } }))
    const mesh = meshOf(store)
    expect(mesh.stripsPerRow).toBe(10)
    expect(mesh.slotsPerPage).toBe(20480)
    expect(mesh.pages).toHaveLength(3)
    expect(stripPlace(mesh, 20481)).toEqual({ page: 1, x: 200, y: 0 })
    expect(stripPlace(mesh, 15)).toEqual({ page: 0, x: 1000, y: 1 })

    store.writeQuads('test-mesh', quads(4, 20478, 0, 200))
    expect(slotTexels(mesh, 20480).slice(0, 3)).toEqual([2, 2, 2])
    // Slots below the write were never written, but sit before the head, so they are drawn, as degenerate quads.
    const ranges = meshDrawRanges(mesh).map(({ page, first, count }) => [page.index, first, count])
    expect(ranges).toEqual([
      [0, 0, 20480],
      [1, 0, 2],
    ])
    // The last page only holds the slots left over, so it is no larger than they need.
    store.writeQuads('test-mesh', quads(1, 49_999, 0, 200))
    expect(mesh.pages[2]).toMatchObject({ slotCount: 50_000 - 40960, width: 2000, height: 904 })
  })

  it('copies what it is sent rather than keeping the arrays', () => {
    const store = new MapMeshStore()
    store.set(definition())
    const sent = quads(1, 0, 7)
    store.writeQuads('test-mesh', sent)
    const corners = slotCorners(meshOf(store), 0)
    sent.corners.fill(0)
    sent.texels.fill(99)
    expect(slotCorners(meshOf(store), 0)).toEqual(corners)
    expect(slotTexels(meshOf(store), 0)).toEqual([7, 7])
  })

  it('draws quads sent without uv upright over their strips, exactly as the explicit upright uv does', () => {
    const [width, height] = [600, 3]
    const instances = (uv?: Float32Array): number[] => {
      const store = new MapMeshStore()
      store.set(definition({ capacity: 4, texels: { format: 'r8', width, height } }))
      store.writeQuads('test-mesh', { ...quads(3, 1, 0, width * height), uv })
      return [...(meshOf(store).pages[0] as MapMeshPage).instances]
    }
    const upright = new Float32Array(3 * 8)
    for (let quad = 0; quad < 3; quad++) upright.set([0, 0, width, 0, width, height, 0, height], quad * 8)
    const omitted = instances()
    expect(omitted).toEqual(instances(upright))
    const slot1Uv = new Float32Array(Uint8Array.from(omitted).buffer, meshInstanceBytes + 32, 8)
    expect([...slot1Uv]).toEqual([0, 0, width, 0, width, height, 0, height])
  })

  it('hands a renderer only what changed since the last flush', () => {
    const uploads: [number, [number, number] | undefined][] = []
    const released: string[] = []
    const renderer: MapMeshRenderer = {
      uploadSettings: () => undefined,
      uploadPage: (_mesh, page) => uploads.push([page.index, page.dirtySlots]),
    }
    const store = new MapMeshStore()
    store.subscribe((change) => change.released && released.push(change.id))
    store.set(definition())
    store.writeQuads('test-mesh', quads(2, 3))
    store.flush(renderer)
    expect(uploads).toEqual([[0, [3, 5]]])
    store.flush(renderer)
    expect(uploads).toHaveLength(1)
    store.remove('test-mesh')
    store.flush(renderer)
    expect(released).toEqual(['test-mesh'])
  })

  it('projects like Leaflet, keeping corners within a millimeter 10 km from the anchor', () => {
    const lat = -27.59
    const lon = -48.55
    const projected = L.Projection.SphericalMercator.project(L.latLng(lat, lon))
    expect(lonToMercatorX(lon)).toBeCloseTo(projected.x, 6)
    expect(latToMercatorY(lat)).toBeCloseTo(projected.y, 6)

    const store = new MapMeshStore()
    store.set(definition({ capacity: 1000 }))
    const metresToDegrees = 180 / (Math.PI * 6378137)
    const far = lon + (7_000 * metresToDegrees) / Math.cos((lat * Math.PI) / 180)
    const farLat = lat + 7_000 * metresToDegrees
    store.writeQuads('test-mesh', quads(1, 0))
    // Steps of irregular size, so the far corners do not land on numbers float32 happens to hold exactly.
    const sent = quads(100, 1)
    for (let i = 0; i < 100; i++) {
      const east = far - i * 0.0000123
      const north = farLat - i * 0.0000371
      sent.corners.set([east, north, east + 0.0001, north, east + 0.0001, north - 0.0001, east, north - 0.0001], i * 8)
    }
    store.writeQuads('test-mesh', sent)
    const mesh = meshOf(store)
    const anchor = mesh.anchor as MercatorPoint
    let worst = 0
    for (let i = 0; i < 100; i++) {
      const stored = slotCorners(mesh, i + 1)
      for (let corner = 0; corner < 4; corner++) {
        const x = lonToMercatorX(sent.corners[i * 8 + corner * 2])
        const y = latToMercatorY(sent.corners[i * 8 + corner * 2 + 1])
        const scale = Math.cos((sent.corners[i * 8 + corner * 2 + 1] * Math.PI) / 180)
        const error = Math.hypot(stored[corner * 2] + anchor.x - x, stored[corner * 2 + 1] + anchor.y - y) * scale
        worst = Math.max(worst, error)
      }
    }
    expect(worst).toBeGreaterThan(0)
    expect(worst).toBeLessThan(0.001)
  })
})

describe('MapMeshStore flush', () => {
  const ids = Array.from({ length: 8 }, (_, i) => `mesh-${i}`)

  // Every call the store makes, as `mesh:page:dirty slots` for uploads.
  const recordingRenderer = (): [MapMeshRenderer, string[]] => {
    const calls: string[] = []
    const renderer: MapMeshRenderer = {
      uploadSettings: (mesh) => calls.push(`settings ${mesh.id}`),
      uploadPage: (mesh, page) => calls.push(`page ${mesh.id}:${page.index}:${page.dirtySlots}`),
    }
    return [renderer, calls]
  }

  // Wraps every mesh the store holds, recording the ids of those anything reads from then on.
  const recordVisits = (store: MapMeshStore): Set<string> => {
    const visited = new Set<string>()
    for (const [id, mesh] of store.meshes) {
      store.meshes.set(id, new Proxy(mesh, { get: (target, key) => (visited.add(id), Reflect.get(target, key)) }))
    }
    return visited
  }

  // 8 meshes of 2 quads, every one flushed, so nothing is dirty.
  const flushedMeshes = (): [MapMeshStore, MapMeshRenderer, string[], Set<string>] => {
    const store = new MapMeshStore()
    for (const id of ids) {
      store.set(definition({ id }))
      store.writeQuads(id, quads(2))
    }
    const [renderer, calls] = recordingRenderer()
    store.flush(renderer)
    expect(calls).toEqual(ids.flatMap((id) => [`settings ${id}`, `page ${id}:0:0,2`]))
    calls.length = 0
    store.subscribe((change) => change.released && calls.push(`release ${change.id}`))
    return [store, renderer, calls, recordVisits(store)]
  }

  it('visits and uploads only the mesh written among many, and no mesh at all on a flush with nothing changed', () => {
    const [store, renderer, calls, visited] = flushedMeshes()
    store.writeQuads('mesh-3', quads(1, 5))
    visited.clear()
    store.flush(renderer)
    expect(calls).toEqual(['page mesh-3:0:5,6'])
    expect([...visited]).toEqual(['mesh-3'])

    // As every per-mesh draw of a frame flushes again.
    visited.clear()
    for (let draw = 0; draw < ids.length; draw++) store.flush(renderer)
    expect(visited.size).toBe(0)
    expect(calls).toEqual(['page mesh-3:0:5,6'])
  })

  it('coalesces repeated writes to a page into one upload, leaving the pages and meshes not written', () => {
    const store = new MapMeshStore()
    const texels = { format: 'r8', width: 700, height: 700 } as const
    store.set(definition({ id: 'big', capacity: 8, texels }))
    store.set(definition({ id: 'other' }))
    store.writeQuads('big', quads(8, 0, 0, 700 * 700))
    store.writeQuads('other', quads(1))
    const [renderer, calls] = recordingRenderer()
    store.flush(renderer)
    expect(calls).toEqual(['settings big', 'page big:0:0,4', 'page big:1:0,4', 'settings other', 'page other:0:0,1'])
    calls.length = 0
    for (const first of [1, 3, 2, 3]) store.writeQuads('big', quads(1, first, 9, 700 * 700))
    store.flush(renderer)
    expect(calls).toEqual(['page big:0:1,4'])
    expect(store.meshes.get('big')?.pages[0]?.dirtySlots).toBeUndefined()
  })

  const changes: [string, (store: MapMeshStore) => void, string[]][] = [
    ['same-layout redefinition', (store) => store.set(definition({ id: 'mesh-3', opacity: 0.5 })), ['settings mesh-3']],
    ['quad removal', (store) => store.removeQuads('mesh-3', 1, 1), ['page mesh-3:0:1,2']],
    ['clear', (store) => store.clear('mesh-3'), ['release mesh-3', 'settings mesh-3']],
    [
      'new-layout redefinition',
      (store) => store.set(definition({ id: 'mesh-3', capacity: 16 })),
      ['release mesh-3', 'settings mesh-3'],
    ],
    ['removal', (store) => store.remove('mesh-3'), ['release mesh-3']],
    [
      'write after a removal of its quads',
      (store) => {
        store.removeQuads('mesh-3', 0, 2)
        store.writeQuads('mesh-3', quads(1, 0))
      },
      ['page mesh-3:0:0,2'],
    ],
  ]
  for (const [name, change, expected] of changes) {
    it(`hands a renderer only what a ${name} changed, visiting no other mesh`, () => {
      const [store, renderer, calls, visited] = flushedMeshes()
      change(store)
      visited.clear()
      store.flush(renderer)
      expect(calls).toEqual(expected)
      expect([...visited].filter((id) => id !== 'mesh-3')).toEqual([])
      calls.length = 0
      store.flush(renderer)
      expect(calls).toEqual([])
    })
  }

  it('hands a renderer every mesh and page again after it lost its GPU copy', () => {
    const [store, renderer, calls] = flushedMeshes()
    store.markAllDirty()
    store.flush(renderer)
    expect(calls).toEqual(ids.flatMap((id) => [`settings ${id}`, `page ${id}:0:0,8`]))
    calls.length = 0
    store.flush(renderer)
    expect(calls).toEqual([])
  })

  it('keeps a mesh queued for the next flush when its upload throws, as it does on a lost context', () => {
    const [store, renderer, calls] = flushedMeshes()
    store.writeQuads('mesh-3', quads(1, 1))
    const failing: MapMeshRenderer = {
      ...renderer,
      uploadPage: () => {
        throw new Error('The WebGL2 context was lost.')
      },
    }
    expect(() => store.flush(failing)).toThrow('lost')
    store.flush(renderer)
    expect(calls).toEqual(['page mesh-3:0:1,2'])
  })
})

describe('MapMeshStore memory budget', () => {
  // ping-viewer's Ping360 map: 1200-sample pings, about 225 s of them at 50 Hz. The default budget holds 16 of them.
  const ping360 = (id: string, capacity = 11264): ValidatedMapMesh =>
    definition({ id, capacity, texels: { format: 'r8', width: 1200, height: 1 } })
  const ping360Bytes = 14_283_776
  // Writing one 112-byte quad to any of its slots allocates a whole 2048x2048 page: 16 MiB of texels and 68 MiB of
  // instances.
  const attack = (id: string): ValidatedMapMesh =>
    definition({ id, capacity: 1 << 20, texels: { format: 'rgba8', width: 2, height: 2 } })
  const attackBytes = 88_081_408
  const small = (id: string, capacity = 8): ValidatedMapMesh => definition({ id, capacity })
  const reservation = (mesh: ValidatedMapMesh): number => {
    const store = new MapMeshStore()
    store.set(mesh)
    return store.reservedBytes()
  }
  const refusal = (action: () => void): MapMeshBudgetError => {
    try {
      action()
    } catch (error) {
      if (error instanceof MapMeshBudgetError) return error
      throw error
    }
    throw new Error('Expected the budget to refuse it.')
  }
  const budgeted = (bytes: number): MapMeshStore => new MapMeshStore(() => String(bytes))

  it('reserves at definition exactly what a production Ping360 mesh holds once every slot is written', () => {
    const store = new MapMeshStore()
    store.set(ping360('test-mesh'))
    expect(allocatedBytes(store)).toBe(1024)
    expect(store.reservedBytes()).toBe(ping360Bytes)

    store.writeQuads('test-mesh', quads(11264, 0, 0, 1200))
    // Five pages of 2048 slots and one of 1024, each slot 68 bytes of instance and 1200 texels, plus the palette.
    expect(meshOf(store).pages.map((page) => page?.slotCount)).toEqual([2048, 2048, 2048, 2048, 2048, 1024])
    expect(1024 + 11264 * (68 + 1200)).toBe(ping360Bytes)
    expect(allocatedBytes(store)).toBe(ping360Bytes)
    expect(store.reservedBytes()).toBe(ping360Bytes)
  })

  it('reserves what every page takes once written, for a last page only partly filled', () => {
    // 10 strips to a row and 1024 rows to a page: the last of 5 pages holds 9043, in 905 rows of which the last has 3.
    const store = new MapMeshStore()
    store.set(definition({ capacity: 50_003, texels: { format: 'rgba8', width: 200, height: 2 } }))
    for (const first of [0, 10240, 20480, 30720, 50_002]) store.writeQuads('test-mesh', quads(1, first, 0, 1600))
    expect(meshOf(store).pages.map((page) => page && [page.slotCount, page.width, page.height])).toEqual([
      ...Array(4).fill([10240, 2000, 2048]),
      [9043, 2000, 1810],
    ])
    expect(store.reservedBytes()).toBe(allocatedBytes(store))
  })

  it('defaults to 16 production Ping360 meshes, defining 16 without allocating them and refusing a 17th', () => {
    expect(reservation(ping360('sonar'))).toBe(ping360Bytes)
    expect(defaultMapMeshBudgetBytes).toBe(228_589_568)
    const store = new MapMeshStore()
    expect(store.budgetBytes()).toBe(defaultMapMeshBudgetBytes)
    for (let i = 0; i < 16; i++) store.set(ping360(`sonar-${i}`))
    store.writeQuads('sonar-0', quads(1, 0, 7, 1200))
    const allocated = allocatedBytes(store)
    expect(allocated).toBe(16 * 1024 + 2048 * (68 + 1200))

    const refused = refusal(() => store.set(ping360('sonar-16')))
    expect(refused).toMatchObject({
      code: 'budget',
      usedBytes: 16 * ping360Bytes,
      previousBytes: 0,
      requestedBytes: ping360Bytes,
      budgetBytes: defaultMapMeshBudgetBytes,
    })
    expect(refused.message).toContain(`${ping360Bytes} bytes`)
    expect(store.meshes.has('sonar-16')).toBe(false)
    expect(store.reservedBytes()).toBe(16 * ping360Bytes)
    expect(allocatedBytes(store)).toBe(allocated)
    const kept = store.meshes.get('sonar-0') as MapMesh
    expect(kept).toMatchObject({ head: 1, highWater: 1 })
    expect(slotTexels(kept, 0)).toEqual(Array(1200).fill(7))
  })

  it('refuses an 84 MiB definition before allocating anything: a third of them, or one past 12 Ping360 meshes', () => {
    const store = new MapMeshStore()
    store.set(attack('attack-0'))
    store.set(attack('attack-1'))
    expect(store.reservedBytes()).toBe(2 * attackBytes)
    const changes: MapMeshChange[] = []
    store.subscribe((change) => changes.push(change))
    expect(refusal(() => store.set(attack('attack-2')))).toMatchObject({ usedBytes: 2 * attackBytes })
    expect(3 * attackBytes).toBeGreaterThan(defaultMapMeshBudgetBytes)
    expect(allocatedBytes(store)).toBe(2 * 1024)
    expect(changes).toEqual([])
    ;['attack-0', 'attack-1'].forEach((id) => store.remove(id))
    for (let i = 0; i < 12; i++) store.set(ping360(`sonar-${i}`))
    changes.length = 0
    const refused = refusal(() => store.set(attack('attack')))
    expect(refused).toMatchObject({ usedBytes: 12 * ping360Bytes, requestedBytes: attackBytes })
    expect(defaultMapMeshBudgetBytes - 12 * ping360Bytes).toBeLessThan(attackBytes)
    expect(store.meshes.has('attack')).toBe(false)
    expect(allocatedBytes(store)).toBe(12 * 1024)
    expect(changes).toEqual([])
  })

  it('refuses a redefinition over the budget, leaving the mesh, its quads and its reservation as they were', () => {
    const store = budgeted(reservation(small('test-mesh')) + reservation(small('other')))
    store.set(small('test-mesh'))
    store.set(small('other'))
    store.writeQuads('test-mesh', quads(3, 2, 40))
    const renderer: MapMeshRenderer = {
      uploadSettings: () => undefined,
      uploadPage: () => undefined,
    }
    store.flush(renderer)
    const before = { ...meshOf(store), anchor: { ...(meshOf(store).anchor as MercatorPoint) } }
    const pages = [...meshOf(store).pages]
    const reserved = store.reservedBytes()
    const changes: MapMeshChange[] = []
    store.subscribe((change) => changes.push(change))

    const refused = refusal(() => store.set(small('test-mesh', 4096)))
    expect(refused).toMatchObject({
      usedBytes: reserved,
      previousBytes: reservation(small('test-mesh')),
      requestedBytes: reservation(small('x', 4096)),
      budgetBytes: reserved,
    })
    expect(meshOf(store)).toEqual(before)
    expect(meshOf(store).pages).toEqual(pages)
    expect(meshOf(store).pages[0]).toBe(pages[0])
    expect([2, 3, 4].map((slot) => slotTexels(meshOf(store), slot))).toEqual([
      [40, 40],
      [41, 41],
      [42, 42],
    ])
    expect(store.reservedBytes()).toBe(reserved)
    expect(changes).toEqual([])
  })

  it('costs nothing to redefine a mesh with the same layout, even with the budget full', () => {
    const store = budgeted(reservation(small('test-mesh')))
    store.set(small('test-mesh'))
    store.writeQuads('test-mesh', quads(2))
    store.set({ ...small('test-mesh'), name: 'Renamed', opacity: 0.5 })
    expect(meshOf(store)).toMatchObject({ name: 'Renamed', opacity: 0.5, highWater: 2 })
    expect(store.reservedBytes()).toBe(reservation(small('test-mesh')))
  })

  it('keeps what the meshes reserve in step with every definition, refusal, clear and removal', () => {
    const store = budgeted(3 * ping360Bytes)
    const summed = (): number =>
      [...store.meshes.values()].reduce((bytes, { capacity, format, stripWidth, stripHeight }) => {
        return bytes + reservation(definition({ capacity, texels: { format, width: stripWidth, height: stripHeight } }))
      }, 0)
    const refused: string[] = []
    const steps: (() => void)[] = [
      () => store.set(ping360('sonar-a')),
      () => store.set(small('test-mesh')),
      () => store.set({ ...ping360('sonar-a'), name: 'Renamed' }),
      () => store.set(ping360('sonar-a', 4096)),
      () => store.set(ping360('sonar-b')),
      () => store.set(ping360('sonar-c')),
      () => store.set(small('test-mesh', 4096)),
      () => store.set(ping360('sonar-d')),
      () => store.clear('sonar-b'),
      () => store.remove('sonar-a'),
      () => store.set(ping360('test-mesh', 11264)),
      () => store.remove('test-mesh'),
    ]
    steps.forEach((step, i) => {
      try {
        step()
      } catch (error) {
        if (!(error instanceof MapMeshBudgetError)) throw error
        refused.push(`step ${i}`)
      }
      expect(store.reservedBytes(), `after step ${i}`).toBe(summed())
    })
    expect(refused).toEqual(['step 7'])
    expect(store.reservedBytes()).toBe(2 * ping360Bytes)
  })

  it('frees the reservation when a mesh is removed, but not when it is only cleared', () => {
    const store = budgeted(reservation(small('test-mesh')))
    store.set(small('test-mesh'))
    expect(refusal(() => store.set(small('other')))).toBeInstanceOf(MapMeshBudgetError)
    store.writeQuads('test-mesh', quads(2))
    store.clear('test-mesh')
    expect(allocatedBytes(store)).toBe(1024)
    expect(store.reservedBytes()).toBe(reservation(small('test-mesh')))
    expect(refusal(() => store.set(small('other')))).toBeInstanceOf(MapMeshBudgetError)
    store.remove('test-mesh')
    expect(store.reservedBytes()).toBe(0)
    store.set(small('other'))
    expect(store.meshes.has('other')).toBe(true)
  })

  it('never evicts on a lowered budget, refusing only what would take more, while updates and reductions apply', () => {
    let configured: string | null = null
    const store = new MapMeshStore(() => configured)
    store.set(ping360('sonar-a'))
    store.set(ping360('sonar-b'))
    store.writeQuads('sonar-a', quads(3, 0, 9, 1200))
    const allocated = allocatedBytes(store)

    configured = String(ping360Bytes)
    expect(store.budgetBytes()).toBe(ping360Bytes)
    expect([store.meshes.has('sonar-a'), store.meshes.has('sonar-b'), allocatedBytes(store)]).toEqual([
      true,
      true,
      allocated,
    ])
    expect(refusal(() => store.set(small('other')))).toMatchObject({ budgetBytes: ping360Bytes })
    expect(refusal(() => store.set(ping360('sonar-b', 12288)))).toMatchObject({
      usedBytes: 2 * ping360Bytes,
      previousBytes: ping360Bytes,
      requestedBytes: reservation(ping360('x', 12288)),
    })

    store.set({ ...ping360('sonar-a'), name: 'Renamed' })
    expect(store.meshes.get('sonar-a')).toMatchObject({ name: 'Renamed', highWater: 3 })
    expect(slotTexels(store.meshes.get('sonar-a') as MapMesh, 2)).toEqual(Array(1200).fill(11))
    store.set(ping360('sonar-b', 1024))
    expect(store.meshes.get('sonar-b')).toMatchObject({ capacity: 1024 })
    expect(store.reservedBytes()).toBe(ping360Bytes + reservation(ping360('x', 1024)))
    expect(store.reservedBytes()).toBeGreaterThan(store.budgetBytes())
  })

  it('uses the default budget for a stored one that is not a positive whole number of bytes', () => {
    const malformed = ['', 'abc', 'NaN', 'Infinity', '-1', '0', '1.5', '1e9', ' 5', '"5"', '0x10', '9007199254740992']
    for (const configured of [null, ...malformed]) {
      expect(new MapMeshStore(() => configured).budgetBytes(), String(configured)).toBe(defaultMapMeshBudgetBytes)
    }
    for (const bytes of [1, 104_857_600, Number.MAX_SAFE_INTEGER]) expect(budgeted(bytes).budgetBytes()).toBe(bytes)
    const store = new MapMeshStore(() => '-1')
    for (let i = 0; i < 16; i++) store.set(ping360(`sonar-${i}`))
    expect(refusal(() => store.set(ping360('sonar-16')))).toMatchObject({ budgetBytes: defaultMapMeshBudgetBytes })
  })

  const r8 = (width: number, height: number): ValidatedMapMesh['texels'] => ({ format: 'r8', width, height })
  const rgba8 = (width: number, height: number): ValidatedMapMesh['texels'] => ({ format: 'rgba8', width, height })
  // Sensor shapes a sender would declare: what, strip, slots, bytes reserved, and how many fit the default budget.
  const useCases: [string, ValidatedMapMesh['texels'], number, number, number][] = [
    ['a Ping360 scan', r8(1200, 1), 11264, 14_283_776, 16],
    ['an echosounder waterfall, 200 at 10 Hz for 10 min', r8(200, 1), 6000, 1_609_024, 142],
    ['camera frames 256x144 at 1 Hz for 10 min', rgba8(256, 144), 600, 88_515_424, 2],
    ['a 1 h Ping360 replay kept whole', r8(1200, 1), 180_000, 228_241_024, 1],
    ['an open-ended Ping360 ring of the most slots', r8(1200, 1), 1 << 20, 1_329_595_392, 0],
  ]

  it.each(useCases)('reserves for %s, %j x %i, %i bytes and fits %i in the default budget', (...useCase) => {
    const [, texels, capacity, bytes, fit] = useCase
    const store = new MapMeshStore()
    for (let i = 0; i < fit; i++) store.set(definition({ id: `mesh-${i}`, capacity, texels }))
    expect(refusal(() => store.set(definition({ id: 'one-more', capacity, texels })))).toMatchObject({
      usedBytes: fit * bytes,
      requestedBytes: bytes,
    })
    expect(allocatedBytes(store)).toBe(fit * 1024)
  })

  it('computes what a definition reserves exactly as the store charges it', () => {
    expect(mapMeshReservedBytes(11264, r8(1200, 1))).toBe(ping360Bytes)
    expect(mapMeshReservedBytes(4, r8(1, 1))).toBe(1024 + 4 * 69)
    let seed = 229
    const random = (below: number): number => (seed = (seed * 1103515245 + 12345) % 2 ** 31) % below
    const store = new MapMeshStore(() => String(Number.MAX_SAFE_INTEGER))
    for (let i = 0; i < 300; i++) {
      const format = random(2) ? 'r8' : 'rgba8'
      const width = 1 + random(2048)
      const height = 1 + random(Math.min(2048, Math.floor(2_097_056 / (width * (format === 'r8' ? 1 : 4)))))
      const capacity = 1 + random(1 << 20)
      const before = store.reservedBytes()
      store.set(definition({ id: `mesh-${i}`, capacity, texels: { format, width, height } }))
      expect(store.reservedBytes() - before, `${capacity} x ${format} ${width}x${height}`).toBe(
        mapMeshReservedBytes(capacity, { format, width, height })
      )
    }
  })

  it('reads a budget typed in whole MiB as bytes, or says why it cannot be one', () => {
    const notNumbers = ['1e3', '0x10', '1_0', '+5', true as unknown as number]
    for (const notWhole of [NaN, Infinity, -Infinity, '', ' ', 'abc', 1.5, '217.95', 1e-7, ...notNumbers]) {
      expect(mapMeshBudgetFromMiB(notWhole), String(notWhole)).toBe('Must be a whole number of MiB.')
    }
    for (const notPositive of [0, -0, -1, '-5']) {
      expect(mapMeshBudgetFromMiB(notPositive), String(notPositive)).toBe('Must be more than zero.')
    }
    for (const tooLarge of [8_589_934_592, 1e300, Number.MAX_VALUE]) {
      expect(mapMeshBudgetFromMiB(tooLarge), String(tooLarge)).toBe('Must be at most 8589934591 MiB.')
    }
    expect(mapMeshBudgetFromMiB(218)).toBe(defaultMapMeshBudgetBytes)
    expect(mapMeshBudgetFromMiB('100')).toBe(104_857_600)
    expect(mapMeshBudgetFromMiB(8_589_934_591)).toBe(8_589_934_591 * 1024 * 1024)
    expect(Number.isSafeInteger(mapMeshBudgetFromMiB(8_589_934_591))).toBe(true)
  })

  it('overwrites the oldest of a full ring without allocating past what it reserved', () => {
    const store = new MapMeshStore()
    store.set(definition({ capacity: 6000, texels: { format: 'r8', width: 200, height: 1 } }))
    store.writeQuads('test-mesh', quads(1, 5998, 1, 200))
    store.writeQuads('test-mesh', quads(3, undefined, 10, 200))
    const mesh = meshOf(store)
    expect([5999, 0, 1].map((slot) => slotTexels(mesh, slot)[0])).toEqual([10, 11, 12])
    expect(mesh).toMatchObject({ head: 2, highWater: 6000 })
    expect(meshDrawRanges(mesh).map(({ first, count }) => [first, count])).toEqual([
      [2, 5998],
      [0, 2],
    ])
    expect(allocatedBytes(store)).toBe(store.reservedBytes())
    store.writeQuads('test-mesh', quads(3, undefined, 20, 200))
    expect(slotTexels(mesh, 2)[0]).toBe(20)
    expect(allocatedBytes(store)).toBe(store.reservedBytes())
  })

  it('empties a mesh redefined with more slots, checked against the budget net of its old reservation, so its sender must replay', () => {
    const store = new MapMeshStore()
    for (let i = 0; i < 15; i++) store.set(ping360(`sonar-${i}`))
    store.set(ping360('test-mesh'))
    store.writeQuads('test-mesh', quads(2, 0, 3, 1200))

    // 6 full pages of 2048 slots: 1,249,280 bytes more than the budget has left.
    expect(refusal(() => store.set(ping360('test-mesh', 12288)))).toMatchObject({
      usedBytes: 16 * ping360Bytes,
      previousBytes: ping360Bytes,
      requestedBytes: 15_582_208,
    })
    expect(meshOf(store)).toMatchObject({ capacity: 11264, head: 2, highWater: 2 })
    expect(slotTexels(meshOf(store), 1)).toEqual(Array(1200).fill(4))

    store.remove('sonar-14')
    store.set(ping360('test-mesh', 12288))
    expect(meshOf(store)).toMatchObject({ capacity: 12288, head: 0, highWater: 0 })
    expect(meshOf(store).pages.filter(Boolean)).toHaveLength(0)
  })
})
