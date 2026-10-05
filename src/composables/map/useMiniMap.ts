import { useThrottleFn } from '@vueuse/core'
import { type ComputedRef, type Ref, type ShallowRef, computed, onBeforeUnmount, ref, watch } from 'vue'

import {
  type MountedCustomTileProviderLayer,
  customTileProviderSignature,
  useCustomTileProviderLayer,
} from '@/composables/map/useCustomTileProviderLayer'
import { useMapAutoResize } from '@/composables/map/useMapAutoResize'
import { provideMapContext } from '@/composables/map/useMapContext'
import { useMapTileLayers } from '@/composables/map/useMapTileLayers'
import { type CockpitMap, createMap } from '@/libs/map/cesium-map'
import { buildRadialFadeMask } from '@/libs/map/minimap-geometry'
import { addRasterLayer } from '@/libs/map/raster-layers'
import { applyFollowZoomMode } from '@/libs/map/utils-map'
import { useMissionStore } from '@/stores/mission'
import type { MapTileProvider, WaypointCoordinates } from '@/types/mission'

// Overview zoom used when the vehicle is offline with no fix, so world imagery loads instead of blank
// high-zoom null-island tiles.
const offlineOverviewZoom = 5

/**
 * Reactive inputs driving the minimap. Getters (not plain values) so the composable can watch them.
 */
export interface UseMiniMapOptions {
  /** Current vehicle position as [latitude, longitude], or undefined when unknown. */
  vehiclePosition: () => WaypointCoordinates | undefined
  /** Current vehicle heading in degrees (0 = north, clockwise). */
  vehicleHeading: () => number
  /** Whether the map rotates so the vehicle heading points to the top of the widget. */
  headingUp: () => boolean
  /** Fraction of the circular map radius that fades toward the edge, in [0, 0.95]. */
  edgeFadeAmount: () => number
  /** Zoom level the map opens at. */
  defaultZoom: () => number
  /** Base tile provider to display: a built-in provider's name, or a custom provider's id. */
  tileProvider: () => string
  /** Whether a vehicle is currently connected; drives the offline reset to the default zoom. */
  vehicleOnline: () => boolean
}

/**
 * Handles exposed by the minimap composable.
 */
export interface UseMiniMapReturn {
  /** The map instance, available once `init` has run and its style has loaded. */
  map: ShallowRef<CockpitMap | undefined>
  /** True once the map is created and ready for descendant overlays. */
  mapReady: Ref<boolean>
  /** Current map zoom level, kept in sync with user zooming. */
  zoom: Ref<number>
  /** The zoom the operator chose, excluding the offline overview override, for consumers that persist it. */
  operatorZoom: ComputedRef<number>
  /**
   * Creates the rotating map on the given element and starts following the vehicle.
   * @param {HTMLElement} element - The container element to mount the map on.
   * @returns {void}
   */
  init: (element: HTMLElement) => void
  /**
   * Destroys the map and releases every listener/observer the composable created.
   * @returns {void}
   */
  destroy: () => void
}

/**
 * Creates a vehicle-centered, heading-up rotating minimap: a circular map with a radial edge fade that
 * always keeps the vehicle at its center. The map library stays behind this composable, and the map context is
 * provided so POI markers and edge indicators can attach as descendants. Teardown is owned here.
 * @param {UseMiniMapOptions} options - Reactive getters for position, heading and appearance.
 * @returns {UseMiniMapReturn} The map instance, readiness flag, and init/destroy lifecycle hooks.
 */
export const useMiniMap = (options: UseMiniMapOptions): UseMiniMapReturn => {
  const { map, mapReady } = provideMapContext()
  const zoom = ref(options.defaultZoom())
  const bearing = ref(0)
  const tileLayers = useMapTileLayers()
  const missionStore = useMissionStore()
  const { mountLayer } = useCustomTileProviderLayer()
  let currentBaseLayerId: string | undefined
  let currentCustomLayer: MountedCustomTileProviderLayer | undefined
  let currentBaseLayerSignature: string | undefined
  let disposed = false
  // Held from creation, while `map` is only published once the style has loaded.
  let mapInstance: CockpitMap | undefined
  const { observe: observeMapResize, stop: stopObservingMapResize } = useMapAutoResize(() => recenter())

  const clearBaseLayer = (): void => {
    currentCustomLayer?.close()
    currentCustomLayer = undefined
    if (map.value && currentBaseLayerId) map.value.setImageryVisible(currentBaseLayerId, false)
    currentBaseLayerId = undefined
  }

  // A custom provider's layer is built from its metadata, so the signature (rather than the plain selection)
  // is what tells us to rebuild it after an edit. Built-in layers are prebuilt, so their name is enough.
  const applyTileProvider = (): void => {
    if (!map.value) return
    const selection = options.tileProvider()
    const builtIn = tileLayers.baseMaps[selection as MapTileProvider]
    const custom = builtIn ? undefined : missionStore.customTileProviders.find((entry) => entry.id === selection)
    const signature = custom ? customTileProviderSignature(custom) : selection
    if (signature === currentBaseLayerSignature) return

    clearBaseLayer()
    if (custom) {
      currentCustomLayer = mountLayer(map.value, custom, { slot: 'base', visible: true })
      currentBaseLayerId = currentCustomLayer.id
    } else {
      // The MiniMap draws no noise background under failed tiles, unlike the larger maps.
      currentBaseLayerId = addRasterLayer(map.value, builtIn ?? tileLayers.esri, { slot: 'base', visible: true })
      map.value.setImageryVisible(currentBaseLayerId, true)
    }
    currentBaseLayerSignature = signature
  }

  // Applied to the instance from creation, so the map never shows as a square before its style loads.
  const applyFadeMask = (): void => {
    const container = mapInstance?.getContainer()
    if (!container) return
    const mask = buildRadialFadeMask(options.edgeFadeAmount())
    container.style.setProperty('-webkit-mask-image', mask)
    container.style.setProperty('mask-image', mask)
  }

  const recenter = (): void => {
    const position = options.vehiclePosition()
    if (!map.value || !position) return
    map.value.jumpTo(position)
  }

  // Working zoom set aside while the overview level is forced, so reconnecting restores it.
  const zoomBeforeOverview = ref<number | undefined>(undefined)

  // While the overview is forced the live zoom is that override, so the level the operator actually chose is
  // the one set aside. Consumers persist this rather than `zoom`, which would store the override.
  const operatorZoom = computed(() => zoomBeforeOverview.value ?? zoom.value)

  // Refresh tiles and settle on a tile-loaded view when the vehicle is offline: keep the working zoom at
  // the last fix, but pull back to an overview level when there is no fix, since high zoom over null-island
  // has no imagery and would otherwise leave the dimmed disc blank gray.
  const applyOfflineView = (): void => {
    if (!map.value) return
    map.value.resize()
    if (options.vehiclePosition()) return
    zoomBeforeOverview.value ??= map.value.getZoom()
    map.value.jumpTo(map.value.getCenter(), offlineOverviewZoom)
  }

  // Heading-up: negate the heading so the vehicle's travel direction ends up pointing to the widget top.
  const targetBearing = (): number => (options.headingUp() ? -options.vehicleHeading() : 0)

  let bearingRaf: number | undefined
  let animatingBearing = false

  // `bearing` is the clockwise turn applied to the map content, so the map's own bearing (the compass direction at
  // the top of the view) is its opposite.
  const setBearing = (theta: number): void => {
    bearing.value = theta
    map.value?.setBearing(-theta)
  }

  const applyBearing = (): void => setBearing(targetBearing())

  const easeInOutQuad = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

  // Tween the map to a target bearing, rotating the short way around the 360° wrap. Used for the manual
  // heading-up toggle; a re-toggle mid-flight cancels the in-flight frame and restarts from the live bearing.
  const animateBearing = (to: number, duration = 400): void => {
    if (!map.value) return
    if (bearingRaf) cancelAnimationFrame(bearingRaf)

    const from = bearing.value
    const delta = ((to - from + 540) % 360) - 180
    if (Math.abs(delta) < 0.5) {
      applyBearing()
      return
    }

    const start = performance.now()
    animatingBearing = true
    const step = (now: number): void => {
      const progress = Math.min((now - start) / duration, 1)
      setBearing(from + delta * easeInOutQuad(progress))
      if (progress < 1) {
        bearingRaf = requestAnimationFrame(step)
      } else {
        bearingRaf = undefined
        animatingBearing = false
      }
    }
    bearingRaf = requestAnimationFrame(step)
  }

  // Telemetry heading updates follow instantly, but stay out of the way while a toggle tween is running so
  // the animation isn't fought frame by frame; live following resumes once it settles.
  const followBearing = (): void => {
    if (animatingBearing) return
    applyBearing()
  }

  // Throttle the view/follow updates so telemetry at message rate does not repaint every frame.
  const throttledRecenter = useThrottleFn(recenter, 16)
  const throttledFollow = useThrottleFn(followBearing, 16)

  const init = (element: HTMLElement): void => {
    if (mapInstance || disposed) return

    const initialCenter = options.vehiclePosition() ?? ([0, 0] as WaypointCoordinates)
    const instance = createMap(element, { center: initialCenter, zoom: options.defaultZoom(), rotatable: true })
    // Zooming to the center is what an always-centered map wants, and box zoom and the arrow keys have no meaning
    // on a map that cannot be panned.
    instance.dragPan.disable()
    instance.boxZoom.disable()
    instance.keyboard.disable()
    applyFollowZoomMode(instance, true)

    instance.once('load', () => {
      if (disposed) return
      map.value = instance
      mapReady.value = true

      applyTileProvider()

      zoom.value = instance.getZoom()
      instance.on('zoomend', () => {
        zoom.value = instance.getZoom()
      })

      applyFadeMask()
      applyBearing()

      if (!options.vehicleOnline()) applyOfflineView()
    })
    mapInstance = instance
    applyFadeMask()

    // Widgets resize by viewport fraction without firing a window resize, so observe the element and let
    // the map recompute its size (and recenter) whenever the container changes.
    observeMapResize(instance)
  }

  const destroy = (): void => {
    disposed = true
    if (bearingRaf) cancelAnimationFrame(bearingRaf)
    bearingRaf = undefined
    stopObservingMapResize()
    currentCustomLayer?.close()
    currentCustomLayer = undefined
    currentBaseLayerId = undefined
    currentBaseLayerSignature = undefined
    mapReady.value = false
    map.value = undefined
    mapInstance?.remove()
    mapInstance = undefined
  }

  watch(() => options.vehiclePosition(), throttledRecenter)
  watch(() => options.vehicleHeading(), throttledFollow)
  watch(
    () => options.headingUp(),
    () => animateBearing(targetBearing())
  )
  watch(() => options.edgeFadeAmount(), applyFadeMask)
  watch(() => options.tileProvider(), applyTileProvider)
  // Editing or deleting the selected custom provider in Settings > Sources has to reach the layer too. The
  // provider list is written on commit for text edits and live while a display slider is dragged, and
  // unchanged metadata is a no-op here.
  watch(() => missionStore.customTileProviders, applyTileProvider, { deep: true })
  watch(
    () => options.vehicleOnline(),
    (online) => {
      if (online) {
        if (zoomBeforeOverview.value !== undefined && map.value) {
          map.value.jumpTo(map.value.getCenter(), zoomBeforeOverview.value)
        }
        zoomBeforeOverview.value = undefined
      } else {
        applyOfflineView()
      }
    }
  )

  onBeforeUnmount(destroy)

  return { map, mapReady, zoom, operatorZoom, init, destroy }
}
