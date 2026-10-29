import { meshInstanceBytes } from '@/libs/map/external-map-mesh-layout'
import {
  type MapMesh,
  type MapMeshPage,
  type MapMeshRenderer,
  type MapMeshStore,
  meshDrawRanges,
} from '@/libs/map/external-map-meshes'

/**
 * Canvas area a mesh is drawn for
 */
export interface MapMeshView {
  /**
   * Width, in canvas pixels
   */
  width: number
  /**
   * Height, in canvas pixels
   */
  height: number
  /**
   * EPSG:3857 easting of the area's top-left corner, in meters
   */
  originX: number
  /**
   * EPSG:3857 northing of the area's top-left corner, in meters
   */
  originY: number
  /**
   * Meters one canvas pixel spans
   */
  metresPerPixel: number
}

const vertexShaderSource = `#version 300 es
layout(location = 0) in vec4 corners01;
layout(location = 1) in vec4 corners23;
layout(location = 2) in vec4 uv01;
layout(location = 3) in vec4 uv23;
layout(location = 4) in vec4 tint;
uniform vec2 offset;
uniform vec2 scale;
uniform int firstSlot;
uniform int stripsPerRow;
uniform vec2 stripSize;
out vec2 uv;
flat out vec2 stripOrigin;
flat out vec4 quadTint;
void main() {
  // Ring-order corners, visited 0, 1, 3, 2 as a triangle strip.
  int corner = gl_VertexID < 2 ? gl_VertexID : 5 - gl_VertexID;
  vec2 position = corner == 0 ? corners01.xy : corner == 1 ? corners01.zw : corner == 2 ? corners23.xy : corners23.zw;
  uv = corner == 0 ? uv01.xy : corner == 1 ? uv01.zw : corner == 2 ? uv23.xy : uv23.zw;
  int slot = firstSlot + gl_InstanceID;
  stripOrigin = vec2(slot % stripsPerRow, slot / stripsPerRow) * stripSize;
  quadTint = tint;
  gl_Position = vec4((position + offset) * scale + vec2(-1.0, 1.0), 0.0, 1.0);
}`

const fragmentShaderSource = `#version 300 es
precision highp float;
uniform sampler2D texels;
uniform sampler2D palette;
uniform bool paletted;
uniform vec2 stripSize;
uniform vec2 pageSize;
in vec2 uv;
flat in vec2 stripOrigin;
flat in vec4 quadTint;
out vec4 color;
void main() {
  // Kept on the strip's own texel centers, so linear filtering never blends in a neighboring strip.
  vec2 inStrip = clamp(uv, vec2(0.5), stripSize - 0.5);
  vec4 texel = texture(texels, (stripOrigin + inStrip) / pageSize);
  vec4 straight = paletted ? texture(palette, vec2((texel.r * 255.0 + 0.5) / 256.0, 0.5)) : texel;
  straight *= quadTint;
  // Premultiplied, and mixed into what older quads of the mesh drew by the blend state render() sets.
  color = vec4(straight.rgb * straight.a, straight.a);
}`

const uniformNames = ['offset', 'scale', 'firstSlot', 'stripsPerRow', 'stripSize', 'pageSize', 'paletted'] as const

/**
 * Weight with which a quad mixes into what older quads of its mesh drew beneath it, wherever it is not the first to
 * cover a pixel: identical readings stay exactly as one, a changed reading moves the pixel 60% of the way to it, so
 * after 3 changed readings less than 7% of the old one is left.
 */
export const meshMixWeight = 0.6

// Location, components, type, normalized and byte offset of each per-instance attribute.
const instanceAttributes: [number, number, 'FLOAT' | 'UNSIGNED_BYTE', boolean, number][] = [
  [0, 4, 'FLOAT', false, 0],
  [1, 4, 'FLOAT', false, 16],
  [2, 4, 'FLOAT', false, 32],
  [3, 4, 'FLOAT', false, 48],
  [4, 4, 'UNSIGNED_BYTE', true, 64],
]

/**
 * GPU copy of a mesh page
 */
interface GpuPage {
  /**
   * Instance data of every slot
   */
  buffer: WebGLBuffer
  /**
   * Texels of every slot
   */
  texture: WebGLTexture
}

/**
 * GPU copy of a mesh
 */
interface GpuMesh {
  /**
   * 256x1 palette texture
   */
  palette: WebGLTexture
  /**
   * Pages uploaded so far, by index
   */
  pages: Map<number, GpuPage>
}

const formats = {
  r8: { internal: 'R8', format: 'RED' },
  rgba8: { internal: 'RGBA8', format: 'RGBA' },
} as const

// WebGL only returns null from its create calls once the context is lost, which every caller checks for first.
const created = <T>(object: T | null): T => {
  if (object === null) throw new Error('The WebGL2 context was lost.')
  return object
}

const compileProgram = (gl: WebGL2RenderingContext): WebGLProgram => {
  const program = created(gl.createProgram())
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertexShaderSource],
    [gl.FRAGMENT_SHADER, fragmentShaderSource],
  ] as const) {
    const shader = gl.createShader(type)
    if (!shader) throw new Error('Could not create a shader.')
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    gl.attachShader(program, shader)
  }
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? '')
  return program
}

/**
 * Draws map meshes with one WebGL2 context shared by every map, keeping the GPU copy of a {@link MapMeshStore}
 * in sync with it, and rebuilding that copy from the store when the context is lost and restored.
 */
export class MapMeshGlRenderer implements MapMeshRenderer {
  private program!: WebGLProgram
  private uniforms!: Record<(typeof uniformNames)[number], WebGLUniformLocation | null>
  private readonly meshes = new Map<string, GpuMesh>()

  /**
   * @param {HTMLCanvasElement} canvas - Detached canvas the context belongs to
   * @param {WebGL2RenderingContext} gl - The context
   * @param {MapMeshStore} store - The meshes to draw
   */
  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly gl: WebGL2RenderingContext,
    private readonly store: MapMeshStore
  ) {
    this.setUp()
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault()
      console.warn('[MapMeshes] The WebGL2 context was lost, so meshes are not drawn until it is restored.')
    })
    canvas.addEventListener('webglcontextrestored', () => {
      this.meshes.clear()
      this.setUp()
      store.markAllDirty()
      console.info('[MapMeshes] The WebGL2 context was restored, so meshes are uploaded again.')
    })
    // Freed right away rather than on the next render, which never comes once no mesh is left to draw.
    store.subscribe(({ id, released }) => released && this.releaseMesh(id))
  }

  /**
   * Draws a mesh for an area of a map, in the bottom-left `width` x `height` corner of {@link canvas}, which stays
   * valid until the current task ends.
   * @param {MapMesh} mesh - The mesh
   * @param {MapMeshView} view - Area of the map
   * @returns {boolean} Whether anything was drawn
   */
  render(mesh: MapMesh, view: MapMeshView): boolean {
    const { gl, canvas } = this
    if (gl.isContextLost()) return false
    this.store.flush(this)
    const gpu = this.meshes.get(mesh.id)
    if (!gpu || !mesh.anchor) return false

    // Only grown, so maps of different sizes do not reallocate the drawing buffer on every redraw.
    if (canvas.width < view.width || canvas.height < view.height) {
      canvas.width = Math.max(canvas.width, view.width)
      canvas.height = Math.max(canvas.height, view.height)
    }
    gl.viewport(0, 0, view.width, view.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clearStencil(0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT)

    const { uniforms } = this
    gl.useProgram(this.program)
    // Subtracted in float64, so the GPU only sees meters within the view.
    const offsetX = mesh.anchor.x - view.originX
    const offsetY = mesh.anchor.y - view.originY
    gl.uniform2f(uniforms.offset, offsetX, offsetY)
    gl.uniform2f(uniforms.scale, 2 / (view.width * view.metresPerPixel), 2 / (view.height * view.metresPerPixel))
    gl.uniform1i(uniforms.stripsPerRow, mesh.stripsPerRow)
    gl.uniform2f(uniforms.stripSize, mesh.stripWidth, mesh.stripHeight)
    gl.uniform1i(uniforms.paletted, mesh.format === 'r8' ? 1 : 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, gpu.palette)
    gl.activeTexture(gl.TEXTURE0)

    // The view in meters from the anchor, to skip pages entirely outside it.
    const left = -offsetX
    const top = -offsetY
    const right = left + view.width * view.metresPerPixel
    const bottom = top - view.height * view.metresPerPixel
    const ranges = meshDrawRanges(mesh).flatMap((range) => {
      const gpuPage = gpu.pages.get(range.page.index)
      const { bounds } = range.page
      if (!gpuPage || bounds.minX > right || bounds.maxX < left || bounds.minY > top || bounds.maxY < bottom) return []
      return [{ ...range, gpuPage }]
    })
    const drawRanges = (): void => {
      for (const { page, gpuPage, first, count } of ranges) {
        gl.bindTexture(gl.TEXTURE_2D, gpuPage.texture)
        gl.uniform2f(uniforms.pageSize, page.width, page.height)
        gl.uniform1i(uniforms.firstSlot, first)
        gl.bindBuffer(gl.ARRAY_BUFFER, gpuPage.buffer)
        for (const [location, size, type, normalized, offset] of instanceAttributes) {
          gl.vertexAttribPointer(
            location,
            size,
            gl[type],
            normalized,
            meshInstanceBytes,
            first * meshInstanceBytes + offset
          )
        }
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count)
      }
    }
    // Writes and marks only pixels the mesh has not drawn yet, in drawing order, so each pixel takes its oldest quad.
    gl.disable(gl.BLEND)
    gl.enable(gl.STENCIL_TEST)
    gl.stencilFunc(gl.EQUAL, 0, 0xff)
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR)
    drawRanges()
    // Then every quad mixes into it in the same order, the oldest into itself, which leaves it as it is.
    gl.enable(gl.BLEND)
    gl.blendColor(0, 0, 0, meshMixWeight)
    gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA)
    gl.stencilFunc(gl.EQUAL, 1, 0xff)
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP)
    drawRanges()
    return ranges.length > 0
  }

  /**
   * Frees everything held on the GPU for a mesh, if anything is
   * @param {string} id - Id of the mesh
   */
  releaseMesh(id: string): void {
    const gpu = this.meshes.get(id)
    if (!gpu) return
    this.gl.deleteTexture(gpu.palette)
    gpu.pages.forEach((page) => {
      this.gl.deleteBuffer(page.buffer)
      this.gl.deleteTexture(page.texture)
    })
    this.meshes.delete(id)
  }

  /* eslint-disable jsdoc/require-jsdoc -- MapMeshRenderer methods, documented there, then private helpers. */
  uploadSettings(mesh: MapMesh): void {
    const { gl } = this
    const gpu = this.gpuMesh(mesh)
    gl.bindTexture(gl.TEXTURE_2D, gpu.palette)
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.RGBA, gl.UNSIGNED_BYTE, mesh.palette)
    gpu.pages.forEach((page) => this.setFilter(page.texture, mesh))
  }

  uploadPage(mesh: MapMesh, page: MapMeshPage): void {
    const { gl } = this
    const gpu = this.gpuMesh(mesh)
    const { internal, format } = formats[mesh.format]
    let gpuPage = gpu.pages.get(page.index)
    let slots = page.dirtySlots
    let texels = page.dirtyTexels
    if (!gpuPage) {
      const buffer = created(gl.createBuffer())
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, page.instances.byteLength, gl.DYNAMIC_DRAW)
      const texture = created(gl.createTexture())
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl[internal], page.width, page.height)
      this.setFilter(texture, mesh)
      gpuPage = { buffer, texture }
      gpu.pages.set(page.index, gpuPage)
      slots = [0, page.slotCount]
      texels = { x0: 0, y0: 0, x1: page.width, y1: page.height }
    }
    if (slots) {
      const [first, end] = slots
      gl.bindBuffer(gl.ARRAY_BUFFER, gpuPage.buffer)
      const offset = first * meshInstanceBytes
      const length = (end - first) * meshInstanceBytes
      gl.bufferSubData(gl.ARRAY_BUFFER, offset, page.instances, offset, length)
    }
    if (texels) {
      const { x0, y0, x1, y1 } = texels
      gl.bindTexture(gl.TEXTURE_2D, gpuPage.texture)
      gl.pixelStorei(gl.UNPACK_ROW_LENGTH, page.width)
      const offset = (y0 * page.width + x0) * mesh.bytesPerTexel
      gl.texSubImage2D(gl.TEXTURE_2D, 0, x0, y0, x1 - x0, y1 - y0, gl[format], gl.UNSIGNED_BYTE, page.texels, offset)
    }
  }

  private setUp(): void {
    const { gl } = this
    this.program = compileProgram(gl)
    this.uniforms = Object.fromEntries(
      uniformNames.map((name) => [name, gl.getUniformLocation(this.program, name)])
    ) as typeof this.uniforms
    gl.useProgram(this.program)
    gl.uniform1i(gl.getUniformLocation(this.program, 'texels'), 0)
    gl.uniform1i(gl.getUniformLocation(this.program, 'palette'), 1)
    gl.bindVertexArray(gl.createVertexArray())
    for (const [location] of instanceAttributes) {
      gl.enableVertexAttribArray(location)
      gl.vertexAttribDivisor(location, 1)
    }
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
  }

  private gpuMesh(mesh: MapMesh): GpuMesh {
    const existing = this.meshes.get(mesh.id)
    if (existing) return existing
    const { gl } = this
    const palette = created(gl.createTexture())
    gl.bindTexture(gl.TEXTURE_2D, palette)
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 256, 1)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    const gpu = { palette, pages: new Map<number, GpuPage>() }
    this.meshes.set(mesh.id, gpu)
    return gpu
  }

  private setFilter(texture: WebGLTexture, mesh: MapMesh): void {
    const { gl } = this
    const filter = mesh.filter === 'linear' ? gl.LINEAR : gl.NEAREST
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }
  /* eslint-enable jsdoc/require-jsdoc */
}

let renderer: MapMeshGlRenderer | null | undefined

/**
 * The renderer every map shares, created on first use, or undefined where WebGL2 is not available
 * @param {MapMeshStore} store - The meshes to draw
 * @returns {MapMeshGlRenderer | undefined} The renderer
 */
export const mapMeshGlRenderer = (store: MapMeshStore): MapMeshGlRenderer | undefined => {
  if (renderer !== undefined) return renderer ?? undefined
  renderer = null
  const canvas = document.createElement('canvas')
  const options: WebGLContextAttributes = {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    stencil: true,
  }
  const gl = canvas.getContext('webgl2', options)
  try {
    if (gl) renderer = new MapMeshGlRenderer(canvas, gl, store)
  } catch (error) {
    console.error('[MapMeshes] Could not set up WebGL2.', error)
  }
  return renderer ?? undefined
}
