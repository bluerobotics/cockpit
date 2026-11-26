import L from 'leaflet'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import type { MapMesh, MapMeshStore } from '@/libs/map/external-map-meshes'
import type { MapMeshGlRenderer } from '@/libs/map/external-map-meshes-gl'
import {
  defaultMeshAlphaCurve,
  ExternalMapMeshesLayer,
  normalizeMeshAlphaCurve,
} from '@/libs/map/external-map-meshes-layer'

const mesh = { id: 'survey', highWater: 1, opacity: 0.5 } as MapMesh
const store = { meshes: new Map([[mesh.id, mesh]]), subscribe: () => () => undefined } as unknown as MapMeshStore

let frames: FrameRequestCallback[] = []
const runFrames = (): void => {
  const pending = frames
  frames = []
  pending.forEach((frame) => frame(0))
}

let map: L.Map
let layer: ExternalMapMeshesLayer
let render: ReturnType<typeof vi.fn>
let getRenderer: ReturnType<typeof vi.fn>
let drawnAlphas: number[]

const addLayer = (curve?: readonly [number, number]): void => {
  layer = new ExternalMapMeshesLayer({
    store,
    renderer: getRenderer as unknown as () => MapMeshGlRenderer,
    onUnsupported: vi.fn(),
    pane: 'overlayPane',
  })
  if (curve !== undefined) layer.setMapAlphaCurve(curve)
  layer.setShown(true)
  map.addLayer(layer)
  runFrames()
}

const canvas = (): HTMLCanvasElement => map.getPane('overlayPane')?.querySelector('canvas') as HTMLCanvasElement
const renderedCurves = (): number[][] => render.mock.calls.map((call) => [...call[2]])

beforeEach(() => {
  frames = []
  drawnAlphas = []
  globalThis.requestAnimationFrame = (frame) => frames.push(frame)
  globalThis.cancelAnimationFrame = vi.fn()
  const context = { clearRect: vi.fn(), drawImage: vi.fn(), globalAlpha: 1 }
  context.drawImage.mockImplementation(() => drawnAlphas.push(context.globalAlpha))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
  render = vi.fn(() => true)
  getRenderer = vi.fn(() => ({ canvas: document.createElement('canvas'), render }))
  const container = document.createElement('div')
  document.body.appendChild(container)
  map = L.map(container, { zoomAnimation: false }).setView([-27.59, -48.55], 15)
  vi.spyOn(map, 'getSize').mockReturnValue(L.point(200, 100))
})

afterEach(() => {
  map.remove()
  vi.restoreAllMocks()
})

describe('normalizeMeshAlphaCurve', () => {
  test('keeps a range within 0 to 1 as it is, in a new array, including one that is not ascending', () => {
    const curve: [number, number] = [0.1, 0.9]
    expect(normalizeMeshAlphaCurve(curve)).toEqual([0.1, 0.9])
    expect(normalizeMeshAlphaCurve(curve)).not.toBe(curve)
    expect(normalizeMeshAlphaCurve([0, 0])).toEqual([0, 0])
    expect(normalizeMeshAlphaCurve([0.8, 0.2])).toEqual([0.8, 0.2])
  })

  test('clamps each end to between 0 and 1', () => {
    expect(normalizeMeshAlphaCurve([-0.5, 1.5])).toEqual([0, 1])
    expect(normalizeMeshAlphaCurve([2, -3])).toEqual([1, 0])
  })

  test('falls back to a copy of the default for anything but a pair of finite numbers', () => {
    const malformed = [undefined, null, 0.5, '0.25,0.5', [0.5], [0.1, 0.2, 0.3], [NaN, 0.5], [0.25, Infinity], ['0', 1]]
    for (const curve of malformed) expect(normalizeMeshAlphaCurve(curve)).toEqual([0.25, 0.5])
    expect(normalizeMeshAlphaCurve(undefined)).not.toBe(defaultMeshAlphaCurve)
  })
})

describe('ExternalMapMeshesLayer transparency range', () => {
  test('draws with the default range until it is set', () => {
    addLayer()
    expect(render).toHaveBeenCalledTimes(1)
    expect(render.mock.calls[0][0]).toBe(mesh)
    expect(renderedCurves()).toEqual([[...defaultMeshAlphaCurve]])
    expect(drawnAlphas).toEqual([mesh.opacity])
    expect(canvas().style.opacity).toBe('')
  })

  test('hands a range set before the layer is added only to the renderer, not to the composite or the canvas', () => {
    addLayer([0.1, 0.9])
    expect(renderedCurves()).toEqual([[0.1, 0.9]])
    expect(drawnAlphas).toEqual([mesh.opacity])
    expect(canvas().style.opacity).toBe('')
  })

  test('redraws once on the next frame with the new range when it changes, and not when it does not', () => {
    addLayer()
    render.mockClear()
    drawnAlphas = []
    layer.setMapAlphaCurve([0.1, 0.7])
    layer.setMapAlphaCurve([0.2, 0.6])
    expect(frames).toHaveLength(1)
    expect(render).not.toHaveBeenCalled()
    runFrames()
    expect(renderedCurves()).toEqual([[0.2, 0.6]])
    expect(drawnAlphas).toEqual([mesh.opacity])
    expect(canvas().style.opacity).toBe('')

    layer.setMapAlphaCurve([0.2, 0.6])
    layer.setMapAlphaCurve([0.2, 1.4])
    layer.setMapAlphaCurve([0.2, 1])
    runFrames()
    expect(renderedCurves()).toEqual([
      [0.2, 0.6],
      [0.2, 1],
    ])
    layer.setMapAlphaCurve([0.2, 1])
    expect(frames).toHaveLength(0)
  })

  test('keeps its own copy, so a range changed in place after it is set is drawn once set again', () => {
    const curve: [number, number] = [0.1, 0.2]
    addLayer(curve)
    curve[1] = 0.8
    layer.setMapAlphaCurve(curve)
    runFrames()
    expect(renderedCurves()).toEqual([
      [0.1, 0.2],
      [0.1, 0.8],
    ])
  })

  test('keeps drawing the meshes at a range of [0, 0]', () => {
    addLayer()
    render.mockClear()
    layer.setMapAlphaCurve([0, 0])
    runFrames()
    expect(renderedCurves()).toEqual([[0, 0]])
    expect(canvas().width).toBeGreaterThan(0)
    expect(canvas().style.opacity).toBe('')
  })

  test('clamps the range to between 0 and 1, and takes the default for a malformed one', () => {
    addLayer([-1, 1.5])
    layer.setMapAlphaCurve([NaN, 0.4])
    runFrames()
    layer.setMapAlphaCurve([1, 0])
    runFrames()
    layer.setMapAlphaCurve([0.5] as unknown as [number, number])
    runFrames()
    expect(renderedCurves()).toEqual([[0, 1], [...defaultMeshAlphaCurve], [1, 0], [...defaultMeshAlphaCurve]])
    expect(canvas().style.opacity).toBe('')
  })

  test('draws each map with its own range', () => {
    addLayer([0.1, 0.2])
    const otherContainer = document.createElement('div')
    document.body.appendChild(otherContainer)
    const otherMap = L.map(otherContainer, { zoomAnimation: false }).setView([-27.59, -48.55], 15)
    vi.spyOn(otherMap, 'getSize').mockReturnValue(L.point(200, 100))
    const otherLayer = new ExternalMapMeshesLayer({
      store,
      renderer: getRenderer as unknown as () => MapMeshGlRenderer,
      onUnsupported: vi.fn(),
      pane: 'overlayPane',
    })
    otherLayer.setMapAlphaCurve([0.6, 0.9])
    otherLayer.setShown(true)
    otherMap.addLayer(otherLayer)
    runFrames()
    layer.redraw()
    runFrames()
    expect(renderedCurves()).toEqual([
      [0.1, 0.2],
      [0.6, 0.9],
      [0.1, 0.2],
    ])
    otherMap.remove()
  })
})

describe('ExternalMapMeshesLayer removed and added again', () => {
  const expectDrawnOnNewCanvas = (previous: HTMLCanvasElement): void => {
    render.mockClear()
    drawnAlphas = []
    runFrames()
    expect(canvas()).not.toBe(previous)
    expect(render).toHaveBeenCalledTimes(1)
    expect(drawnAlphas).toEqual([mesh.opacity])
    expect(canvas().style.width).toBe('300px')
  }

  test('draws the unchanged meshes on its new canvas every time, without the map moving', () => {
    addLayer()
    for (let toggle = 0; toggle < 3; toggle++) {
      const previous = canvas()
      map.removeLayer(layer)
      expect(canvas()).toBeNull()
      map.addLayer(layer)
      expect(frames).toHaveLength(1)
      expectDrawnOnNewCanvas(previous)
    }
  })

  test('draws again when it was removed in the middle of a zoom whose end it never saw', () => {
    addLayer()
    const previous = canvas()
    map.fire('zoomstart')
    map.removeLayer(layer)
    map.fire('zoomend')
    map.addLayer(layer)
    expectDrawnOnNewCanvas(previous)
  })

  test('waits for the end of a zoom that starts after it is added again, then draws', () => {
    addLayer()
    map.removeLayer(layer)
    map.addLayer(layer)
    map.fire('zoomstart')
    render.mockClear()
    runFrames()
    expect(render).not.toHaveBeenCalled()
    map.fire('zoomend')
    runFrames()
    expect(render).toHaveBeenCalledTimes(1)
  })

  test('stays hidden when hidden while removed, until it is shown again', () => {
    addLayer()
    map.removeLayer(layer)
    layer.setShown(false)
    map.addLayer(layer)
    expect(frames).toHaveLength(0)
    const previous = canvas()
    layer.setShown(true)
    expect(frames).toHaveLength(1)
    render.mockClear()
    runFrames()
    expect(canvas()).toBe(previous)
    expect(render).toHaveBeenCalledTimes(1)
  })
})

describe('ExternalMapMeshesLayer shown and hidden', () => {
  test('releases its canvas when hidden, and draws nothing until it is shown again', () => {
    addLayer()
    expect(canvas().width).toBeGreaterThan(0)
    layer.setShown(false)
    expect(canvas().width).toBe(0)
    expect(canvas().height).toBe(0)
    expect(frames).toHaveLength(0)
    layer.setMapAlphaCurve([0.1, 0.2])
    layer.redraw()
    expect(frames).toHaveLength(0)
  })

  test('cancels a pending draw when hidden', () => {
    addLayer()
    layer.setMapAlphaCurve([0.1, 0.2])
    expect(frames).toHaveLength(1)
    layer.setShown(false)
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1)
  })

  test('draws again when shown', () => {
    addLayer()
    layer.setShown(false)
    render.mockClear()
    layer.setShown(true)
    expect(frames).toHaveLength(1)
    runFrames()
    expect(render).toHaveBeenCalledTimes(1)
    expect(canvas().width).toBeGreaterThan(0)
  })

  test('does nothing when set to what it already is', () => {
    addLayer()
    layer.setShown(true)
    expect(frames).toHaveLength(0)
    layer.setShown(false)
    canvas().width = 5
    layer.setShown(false)
    expect(canvas().width).toBe(5)
  })

  test('never starts a timer', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    addLayer()
    layer.setShown(false)
    layer.setShown(true)
    map.removeLayer(layer)
    map.addLayer(layer)
    expect(setIntervalSpy).not.toHaveBeenCalled()
  })
})
