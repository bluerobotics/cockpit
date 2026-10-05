import { useDebounceFn } from '@vueuse/core'
import { onBeforeUnmount, watch } from 'vue'

import { useMapContext } from '@/composables/map/useMapContext'
import { useGeoFenceEditorDraft } from '@/composables/useGeoFenceEditorDraft'
import type { CockpitMap, MapPointerEvent } from '@/libs/map/cesium-map'
import { type MapMarker, type MarkerTooltip, bindTooltip, divIconMarker, setDivIcon } from '@/libs/map/cesium-marker'
import {
  type FillStyle,
  type LineStyle,
  type VectorFeature,
  lineFeature,
  meterCircleRing,
  polygonFeature,
} from '@/libs/map/cesium-vectors'
import { type FenceHandleStyle, asFenceMarker, fenceHandleMarker, fenceLayerId } from '@/libs/map/fence-layers'
import { distanceInMeters } from '@/libs/map/utils-map'
import { centroidLatLng } from '@/libs/mission/general-estimates'
import { useGeoFenceStore } from '@/stores/geoFence'
import type { BreachReturnPoint, FenceCircle, FenceLatLng, FencePolygon, GeoFencePlan } from '@/types/geofence'

/**
 * Props consumed by {@link useFenceRendering}. Mirrors the host
 * `GeoFenceMapLayer` component's props so its reactive proxy can be passed
 * through untouched, keeping the reads reactive.
 */
export interface FenceRenderingProps {
  /**
   * When true, fences are rendered without drag/edit affordances (the
   * read-only live overlay on the flight Map widget).
   */
  readonly: boolean
  /**
   * Optional plan to render. When omitted (interactive mode), the renderer
   * subscribes to the live `useGeoFenceStore` editor state instead.
   */
  plan?: GeoFencePlan
}

let rendererInstanceCount = 0

/**
 * Owns the imperative map rendering of the geofence overlay — polygons,
 * circles, drag/vertex handles, the breach-return marker and the live radius
 * measure — so the map library stays out of the `.vue` component and the map
 * solution remains swappable. Reads the reactive `props`, the injected map
 * context and the fence store/draft, and tears every layer down on unmount.
 * @param {FenceRenderingProps} props Reactive props proxy from the host component.
 * @returns {void}
 */
export const useFenceRendering = (props: FenceRenderingProps): void => {
  const fenceStore = useGeoFenceStore()
  const fenceDraft = useGeoFenceEditorDraft()
  const { map, mapReady } = useMapContext()

  const INCLUSION_BORDER = '#3B78A8'
  const INCLUSION_FILL_COLOR = '#3B78A8'
  const INCLUSION_FILL_OPACITY = 0.2
  const EXCLUSION_BORDER = '#FF8800'
  const EXCLUSION_FILL_COLOR = '#FF8800'
  const EXCLUSION_FILL_OPACITY = 1
  const EXCLUSION_STRIPE_OPACITY = 0.32
  const VERTEX_COLOR = '#FFFFFF'
  const VERTEX_BORDER = '#FF8800'

  // Read-only renders (e.g. the live overlay on the flight Map widget) get every
  // fence-related opacity halved so the fences sit further into the background
  // while staying clearly differentiated as inclusion/exclusion.
  const READONLY_OPACITY_FACTOR = 0.5

  // Each renderer owns its layers, so two Map widgets on a view never draw into each other's.
  const instanceToken = ++rendererInstanceCount
  const inclusionLayerId = fenceLayerId(`inclusion-${instanceToken}`)
  const exclusionLayerId = fenceLayerId(`exclusion-${instanceToken}`)
  const radiusLineId = fenceLayerId(`radius-line-${instanceToken}`)
  const shapeLayerIds = [inclusionLayerId, exclusionLayerId]

  const polygonVertexMarkers = new Map<string, MapMarker[]>()
  const polygonMidpointMarkers = new Map<string, MapMarker[]>()
  const polygonCenterMarkers = new Map<string, MapMarker>()
  const circleCenterMarkers = new Map<string, MapMarker>()
  const circleEdgeMarkers = new Map<string, MapMarker>()
  let breachReturnMarker: MapMarker | null = null
  let breachReturnTooltip: MarkerTooltip | null = null
  let layersMap: CockpitMap | undefined
  // Whether the shape click and hover handlers are on, which they are only while editing.
  let shapeHandlersOn = false

  const dim = (): number => (props.readonly ? READONLY_OPACITY_FACTOR : 1)

  const vertexHandleStyle = (radius: number): FenceHandleStyle => ({
    radius,
    color: VERTEX_BORDER,
    fillColor: VERTEX_COLOR,
    fillOpacity: 1,
    weight: 2,
    opacity: 1,
    className: 'fence-drag-handle',
  })

  const midpointHandleStyle = (): FenceHandleStyle => ({
    radius: 4,
    color: VERTEX_BORDER,
    fillColor: VERTEX_COLOR,
    fillOpacity: 0.6,
    weight: 1,
    opacity: 0.6,
    className: 'fence-add-handle',
  })

  const midpointBetween = (a: FenceLatLng, b: FenceLatLng): FenceLatLng => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]

  const formatRadiusShort = (meters: number): string => {
    if (!isFinite(meters) || meters <= 0) return '—'
    if (meters < 1000) return `${meters.toFixed(0)} m`
    return `${(meters / 1000).toFixed(2)} km`
  }

  // Inclusions and exclusions are two layers, the exclusions drawn above: an inclusion fence can never cut into an
  // exclusion one, whatever order the two were created in. Both are rebuilt with the current read-only dimming.
  const drawShapes = (targetMap: CockpitMap, polygons: FencePolygon[], circles: FenceCircle[]): void => {
    const shapes = (inclusion: boolean): VectorFeature[] => {
      const fill: FillStyle = inclusion
        ? { color: INCLUSION_FILL_COLOR, opacity: INCLUSION_FILL_OPACITY * dim() }
        : {
            stripes: { color: EXCLUSION_FILL_COLOR, opacity: EXCLUSION_STRIPE_OPACITY * dim(), spacing: 12 },
            opacity: EXCLUSION_FILL_OPACITY * dim(),
          }
      const border: LineStyle = inclusion
        ? { color: INCLUSION_BORDER, width: 2, opacity: dim() }
        : { color: EXCLUSION_BORDER, width: 2, opacity: 0.6 * dim() }
      return [
        ...polygons.filter((polygon) => polygon.inclusion === inclusion).map((p) => ({ id: p.id, ring: p.vertices })),
        ...circles
          .filter((circle) => circle.inclusion === inclusion)
          .map((circle) => ({ id: circle.id, ring: meterCircleRing(circle.center, circle.radius) })),
      ].flatMap(({ id, ring }) => [polygonFeature(ring, fill, { id }), lineFeature([...ring, ring[0]], border, { id })])
    }
    targetMap.setVectors(inclusionLayerId, 'fence', shapes(true))
    targetMap.setVectors(exclusionLayerId, 'fence', shapes(false))
  }

  // Shapes answer clicks and hovers only while being edited.
  const setShapeHandlers = (targetMap: CockpitMap, on: boolean): void => {
    shapeHandlersOn = on
    if (on) {
      targetMap.onLayer('click', shapeLayerIds, onShapeClick)
      targetMap.onLayer('mouseenter', shapeLayerIds, onShapeEnter)
      targetMap.onLayer('mouseleave', shapeLayerIds, onShapeLeave)
      return
    }
    targetMap.offLayer('click', shapeLayerIds, onShapeClick)
    targetMap.offLayer('mouseenter', shapeLayerIds, onShapeEnter)
    targetMap.offLayer('mouseleave', shapeLayerIds, onShapeLeave)
  }

  // Selecting a shape claims the click, so the planning view does not also treat it as a click on the map.
  const onShapeClick = (event: MapPointerEvent): void => {
    const id = event.feature?.properties.id
    if (typeof id !== 'string') return
    event.preventDefault()
    fenceDraft.setInteractive(id)
  }
  const onShapeEnter = (): void => {
    if (map.value) map.value.getCanvasContainer().style.cursor = 'pointer'
  }
  const onShapeLeave = (): void => {
    if (map.value) map.value.getCanvasContainer().style.cursor = ''
  }

  let radiusPillMarker: MapMarker | null = null

  const showRadiusMeasure = (center: FenceLatLng, cursor: FenceLatLng, radius: number): void => {
    if (!map.value) return

    map.value.setVectors(radiusLineId, 'fence', [
      lineFeature([center, cursor], { color: '#2563eb', width: 2, opacity: 0.9, dashPattern: [10, 10] }),
    ])

    const midpoint: FenceLatLng = [(center[0] + cursor[0]) / 2, (center[1] + cursor[1]) / 2]
    const html = `<div class="live-measure-pill">${formatRadiusShort(radius)}</div>`
    if (radiusPillMarker) {
      radiusPillMarker.setLatLng(midpoint)
      setDivIcon(radiusPillMarker, { html, size: [0, 0], anchor: [0, 0] })
    } else {
      radiusPillMarker = asFenceMarker(
        divIconMarker({ html, className: 'live-measure-tag', size: [0, 0], anchor: [0, 0] })
      )
      radiusPillMarker.getElement().style.pointerEvents = 'none'
      radiusPillMarker.setLatLng(midpoint).addTo(map.value)
    }
  }

  const hideRadiusMeasure = (): void => {
    radiusPillMarker?.remove()
    radiusPillMarker = null
    layersMap?.removeVectors(radiusLineId)
  }

  const removePolygonHandles = (id: string): void => {
    polygonVertexMarkers.get(id)?.forEach((m) => m.remove())
    polygonMidpointMarkers.get(id)?.forEach((m) => m.remove())
    polygonCenterMarkers.get(id)?.remove()
    polygonVertexMarkers.delete(id)
    polygonMidpointMarkers.delete(id)
    polygonCenterMarkers.delete(id)
  }

  const removeCircleHandles = (id: string): void => {
    circleCenterMarkers.get(id)?.remove()
    circleCenterMarkers.delete(id)
    circleEdgeMarkers.get(id)?.remove()
    circleEdgeMarkers.delete(id)
  }

  const removeBreachReturnMarker = (): void => {
    breachReturnTooltip?.remove()
    breachReturnTooltip = null
    breachReturnMarker?.remove()
    breachReturnMarker = null
  }

  const clearAllLayers = (): void => {
    Array.from(polygonVertexMarkers.keys()).forEach(removePolygonHandles)
    Array.from(polygonCenterMarkers.keys()).forEach(removePolygonHandles)
    Array.from(circleCenterMarkers.keys()).forEach(removeCircleHandles)
    removeBreachReturnMarker()
    hideRadiusMeasure()
    if (layersMap && shapeHandlersOn) setShapeHandlers(layersMap, false)
    shapeLayerIds.forEach((id) => layersMap?.removeVectors(id))
    layersMap = undefined
  }

  const isInteractiveShape = (id: string): boolean => !props.readonly && fenceDraft.interactiveShapeId === id

  // A handle drag holds the map itself hostage: panning is disabled, and both the
  // map and the document outlive this overlay, so the release stays reachable for
  // the teardown below.
  let releaseActiveDrag: (() => void) | undefined

  /**
   * Starts a handle drag on the map: disables panning, routes pointer moves to
   * `onMove` until the pointer is released, and restores both on release.
   * @param { (latLng: FenceLatLng) => void } onMove Called with the pointer coordinate on every move while dragging.
   * @param { () => void } onRelease Optional extra cleanup once the drag ends.
   */
  const beginMapDrag = (onMove: (latLng: FenceLatLng) => void, onRelease?: () => void): void => {
    const targetMap = map.value
    if (!targetMap) return
    releaseActiveDrag?.()
    targetMap.dragPan.disable()
    const handleMove = (event: MapPointerEvent): void => onMove(event.latLng)
    const release = (): void => {
      targetMap.off('mousemove', handleMove)
      document.removeEventListener('mouseup', release)
      targetMap.dragPan.enable()
      releaseActiveDrag = undefined
      onRelease?.()
    }
    targetMap.on('mousemove', handleMove)
    // The release comes from the document rather than the map: a button released
    // outside the container never reaches the map, which would leave panning
    // disabled for good.
    document.addEventListener('mouseup', release)
    releaseActiveDrag = release
  }

  // Handles take the press themselves, so the map neither pans under it nor treats it as a click on the map.
  const onHandle = (
    marker: MapMarker,
    type: 'mousedown' | 'click' | 'contextmenu',
    handler: (e: MouseEvent) => void
  ): void =>
    marker.getElement().addEventListener(type, (event: MouseEvent) => {
      event.stopPropagation()
      handler(event)
    })

  const pointerLatLng = (event: MouseEvent): FenceLatLng | undefined =>
    map.value ? map.value.unproject(map.value.pointFromClient(event)) : undefined

  const buildVertexMarkers = (polygon: FencePolygon): void => {
    if (!map.value) return
    removePolygonHandles(polygon.id)

    if (!isInteractiveShape(polygon.id)) return

    const vertexMarkers: MapMarker[] = polygon.vertices.map((vertex, index) => {
      const marker = fenceHandleMarker(vertexHandleStyle(6)).setLatLng(vertex)
      marker.addTo(map.value as CockpitMap)

      onHandle(marker, 'mousedown', () => {
        beginMapDrag((latLng) => {
          const newVertices = polygon.vertices.map((v, i): FenceLatLng => (i === index ? latLng : v))
          fenceStore.updatePolygon(polygon.id, { vertices: newVertices })
        })
      })

      onHandle(marker, 'contextmenu', (event) => {
        event.preventDefault()
        if (polygon.vertices.length <= 3) return
        const newVertices = polygon.vertices.filter((_, i) => i !== index)
        fenceStore.updatePolygon(polygon.id, { vertices: newVertices })
      })

      return marker
    })
    polygonVertexMarkers.set(polygon.id, vertexMarkers)

    const midpointMarkers: MapMarker[] = []
    polygon.vertices.forEach((vertex, index) => {
      const next = polygon.vertices[(index + 1) % polygon.vertices.length]
      const mid = midpointBetween(vertex, next)
      const marker = fenceHandleMarker(midpointHandleStyle()).setLatLng(mid)
      marker.addTo(map.value as CockpitMap)
      // The new vertex lands on the handle, not under the pointer, as a click on a small marker always reported.
      onHandle(marker, 'click', () => {
        const insertAt = index + 1
        const newVertices: FenceLatLng[] = [
          ...polygon.vertices.slice(0, insertAt),
          mid,
          ...polygon.vertices.slice(insertAt),
        ]
        fenceStore.updatePolygon(polygon.id, { vertices: newVertices })
      })
      midpointMarkers.push(marker)
    })
    polygonMidpointMarkers.set(polygon.id, midpointMarkers)

    buildPolygonCenterHandle(polygon)
  }

  const buildPolygonCenterHandle = (polygon: FencePolygon): void => {
    if (!map.value) return
    if (polygon.vertices.length < 3) return

    const center = centroidLatLng(polygon.vertices)
    const html = `<div class="fence-center-handle"><span class="mdi mdi-cursor-move" /></div>`
    const marker = asFenceMarker(divIconMarker({ html, className: 'fence-center-handle-icon', size: [18, 18] }))
    marker.setLatLng(center).addTo(map.value)

    onHandle(marker, 'mousedown', (event) => {
      let lastLatLng = pointerLatLng(event)
      beginMapDrag((latLng) => {
        if (!lastLatLng) return
        const dLat = latLng[0] - lastLatLng[0]
        const dLng = latLng[1] - lastLatLng[1]
        lastLatLng = latLng
        const current = fenceStore.polygons.find((p) => p.id === polygon.id)
        if (!current) return
        const newVertices: FenceLatLng[] = current.vertices.map(([lat, lng]) => [lat + dLat, lng + dLng])
        fenceStore.updatePolygon(polygon.id, { vertices: newVertices })
      })
    })

    polygonCenterMarkers.set(polygon.id, marker)
  }

  // Where Leaflet put the radius handle: due east of the center, by the radius, on its bounds-based approximation.
  const circleEdgeLatLng = (circle: FenceCircle): FenceLatLng => {
    const latAccuracy = (180 * circle.radius * 2) / 40075017
    const lngAccuracy = latAccuracy / Math.cos((Math.PI / 180) * circle.center[0])
    return [circle.center[0], circle.center[1] + lngAccuracy]
  }

  const buildCircleHandles = (circle: FenceCircle): void => {
    if (!map.value) return
    removeCircleHandles(circle.id)

    if (!isInteractiveShape(circle.id)) return

    const centerMarker = fenceHandleMarker(vertexHandleStyle(6)).setLatLng(circle.center)
    centerMarker.addTo(map.value)
    onHandle(centerMarker, 'mousedown', () => {
      beginMapDrag((latLng) => {
        fenceStore.updateCircle(circle.id, { center: latLng })
      })
    })
    circleCenterMarkers.set(circle.id, centerMarker)

    const edgeMarker = fenceHandleMarker(vertexHandleStyle(5)).setLatLng(circleEdgeLatLng(circle))
    edgeMarker.addTo(map.value)
    onHandle(edgeMarker, 'mousedown', () => {
      beginMapDrag((latLng) => {
        const distance = distanceInMeters(circle.center, latLng)
        fenceStore.updateCircle(circle.id, { radius: distance })
        showRadiusMeasure(circle.center, latLng, distance)
      }, hideRadiusMeasure)
    })
    circleEdgeMarkers.set(circle.id, edgeMarker)
  }

  const renderBreachReturn = (point: BreachReturnPoint | undefined): void => {
    if (!map.value) return
    if (!point) {
      removeBreachReturnMarker()
      return
    }
    const html = `<div class="fence-breach-return">B</div>`
    const tooltipText = `Breach return — ${point.altitude.toFixed(1)} m`
    if (breachReturnMarker) {
      breachReturnMarker.setLatLng(point.coordinates)
      // Refresh the icon so any future visual changes (size, color, inner HTML)
      // surface on subsequent renders without needing to recreate the marker.
      setDivIcon(breachReturnMarker, { html, size: [22, 22] })
      breachReturnTooltip?.setContent(tooltipText)
      return
    }
    const marker = asFenceMarker(
      divIconMarker({ html, className: 'fence-breach-return-icon', size: [22, 22], draggable: !props.readonly })
    )
    marker.setLatLng(point.coordinates).addTo(map.value)
    if (!props.readonly) {
      // Read latitude/altitude from the store (source of truth) instead of
      // the captured `point` so altitude edits made after the marker is
      // created don't get overwritten by the next drag.
      marker.on('dragend', () => {
        const currentAltitude = fenceStore.breachReturn?.altitude ?? point.altitude
        fenceStore.setBreachReturn({ coordinates: marker.getLatLng(), altitude: currentAltitude })
      })
    }
    breachReturnTooltip = bindTooltip(map.value, marker, tooltipText, { direction: 'top', offset: [0, -10] })
    breachReturnMarker = marker
  }

  const sourcePolygons = (): FencePolygon[] => (props.plan ? props.plan.polygons : fenceStore.polygons)
  const sourceCircles = (): FenceCircle[] => (props.plan ? props.plan.circles : fenceStore.circles)
  const sourceBreach = (): BreachReturnPoint | undefined =>
    props.plan ? props.plan.breachReturn : fenceStore.breachReturn

  let disposed = false

  const syncLayers = (): void => {
    if (disposed || !map.value) return
    // A replaced map starts from nothing, and the old one's layers went with it.
    if (layersMap && layersMap !== map.value) clearAllLayers()
    layersMap = map.value
    if (shapeHandlersOn === props.readonly) setShapeHandlers(map.value, !props.readonly)

    const polys = sourcePolygons()
    const circs = sourceCircles()
    drawShapes(map.value, polys, circs)

    const polyIds = new Set(polys.map((p) => p.id))
    Array.from(new Set([...polygonVertexMarkers.keys(), ...polygonCenterMarkers.keys()])).forEach((id) => {
      if (!polyIds.has(id)) removePolygonHandles(id)
    })
    polys.forEach(buildVertexMarkers)

    const circleIds = new Set(circs.map((c) => c.id))
    Array.from(circleCenterMarkers.keys()).forEach((id) => {
      if (!circleIds.has(id)) removeCircleHandles(id)
    })
    circs.forEach(buildCircleHandles)

    renderBreachReturn(sourceBreach())
  }

  // Coalesce change-driven sync into one frame so vertex drags don't rebuild
  // every handle per `mousemove`. The initial sync below stays
  // synchronous so the overlay paints on the same tick the map becomes ready.
  const debouncedSyncLayers = useDebounceFn(syncLayers, 16)

  watch(
    mapReady,
    (ready) => {
      if (ready) syncLayers()
    },
    { immediate: true }
  )

  // Deep-watching the raw store/prop sources lets Vue's reactivity track every
  // nested change without reallocating a normalized snapshot on each tick;
  // drag-driven mutations no longer build per-vertex strings just to detect that
  // "something changed".
  watch(
    () => [sourcePolygons(), sourceCircles(), sourceBreach(), fenceDraft.interactiveShapeId, props.readonly],
    () => debouncedSyncLayers(),
    { deep: true }
  )

  // The map outlives this overlay, so everything installed on it has to
  // come back off: a debounced sync already scheduled would otherwise re-add
  // layers nothing can remove, and an unmount mid-drag would leave the map
  // unpannable.
  onBeforeUnmount(() => {
    disposed = true
    releaseActiveDrag?.()
    clearAllLayers()
  })
}
