import L, { type LatLng, type Map, type Polyline } from 'leaflet'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { type Ref, createApp, nextTick, ref, shallowRef } from 'vue'

import { useMapVehiclePathLayer, VEHICLE_PATH_SEGMENT_SIZE } from '@/composables/map/useMapVehiclePathLayer'
import type { WaypointCoordinates } from '@/types/mission'

/**
 * A stand-in Leaflet map that only records which layers are on it.
 */
interface FakeMap {
  /** The map handed to the composable. */
  map: Map
  /** Layers currently added to the map. */
  layers: Set<unknown>
}

/**
 * The composable mounted in a throwaway app, with the inputs that drive it.
 */
interface PathLayerHarness {
  /** Trail fed to the layer. */
  history: Ref<WaypointCoordinates[]>
  /** Revision counter fed to the layer. */
  revision: Ref<number>
  /** Layers on the fake map. */
  layers: Set<unknown>
  /** Unmounts the app owning the composable. */
  unmount: () => void
}

const fakeMap = (): FakeMap => {
  const layers = new Set<unknown>()
  const panes: Record<string, HTMLElement> = {}
  const map = {
    getContainer: () => document.createElement('div'),
    getPane: (name: string) => panes[name],
    createPane: (name: string) => (panes[name] = document.createElement('div')),
    hasLayer: (layer: unknown) => layers.has(layer),
    addLayer: (layer: unknown) => layers.add(layer),
    removeLayer: (layer: unknown) => layers.delete(layer),
  }
  return { map: map as unknown as Map, layers }
}

const drawnPoints = (layers: Set<unknown>): number[][] => {
  const group = [...layers][0] as L.LayerGroup
  const lines = group.getLayers() as Polyline[]
  return lines.flatMap((line, index) =>
    (line.getLatLngs() as LatLng[]).slice(index === 0 ? 0 : 1).map((p) => [p.lat, p.lng])
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

const point = (i: number): WaypointCoordinates => [i, -i]

const setup = (initial: WaypointCoordinates[], deep: boolean): PathLayerHarness => {
  const history = deep ? ref(initial) : shallowRef(initial)
  const revision = ref(0)
  const { map, layers } = fakeMap()
  const app = createApp({
    setup() {
      useMapVehiclePathLayer(shallowRef(map), {
        path: () => history.value,
        revision: () => revision.value,
        show: () => true,
      })
      return () => null
    },
  })
  app.mount(document.createElement('div'))
  return { history, revision, layers, unmount: () => app.unmount() }
}

describe.each([true, false])('useMapVehiclePathLayer (deep history: %s)', (deep) => {
  test('draws a long history as joined segments', () => {
    const initial = Array.from({ length: VEHICLE_PATH_SEGMENT_SIZE * 2 + 10 }, (_, i) => point(i))
    const { layers } = setup(initial, deep)
    expect(drawnPoints(layers)).toEqual(initial)
    expect(([...layers][0] as L.LayerGroup).getLayers()).toHaveLength(3)
  })

  test('updates only the head and tail segments when the history is at its cap', async () => {
    // Shifting a deep reactive array costs Vue O(n) per call, so that variant runs a shorter trail.
    const size = deep ? 600 : VEHICLE_PATH_SEGMENT_SIZE * 3
    const updates = deep ? 300 : VEHICLE_PATH_SEGMENT_SIZE + 100
    const { history, revision, layers } = setup(
      Array.from({ length: size }, (_, i) => point(i)),
      deep
    )
    const setLatLngs = vi.spyOn(L.Polyline.prototype, 'setLatLngs')

    for (let i = size; i < size + updates; i++) {
      // Coalesce a few store updates into one revision, as Vue's batching does.
      const batch = i % 3 === 0 ? 3 : 1
      for (let b = 0; b < batch; b++) {
        history.value.push(point(i + b))
        history.value.shift()
      }
      i += batch - 1
      revision.value += 1
      await nextTick()
    }

    expect(drawnPoints(layers)).toEqual(history.value.map((p) => [p[0], p[1]]))
    expect(setLatLngs.mock.calls.every(([latlngs]) => (latlngs as unknown[]).length <= VEHICLE_PATH_SEGMENT_SIZE)).toBe(
      true
    )
  })

  test('rebuilds when the history array is replaced, and keeps appending after it', async () => {
    const { history, revision, layers } = setup(
      Array.from({ length: 5000 }, (_, i) => point(i)),
      deep
    )
    history.value = history.value.filter((_, i) => i % 2 === 0)
    revision.value += 1
    await nextTick()
    history.value.push(point(9000), point(9001))
    revision.value += 1
    await nextTick()
    expect(drawnPoints(layers)).toEqual(history.value.map((p) => [p[0], p[1]]))
  })

  test('removes the trail when the history is cleared or the owner unmounts', async () => {
    const { history, revision, layers, unmount } = setup([point(1), point(2)], deep)
    const group = [...layers][0] as L.LayerGroup
    history.value = []
    revision.value += 1
    await nextTick()
    expect(group.getLayers()).toHaveLength(0)

    history.value = [point(3), point(4)]
    revision.value += 1
    await nextTick()
    expect(group.getLayers()).toHaveLength(1)
    unmount()
    expect(group.getLayers()).toHaveLength(0)
  })
})
