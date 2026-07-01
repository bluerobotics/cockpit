<template>
  <div class="hidden" />
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import L from 'leaflet'
import { onBeforeUnmount, watch } from 'vue'

import { useMapContext } from '@/composables/map/useMapContext'
import { useGeoFenceStore } from '@/stores/geoFence'
import type { BreachReturnPoint, FenceCircle, FenceLatLng, FencePolygon, GeoFencePlan } from '@/types/geofence'

// eslint-disable-next-line jsdoc/require-jsdoc
const props = withDefaults(
  defineProps<{
    /**
     * When true, fences are rendered without drag/edit affordances.
     * Used by the live overlay on the flight Map widget.
     */
    readonly?: boolean
    /**
     * Optional plan to render. When omitted (interactive mode), the layer
     * subscribes to the live `useGeoFenceStore` editor state instead.
     */
    plan?: GeoFencePlan
  }>(),
  { readonly: false, plan: undefined }
)

const fenceStore = useGeoFenceStore()
const { map, mapReady } = useMapContext()

const INCLUSION_BORDER = '#3B78A8'
const INCLUSION_FILL_COLOR = '#3B78A8'
const INCLUSION_FILL_OPACITY = 0.2
const EXCLUSION_BORDER = '#FF8800'
const EXCLUSION_FILL_COLOR = '#FF8800'
const EXCLUSION_FILL_OPACITY = 1
const EXCLUSION_PATTERN_ID = 'fence-exclusion-stripes'
const EXCLUSION_PATTERN_DIM_ID = 'fence-exclusion-stripes-dim'
const VERTEX_COLOR = '#FFFFFF'
const VERTEX_BORDER = '#FF8800'

// Read-only renders (e.g. the live overlay on the flight Map widget) get every
// fence-related opacity halved so the fences sit further into the background
// while staying clearly differentiated as inclusion/exclusion.
const READONLY_OPACITY_FACTOR = 0.5

const polygonLayers = new Map<string, L.Polygon>()
const polygonVertexMarkers = new Map<string, L.CircleMarker[]>()
const polygonMidpointMarkers = new Map<string, L.CircleMarker[]>()
const polygonCenterMarkers = new Map<string, L.Marker>()
const circleLayers = new Map<string, L.Circle>()
const circleCenterMarkers = new Map<string, L.CircleMarker>()
const circleEdgeMarkers = new Map<string, L.CircleMarker>()
let breachReturnMarker: L.Marker | null = null

const polygonStyle = (inclusion: boolean): L.PathOptions => {
  const dim = props.readonly ? READONLY_OPACITY_FACTOR : 1
  return {
    color: inclusion ? INCLUSION_BORDER : EXCLUSION_BORDER,
    weight: 2,
    opacity: (inclusion ? 1 : 0.6) * dim,
    fillColor: inclusion ? INCLUSION_FILL_COLOR : EXCLUSION_FILL_COLOR,
    fillOpacity: (inclusion ? INCLUSION_FILL_OPACITY : EXCLUSION_FILL_OPACITY) * dim,
  }
}

/**
 * Lazily injects a 45° striped orange / transparent SVG `<pattern>` into the
 * map's overlay SVG so exclusion fences can fill themselves with it. Leaflet
 * draws all vector layers under a single SVG renderer per map, so a single
 * pattern definition is enough for the whole layer.
 *
 * Two flavors are registered on demand: a "normal" pattern used by the
 * interactive editor, and a dimmed one (50% less opaque) used by the
 * read-only live overlay so map context stays readable underneath.
 * @param { L.Map } targetMap The Leaflet map to inject the pattern into.
 * @param { boolean } dim When true, registers / reuses the dimmed pattern.
 */
const ensureExclusionPattern = (targetMap: L.Map, dim: boolean): void => {
  const overlayPane = targetMap.getPanes().overlayPane
  const svg = overlayPane?.querySelector('svg') as SVGSVGElement | null
  if (!svg) return
  const id = dim ? EXCLUSION_PATTERN_DIM_ID : EXCLUSION_PATTERN_ID
  if (svg.querySelector(`#${id}`)) return

  const svgNs = 'http://www.w3.org/2000/svg'
  let defs = svg.querySelector('defs') as SVGDefsElement | null
  if (!defs) {
    defs = document.createElementNS(svgNs, 'defs')
    svg.insertBefore(defs, svg.firstChild)
  }

  const pattern = document.createElementNS(svgNs, 'pattern')
  pattern.setAttribute('id', id)
  pattern.setAttribute('patternUnits', 'userSpaceOnUse')
  pattern.setAttribute('width', '12')
  pattern.setAttribute('height', '12')
  pattern.setAttribute('patternTransform', 'rotate(45)')

  const stripe = document.createElementNS(svgNs, 'rect')
  stripe.setAttribute('x', '0')
  stripe.setAttribute('y', '0')
  stripe.setAttribute('width', '6')
  stripe.setAttribute('height', '12')
  stripe.setAttribute('fill', EXCLUSION_FILL_COLOR)
  stripe.setAttribute('fill-opacity', String(0.32 * (dim ? READONLY_OPACITY_FACTOR : 1)))
  pattern.appendChild(stripe)

  defs.appendChild(pattern)
}

/**
 * Applies the appropriate `fill` to the SVG path element of a fence layer.
 * Inclusion fences get the translucent blue color (already set via
 * `polygonStyle`); exclusion fences are repainted to reference the diagonal
 * stripe pattern, which Leaflet's `fillColor` can't express directly.
 * @param { L.Path } layer The Leaflet vector layer whose element should be styled.
 * @param { boolean } inclusion Whether the underlying fence is an inclusion fence.
 */
const applyFenceFill = (layer: L.Path, inclusion: boolean): void => {
  const el = layer.getElement() as SVGPathElement | null
  if (!el) return
  if (inclusion) {
    el.setAttribute('fill', INCLUSION_FILL_COLOR)
  } else if (map.value) {
    ensureExclusionPattern(map.value, props.readonly)
    const patternId = props.readonly ? EXCLUSION_PATTERN_DIM_ID : EXCLUSION_PATTERN_ID
    el.setAttribute('fill', `url(#${patternId})`)
  }
}

const vertexHandleStyle = (): L.PathOptions => ({
  color: VERTEX_BORDER,
  fillColor: VERTEX_COLOR,
  fillOpacity: 1,
  weight: 2,
  opacity: 1,
})

const midpointHandleStyle = (): L.PathOptions => ({
  color: VERTEX_BORDER,
  fillColor: VERTEX_COLOR,
  fillOpacity: 0.6,
  weight: 1,
  opacity: 0.6,
})

const midpointBetween = (a: FenceLatLng, b: FenceLatLng): FenceLatLng => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]

const formatRadiusShort = (meters: number): string => {
  if (!isFinite(meters) || meters <= 0) return '—'
  if (meters < 1000) return `${meters.toFixed(0)} m`
  return `${(meters / 1000).toFixed(2)} km`
}

let radiusPillMarker: L.Marker | null = null
let radiusLine: L.Polyline | null = null

const showRadiusMeasure = (center: L.LatLng, cursor: L.LatLng, radius: number): void => {
  if (!map.value) return

  const latlngs: L.LatLngTuple[] = [
    [center.lat, center.lng],
    [cursor.lat, cursor.lng],
  ]
  if (radiusLine) {
    radiusLine.setLatLngs(latlngs)
  } else {
    radiusLine = L.polyline(latlngs, {
      color: '#2563eb',
      weight: 2,
      opacity: 0.9,
      dashArray: '10, 10',
      interactive: false,
    }).addTo(map.value)
  }

  const midpoint = L.latLng((center.lat + cursor.lat) / 2, (center.lng + cursor.lng) / 2)
  const html = `<div class="live-measure-pill">${formatRadiusShort(radius)}</div>`
  const icon = L.divIcon({ html, className: 'live-measure-tag', iconSize: [0, 0], iconAnchor: [0, 0] })
  if (radiusPillMarker) {
    radiusPillMarker.setLatLng(midpoint)
    radiusPillMarker.setIcon(icon)
  } else {
    radiusPillMarker = L.marker(midpoint, { icon, interactive: false, keyboard: false }).addTo(map.value)
  }
}

const hideRadiusMeasure = (): void => {
  if (radiusPillMarker && map.value) map.value.removeLayer(radiusPillMarker)
  radiusPillMarker = null
  if (radiusLine && map.value) map.value.removeLayer(radiusLine)
  radiusLine = null
}

const removePolygonHandles = (id: string): void => {
  polygonVertexMarkers.get(id)?.forEach((m) => map.value?.removeLayer(m))
  polygonMidpointMarkers.get(id)?.forEach((m) => map.value?.removeLayer(m))
  const center = polygonCenterMarkers.get(id)
  if (center && map.value) map.value.removeLayer(center)
  polygonVertexMarkers.delete(id)
  polygonMidpointMarkers.delete(id)
  polygonCenterMarkers.delete(id)
}

const removePolygonLayer = (id: string): void => {
  const layer = polygonLayers.get(id)
  if (layer && map.value) map.value.removeLayer(layer)
  polygonLayers.delete(id)
  removePolygonHandles(id)
}

const removeCircleHandles = (id: string): void => {
  const center = circleCenterMarkers.get(id)
  if (center && map.value) map.value.removeLayer(center)
  circleCenterMarkers.delete(id)
  const edge = circleEdgeMarkers.get(id)
  if (edge && map.value) map.value.removeLayer(edge)
  circleEdgeMarkers.delete(id)
}

const removeCircleLayer = (id: string): void => {
  const layer = circleLayers.get(id)
  if (layer && map.value) map.value.removeLayer(layer)
  circleLayers.delete(id)
  removeCircleHandles(id)
}

const removeBreachReturnMarker = (): void => {
  if (breachReturnMarker && map.value) map.value.removeLayer(breachReturnMarker)
  breachReturnMarker = null
}

const clearAllLayers = (): void => {
  Array.from(polygonLayers.keys()).forEach(removePolygonLayer)
  Array.from(circleLayers.keys()).forEach(removeCircleLayer)
  removeBreachReturnMarker()
  hideRadiusMeasure()
}

const isInteractiveShape = (id: string): boolean => !props.readonly && fenceStore.interactiveShapeId === id

const buildVertexMarkers = (polygon: FencePolygon): void => {
  if (!map.value) return
  removePolygonHandles(polygon.id)

  if (!isInteractiveShape(polygon.id)) return

  const vertexMarkers: L.CircleMarker[] = polygon.vertices.map((vertex, index) => {
    const marker = L.circleMarker(vertex as L.LatLngTuple, {
      ...vertexHandleStyle(),
      radius: 6,
      pane: 'markerPane',
      className: 'fence-drag-handle',
    })
    marker.addTo(map.value as L.Map)
    let dragging = false

    marker.on('mousedown', () => {
      dragging = true
      map.value?.dragging.disable()
      const onMove = (event: L.LeafletMouseEvent): void => {
        if (!dragging) return
        const newVertices = polygon.vertices.map(
          (v, i): FenceLatLng => (i === index ? [event.latlng.lat, event.latlng.lng] : v)
        )
        fenceStore.updatePolygon(polygon.id, { vertices: newVertices })
      }
      const onUp = (): void => {
        dragging = false
        map.value?.off('mousemove', onMove)
        map.value?.off('mouseup', onUp)
        map.value?.dragging.enable()
      }
      map.value?.on('mousemove', onMove)
      map.value?.on('mouseup', onUp)
    })

    marker.on('contextmenu', (event: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(event)
      if (polygon.vertices.length <= 3) return
      const newVertices = polygon.vertices.filter((_, i) => i !== index)
      fenceStore.updatePolygon(polygon.id, { vertices: newVertices })
    })

    return marker
  })
  polygonVertexMarkers.set(polygon.id, vertexMarkers)

  const midpointMarkers: L.CircleMarker[] = []
  polygon.vertices.forEach((vertex, index) => {
    const next = polygon.vertices[(index + 1) % polygon.vertices.length]
    const mid = midpointBetween(vertex, next)
    const marker = L.circleMarker(mid as L.LatLngTuple, {
      ...midpointHandleStyle(),
      radius: 4,
      pane: 'markerPane',
      className: 'fence-add-handle',
    })
    marker.addTo(map.value as L.Map)
    marker.on('click', (event: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(event)
      const insertAt = index + 1
      const newVertices: FenceLatLng[] = [
        ...polygon.vertices.slice(0, insertAt),
        [event.latlng.lat, event.latlng.lng],
        ...polygon.vertices.slice(insertAt),
      ]
      fenceStore.updatePolygon(polygon.id, { vertices: newVertices })
    })
    midpointMarkers.push(marker)
  })
  polygonMidpointMarkers.set(polygon.id, midpointMarkers)

  buildPolygonCenterHandle(polygon)
}

const polygonCentroid = (vertices: FenceLatLng[]): FenceLatLng => {
  const sum = vertices.reduce<[number, number]>((acc, [lat, lng]) => [acc[0] + lat, acc[1] + lng], [0, 0])
  const n = vertices.length || 1
  return [sum[0] / n, sum[1] / n]
}

const buildPolygonCenterHandle = (polygon: FencePolygon): void => {
  if (!map.value) return
  if (polygon.vertices.length < 3) return

  const center = polygonCentroid(polygon.vertices)
  const html = `<div class="fence-center-handle"><span class="mdi mdi-cursor-move" /></div>`
  const icon = L.divIcon({
    html,
    className: 'fence-center-handle-icon',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
  const marker = L.marker(center as L.LatLngTuple, { icon, pane: 'markerPane', interactive: true })
  marker.addTo(map.value)

  let dragging = false
  let lastLatLng: L.LatLng | null = null
  marker.on('mousedown', (event: L.LeafletMouseEvent) => {
    L.DomEvent.stopPropagation(event)
    dragging = true
    lastLatLng = event.latlng
    map.value?.dragging.disable()
    const onMove = (moveEvent: L.LeafletMouseEvent): void => {
      if (!dragging || !lastLatLng) return
      const dLat = moveEvent.latlng.lat - lastLatLng.lat
      const dLng = moveEvent.latlng.lng - lastLatLng.lng
      lastLatLng = moveEvent.latlng
      const current = fenceStore.polygons.find((p) => p.id === polygon.id)
      if (!current) return
      const newVertices: FenceLatLng[] = current.vertices.map(([lat, lng]) => [lat + dLat, lng + dLng])
      fenceStore.updatePolygon(polygon.id, { vertices: newVertices })
    }
    const onUp = (): void => {
      dragging = false
      lastLatLng = null
      map.value?.off('mousemove', onMove)
      map.value?.off('mouseup', onUp)
      map.value?.dragging.enable()
    }
    map.value?.on('mousemove', onMove)
    map.value?.on('mouseup', onUp)
  })

  polygonCenterMarkers.set(polygon.id, marker)
}

const renderPolygon = (polygon: FencePolygon): void => {
  if (!map.value) return
  const existing = polygonLayers.get(polygon.id)
  if (existing) {
    existing.setLatLngs(polygon.vertices as L.LatLngExpression[])
    existing.setStyle(polygonStyle(polygon.inclusion))
    applyFenceFill(existing, polygon.inclusion)
  } else {
    const layer = L.polygon(polygon.vertices as L.LatLngExpression[], polygonStyle(polygon.inclusion))
    layer.addTo(map.value)
    applyFenceFill(layer, polygon.inclusion)
    if (!props.readonly) {
      layer.on('click', (event: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(event)
        fenceStore.setInteractive(polygon.id)
      })
    }
    polygonLayers.set(polygon.id, layer)
  }
  buildVertexMarkers(polygon)
}

const buildCircleHandles = (circle: FenceCircle): void => {
  if (!map.value) return
  removeCircleHandles(circle.id)

  if (!isInteractiveShape(circle.id)) return

  const centerMarker = L.circleMarker(circle.center as L.LatLngTuple, {
    ...vertexHandleStyle(),
    radius: 6,
    pane: 'markerPane',
    className: 'fence-drag-handle',
  })
  centerMarker.addTo(map.value)
  let centerDragging = false
  centerMarker.on('mousedown', () => {
    centerDragging = true
    map.value?.dragging.disable()
    const onMove = (event: L.LeafletMouseEvent): void => {
      if (!centerDragging) return
      fenceStore.updateCircle(circle.id, { center: [event.latlng.lat, event.latlng.lng] })
    }
    const onUp = (): void => {
      centerDragging = false
      map.value?.off('mousemove', onMove)
      map.value?.off('mouseup', onUp)
      map.value?.dragging.enable()
    }
    map.value?.on('mousemove', onMove)
    map.value?.on('mouseup', onUp)
  })
  circleCenterMarkers.set(circle.id, centerMarker)

  const edgeBounds = L.latLng(circle.center[0], circle.center[1]).toBounds(circle.radius * 2)
  const edgeLatLng: L.LatLngTuple = [circle.center[0], edgeBounds.getEast()]
  const edgeMarker = L.circleMarker(edgeLatLng, {
    ...vertexHandleStyle(),
    radius: 5,
    pane: 'markerPane',
    className: 'fence-drag-handle',
  })
  edgeMarker.addTo(map.value)
  let edgeDragging = false
  edgeMarker.on('mousedown', () => {
    edgeDragging = true
    map.value?.dragging.disable()
    const onMove = (event: L.LeafletMouseEvent): void => {
      if (!edgeDragging) return
      const center = L.latLng(circle.center[0], circle.center[1])
      const distance = center.distanceTo(event.latlng)
      fenceStore.updateCircle(circle.id, { radius: distance })
      showRadiusMeasure(center, event.latlng, distance)
    }
    const onUp = (): void => {
      edgeDragging = false
      map.value?.off('mousemove', onMove)
      map.value?.off('mouseup', onUp)
      map.value?.dragging.enable()
      hideRadiusMeasure()
    }
    map.value?.on('mousemove', onMove)
    map.value?.on('mouseup', onUp)
  })
  circleEdgeMarkers.set(circle.id, edgeMarker)
}

const renderCircle = (circle: FenceCircle): void => {
  if (!map.value) return
  const existing = circleLayers.get(circle.id)
  if (existing) {
    existing.setLatLng(circle.center as L.LatLngTuple)
    existing.setRadius(circle.radius)
    existing.setStyle(polygonStyle(circle.inclusion))
    applyFenceFill(existing, circle.inclusion)
  } else {
    const layer = L.circle(circle.center as L.LatLngTuple, {
      ...polygonStyle(circle.inclusion),
      radius: circle.radius,
    })
    layer.addTo(map.value)
    applyFenceFill(layer, circle.inclusion)
    if (!props.readonly) {
      layer.on('click', (event: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(event)
        fenceStore.setInteractive(circle.id)
      })
    }
    circleLayers.set(circle.id, layer)
  }
  buildCircleHandles(circle)
}

const renderBreachReturn = (point: BreachReturnPoint | undefined): void => {
  if (!map.value) return
  if (!point) {
    removeBreachReturnMarker()
    return
  }
  const html = `<div class="fence-breach-return">B</div>`
  const icon = L.divIcon({ html, className: 'fence-breach-return-icon', iconSize: [22, 22], iconAnchor: [11, 11] })
  if (breachReturnMarker) {
    breachReturnMarker.setLatLng(point.coordinates as L.LatLngTuple)
    // Refresh the icon so any future visual changes (size, color, inner HTML)
    // surface on subsequent renders without needing to recreate the marker.
    breachReturnMarker.setIcon(icon)
  } else {
    breachReturnMarker = L.marker(point.coordinates as L.LatLngTuple, { icon, draggable: !props.readonly })
    breachReturnMarker.addTo(map.value)
    if (!props.readonly) {
      // Read latitude/altitude from the store (source of truth) instead of
      // the captured `point` so altitude edits made after the marker is
      // created don't get overwritten by the next drag.
      breachReturnMarker.on('dragend', (event) => {
        const newCoords = (event.target as L.Marker).getLatLng()
        const currentAltitude = fenceStore.breachReturn?.altitude ?? point.altitude
        fenceStore.setBreachReturn({ coordinates: [newCoords.lat, newCoords.lng], altitude: currentAltitude })
      })
    }
  }
  breachReturnMarker.bindTooltip(`Breach return — ${point.altitude.toFixed(1)} m`, {
    direction: 'top',
    offset: [0, -10],
  })
}

const sourcePolygons = (): FencePolygon[] => (props.plan ? props.plan.polygons : fenceStore.polygons)
const sourceCircles = (): FenceCircle[] => (props.plan ? props.plan.circles : fenceStore.circles)
const sourceBreach = (): BreachReturnPoint | undefined =>
  props.plan ? props.plan.breachReturn : fenceStore.breachReturn

const syncLayers = (): void => {
  if (!map.value) return

  const polys = sourcePolygons()
  const polyIds = new Set(polys.map((p) => p.id))
  Array.from(polygonLayers.keys()).forEach((id) => {
    if (!polyIds.has(id)) removePolygonLayer(id)
  })
  polys.forEach(renderPolygon)

  const circs = sourceCircles()
  const circleIds = new Set(circs.map((c) => c.id))
  Array.from(circleLayers.keys()).forEach((id) => {
    if (!circleIds.has(id)) removeCircleLayer(id)
  })
  circs.forEach(renderCircle)

  renderBreachReturn(sourceBreach())
}

// Coalesce change-driven sync into one frame so vertex drags don't rebuild
// every Leaflet layer per `mousemove`. The initial sync below stays
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
  () => [sourcePolygons(), sourceCircles(), sourceBreach(), fenceStore.interactiveShapeId, props.readonly],
  () => debouncedSyncLayers(),
  { deep: true }
)

onBeforeUnmount(() => clearAllLayers())
</script>

<!--
  Styling targets DOM that Leaflet injects outside this component's render
  tree (divIcons attached to the map's overlay pane, owned by the parent Map
  component). Vue's `scoped` data-v-* attribute can't reach those elements,
  so the rules below must stay global. The `fence-` prefix is the namespace
  guard against accidental collisions.
-->
<style>
.fence-breach-return-icon {
  background: transparent;
  border: none;
}
.fence-breach-return {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #ff8800;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 12px;
  border: 2px solid #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}
.fence-center-handle-icon {
  background: transparent;
  border: none;
  cursor: move;
}
.fence-center-handle {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ffffff;
  color: #1f2937;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  border: 2px solid #3b78a8;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  cursor: move;
}
.fence-center-handle .mdi {
  pointer-events: none;
}
/* `fence-drag-handle` and `fence-add-handle` are passed via Leaflet's
   `L.CircleMarker({ className })`, which Leaflet merges onto the rendered
   SVG `<circle>` element on the overlay pane — so these cursor rules apply
   to the circle node directly, not to a wrapping div. */
.fence-drag-handle {
  cursor: move;
}
.fence-add-handle {
  cursor: copy;
}
</style>
