import type { ValidatedMapMesh, ValidatedMapMeshQuads } from '@/libs/map/external-map-mesh-api'
import { mapMeshBudgetBytes, MapMeshBudgetError } from '@/libs/map/external-map-mesh-budget'
import {
  earthRadius,
  meshInstanceBytes,
  meshLayout,
  meshReservedBytes,
  pageLayout,
  paletteBytes,
} from '@/libs/map/external-map-mesh-layout'

const tintOffset = 64

const instanceFloats = meshInstanceBytes / 4

/**
 * Projects a longitude to EPSG:3857 meters, as Leaflet's spherical Mercator does
 * @param {number} lon - Longitude, in degrees
 * @returns {number} Easting, in meters
 */
export const lonToMercatorX = (lon: number): number => earthRadius * lon * (Math.PI / 180)

/**
 * Projects a latitude to EPSG:3857 meters, as Leaflet's spherical Mercator does
 * @param {number} lat - Latitude, in degrees
 * @returns {number} Northing, in meters
 */
export const latToMercatorY = (lat: number): number =>
  earthRadius * Math.log(Math.tan(Math.PI / 4 + lat * (Math.PI / 360)))

/**
 * Point in EPSG:3857 meters
 */
export interface MercatorPoint {
  /**
   * Easting
   */
  x: number
  /**
   * Northing
   */
  y: number
}

/**
 * Rectangle in EPSG:3857 meters
 */
export interface MercatorBounds {
  /**
   * Western edge
   */
  minX: number
  /**
   * Southern edge
   */
  minY: number
  /**
   * Eastern edge
   */
  maxX: number
  /**
   * Northern edge
   */
  maxY: number
}

/**
 * Rectangle of texels in a page, from its top-left corner, end exclusive
 */
export interface TexelRect {
  /**
   * Left column
   */
  x0: number
  /**
   * Top row
   */
  y0: number
  /**
   * Column past the right edge
   */
  x1: number
  /**
   * Row past the bottom edge
   */
  y1: number
}

/**
 * Consecutive slots of a mesh held in one texture page and one instance buffer
 */
export interface MapMeshPage {
  /**
   * Position of the page in its mesh
   */
  index: number
  /**
   * Mesh slot of the page's first slot
   */
  firstSlot: number
  /**
   * How many slots the page holds
   */
  slotCount: number
  /**
   * Width of the page, in texels
   */
  width: number
  /**
   * Height of the page, in texels
   */
  height: number
  /**
   * Instance data of every slot, {@link meshInstanceBytes} each. An empty slot is all zeros, a degenerate quad.
   */
  instances: Uint8Array
  /**
   * The same instance data, as float32
   */
  instanceFloats: Float32Array
  /**
   * Texels of every slot's strip, row by row
   */
  texels: Uint8Array
  /**
   * Bounds of every quad ever written to the page, in meters from the mesh's anchor
   */
  bounds: MercatorBounds
  /**
   * Page-relative slots changed since the renderer last uploaded them, end exclusive
   */
  dirtySlots?: [number, number]
  /**
   * Texels changed since the renderer last uploaded them
   */
  dirtyTexels?: TexelRect
}

/**
 * A map mesh, as kept on the CPU for every map to draw
 */
export interface MapMesh {
  /**
   * Id the sender gave the mesh
   */
  id: string
  /**
   * Name shown to the operator
   */
  name: string
  /**
   * How many quads the mesh holds
   */
  capacity: number
  /**
   * Format of every quad's texels
   */
  format: 'r8' | 'rgba8'
  /**
   * Bytes per texel
   */
  bytesPerTexel: number
  /**
   * Width of a quad's strip, in texels
   */
  stripWidth: number
  /**
   * Height of a quad's strip, in texels
   */
  stripHeight: number
  /**
   * How texels are sampled between their centers
   */
  filter: 'nearest' | 'linear'
  /**
   * 256 RGBA entries, straight alpha, that r8 texels index into
   */
  palette: Uint8Array
  /**
   * Opacity the whole mesh is drawn with
   */
  opacity: number
  /**
   * Number of strips side by side in a page row
   */
  stripsPerRow: number
  /**
   * Slots in a full page
   */
  slotsPerPage: number
  /**
   * EPSG:3857 meters of the first vertex written, which stored corners are relative to, keeping them precise in
   * float32
   */
  anchor?: MercatorPoint
  /**
   * Pages, allocated when one of their slots is first written
   */
  pages: (MapMeshPage | undefined)[]
  /**
   * Slot past the last write, where the next write without `first` begins
   */
  head: number
  /**
   * Slot past the highest one ever written
   */
  highWater: number
  /**
   * Whether the palette or filter changed since the renderer last uploaded them
   */
  settingsDirty: boolean
}

/**
 * What changed in the meshes, for maps to redraw
 */
export interface MapMeshChange {
  /**
   * Id of the mesh
   */
  id: string
  /**
   * Area that changed, old quads included, or undefined when the whole mesh did
   */
  bounds?: MercatorBounds
  /**
   * Whether the mesh was removed, cleared or set with a new layout, so a renderer frees its GPU copy
   */
  released?: boolean
}

/**
 * Consecutive slots one write filled, wrapping around at the mesh's capacity
 */
export interface MapMeshWrittenSlots {
  /**
   * First slot written
   */
  first: number
  /**
   * How many slots were written
   */
  count: number
}

/**
 * Receives what changed in the meshes since the last flush, to keep their GPU copies in sync
 */
export interface MapMeshRenderer {
  /**
   * Uploads a mesh's palette and texel filter
   */
  uploadSettings(mesh: MapMesh): void
  /**
   * Uploads the dirty slots and texels of a page, or the whole page if it has no copy of it yet
   */
  uploadPage(mesh: MapMesh, page: MapMeshPage): void
}

/**
 * Slots of one page drawn by one call
 */
export interface MapMeshDrawRange {
  /**
   * The page
   */
  page: MapMeshPage
  /**
   * First page-relative slot
   */
  first: number
  /**
   * How many slots
   */
  count: number
}

const greyRamp = (): Uint8Array => {
  const palette = new Uint8Array(paletteBytes)
  for (let i = 0; i < 256; i++) palette.set([i, i, i, 255], i * 4)
  return palette
}

const emptyBounds = (): MercatorBounds => ({ minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity })

// Skips empty slots, whose corners all sit on the anchor and would stretch the bounds to it.
const extendByQuad = (bounds: MercatorBounds, floats: Float32Array, at: number): void => {
  let degenerate = true
  for (let i = 2; i < 8; i += 2) {
    if (floats[at + i] !== floats[at] || floats[at + i + 1] !== floats[at + 1]) degenerate = false
  }
  if (degenerate) return
  for (let i = 0; i < 8; i += 2) {
    bounds.minX = Math.min(bounds.minX, floats[at + i])
    bounds.maxX = Math.max(bounds.maxX, floats[at + i])
    bounds.minY = Math.min(bounds.minY, floats[at + i + 1])
    bounds.maxY = Math.max(bounds.maxY, floats[at + i + 1])
  }
}

// The uv of a quad sent without any: (0, 0), (width, 0), (width, height), (0, height), upright over its strip.
const setUprightUv = (floats: Float32Array, at: number, width: number, height: number): void => {
  floats.fill(0, at, at + 8)
  floats[at + 2] = floats[at + 4] = width
  floats[at + 5] = floats[at + 7] = height
}

const markDirty = (page: MapMeshPage, slot: number, texels?: TexelRect): void => {
  const [start, end] = page.dirtySlots ?? [slot, slot + 1]
  page.dirtySlots = [Math.min(start, slot), Math.max(end, slot + 1)]
  if (!texels) return
  const dirty = page.dirtyTexels ?? texels
  page.dirtyTexels = {
    x0: Math.min(dirty.x0, texels.x0),
    y0: Math.min(dirty.y0, texels.y0),
    x1: Math.max(dirty.x1, texels.x1),
    y1: Math.max(dirty.y1, texels.y1),
  }
}

/**
 * Where a slot's strip sits
 */
export interface StripPlace {
  /**
   * Index of the page holding it
   */
  page: number
  /**
   * Column of its top-left texel in the page
   */
  x: number
  /**
   * Row of its top-left texel in the page
   */
  y: number
}

/**
 * Where a slot's strip sits in its page
 * @param {MapMesh} mesh - The mesh
 * @param {number} slot - Mesh slot
 * @returns {StripPlace} The page, and the strip's top-left texel in it
 */
export const stripPlace = (mesh: MapMesh, slot: number): StripPlace => {
  const page = Math.floor(slot / mesh.slotsPerPage)
  const local = slot - page * mesh.slotsPerPage
  const x = (local % mesh.stripsPerRow) * mesh.stripWidth
  const y = Math.floor(local / mesh.stripsPerRow) * mesh.stripHeight
  return { page, x, y }
}

/**
 * The draw calls that paint a mesh from oldest to newest, following the ring that writes without `first` wrap around:
 * from the head to the highest slot written, then from slot 0 to the head. Pages never written are skipped.
 * @param {MapMesh} mesh - The mesh
 * @returns {MapMeshDrawRange[]} Page-relative ranges of slots, in drawing order
 */
export const meshDrawRanges = (mesh: MapMesh): MapMeshDrawRange[] => {
  const slotRanges: [number, number][] = []
  if (mesh.head < mesh.highWater) slotRanges.push([mesh.head, mesh.highWater])
  if (mesh.head > 0) slotRanges.push([0, mesh.head])
  const ranges: MapMeshDrawRange[] = []
  for (const [start, end] of slotRanges) {
    for (let slot = start; slot < end; ) {
      const page = mesh.pages[Math.floor(slot / mesh.slotsPerPage)]
      const pageEnd = Math.min(end, (Math.floor(slot / mesh.slotsPerPage) + 1) * mesh.slotsPerPage)
      if (page) ranges.push({ page, first: slot - page.firstSlot, count: pageEnd - slot })
      slot = pageEnd
    }
  }
  return ranges
}

/**
 * The meshes external software sent, kept on the CPU as the source of truth every map draws from, and that the
 * GPU copy is rebuilt from when the WebGL context is lost. Not reactive: maps subscribe to its changes instead.
 * A mesh reserves its full capacity when defined, so only definitions are refused by the budget; pages are allocated
 * on their first write, and a renderer drawing them holds about as much again on the GPU.
 */
export class MapMeshStore {
  readonly meshes = new Map<string, MapMesh>()
  private readonly listeners = new Set<(change: MapMeshChange) => void>()
  // Ids of the meshes whose settings or pages changed since the last flush (every per-mesh draw calls flush).
  private readonly dirty = new Set<string>()
  // Kept as meshes are set and removed rather than summed, so a sender defining many meshes costs O(1) for each.
  private reserved = 0

  /**
   * @param {() => string | null} storedBudget - Reads the budget this computer is set to, in bytes, as stored
   */
  constructor(private readonly storedBudget: () => string | null = () => null) {}

  /**
   * Calls a listener on every change
   * @param {(change: MapMeshChange) => void} listener - Called with what changed
   * @returns {() => void} Stops calling it
   */
  subscribe(listener: (change: MapMeshChange) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Creates or redefines a mesh. One with the same capacity and texel layout keeps its quads; a changed capacity,
   * format or strip size starts empty. Throws a {@link MapMeshBudgetError}, changing nothing and so keeping the old
   * quads, if its full capacity would take the reservations past the budget.
   * @param {ValidatedMapMesh} definition - The mesh as the sender defined it
   */
  set(definition: ValidatedMapMesh): void {
    const { id, name, capacity, texels, filter, opacity } = definition
    const palette = definition.palette?.slice() ?? greyRamp()
    const previous = this.meshes.get(id)
    const sameLayout =
      previous?.capacity === capacity &&
      previous.format === texels.format &&
      previous.stripWidth === texels.width &&
      previous.stripHeight === texels.height
    if (previous && sameLayout) {
      Object.assign(previous, { name, filter, opacity, palette, settingsDirty: true })
      this.dirty.add(id)
      this.emit({ id })
      return
    }
    const layout = meshLayout(capacity, texels)
    const requestedBytes = meshReservedBytes(layout)
    const previousBytes = previous ? meshReservedBytes(previous) : 0
    const usedBytes = this.reservedBytes()
    const resultingBytes = usedBytes - previousBytes + requestedBytes
    const budgetBytes = this.budgetBytes()
    // A lowered budget evicts nothing: only a definition reserving more than the one it replaces is held to it.
    if (requestedBytes > previousBytes && resultingBytes > budgetBytes) {
      throw new MapMeshBudgetError(id, usedBytes, previousBytes, requestedBytes, budgetBytes)
    }
    this.reserved = resultingBytes
    this.meshes.set(id, {
      id,
      name,
      ...layout,
      format: texels.format,
      filter,
      palette,
      opacity,
      pages: new Array(Math.ceil(capacity / layout.slotsPerPage)),
      head: 0,
      highWater: 0,
      settingsDirty: true,
    })
    this.dirty.add(id)
    this.emit(previous ? { id, released: true } : { id })
  }

  /**
   * Writes quads into consecutive slots of a mesh, copying them. Without `first`, they follow the previous write,
   * wrapping around at the mesh's capacity. Nothing is written if any of it does not fit.
   * @param {string} id - Id of the mesh
   * @param {ValidatedMapMeshQuads} quads - The quads
   * @returns {MapMeshWrittenSlots} The slots written
   */
  writeQuads(id: string, quads: ValidatedMapMeshQuads): MapMeshWrittenSlots {
    const mesh = this.existing(id)
    const count = quads.corners.length / 8
    const stripBytes = mesh.stripWidth * mesh.stripHeight * mesh.bytesPerTexel
    if (quads.texels.length !== count * stripBytes) {
      throw new Error(
        `Mesh '${id}' needs ${stripBytes} texel bytes per quad, ${count * stripBytes} for ${count} quads.`
      )
    }
    if (count > mesh.capacity)
      throw new Error(`Mesh '${id}' holds at most ${mesh.capacity} quads, but ${count} were sent.`)
    const first = quads.first ?? mesh.head % mesh.capacity
    if (quads.first !== undefined && first + count > mesh.capacity) {
      throw new Error(
        `Slots ${first} to ${first + count - 1} do not fit mesh '${id}', which has ${mesh.capacity} slots.`
      )
    }
    this.allocatePages(mesh, first, count)
    this.dirty.add(id)
    const bounds = emptyBounds()
    for (let quad = 0; quad < count; quad++) {
      this.writeSlot(mesh, (first + quad) % mesh.capacity, quads, quad, bounds)
    }
    const end = first + count
    mesh.highWater = end > mesh.capacity ? mesh.capacity : Math.max(mesh.highWater, end)
    mesh.head = ((end - 1) % mesh.capacity) + 1
    this.emit({ id, bounds: this.absolute(mesh, bounds) })
    return { first, count }
  }

  /**
   * Empties consecutive slots of a mesh, which then draw nothing
   * @param {string} id - Id of the mesh
   * @param {number} first - First slot
   * @param {number} count - How many slots
   */
  removeQuads(id: string, first: number, count: number): void {
    const mesh = this.existing(id)
    if (first + count > mesh.capacity) {
      throw new Error(
        `Slots ${first} to ${first + count - 1} do not fit mesh '${id}', which has ${mesh.capacity} slots.`
      )
    }
    const bounds = emptyBounds()
    for (let slot = first; slot < first + count; slot++) {
      const page = mesh.pages[Math.floor(slot / mesh.slotsPerPage)]
      if (!page) continue
      const local = slot - page.firstSlot
      extendByQuad(bounds, page.instanceFloats, local * instanceFloats)
      page.instanceFloats.fill(0, local * instanceFloats, (local + 1) * instanceFloats)
      markDirty(page, local)
    }
    this.dirty.add(id)
    this.emit({ id, bounds: this.absolute(mesh, bounds) })
  }

  /**
   * Empties every slot of a mesh, keeping the mesh
   * @param {string} id - Id of the mesh
   */
  clear(id: string): void {
    const mesh = this.existing(id)
    mesh.pages = new Array(mesh.pages.length)
    mesh.head = 0
    mesh.highWater = 0
    mesh.anchor = undefined
    mesh.settingsDirty = true
    this.dirty.add(id)
    this.emit({ id, released: true })
  }

  /**
   * Removes a mesh
   * @param {string} id - Id of the mesh
   */
  remove(id: string): void {
    this.reserved -= meshReservedBytes(this.existing(id))
    this.meshes.delete(id)
    // Retired here rather than on the next flush, which never comes once no mesh is left to draw.
    this.dirty.delete(id)
    this.emit({ id, released: true })
  }

  /**
   * Hands a renderer everything that changed since the last flush
   * @param {MapMeshRenderer} renderer - Keeps the GPU copy
   */
  flush(renderer: MapMeshRenderer): void {
    for (const id of this.dirty) {
      const mesh = this.meshes.get(id)
      if (mesh) this.flushMesh(renderer, mesh)
      // Only once its uploads are done, so one that throws, as on a lost context, is retried on the next flush.
      this.dirty.delete(id)
    }
  }

  /**
   * Marks everything dirty, for a renderer that lost its GPU copy, and tells every map to redraw
   */
  markAllDirty(): void {
    for (const mesh of this.meshes.values()) {
      mesh.settingsDirty = true
      for (const page of mesh.pages) {
        if (!page) continue
        page.dirtySlots = [0, page.slotCount]
        page.dirtyTexels = { x0: 0, y0: 0, x1: page.width, y1: page.height }
      }
      this.dirty.add(mesh.id)
      this.emit({ id: mesh.id })
    }
  }

  /**
   * Bytes all meshes reserve for their full capacity, which {@link set} keeps within the budget. A cleared mesh keeps
   * its reservation, so its sender can write it full again.
   * @returns {number} The bytes
   */
  reservedBytes(): number {
    return this.reserved
  }

  /**
   * Most bytes all meshes together can reserve, as {@link mapMeshBudgetBytes} reads the budget this computer is set to
   * @returns {number} The bytes
   */
  budgetBytes(): number {
    return mapMeshBudgetBytes(this.storedBudget())
  }

  /* eslint-disable jsdoc/require-jsdoc -- private helpers, commented where they need it. */
  private existing(id: string): MapMesh {
    const mesh = this.meshes.get(id)
    if (!mesh) throw new Error(`Mesh '${id}' does not exist.`)
    return mesh
  }

  private emit(change: MapMeshChange): void {
    this.listeners.forEach((listener) => listener(change))
  }

  private flushMesh(renderer: MapMeshRenderer, mesh: MapMesh): void {
    if (mesh.settingsDirty) renderer.uploadSettings(mesh)
    mesh.settingsDirty = false
    for (const page of mesh.pages) {
      if (!page || (!page.dirtySlots && !page.dirtyTexels)) continue
      renderer.uploadPage(mesh, page)
      page.dirtySlots = undefined
      page.dirtyTexels = undefined
    }
  }

  private absolute(mesh: MapMesh, bounds: MercatorBounds): MercatorBounds | undefined {
    if (!mesh.anchor || bounds.minX > bounds.maxX) return undefined
    const { x, y } = mesh.anchor
    return { minX: bounds.minX + x, minY: bounds.minY + y, maxX: bounds.maxX + x, maxY: bounds.maxY + y }
  }

  private allocatePage(mesh: MapMesh, index: number): MapMeshPage {
    const layout = pageLayout(mesh, index)
    const instances = new Uint8Array(layout.slotCount * meshInstanceBytes)
    const page: MapMeshPage = {
      ...layout,
      instances,
      instanceFloats: new Float32Array(instances.buffer),
      texels: new Uint8Array(layout.width * layout.height * mesh.bytesPerTexel),
      bounds: emptyBounds(),
    }
    return page
  }

  // Before a write touches any slot, so an allocation that fails leaves the mesh as it was.
  private allocatePages(mesh: MapMesh, first: number, count: number): void {
    const missing = new Set<number>()
    for (let quad = 0; quad < count; quad++) {
      const index = Math.floor(((first + quad) % mesh.capacity) / mesh.slotsPerPage)
      if (!mesh.pages[index]) missing.add(index)
    }
    const pages = [...missing].map((index) => this.allocatePage(mesh, index))
    pages.forEach((page) => (mesh.pages[page.index] = page))
  }

  // `bounds` collects the old quad as well as the new one, so maps showing either redraw.
  private writeSlot(
    mesh: MapMesh,
    slot: number,
    quads: ValidatedMapMeshQuads,
    quad: number,
    bounds: MercatorBounds
  ): void {
    const place = stripPlace(mesh, slot)
    const page = mesh.pages[place.page] as MapMeshPage
    const local = slot - page.firstSlot
    const at = local * instanceFloats
    const floats = page.instanceFloats
    extendByQuad(bounds, floats, at)

    const { corners, uv, tint, texels } = quads
    mesh.anchor ??= { x: lonToMercatorX(corners[quad * 8]), y: latToMercatorY(corners[quad * 8 + 1]) }
    for (let i = 0; i < 8; i += 2) {
      floats[at + i] = lonToMercatorX(corners[quad * 8 + i]) - mesh.anchor.x
      floats[at + i + 1] = latToMercatorY(corners[quad * 8 + i + 1]) - mesh.anchor.y
    }
    if (uv) floats.set(uv.subarray(quad * 8, quad * 8 + 8), at + 8)
    else setUprightUv(floats, at + 8, mesh.stripWidth, mesh.stripHeight)
    const tintAt = local * meshInstanceBytes + tintOffset
    if (tint) page.instances.set(tint.subarray(quad * 4, quad * 4 + 4), tintAt)
    else page.instances.fill(255, tintAt, tintAt + 4)
    extendByQuad(bounds, floats, at)
    extendByQuad(page.bounds, floats, at)

    const rowBytes = mesh.stripWidth * mesh.bytesPerTexel
    const source = quad * rowBytes * mesh.stripHeight
    for (let row = 0; row < mesh.stripHeight; row++) {
      const target = ((place.y + row) * page.width + place.x) * mesh.bytesPerTexel
      page.texels.set(texels.subarray(source + row * rowBytes, source + (row + 1) * rowBytes), target)
    }
    const { x, y } = place
    markDirty(page, local, { x0: x, y0: y, x1: x + mesh.stripWidth, y1: y + mesh.stripHeight })
  }
  /* eslint-enable jsdoc/require-jsdoc */
}
