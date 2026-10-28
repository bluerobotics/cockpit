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
