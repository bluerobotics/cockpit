import { flushPromises } from '@vue/test-utils'
import L from 'leaflet'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

import type { CachedOverlayRender } from '@/libs/map/overlay-storage'
import type { MapOverlayMeta } from '@/types/mission'

const missionStore = reactive({ mapOverlays: [] as MapOverlayMeta[] })
const getCachedOverlayRender = vi.fn<[string], Promise<CachedOverlayRender | null>>()

vi.mock('@/stores/mission', () => ({ useMissionStore: () => missionStore }))
vi.mock('@/libs/map/geotiff-overlay', () => ({ OVERLAY_RENDER_VERSION: 2, renderGeoTiffImage: vi.fn() }))
vi.mock('@/libs/map/overlay-storage', () => ({
  getCachedOverlayRender,
  setCachedOverlayRender: vi.fn(),
  mapOverlayStorage: { getItem: vi.fn() },
}))

const { useMapOverlays } = await import('@/composables/map/useMapOverlays')

const bounds: MapOverlayMeta['bounds'] = [
  [-27.6, -48.6],
  [-27.58, -48.54],
]
const render: CachedOverlayRender = {
  version: 2,
  renderMode: 'grayscale',
  dataUrl: 'data:image/png;base64,',
  bounds,
}

// The render cache is shared by every map, so each test uses its own overlay id to start uncached.
let overlayCount = 0
const showOverlay = (): MapOverlayMeta => {
  const meta: MapOverlayMeta = {
    id: `overlay-${++overlayCount}`,
    name: 'Survey',
    bounds,
    opacity: 0.7,
    visible: true,
    renderMode: 'grayscale',
    fileSize: 1,
    createdAt: 0,
  }
  missionStore.mapOverlays = [meta]
  return meta
}

// Holds every cached-render read until `release` is called, as a slow IndexedDB read would.
const holdCachedRenders = (): (() => void) => {
  let release = (): void => undefined
  const held = new Promise<void>((resolve) => (release = resolve))
  getCachedOverlayRender.mockImplementation(async () => {
    await held
    return render
  })
  return release
}

// Destroyed after each test even when an assertion fails first, so no test's registry reacts to the next one's store.
const registries: ReturnType<typeof useMapOverlays>[] = []
const createOverlays = (): ReturnType<typeof useMapOverlays> => {
  const overlays = useMapOverlays()
  registries.push(overlays)
  return overlays
}

let map: L.Map
const overlayLayers = (): L.ImageOverlay[] => {
  const layers: L.ImageOverlay[] = []
  map.eachLayer((layer) => {
    if (layer instanceof L.ImageOverlay) layers.push(layer)
  })
  return layers
}

// Each reconcile of an already shown overlay sets its layer's opacity once, so this counts the reconciles a change
// causes.
const reconcilesForOpacityChange = async (opacity: number): Promise<number> => {
  const setOpacity = vi.spyOn(L.ImageOverlay.prototype, 'setOpacity')
  missionStore.mapOverlays[0].opacity = opacity
  await nextTick()
  await flushPromises()
  const calls = setOpacity.mock.calls.filter(([value]) => value === opacity).length
  setOpacity.mockRestore()
  return calls
}

beforeEach(() => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  map = L.map(container, { zoomAnimation: false }).setView([-27.59, -48.57], 13)
  getCachedOverlayRender.mockReset()
  getCachedOverlayRender.mockResolvedValue(render)
})

afterEach(() => {
  registries.splice(0).forEach((overlays) => overlays.destroyOverlays())
  map.remove()
  missionStore.mapOverlays = []
  vi.restoreAllMocks()
})

describe('useMapOverlays', () => {
  test('shows a visible overlay and syncs each later change once, until destroyed', async () => {
    showOverlay()
    const overlays = createOverlays()
    await overlays.initOverlays(map)
    expect(overlayLayers()).toHaveLength(1)

    expect(await reconcilesForOpacityChange(0.4)).toBe(1)
    expect(overlayLayers()[0].options.opacity).toBe(0.4)

    missionStore.mapOverlays[0].visible = false
    await nextTick()
    await flushPromises()
    expect(overlayLayers()).toHaveLength(0)

    missionStore.mapOverlays[0].visible = true
    await nextTick()
    await flushPromises()
    expect(overlayLayers()).toHaveLength(1)

    overlays.destroyOverlays()
    expect(overlayLayers()).toHaveLength(0)
    expect(await reconcilesForOpacityChange(0.3)).toBe(0)
  })

  test('neither draws nor keeps syncing when destroyed while the cached render is still loading', async () => {
    showOverlay()
    const release = holdCachedRenders()
    const overlays = createOverlays()
    const init = overlays.initOverlays(map)
    await flushPromises()
    expect(getCachedOverlayRender).toHaveBeenCalledTimes(1)

    overlays.destroyOverlays()
    release()
    await init
    await flushPromises()
    expect(overlayLayers()).toHaveLength(0)

    // A later init, as the MiniMap does when its overlay switch is turned back on, syncs changes exactly once.
    await overlays.initOverlays(map)
    expect(overlayLayers()).toHaveLength(1)
    expect(await reconcilesForOpacityChange(0.4)).toBe(1)
    overlays.destroyOverlays()
    expect(await reconcilesForOpacityChange(0.2)).toBe(0)
  })

  test('ignores later changes when destroyed while the cached render is loading and never initialized again', async () => {
    showOverlay()
    const release = holdCachedRenders()
    const overlays = createOverlays()
    const init = overlays.initOverlays(map)
    await flushPromises()
    overlays.destroyOverlays()
    release()
    await init
    await flushPromises()

    // A live watcher reads every field of every overlay on a change, so any read of this one's name means one is left.
    let nameReads = 0
    const later = { ...missionStore.mapOverlays[0], id: `overlay-${++overlayCount}` }
    Object.defineProperty(later, 'name', { enumerable: true, get: () => (nameReads++, 'Later') })
    missionStore.mapOverlays = [later]
    await nextTick()
    await flushPromises()
    expect(nameReads).toBe(0)
    expect(overlayLayers()).toHaveLength(0)
  })

  test('syncs each change once when destroyed and initialized again before the first init finishes', async () => {
    showOverlay()
    const release = holdCachedRenders()
    const overlays = createOverlays()
    const firstInit = overlays.initOverlays(map)
    await flushPromises()

    overlays.destroyOverlays()
    const secondInit = overlays.initOverlays(map)
    release()
    await Promise.all([firstInit, secondInit])
    await flushPromises()
    expect(overlayLayers()).toHaveLength(1)

    expect(await reconcilesForOpacityChange(0.4)).toBe(1)
    overlays.destroyOverlays()
    expect(overlayLayers()).toHaveLength(0)
    expect(await reconcilesForOpacityChange(0.2)).toBe(0)
  })

  test('syncs each change once when initialized twice on the same map', async () => {
    showOverlay()
    const overlays = createOverlays()
    await overlays.initOverlays(map)
    await overlays.initOverlays(map)
    expect(overlayLayers()).toHaveLength(1)

    expect(await reconcilesForOpacityChange(0.4)).toBe(1)
    overlays.destroyOverlays()
    expect(await reconcilesForOpacityChange(0.2)).toBe(0)
  })
})
