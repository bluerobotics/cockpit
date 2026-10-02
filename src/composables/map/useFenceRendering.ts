import { useDebounceFn } from '@vueuse/core'
import type { Feature, Polygon } from 'geojson'
import type { Map as MapLibreMap, MapLayerMouseEvent, MapMouseEvent, Marker } from 'maplibre-gl'
import { onBeforeUnmount, watch } from 'vue'

import { useMapContext } from '@/composables/map/useMapContext'
import { useGeoFenceEditorDraft } from '@/composables/useGeoFenceEditorDraft'
import {
  type FenceHandleStyle,
  asFenceMarker,
  ensureStripePattern,
  fenceHandleMarker,
  fenceLayerId,
} from '@/libs/map/fence-layers'
import {
  type MarkerTooltip,
  beforeIdForSlot,
  bindTooltip,
  containerPointFromClient,
  divIconMarker,
  eventLatLng,
  fromLngLat,
  lineFeature,
  linePaint,
  meterCircle,
  polygonFeature,
  removeLayersAndSource,
  setDivIcon,
  setLineLayer,
  toLngLat,
  unprojectFromContainer,
  upsertGeoJsonSource,
} from '@/libs/map/maplibre'
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
  const shapesSourceId = fenceLayerId(`shapes-${instanceToken}`)
  const inclusionFillId = fenceLayerId(`inclusion-fill-${instanceToken}`)
  const inclusionLineId = fenceLayerId(`inclusion-line-${instanceToken}`)
  const exclusionFillId = fenceLayerId(`exclusion-fill-${instanceToken}`)
  const exclusionLineId = fenceLayerId(`exclusion-line-${instanceToken}`)
  const radiusLineId = fenceLayerId(`radius-line-${instanceToken}`)
  const shapeLayerIds = [inclusionFillId, inclusionLineId, exclusionFillId, exclusionLineId]
  const fillLayerIds = [inclusionFillId, exclusionFillId]

  const polygonVertexMarkers = new Map<string, Marker[]>()
  const polygonMidpointMarkers = new Map<string, Marker[]>()
  const polygonCenterMarkers = new Map<string, Marker>()
  const circleCenterMarkers = new Map<string, Marker>()
  const circleEdgeMarkers = new Map<string, Marker>()
  let breachReturnMarker: Marker | null = null
  let breachReturnTooltip: MarkerTooltip | null = null
  let layersMap: MapLibreMap | undefined
  // The read-only look the layers were last drawn with, which also says whether the shape handlers are on.
  let drawnReadonly: boolean | undefined

  const dim = (): number => (props.readonly ? READONLY_OPACITY_FACTOR : 1)
  const stripePatternName = (): string => `cockpit-fence-exclusion-stripes${props.readonly ? '-dim' : ''}`

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

  // Draws the inclusion and exclusion layers once per map. Exclusions sit above inclusions: an inclusion fence can
  // never cut into an exclusion one, whatever order the two were created in.
  const ensureShapeLayers = (targetMap: MapLibreMap): void => {
    if (targetMap.getLayer(inclusionFillId)) return
    upsertGeoJsonSource(targetMap, shapesSourceId, { type: 'FeatureCollection', features: [] })
    ensureStripePattern(targetMap, stripePatternName(), EXCLUSION_FILL_COLOR, EXCLUSION_STRIPE_OPACITY * dim())
    const beforeId = beforeIdForSlot(targetMap, 'fence')
    const inclusion = ['==', ['get', 'inclusion'], true]
    const exclusion = ['==', ['get', 'inclusion'], false]
    const lineLayout = { 'line-cap': 'round', 'line-join': 'round' } as const
    targetMap.addLayer(
      {
        id: inclusionFillId,
        type: 'fill',
        source: shapesSourceId,
        filter: inclusion as never,
        paint: { 'fill-color': INCLUSION_FILL_COLOR, 'fill-opacity': INCLUSION_FILL_OPACITY * dim() },
      },
      beforeId
    )
    targetMap.addLayer(
      {
        id: inclusionLineId,
        type: 'line',
        source: shapesSourceId,
        filter: inclusion as never,
        layout: lineLayout,
        paint: linePaint({ color: INCLUSION_BORDER, width: 2, opacity: dim() }) as never,
      },
      beforeId
    )
    targetMap.addLayer(
      {
        id: exclusionFillId,
        type: 'fill',
        source: shapesSourceId,
        filter: exclusion as never,
        paint: { 'fill-pattern': stripePatternName(), 'fill-opacity': EXCLUSION_FILL_OPACITY * dim() },
      },
      beforeId
    )
    targetMap.addLayer(
      {
        id: exclusionLineId,
        type: 'line',
        source: shapesSourceId,
        filter: exclusion as never,
        layout: lineLayout,
        paint: linePaint({ color: EXCLUSION_BORDER, width: 2, opacity: 0.6 * dim() }) as never,
      },
      beforeId
    )
    drawnReadonly = props.readonly
    if (!drawnReadonly) setShapeHandlers(targetMap, true)
  }

  const setShapeHandlers = (targetMap: MapLibreMap, on: boolean): void => {
    if (on) {
      targetMap.on('click', fillLayerIds, onShapeClick)
      targetMap.on('mouseenter', fillLayerIds, onShapeEnter)
      targetMap.on('mouseleave', fillLayerIds, onShapeLeave)
      return
    }
    targetMap.off('click', fillLayerIds, onShapeClick)
    targetMap.off('mouseenter', fillLayerIds, onShapeEnter)
    targetMap.off('mouseleave', fillLayerIds, onShapeLeave)
  }

  // The layers outlive a switch between read-only and editing, so the switch restyles them in place.
  const syncReadonlyLook = (targetMap: MapLibreMap): void => {
    if (drawnReadonly === props.readonly) return
    ensureStripePattern(targetMap, stripePatternName(), EXCLUSION_FILL_COLOR, EXCLUSION_STRIPE_OPACITY * dim())
    targetMap.setPaintProperty(inclusionFillId, 'fill-opacity', INCLUSION_FILL_OPACITY * dim())
    targetMap.setPaintProperty(inclusionLineId, 'line-opacity', dim())
    targetMap.setPaintProperty(exclusionFillId, 'fill-pattern', stripePatternName())
    targetMap.setPaintProperty(exclusionFillId, 'fill-opacity', EXCLUSION_FILL_OPACITY * dim())
    targetMap.setPaintProperty(exclusionLineId, 'line-opacity', 0.6 * dim())
    setShapeHandlers(targetMap, !props.readonly)
    drawnReadonly = props.readonly
  }

  // Selecting a shape claims the click, so the planning view does not also treat it as a click on the map.
  const onShapeClick = (event: MapLayerMouseEvent): void => {
    const id = event.features?.[0]?.properties?.id
    if (typeof id !== 'string') return
    event.preventDefault()
    fenceDraft.setInteractive(id)
  }
  const onShapeEnter = (): void => {
    if (map.value) map.value.getCanvas().style.cursor = 'pointer'
  }
  const onShapeLeave = (): void => {
    if (map.value) map.value.getCanvas().style.cursor = ''
  }

  let radiusPillMarker: Marker | null = null

  const showRadiusMeasure = (center: FenceLatLng, cursor: FenceLatLng, radius: number): void => {
    if (!map.value) return

    setLineLayer(map.value, radiusLineId, 'fence', lineFeature([center, cursor]), {
      color: '#2563eb',
      width: 2,
      opacity: 0.9,
      dashPattern: [10, 10],
    })

    const midpoint: FenceLatLng = [(center[0] + cursor[0]) / 2, (center[1] + cursor[1]) / 2]
    const html = `<div class="live-measure-pill">${formatRadiusShort(radius)}</div>`
    if (radiusPillMarker) {
      radiusPillMarker.setLngLat(toLngLat(midpoint))
      setDivIcon(radiusPillMarker, { html, size: [0, 0], anchor: [0, 0] })
    } else {
      radiusPillMarker = asFenceMarker(
        divIconMarker({ html, className: 'live-measure-tag', size: [0, 0], anchor: [0, 0] })
      )
      radiusPillMarker.getElement().style.pointerEvents = 'none'
      radiusPillMarker.setLngLat(toLngLat(midpoint)).addTo(map.value)
    }
  }

  const hideRadiusMeasure = (): void => {
    radiusPillMarker?.remove()
    radiusPillMarker = null
    removeLayersAndSource(layersMap, [radiusLineId], radiusLineId)
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
    if (layersMap && drawnReadonly === false) setShapeHandlers(layersMap, false)
    removeLayersAndSource(layersMap, shapeLayerIds, shapesSourceId)
    layersMap = undefined
    drawnReadonly = undefined
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
    const handleMove = (event: MapMouseEvent): void => onMove(eventLatLng(event))
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
    marker: Marker,
    type: 'mousedown' | 'click' | 'contextmenu',
    handler: (e: MouseEvent) => void
  ): void =>
    marker.getElement().addEventListener(type, (event: MouseEvent) => {
      event.stopPropagation()
      handler(event)
    })

  const pointerLatLng = (event: MouseEvent): FenceLatLng | undefined =>
    map.value ? unprojectFromContainer(map.value, containerPointFromClient(map.value, event)) : undefined

  const buildVertexMarkers = (polygon: FencePolygon): void => {
    if (!map.value) return
    removePolygonHandles(polygon.id)

    if (!isInteractiveShape(polygon.id)) return

    const vertexMarkers: Marker[] = polygon.vertices.map((vertex, index) => {
      const marker = fenceHandleMarker(vertexHandleStyle(6)).setLngLat(toLngLat(vertex))
      marker.addTo(map.value as MapLibreMap)

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

    const midpointMarkers: Marker[] = []
    polygon.vertices.forEach((vertex, index) => {
      const next = polygon.vertices[(index + 1) % polygon.vertices.length]
      const mid = midpointBetween(vertex, next)
      const marker = fenceHandleMarker(midpointHandleStyle()).setLngLat(toLngLat(mid))
      marker.addTo(map.value as MapLibreMap)
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
    marker.setLngLat(toLngLat(center)).addTo(map.value)

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

    const centerMarker = fenceHandleMarker(vertexHandleStyle(6)).setLngLat(toLngLat(circle.center))
    centerMarker.addTo(map.value)
    onHandle(centerMarker, 'mousedown', () => {
      beginMapDrag((latLng) => {
        fenceStore.updateCircle(circle.id, { center: latLng })
      })
    })
    circleCenterMarkers.set(circle.id, centerMarker)

    const edgeMarker = fenceHandleMarker(vertexHandleStyle(5)).setLngLat(toLngLat(circleEdgeLatLng(circle)))
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

  const shapeFeatures = (polygons: FencePolygon[], circles: FenceCircle[]): Feature<Polygon>[] => [
    ...polygons.map((polygon) => polygonFeature(polygon.vertices, { id: polygon.id, inclusion: polygon.inclusion })),
    ...circles.map((circle) =>
      meterCircle(circle.center, circle.radius, { id: circle.id, inclusion: circle.inclusion })
    ),
  ]

  const renderBreachReturn = (point: BreachReturnPoint | undefined): void => {
    if (!map.value) return
    if (!point) {
      removeBreachReturnMarker()
      return
    }
    const html = `<div class="fence-breach-return">B</div>`
    const tooltipText = `Breach return — ${point.altitude.toFixed(1)} m`
    if (breachReturnMarker) {
      breachReturnMarker.setLngLat(toLngLat(point.coordinates))
      // Refresh the icon so any future visual changes (size, color, inner HTML)
      // surface on subsequent renders without needing to recreate the marker.
      setDivIcon(breachReturnMarker, { html, size: [22, 22] })
      breachReturnTooltip?.setContent(tooltipText)
      return
    }
    const marker = asFenceMarker(
      divIconMarker({ html, className: 'fence-breach-return-icon', size: [22, 22], draggable: !props.readonly })
    )
    marker.setLngLat(toLngLat(point.coordinates)).addTo(map.value)
    if (!props.readonly) {
      // Read latitude/altitude from the store (source of truth) instead of
      // the captured `point` so altitude edits made after the marker is
      // created don't get overwritten by the next drag.
      marker.on('dragend', () => {
        const currentAltitude = fenceStore.breachReturn?.altitude ?? point.altitude
        fenceStore.setBreachReturn({ coordinates: fromLngLat(marker.getLngLat()), altitude: currentAltitude })
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
    ensureShapeLayers(map.value)
    syncReadonlyLook(map.value)

    const polys = sourcePolygons()
    const circs = sourceCircles()
    upsertGeoJsonSource(map.value, shapesSourceId, { type: 'FeatureCollection', features: shapeFeatures(polys, circs) })

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
