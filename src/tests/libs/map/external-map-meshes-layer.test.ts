import L from 'leaflet'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import type { MapMesh, MapMeshStore } from '@/libs/map/external-map-meshes'
import type { MapMeshGlRenderer } from '@/libs/map/external-map-meshes-gl'
import { ExternalMapMeshesLayer } from '@/libs/map/external-map-meshes-layer'

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

const addLayer = (): void => {
  layer = new ExternalMapMeshesLayer({
    store,
    renderer: getRenderer as unknown as () => MapMeshGlRenderer,
    onUnsupported: vi.fn(),
    pane: 'overlayPane',
  })
  layer.setShown(true)
  map.addLayer(layer)
  runFrames()
}

const canvas = (): HTMLCanvasElement => map.getPane('overlayPane')?.querySelector('canvas') as HTMLCanvasElement

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
    layer.redraw()
    expect(frames).toHaveLength(0)
  })

  test('cancels a pending draw when hidden', () => {
    addLayer()
    layer.redraw()
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
