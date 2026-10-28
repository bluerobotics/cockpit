import { z } from 'zod'

import { bytesPerTexel, earthRadius, meshPageSide, paletteBytes } from '@/libs/map/external-map-mesh-layout'

/**
 * The id that external software gives a map mesh, so that it can replace or remove the mesh later. Every sender shares
 * the same ids, so prefix it with the sender's name (e.g. `my-extension-scan`) to keep two extensions from replacing
 * each other's meshes.
 */
const externalMapMeshIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, digits and single dashes.')

/**
 * Texel formats a mesh's strips can have
 */
const externalMapMeshTexelFormats = ['r8', 'rgba8'] as const

// What a write carries for each quad besides its strip and its optional tint: 8 float64 corners and, unless omitted,
// 8 float32 uv.
const quadCornerAndUvBytes = 8 * 8 + 8 * 4

/**
 * Limits on what a sender can ask of the map meshes
 */
export const externalMapMeshLimits = {
  /**
   * Maximum number of quads a mesh can hold
   */
  maxCapacity: 1 << 20,
  /**
   * Maximum number of quads one `cockpit:setMapMeshQuads` can write
   */
  maxQuadsPerMessage: 4096,
  /**
   * Maximum bytes of array data in one message, before base64 encoding. Larger messages make decoding and validating
   * them a long task on the main thread.
   */
  maxMessageBytes: 2 * 1024 * 1024,
  /**
   * Maximum width and height of a quad's texel strip: WebGL2's guaranteed MAX_TEXTURE_SIZE, so every strip fits a
   * texture page on every device
   */
  maxTexelSide: meshPageSide,
  /**
   * Maximum texel bytes of a quad's strip (width × height × bytes per texel), so that one untinted quad with its
   * corners and uv fits in a message. A tint takes 4 bytes more, and a batch of quads is held to `maxMessageBytes`.
   */
  maxStripBytes: 2 * 1024 * 1024 - quadCornerAndUvBytes,
} as const

const {
  maxCapacity: maxMeshCapacity,
  maxQuadsPerMessage: maxMeshWriteQuads,
  maxMessageBytes: maxMeshMessageBytes,
  maxTexelSide: maxStripSide,
  maxStripBytes,
} = externalMapMeshLimits
// Guards the GPU: a million quads spanning the screen at high zoom would be a million full-screen fills.
const maxQuadDiagonalMetres = 20_000
const maxMeshLatitude = 85.05
const metresPerDegree = (Math.PI / 180) * earthRadius

type TypedArrayConstructor = Float64ArrayConstructor | Float32ArrayConstructor | Uint8ArrayConstructor

// Typed arrays arrive as-is through postMessage, and as base64 of their little-endian bytes through WebSocket JSON,
// since validating a JSON array of a million numbers element by element takes hundreds of milliseconds.
const base64Of = <T extends TypedArrayConstructor>(TypedArray: T): z.ZodType<InstanceType<T>, string> =>
  z
    .base64()
    .max(Math.ceil(maxMeshMessageBytes / 3) * 4)
    .transform((base64, context) => {
      const binary = atob(base64)
      if (binary.length % TypedArray.BYTES_PER_ELEMENT !== 0) {
        context.addIssue({ code: 'custom', message: `Needs a multiple of ${TypedArray.BYTES_PER_ELEMENT} bytes.` })
        return z.NEVER
      }
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return new TypedArray(bytes.buffer) as InstanceType<T>
    })

// A string can only be base64, so it is told why the last branch, base64, refused it; other values get the types.
const expected =
  (message: string) =>
  (issue: z.core.$ZodRawIssue): string | undefined =>
    issue.code === 'invalid_union' && typeof issue.input === 'string' ? issue.errors.at(-1)?.[0]?.message : message

const typedArrayOrBase64 = <T extends TypedArrayConstructor>(
  TypedArray: T
): z.ZodType<InstanceType<T>, InstanceType<T> | string> =>
  z.union([z.instanceof(TypedArray), base64Of(TypedArray)], {
    error: expected(`Expected a ${TypedArray.name} or base64 of its bytes.`),
  })

// Also takes the Uint8ClampedArray of a canvas's getImageData, as a Uint8Array over the same bytes.
const bytesOrBase64: z.ZodType<Uint8Array, Uint8Array | Uint8ClampedArray | string> = z.union(
  [
    z.instanceof(Uint8Array),
    z.instanceof(Uint8ClampedArray).transform((bytes) => new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.length)),
    base64Of(Uint8Array),
  ],
  { error: expected('Expected a Uint8Array or Uint8ClampedArray, or base64 of its bytes.') }
)

const paletteSchema = bytesOrBase64.refine((palette) => palette.length === paletteBytes, {
  message: `A palette has 256 RGBA entries, ${paletteBytes} bytes.`,
})

/**
 * A mesh of textured quads that external software draws on Cockpit's maps, for imagery sent many times a second. It has
 * `capacity` slots the sender writes quads into, each quad carrying its own `width` x `height` strip of texels. A mesh
 * is kept in memory only: the sender re-sends it to a Cockpit that connects later.
 */
const externalMapMeshSchema = z
  .object({
    id: externalMapMeshIdSchema,
    name: z.string().min(1),
    capacity: z.number().int().min(1).max(maxMeshCapacity),
    texels: z.object({
      format: z.enum(externalMapMeshTexelFormats),
      width: z.number().int().min(1).max(maxStripSide),
      height: z.number().int().min(1).max(maxStripSide),
    }),
    filter: z.enum(['nearest', 'linear']).default('nearest'),
    // 256 RGBA entries, straight alpha, that r8 texels index into. Defaults to an opaque gray ramp.
    palette: paletteSchema.optional(),
    opacity: z.number().min(0).max(1).default(1),
  })
  .refine((mesh) => mesh.palette === undefined || mesh.texels.format === 'r8', {
    message: 'Only r8 meshes have a palette.',
    path: ['palette'],
  })
  .refine(({ texels }) => texels.width * texels.height * bytesPerTexel[texels.format] <= maxStripBytes, {
    message: `A strip, with its quad's corners and uv, must fit in a message of ${maxMeshMessageBytes} bytes.`,
    path: ['texels'],
  })

const meshQuadsShape = {
  id: externalMapMeshIdSchema,
  // Omitted to write after the previous write, wrapping around at the mesh's capacity.
  first: z.number().int().min(0).optional(),
  // Longitude and latitude of each quad's four corners, in ring order: 8 per quad.
  corners: typedArrayOrBase64(Float64Array),
  // Texel coordinates of each corner inside the quad's own strip, texel centers at +0.5: 8 per quad. Omitted to draw
  // every quad upright over its strip, its corners at (0, 0), (width, 0), (width, height) and (0, height).
  uv: typedArrayOrBase64(Float32Array).optional(),
  // Each quad's strip, row by row: width * height * bytes per texel per quad.
  texels: bytesOrBase64,
  // RGBA, straight alpha, multiplied into each quad's color: 4 per quad.
  tint: bytesOrBase64.optional(),
}

type MeshQuads = z.output<z.ZodObject<typeof meshQuadsShape>>

const cornerProblem = (corners: Float64Array, quad: number): string | undefined => {
  const at = quad * 8
  for (let corner = 0; corner < 4; corner++) {
    const lon = corners[at + corner * 2]
    const lat = corners[at + corner * 2 + 1]
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return 'has a corner that is not a finite number'
    if (Math.abs(lon) > 180) return 'has a longitude outside [-180, 180]'
    if (Math.abs(lat) > maxMeshLatitude) return `has a latitude beyond ±${maxMeshLatitude}`
  }
  const latitudeScale = Math.cos(((corners[at + 1] + corners[at + 5]) / 2) * (Math.PI / 180))
  for (const [a, b] of [
    [0, 2],
    [1, 3],
  ]) {
    const east = (corners[at + b * 2] - corners[at + a * 2]) * latitudeScale
    const north = corners[at + b * 2 + 1] - corners[at + a * 2 + 1]
    if (Math.hypot(east, north) * metresPerDegree > maxQuadDiagonalMetres) {
      return `is more than ${maxQuadDiagonalMetres / 1000} km across`
    }
  }
  return undefined
}

// One pass over every quad, reporting only the first problem, so a malformed write costs no more than a valid one.
const validateMeshQuads = (quads: MeshQuads, context: z.core.$RefinementCtx<MeshQuads>): void => {
  const count = quads.corners.length / 8
  const issue = (path: string, message: string): void => context.addIssue({ code: 'custom', path: [path], message })
  if (!Number.isInteger(count) || count < 1) return issue('corners', 'Needs 8 numbers, 4 lon/lat pairs, per quad.')
  if (count > maxMeshWriteQuads) return issue('corners', `A message writes at most ${maxMeshWriteQuads} quads.`)
  if (quads.uv && quads.uv.length !== count * 8)
    return issue('uv', `Needs 8 numbers per quad, ${count * 8} for ${count} quads.`)
  if (quads.tint && quads.tint.length !== count * 4)
    return issue('tint', `Needs 4 bytes per quad (${count * 4} for ${count} quads).`)
  const bytes =
    quads.corners.byteLength + (quads.uv?.byteLength ?? 0) + quads.texels.byteLength + (quads.tint?.byteLength ?? 0)
  if (bytes > maxMeshMessageBytes) return issue('texels', `A message carries at most ${maxMeshMessageBytes} bytes.`)
  for (let quad = 0; quad < count; quad++) {
    const problem = cornerProblem(quads.corners, quad)
    if (problem) return issue('corners', `Quad ${quad} ${problem}.`)
    if (!quads.uv) continue
    for (let i = quad * 8; i < quad * 8 + 8; i++) {
      if (!Number.isFinite(quads.uv[i])) return issue('uv', `Quad ${quad} has a uv that is not a finite number.`)
    }
  }
}

/**
 * Commands external software (embedded iframes, WebSocket servers) can send to manage map meshes.
 */
export const externalMapMeshCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('cockpit:setMapMesh'), mesh: externalMapMeshSchema }),
  z.object({ type: z.literal('cockpit:setMapMeshQuads'), ...meshQuadsShape }).superRefine(validateMeshQuads),
  z.object({
    type: z.literal('cockpit:removeMapMeshQuads'),
    id: externalMapMeshIdSchema,
    first: z.number().int().min(0),
    count: z.number().int().min(1).max(maxMeshCapacity),
  }),
  z.object({ type: z.literal('cockpit:clearMapMesh'), id: externalMapMeshIdSchema }),
  z.object({ type: z.literal('cockpit:removeMapMesh'), id: externalMapMeshIdSchema }),
])

/**
 * A validated map mesh command from external software
 */
export type ExternalMapMeshCommand = z.output<typeof externalMapMeshCommandSchema>

/**
 * Map mesh as external software sends it
 */
export type ExternalMapMesh = z.input<typeof externalMapMeshSchema>

/**
 * A validated map mesh from external software
 */
export type ValidatedMapMesh = z.output<typeof externalMapMeshSchema>

/**
 * Quads external software writes into a map mesh, as it sends them
 */
export type ExternalMapMeshQuads = Omit<z.input<z.ZodObject<typeof meshQuadsShape>>, 'id'>

/**
 * Validated quads written into a map mesh
 */
export type ValidatedMapMeshQuads = Omit<MeshQuads, 'id'>

/**
 * Tells whether a message is meant as a map mesh command, before validating it.
 * @param {unknown} message - Message received from external software
 * @returns {boolean} Whether the message carries one of the map mesh command types
 */
export const isExternalMapMeshCommand = (message: unknown): boolean => {
  if (typeof message !== 'object' || message === null || !('type' in message)) return false
  return externalMapMeshCommandSchema.options.some((option) => option.shape.type.value === message.type)
}
