/**
 * Side of a texture page, in texels: WebGL2's guaranteed MAX_TEXTURE_SIZE, so pages are the same on every device
 */
export const meshPageSide = 2048

/**
 * Bytes of a slot's instance data: 4 corners and 4 uv as float32, then the RGBA tint
 */
export const meshInstanceBytes = 68

export const earthRadius = 6378137

export const bytesPerTexel = { r8: 1, rgba8: 4 }

export const paletteBytes = 256 * 4

/**
 * Format and size of each slot's strip
 */
interface MeshTexels {
  /**
   * Format of every quad's texels
   */
  format: 'r8' | 'rgba8'
  /**
   * Width of a quad's strip, in texels
   */
  width: number
  /**
   * Height of a quad's strip, in texels
   */
  height: number
}

/**
 * How a mesh's slots are packed into texture pages
 */
interface MeshLayout {
  /**
   * How many quads the mesh holds
   */
  capacity: number
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
   * Number of strips side by side in a page row
   */
  stripsPerRow: number
  /**
   * Slots in a full page
   */
  slotsPerPage: number
}

/**
 * Which slots a texture page holds, and its size
 */
interface PageLayout {
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
}

export const meshLayout = (capacity: number, { format, width, height }: MeshTexels): MeshLayout => {
  const stripsPerRow = Math.floor(meshPageSide / width)
  const slotsPerPage = stripsPerRow * Math.floor(meshPageSide / height)
  return {
    capacity,
    bytesPerTexel: bytesPerTexel[format],
    stripWidth: width,
    stripHeight: height,
    stripsPerRow,
    slotsPerPage,
  }
}

// The last page only holds the slots left over, so it is no larger than they need.
export const pageLayout = (mesh: MeshLayout, index: number): PageLayout => {
  const firstSlot = index * mesh.slotsPerPage
  const slotCount = Math.min(mesh.slotsPerPage, mesh.capacity - firstSlot)
  const width = Math.min(mesh.stripsPerRow, slotCount) * mesh.stripWidth
  const height = Math.ceil(slotCount / mesh.stripsPerRow) * mesh.stripHeight
  return { index, firstSlot, slotCount, width, height }
}

const pageBytes = (mesh: MeshLayout, index: number): number => {
  const { slotCount, width, height } = pageLayout(mesh, index)
  return slotCount * meshInstanceBytes + width * height * mesh.bytesPerTexel
}

// What a mesh holds on the CPU once every page is written. Every page but the last is the same size as the first.
export const meshReservedBytes = (mesh: MeshLayout): number => {
  const pages = Math.ceil(mesh.capacity / mesh.slotsPerPage)
  return paletteBytes + (pages - 1) * pageBytes(mesh, 0) + pageBytes(mesh, pages - 1)
}

/**
 * Bytes a mesh reserves against the budget when defined, for mesh commands version 1: 1024 for the palette + Σ per
 * page (68 x slots + page width x page height x bytes per texel). Pages are at most 2048x2048 texels, packed with
 * floor(2048 / width) x floor(2048 / height) whole strips (a Ping360 page is 1200x2048); the last is only as large as
 * its slots need. This is buffer accounting, not physical memory, and the inputs are not validated: an invalid mesh
 * gives a meaningless figure.
 * @param {number} capacity - Slots of the mesh
 * @param {MeshTexels} texels - Format, width and height of each slot's strip
 * @returns {number} Bytes the mesh reserves
 */
export const mapMeshReservedBytes = (capacity: number, texels: MeshTexels): number =>
  meshReservedBytes(meshLayout(capacity, texels))
