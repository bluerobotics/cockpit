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
