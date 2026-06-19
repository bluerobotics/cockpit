import L from 'leaflet'
import { type Ref, type ShallowRef, onScopeDispose, ref, shallowRef, toRaw, watch } from 'vue'

import { openSnackbar } from '@/composables/snackbar'
import {
  type GeoAnchor,
  type LocalMetersBounds,
  type LocalMetersPoint,
  computeMissionLocation,
  computeOriginalLocalBounds,
  METERS_PER_DEGREE_LAT,
  PLACEMENT_LIMITS,
  safeRotationRad,
  safeScalePercent,
  transformLocalMeters,
  transformPlacementCoord,
  unrotateToOriginalLocal,
} from '@/libs/mission/library'
import type { CockpitMission, WaypointCoordinates } from '@/types/mission'

const PREVIEW = {
  rotationHandleOffsetPx: 36,
  boundsPaddingRatio: 0.08,
} as const

/**
 * Configuration for {@link useMissionPlacement}.
 */
export type UseMissionPlacementOptions = {
  /**
   * Invoked when the user confirms placement, with the mission already transformed into its
   * placed coordinates. The composable resets its own state before calling the callback.
   */
  onConfirm: (placedMission: CockpitMission) => void
  /**
   * Invoked at the end of any drag gesture so the host view can ignore the synthetic click
   * leaflet emits right after `mouseup`. The composable does not own click routing itself.
   */
  markIgnoreNextClick?: () => void
  /**
   * Invoked after every preview rebuild so the host can reposition overlay UI (e.g. the
   * placement toolbar) that depends on the current preview bounds.
   */
  onPreviewRebuilt?: () => void
}

type ScaleDragInitial = {
  /**
   * Corner the user grabbed, in the original mission local frame (east/north meters).
   */
  cornerLocal: LocalMetersPoint
  /**
   * Scale-X percentage at the moment the drag started.
   */
  initialScaleX: number
  /**
   * Scale-Y percentage at the moment the drag started.
   */
  initialScaleY: number
}

type RotationDragInitial = {
  /**
   * Rotation (degrees) at the moment the drag started.
   */
  initialRotation: number
  /**
   * Mouse angle (radians, clockwise from screen-north) at the moment the drag started.
   */
  initialAngleRad: number
}

/**
 * Owns the interactive "free placement" mode for a saved mission on a leaflet map: drag to move,
 * corner handles to scale, top handle to rotate, then confirm or cancel. The composable manages
 * its own preview layers, mouse listeners, and animation-frame coalescing; the host view only
 * provides the map ref, a confirm callback, and an optional click-suppression hook.
 * @param {Ref<L.Map | null | undefined> | ShallowRef<L.Map | undefined>} mapRef - Reactive reference to the leaflet map the placement runs on.
 * @param {UseMissionPlacementOptions} options - Confirm callback and view-side hooks.
 * @returns {object} State refs and actions used by the host view's template and event wiring.
 */
export const useMissionPlacement = (
  mapRef: Ref<L.Map | null | undefined> | ShallowRef<L.Map | undefined>,
  options: UseMissionPlacementOptions
): {
  /**
   * True while the user is interactively positioning a mission on the map.
   */
  isPlacingMission: Ref<boolean>
  /**
   * Reactive scale-X percentage bound to the toolbar input.
   */
  placementScaleXPercent: Ref<number>
  /**
   * Reactive scale-Y percentage bound to the toolbar input.
   */
  placementScaleYPercent: Ref<number>
  /**
   * Reactive rotation in degrees bound to the toolbar input.
   */
  placementRotationDeg: Ref<number>
  /**
   * Limits applied to the scale/rotation inputs; mirrors the lib export for template binding.
   */
  PLACEMENT_LIMITS: typeof PLACEMENT_LIMITS
  /**
   * Clamps {@link placementScaleXPercent} into the configured range.
   */
  clampPlacementScaleX: () => void
  /**
   * Clamps {@link placementScaleYPercent} into the configured range.
   */
  clampPlacementScaleY: () => void
  /**
   * Clamps {@link placementRotationDeg} into the configured range.
   */
  clampPlacementRotation: () => void
  /**
   * Resets scale and rotation inputs to their identity values.
   */
  resetPlacementTransform: () => void
  /**
   * Starts free placement for the given mission.
   */
  startFreePlacement: (mission: CockpitMission) => void
  /**
   * Tears down placement state and removes the preview layers.
   */
  cancelFreePlacement: () => void
  /**
   * Builds the placed mission, invokes the configured confirm callback, then cancels.
   */
  confirmFreePlacement: () => void
  /**
   * Returns the current placement preview's geographic bounds, or null when not placing.
   * Exposed so the host view can position the toolbar overlay in screen space.
   */
  getPlacementBounds: () => L.LatLngBounds | null
} => {
  const isPlacingMission = ref(false)
  const placementMission = ref<CockpitMission | null>(null)
  const placementAnchorOriginal = ref<L.LatLng>(L.latLng(0, 0))
  const placementAnchorCurrent = ref<L.LatLng>(L.latLng(0, 0))
  const placementScaleXPercent = ref(100)
  const placementScaleYPercent = ref(100)
  const placementRotationDeg = ref(0)
  // Captured once at the start of placement so the preview box rotates and scales with the
  // mission instead of staying axis-aligned (in meters around `placementAnchorOriginal`).
  const placementOriginalLocalBounds = ref<LocalMetersBounds | null>(null)
  const placementPreviewLayers = shallowRef<L.Layer[]>([])
  const placementDragPolygon = shallowRef<L.Polygon | null>(null)

  let placementDragStartLatLng: L.LatLng | null = null
  let placementRebuildRafHandle: number | null = null
  let scaleDragInitial: ScaleDragInitial | null = null
  let rotationDragInitial: RotationDragInitial | null = null

  const originalAnchorAsGeo = (): GeoAnchor => ({
    lat: placementAnchorOriginal.value.lat,
    lng: placementAnchorOriginal.value.lng,
  })
  const currentAnchorAsGeo = (): GeoAnchor => ({
    lat: placementAnchorCurrent.value.lat,
    lng: placementAnchorCurrent.value.lng,
  })
  const transformCoord = (c: WaypointCoordinates): WaypointCoordinates =>
    transformPlacementCoord(
      c,
      originalAnchorAsGeo(),
      currentAnchorAsGeo(),
      placementScaleXPercent.value,
      placementScaleYPercent.value,
      placementRotationDeg.value
    )
  const transformLocal = (east: number, north: number): WaypointCoordinates =>
    transformLocalMeters(
      east,
      north,
      currentAnchorAsGeo(),
      placementScaleXPercent.value,
      placementScaleYPercent.value,
      placementRotationDeg.value
    )

  const clampPlacementScaleX = (): void => {
    const raw = Number(placementScaleXPercent.value)
    placementScaleXPercent.value = Number.isFinite(raw)
      ? Math.max(PLACEMENT_LIMITS.scaleMinPercent, Math.min(PLACEMENT_LIMITS.scaleMaxPercent, raw))
      : 100
  }
  const clampPlacementScaleY = (): void => {
    const raw = Number(placementScaleYPercent.value)
    placementScaleYPercent.value = Number.isFinite(raw)
      ? Math.max(PLACEMENT_LIMITS.scaleMinPercent, Math.min(PLACEMENT_LIMITS.scaleMaxPercent, raw))
      : 100
  }
  const clampPlacementRotation = (): void => {
    const raw = Number(placementRotationDeg.value)
    placementRotationDeg.value = Number.isFinite(raw)
      ? Math.max(PLACEMENT_LIMITS.rotationMinDeg, Math.min(PLACEMENT_LIMITS.rotationMaxDeg, raw))
      : 0
  }

  // Reuses the bounding polygon's lat/lng bounds (already kept in sync with the transform) to
  // avoid re-projecting every coordinate on each map move/zoom.
  const getPlacementBounds = (): L.LatLngBounds | null => {
    const polygonBounds = placementDragPolygon.value?.getBounds()
    if (polygonBounds) return polygonBounds
    if (!placementMission.value) return null
    const wpCoords = placementMission.value.waypoints.map((w) => transformCoord(w.coordinates))
    const surveyCoords =
      placementMission.value.surveys?.flatMap((s) => s.polygonCoordinates.map((c) => transformCoord(c))) ?? []
    const allCoords = [...wpCoords, ...surveyCoords]
    if (allCoords.length === 0) return null
    return L.latLngBounds(allCoords.map((c) => L.latLng(c[0], c[1])))
  }

  const onPlacementMouseDown = (event: L.LeafletMouseEvent): void => {
    if (!isPlacingMission.value) return
    placementDragStartLatLng = event.latlng
    mapRef.value?.dragging.disable()
    mapRef.value?.on('mousemove', onPlacementMouseMove)
    mapRef.value?.on('mouseup', onPlacementMouseUp)
    L.DomEvent.stopPropagation(event.originalEvent)
    L.DomEvent.preventDefault(event.originalEvent)
  }

  const onPlacementMouseMove = (event: L.LeafletMouseEvent): void => {
    if (!placementDragStartLatLng) return
    const dLat = event.latlng.lat - placementDragStartLatLng.lat
    const dLng = event.latlng.lng - placementDragStartLatLng.lng
    placementAnchorCurrent.value = L.latLng(
      placementAnchorCurrent.value.lat + dLat,
      placementAnchorCurrent.value.lng + dLng
    )
    placementDragStartLatLng = event.latlng
    schedulePlacementPreviewRebuild()
    L.DomEvent.stopPropagation(event.originalEvent)
  }

  const onPlacementMouseUp = (event: L.LeafletMouseEvent): void => {
    placementDragStartLatLng = null
    mapRef.value?.dragging.enable()
    mapRef.value?.off('mousemove', onPlacementMouseMove)
    mapRef.value?.off('mouseup', onPlacementMouseUp)
    options.markIgnoreNextClick?.()
    L.DomEvent.stopPropagation(event.originalEvent)
    L.DomEvent.preventDefault(event.originalEvent)
  }

  const onScaleHandleMouseDown = (event: L.LeafletMouseEvent, cornerLocal: LocalMetersPoint): void => {
    if (!isPlacingMission.value || !mapRef.value) return
    scaleDragInitial = {
      cornerLocal: { ...cornerLocal },
      initialScaleX: placementScaleXPercent.value || 100,
      initialScaleY: placementScaleYPercent.value || 100,
    }
    mapRef.value.dragging.disable()
    mapRef.value.on('mousemove', onScaleHandleMouseMove)
    mapRef.value.on('mouseup', onScaleHandleMouseUp)
    L.DomEvent.stopPropagation(event.originalEvent)
    L.DomEvent.preventDefault(event.originalEvent)
  }

  const onScaleHandleMouseMove = (event: L.LeafletMouseEvent): void => {
    if (!scaleDragInitial || !mapRef.value) return
    const target = placementAnchorCurrent.value
    const metersPerDegLngTarget = METERS_PER_DEGREE_LAT * Math.cos((target.lat * Math.PI) / 180)

    // Mouse position in the rotated current frame (meters relative to the current anchor).
    const mouseEastRot = (event.latlng.lng - target.lng) * metersPerDegLngTarget
    const mouseNorthRot = (event.latlng.lat - target.lat) * METERS_PER_DEGREE_LAT

    // Express the mouse in the original mission local frame so it lines up with the captured corner.
    const mouseLocal = unrotateToOriginalLocal(mouseEastRot, mouseNorthRot, placementRotationDeg.value)
    const { cornerLocal, initialScaleX, initialScaleY } = scaleDragInitial
    const isShift = (event.originalEvent as MouseEvent).shiftKey

    if (isShift) {
      // Proportional: project the mouse onto the line from the centroid through the captured corner;
      // the projection length divided by the corner length gives the uniform scale factor.
      const cornerLenSq = cornerLocal.east * cornerLocal.east + cornerLocal.north * cornerLocal.north
      if (cornerLenSq < 1e-9) return
      const projection = (mouseLocal.east * cornerLocal.east + mouseLocal.north * cornerLocal.north) / cornerLenSq
      const newScale = Math.max(
        PLACEMENT_LIMITS.scaleMinPercent,
        Math.min(PLACEMENT_LIMITS.scaleMaxPercent, Math.round(projection * 100))
      )
      placementScaleXPercent.value = newScale
      placementScaleYPercent.value = newScale
    } else {
      if (Math.abs(cornerLocal.east) > 1e-6) {
        const newScaleX = (mouseLocal.east / cornerLocal.east) * 100
        placementScaleXPercent.value = Math.max(
          PLACEMENT_LIMITS.scaleMinPercent,
          Math.min(PLACEMENT_LIMITS.scaleMaxPercent, Math.round(newScaleX))
        )
      } else {
        placementScaleXPercent.value = initialScaleX
      }
      if (Math.abs(cornerLocal.north) > 1e-6) {
        const newScaleY = (mouseLocal.north / cornerLocal.north) * 100
        placementScaleYPercent.value = Math.max(
          PLACEMENT_LIMITS.scaleMinPercent,
          Math.min(PLACEMENT_LIMITS.scaleMaxPercent, Math.round(newScaleY))
        )
      } else {
        placementScaleYPercent.value = initialScaleY
      }
    }
    L.DomEvent.stopPropagation(event.originalEvent)
  }

  const onScaleHandleMouseUp = (event: L.LeafletMouseEvent): void => {
    scaleDragInitial = null
    mapRef.value?.dragging.enable()
    mapRef.value?.off('mousemove', onScaleHandleMouseMove)
    mapRef.value?.off('mouseup', onScaleHandleMouseUp)
    options.markIgnoreNextClick?.()
    L.DomEvent.stopPropagation(event.originalEvent)
    L.DomEvent.preventDefault(event.originalEvent)
  }

  const onRotationHandleMouseDown = (event: L.LeafletMouseEvent): void => {
    if (!isPlacingMission.value || !mapRef.value) return
    const map = mapRef.value
    const anchorPt = map.latLngToContainerPoint(placementAnchorCurrent.value)
    const mousePt = map.latLngToContainerPoint(event.latlng)
    const dx = mousePt.x - anchorPt.x
    const dy = mousePt.y - anchorPt.y
    // Angle clockwise from screen-north (negative y direction).
    const initialAngleRad = Math.atan2(dx, -dy)
    rotationDragInitial = { initialRotation: placementRotationDeg.value || 0, initialAngleRad }
    map.dragging.disable()
    map.on('mousemove', onRotationHandleMouseMove)
    map.on('mouseup', onRotationHandleMouseUp)
    L.DomEvent.stopPropagation(event.originalEvent)
    L.DomEvent.preventDefault(event.originalEvent)
  }

  const onRotationHandleMouseMove = (event: L.LeafletMouseEvent): void => {
    if (!rotationDragInitial || !mapRef.value) return
    const map = mapRef.value
    const anchorPt = map.latLngToContainerPoint(placementAnchorCurrent.value)
    const mousePt = map.latLngToContainerPoint(event.latlng)
    const dx = mousePt.x - anchorPt.x
    const dy = mousePt.y - anchorPt.y
    const currentAngleRad = Math.atan2(dx, -dy)
    const deltaDeg = ((currentAngleRad - rotationDragInitial.initialAngleRad) * 180) / Math.PI
    let newRotation = rotationDragInitial.initialRotation + deltaDeg
    while (newRotation > 180) newRotation -= 360
    while (newRotation <= -180) newRotation += 360
    placementRotationDeg.value = Math.round(newRotation)
    L.DomEvent.stopPropagation(event.originalEvent)
  }

  const onRotationHandleMouseUp = (event: L.LeafletMouseEvent): void => {
    rotationDragInitial = null
    mapRef.value?.dragging.enable()
    mapRef.value?.off('mousemove', onRotationHandleMouseMove)
    mapRef.value?.off('mouseup', onRotationHandleMouseUp)
    options.markIgnoreNextClick?.()
    L.DomEvent.stopPropagation(event.originalEvent)
    L.DomEvent.preventDefault(event.originalEvent)
  }

  const clearPlacementLayers = (): void => {
    placementPreviewLayers.value.forEach((l) => mapRef.value?.removeLayer(l))
    placementPreviewLayers.value = []
    if (placementDragPolygon.value) {
      placementDragPolygon.value.off('mousedown', onPlacementMouseDown)
      mapRef.value?.removeLayer(placementDragPolygon.value)
      placementDragPolygon.value = null
    }
  }

  // Coalesces rapid placement updates so the preview rebuilds at most once per animation frame.
  const schedulePlacementPreviewRebuild = (): void => {
    if (placementRebuildRafHandle !== null) return
    placementRebuildRafHandle = requestAnimationFrame(() => {
      placementRebuildRafHandle = null
      rebuildPlacementPreview()
    })
  }

  const rebuildPlacementPreview = (): void => {
    if (!mapRef.value || !placementMission.value) return
    clearPlacementLayers()

    const map = mapRef.value
    const wpCoords = placementMission.value.waypoints.map((w) => transformCoord(w.coordinates))

    placementMission.value.surveys?.forEach((survey) => {
      if (!survey.polygonCoordinates?.length) return
      const polygon = L.polygon(
        survey.polygonCoordinates.map((c) => transformCoord(c)),
        {
          color: '#FFD54F',
          fillColor: '#FFD54F',
          fillOpacity: 0.18,
          weight: 2,
          dashArray: '6 4',
          interactive: false,
        }
      ).addTo(map)
      placementPreviewLayers.value.push(polygon)

      survey.waypoints.forEach((wp) => {
        const surveyWpCoord = transformCoord(wp.coordinates)
        const marker = L.circleMarker(surveyWpCoord, {
          radius: 3,
          color: '#000000',
          weight: 1,
          fillColor: '#FFFFFF',
          fillOpacity: 0.85,
          interactive: false,
        }).addTo(map)
        placementPreviewLayers.value.push(marker)
      })
    })

    if (wpCoords.length > 1) {
      const polyline = L.polyline(wpCoords, {
        color: '#FFD54F',
        weight: 3,
        opacity: 0.9,
        dashArray: '8 6',
        interactive: false,
      }).addTo(map)
      placementPreviewLayers.value.push(polyline)
    }

    wpCoords.forEach((coord, index) => {
      const isFirst = index === 0
      const isLast = index === wpCoords.length - 1
      const fillColor = isFirst ? '#4CAF50' : isLast ? '#F44336' : '#FFFFFF'
      const marker = L.circleMarker(coord, {
        radius: 6,
        color: '#000000',
        weight: 1,
        fillColor,
        fillOpacity: 0.95,
        interactive: false,
      }).addTo(map)
      placementPreviewLayers.value.push(marker)
    })

    const localBounds = placementOriginalLocalBounds.value
    if (localBounds) {
      const padE = (localBounds.maxE - localBounds.minE) * PREVIEW.boundsPaddingRatio || 1
      const padN = (localBounds.maxN - localBounds.minN) * PREVIEW.boundsPaddingRatio || 1
      const minE = localBounds.minE - padE
      const maxE = localBounds.maxE + padE
      const minN = localBounds.minN - padN
      const maxN = localBounds.maxN + padN

      // Corners in original local frame, ordered NW, NE, SE, SW.
      const cornersLocal: (LocalMetersPoint & {
        /**
         * CSS cursor to apply to the scale handle drawn at this corner.
         */
        cursor: string
      })[] = [
        { east: minE, north: maxN, cursor: 'nwse-resize' },
        { east: maxE, north: maxN, cursor: 'nesw-resize' },
        { east: maxE, north: minN, cursor: 'nwse-resize' },
        { east: minE, north: minN, cursor: 'nesw-resize' },
      ]
      const cornerLatLngs = cornersLocal.map((c) => L.latLng(transformLocal(c.east, c.north)))

      const polygon = L.polygon(cornerLatLngs, {
        color: '#FFFFFF',
        weight: 1,
        opacity: 0.6,
        fillOpacity: 0.04,
        dashArray: '4 4',
        interactive: true,
        bubblingMouseEvents: false,
      }).addTo(map)
      polygon.on('mousedown', onPlacementMouseDown)
      placementDragPolygon.value = polygon
      placementPreviewLayers.value.push(polygon)
      const polyEl = polygon.getElement() as SVGElement | null
      if (polyEl) polyEl.style.cursor = 'grab'

      cornersLocal.forEach((corner, idx) => {
        const handle = L.marker(cornerLatLngs[idx], {
          icon: L.divIcon({
            html:
              `<div style="width: 12px; height: 12px; background: transparent; border: 2px solid #ffffff; ` +
              `box-shadow: 0 0 4px rgba(0,0,0,0.7); cursor: ${corner.cursor};"></div>`,
            className: '',
            iconSize: [12, 12],
            iconAnchor: [6, 6],
          }),
          interactive: true,
          bubblingMouseEvents: false,
          keyboard: false,
        }).addTo(map)
        handle.on('mousedown', (event: L.LeafletMouseEvent) =>
          onScaleHandleMouseDown(event, { east: corner.east, north: corner.north })
        )
        placementPreviewLayers.value.push(handle)
      })

      // Rotation handle: offset from the rotated top-edge centre along the mission's current "up"
      // so it always sits perpendicular to the top edge.
      const topCenterE = (minE + maxE) / 2
      const topCenterLatLng = L.latLng(transformLocal(topCenterE, maxN))
      const topCenterPt = map.latLngToContainerPoint(topCenterLatLng)
      const theta = safeRotationRad(placementRotationDeg.value)
      // Local "north" (0, +1) becomes (sin θ, -cos θ) in screen space.
      const dirX = Math.sin(theta)
      const dirY = -Math.cos(theta)
      const rotHandlePt = L.point(
        topCenterPt.x + PREVIEW.rotationHandleOffsetPx * dirX,
        topCenterPt.y + PREVIEW.rotationHandleOffsetPx * dirY
      )
      const rotHandleLatLng = map.containerPointToLatLng(rotHandlePt)

      const stem = L.polyline([rotHandleLatLng, topCenterLatLng], {
        color: '#FFFFFF',
        weight: 2,
        opacity: 0.7,
        dashArray: '2 4',
        interactive: false,
      }).addTo(map)
      placementPreviewLayers.value.push(stem)

      const rotationHandle = L.marker(rotHandleLatLng, {
        icon: L.divIcon({
          html:
            `<div style="width: 16px; height: 16px; background: transparent; border: 2px solid #ffffff; ` +
            `border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.7); cursor: grab;"></div>`,
          className: '',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
        interactive: true,
        bubblingMouseEvents: false,
        keyboard: false,
      }).addTo(map)
      rotationHandle.on('mousedown', onRotationHandleMouseDown)
      placementPreviewLayers.value.push(rotationHandle)
    }

    options.onPreviewRebuilt?.()
  }

  const startFreePlacement = (mission: CockpitMission): void => {
    if (!mapRef.value) return
    cancelFreePlacement()
    // Proxy-safe deep clone matching the `safeClone` pattern in default-profile-importer.ts:
    // `toRaw` unwraps the Pinia-store reactivity wrappers so the JSON round-trip can't trip over them.
    placementMission.value = JSON.parse(JSON.stringify(toRaw(mission))) as CockpitMission

    // Anchor the centroid to the current map center so the preview lands inside the viewport.
    const centroid = computeMissionLocation(placementMission.value)
    placementAnchorOriginal.value = L.latLng(centroid[0], centroid[1])
    placementAnchorCurrent.value = mapRef.value.getCenter()
    placementScaleXPercent.value = 100
    placementScaleYPercent.value = 100
    placementRotationDeg.value = 0
    placementOriginalLocalBounds.value = computeOriginalLocalBounds(placementMission.value, originalAnchorAsGeo())

    isPlacingMission.value = true
    rebuildPlacementPreview()
    openSnackbar({
      variant: 'info',
      message: 'Drag to reposition. Drag corners to scale (Shift = uniform), drag the top circle to rotate.',
      duration: 4500,
    })
  }

  const cancelFreePlacement = (): void => {
    clearPlacementLayers()
    isPlacingMission.value = false
    placementMission.value = null
    placementAnchorOriginal.value = L.latLng(0, 0)
    placementAnchorCurrent.value = L.latLng(0, 0)
    placementScaleXPercent.value = 100
    placementScaleYPercent.value = 100
    placementRotationDeg.value = 0
    placementOriginalLocalBounds.value = null
    placementDragStartLatLng = null
    scaleDragInitial = null
    rotationDragInitial = null
    if (placementRebuildRafHandle !== null) {
      cancelAnimationFrame(placementRebuildRafHandle)
      placementRebuildRafHandle = null
    }
    mapRef.value?.dragging.enable()
    mapRef.value?.off('mousemove', onPlacementMouseMove)
    mapRef.value?.off('mouseup', onPlacementMouseUp)
    mapRef.value?.off('mousemove', onScaleHandleMouseMove)
    mapRef.value?.off('mouseup', onScaleHandleMouseUp)
    mapRef.value?.off('mousemove', onRotationHandleMouseMove)
    mapRef.value?.off('mouseup', onRotationHandleMouseUp)
  }

  const resetPlacementTransform = (): void => {
    placementScaleXPercent.value = 100
    placementScaleYPercent.value = 100
    placementRotationDeg.value = 0
  }

  const confirmFreePlacement = (): void => {
    if (!placementMission.value) return
    const scaleX = safeScalePercent(placementScaleXPercent.value)
    const scaleY = safeScalePercent(placementScaleYPercent.value)
    // Surveys store a single scan-line spacing/turnaround in meters; the geometric mean keeps
    // the density close to the preview when the user picks non-uniform scale factors.
    const surveyScalarFactor = Math.sqrt(scaleX * scaleY)
    const rotRaw = placementRotationDeg.value
    const rotationDeg = Number.isFinite(rotRaw) ? rotRaw : 0
    const placedMission: CockpitMission = {
      ...placementMission.value,
      waypoints: placementMission.value.waypoints.map((wp) => ({
        ...wp,
        coordinates: transformCoord(wp.coordinates),
      })),
      surveys: placementMission.value.surveys?.map((survey) => ({
        ...survey,
        polygonCoordinates: survey.polygonCoordinates.map((c) => transformCoord(c)),
        waypoints: survey.waypoints.map((wp) => ({
          ...wp,
          coordinates: transformCoord(wp.coordinates),
        })),
        distanceBetweenLines: survey.distanceBetweenLines * surveyScalarFactor,
        turnaroundDistance: survey.turnaroundDistance * surveyScalarFactor,
        surveyLinesAngle: (((survey.surveyLinesAngle + rotationDeg) % 360) + 360) % 360,
      })),
    }
    cancelFreePlacement()
    options.onConfirm(placedMission)
  }

  // Re-render the preview when the user types into the scale/rotation inputs.
  watch([placementScaleXPercent, placementScaleYPercent, placementRotationDeg], () => {
    if (isPlacingMission.value) schedulePlacementPreviewRebuild()
  })

  const onZoomEnd = (): void => {
    if (isPlacingMission.value) rebuildPlacementPreview()
  }

  // Also rebuild the preview when the host map reaches a new zoom level so handle screen
  // offsets recompute correctly. The host's template ref briefly holds the underlying DOM
  // element before Leaflet replaces it with the L.Map instance, so guard every call.
  watch(mapRef, (map, prevMap) => {
    if (prevMap instanceof L.Map) prevMap.off('zoomend', onZoomEnd)
    if (map instanceof L.Map) map.on('zoomend', onZoomEnd)
  })
  if (mapRef.value instanceof L.Map) mapRef.value.on('zoomend', onZoomEnd)

  onScopeDispose(() => {
    if (mapRef.value instanceof L.Map) mapRef.value.off('zoomend', onZoomEnd)
    cancelFreePlacement()
  })

  return {
    isPlacingMission,
    placementScaleXPercent,
    placementScaleYPercent,
    placementRotationDeg,
    PLACEMENT_LIMITS,
    clampPlacementScaleX,
    clampPlacementScaleY,
    clampPlacementRotation,
    resetPlacementTransform,
    startFreePlacement,
    cancelFreePlacement,
    confirmFreePlacement,
    getPlacementBounds,
  }
}
