import { flushPromises, mount } from '@vue/test-utils'
import L from 'leaflet'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { defineComponent, h, nextTick, onMounted, onUnmounted, ref } from 'vue'

import { ExternalMapMeshesLayer } from '@/libs/map/external-map-meshes-layer'

vi.mock('@/composables/snackbar', () => ({ openSnackbar: vi.fn() }))
vi.mock('@/libs/map/external-map-meshes-gl', () => ({ mapMeshGlRenderer: () => undefined }))
vi.mock('@/composables/map/useExternalMapMeshes', () => ({
  useExternalMapMeshes: () => ({ meshes: { meshes: new Map(), subscribe: () => () => undefined } }),
}))

const { useExternalMapMeshLayers } = await import('@/composables/map/useExternalMapMeshLayers')

let map: L.Map
const meshCanvas = (): HTMLCanvasElement | null | undefined => map.getPane('externalMeshPane')?.querySelector('canvas')
const meshLayer = (): ExternalMapMeshesLayer | undefined => {
  let found: ExternalMapMeshesLayer | undefined
  map.eachLayer((layer) => {
    if (layer instanceof ExternalMapMeshesLayer) found = layer
  })
  return found
}

beforeEach(() => {
  globalThis.requestAnimationFrame = vi.fn()
  globalThis.cancelAnimationFrame = vi.fn()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  const container = document.createElement('div')
  document.body.appendChild(container)
  map = L.map(container, { zoomAnimation: false }).setView([-27.59, -48.55], 15)
})

afterEach(() => {
  map.remove()
  vi.restoreAllMocks()
})

describe('useExternalMapMeshLayers in a component that awaits other layers before init', () => {
  // Mounts as Mission Planning does: an async mount hook initializes the meshes after awaiting the GeoTIFF overlays.
  // Returns the unmount, and what makes the overlays ready.
  const mountAwaitingOverlays = (): [() => void, () => Promise<void>] => {
    let resolveOverlays!: () => void
    const overlays = new Promise<void>((resolve) => (resolveOverlays = resolve))
    const wrapper = mount(
      defineComponent({
        setup() {
          const layers = useExternalMapMeshLayers()
          onMounted(async () => {
            await overlays
            layers.init(map)
          })
          onUnmounted(layers.destroy)
          return () => h('div')
        },
      })
    )
    const finishOverlays = async (): Promise<void> => {
      resolveOverlays()
      await flushPromises()
    }
    return [() => wrapper.unmount(), finishOverlays]
  }

  test('draws the meshes once the overlays are ready, and stops when the component unmounts', async () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    const [unmount, finishOverlays] = mountAwaitingOverlays()
    expect(meshCanvas()).toBeFalsy()
    await finishOverlays()
    expect(meshCanvas()).toBeTruthy()

    unmount()
    expect(meshCanvas()).toBeNull()
    expect(meshLayer()).toBeUndefined()
    expect(setIntervalSpy).not.toHaveBeenCalled()
  })
})

describe('useExternalMapMeshLayers on a map that is shown and hidden', () => {
  const isLayerShown = (): boolean | undefined => Reflect.get(meshLayer() ?? {}, 'shown')

  test('hides the meshes as soon as a reactive isShown turns false, and shows them when it turns true', async () => {
    const shown = ref(true)
    const layers = useExternalMapMeshLayers()
    layers.init(map, () => shown.value)
    expect(isLayerShown()).toBe(true)

    shown.value = false
    await nextTick()
    expect(isLayerShown()).toBe(false)
    expect(meshCanvas()?.width).toBe(0)

    vi.mocked(requestAnimationFrame).mockClear()
    shown.value = true
    await nextTick()
    expect(isLayerShown()).toBe(true)
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)
    layers.destroy()
  })

  test('reads isShown again when the page is hidden or shown', async () => {
    const pageVisible = ref(true)
    const onView = ref(true)
    const layers = useExternalMapMeshLayers()
    layers.init(map, () => pageVisible.value && onView.value)

    pageVisible.value = false
    await nextTick()
    expect(isLayerShown()).toBe(false)

    pageVisible.value = true
    await nextTick()
    expect(isLayerShown()).toBe(true)
    layers.destroy()
  })

  test('follows view changes after starting in a hidden page and coming back', async () => {
    const pageVisible = ref(false)
    const onView = ref(false)
    const layers = useExternalMapMeshLayers()
    layers.init(map, () => pageVisible.value && onView.value)
    expect(isLayerShown()).toBe(false)

    pageVisible.value = true
    await nextTick()
    expect(isLayerShown()).toBe(false)

    onView.value = true
    await nextTick()
    expect(isLayerShown()).toBe(true)

    onView.value = false
    await nextTick()
    expect(isLayerShown()).toBe(false)
    layers.destroy()
  })

  test('stops reading isShown once destroyed, and on a new init', async () => {
    const shown = ref(true)
    const isShown = vi.fn(() => shown.value)
    const layers = useExternalMapMeshLayers()
    layers.init(map, isShown)
    layers.init(map)
    isShown.mockClear()

    shown.value = false
    await nextTick()
    expect(isShown).not.toHaveBeenCalled()

    layers.destroy()
    shown.value = true
    await nextTick()
    expect(isShown).not.toHaveBeenCalled()
  })
})
