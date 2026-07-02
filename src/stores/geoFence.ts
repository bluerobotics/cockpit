import { tryOnScopeDispose, useDebounceFn, useDocumentVisibility } from '@vueuse/core'
import { defineStore } from 'pinia'
import { v4 as uuid } from 'uuid'
import { computed, reactive, ref, watch } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { useSnackbar } from '@/composables/snackbar'
import { useGeoFenceEditorDraft } from '@/composables/useGeoFenceEditorDraft'
import { MavParamType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import {
  type MissionBreachReport,
  type WaypointLike,
  CIRCLE_DEFAULT_RADIUS_M,
  CIRCLE_MAX_RADIUS_M,
  clonePlan,
  cloneVertices,
  detectMissionBreaches as detectMissionBreachesInShapes,
  emptyGeoFencePlan,
  offsetCoordinates,
  POLYGON_DEFAULT_HALF_SIDE_M,
  POLYGON_MAX_HALF_SIDE_M,
} from '@/libs/geo-fence'
import type { Parameter } from '@/libs/vehicle/types'
import * as Vehicle from '@/libs/vehicle/vehicle'
import type { BreachReturnPoint, FenceCircle, FenceLatLng, FencePolygon, GeoFencePlan } from '@/types/geofence'
import type { MissionLoadingCallback } from '@/types/mission'

import { useMainVehicleStore } from './mainVehicle'

export const useGeoFenceStore = defineStore('geo-fence', () => {
  const mainVehicleStore = useMainVehicleStore()
  const { openSnackbar } = useSnackbar()
  const draft = useGeoFenceEditorDraft()

  const polygons = reactive<FencePolygon[]>([])
  const circles = reactive<FenceCircle[]>([])
  const breachReturn = ref<BreachReturnPoint | undefined>(undefined)

  const dirty = ref(false)
  const syncInProgress = ref(false)
  const lastUploadedPlan = ref<GeoFencePlan | undefined>(undefined)

  const draftFence = useBlueOsStorage<GeoFencePlan>('cockpit-draft-fence', emptyGeoFencePlan())
  const persistedVehicleFence = useBlueOsStorage<GeoFencePlan | null>('cockpit-vehicle-fence', null)

  // Restore previously persisted last-uploaded plan so the live overlay can
  // appear immediately after a page reload without re-downloading.
  if (persistedVehicleFence.value) {
    lastUploadedPlan.value = clonePlan(persistedVehicleFence.value)
  }

  // Restore the user's draft into the reactive working model.
  if (draftFence.value) {
    polygons.push(...(draftFence.value.polygons ?? []))
    circles.push(...(draftFence.value.circles ?? []))
    breachReturn.value = draftFence.value.breachReturn
  }

  const markDirty = (): void => {
    dirty.value = true
  }

  const persistDraft = (): void => {
    draftFence.value = exportPlan()
  }

  // Debounced variant for high-frequency callers (vertex drag updates fire on
  // every mousemove). Atomic actions stay on the immediate `persistDraft` so
  // discrete edits (add/delete/finish-drawing/clear/load/setBreachReturn)
  // are flushed to storage right away.
  const persistDraftDebounced = useDebounceFn(persistDraft, 300)

  // MAV_PROTOCOL_CAPABILITY_MISSION_FENCE — bit 14 of AUTOPILOT_VERSION.capabilities.
  // The dialect generator doesn't expose this enum yet (the field is typed as a
  // generic BitFlag), so we mirror the single value we need.
  const MAV_PROTOCOL_CAPABILITY_MISSION_FENCE = 1 << 14

  /**
   * Whether the connected vehicle advertises the geofence MAVLink service.
   * Optimistic by default: if no `AUTOPILOT_VERSION` has been received yet,
   * the editor remains enabled.
   * @returns { boolean } True when the editor should be enabled for the current vehicle.
   */
  const isFenceSupported = computed<boolean>(() => {
    const bits = mainVehicleStore.capabilities
    if (bits === undefined) return true
    return (bits & MAV_PROTOCOL_CAPABILITY_MISSION_FENCE) !== 0
  })

  /**
   * True when the connected vehicle is an ArduPilot Plane. ArduPilot Plane
   * requires a polygon to be present for any fence parameter (incl. ALT_MAX)
   * to take effect — surfaced as a UI hint.
   * @returns { boolean } True for ArduPilot Plane vehicles.
   */
  const isArduPilotPlane = computed<boolean>(() => {
    const v = mainVehicleStore.mainVehicle
    if (!v) return false
    return v.firmware() === Vehicle.Firmware.ArduPilot && v.type() === Vehicle.Type.Plane
  })

  /**
   * True when the connected vehicle is PX4. PX4 ANDs multiple inclusion
   * polygons (intersection) — surfaced as a UI hint.
   * @returns { boolean } True for PX4 vehicles.
   */
  const isPx4 = computed<boolean>(() => {
    const v = mainVehicleStore.mainVehicle
    if (!v) return false
    return v.firmware() === Vehicle.Firmware.PX4
  })

  /**
   * True when the connected vehicle runs ArduPilot firmware. Used to gate
   * features that exist only on ArduPilot (e.g. the `FENCE_ENABLE` runtime
   * enforcement toggle, which has no PX4 equivalent).
   * @returns { boolean } True for any ArduPilot vehicle.
   */
  const isArduPilot = computed<boolean>(() => {
    const v = mainVehicleStore.mainVehicle
    if (!v) return false
    return v.firmware() === Vehicle.Firmware.ArduPilot
  })

  // Tracks the vehicle-side fence enforcement state (ArduPilot's `FENCE_ENABLE`).
  // `undefined` until the first PARAM_VALUE reply lands, so the UI can render a
  // neutral state instead of falsely claiming the fence is disabled.
  const fenceEnabled = ref<boolean | undefined>(undefined)

  // Tracks the current `FENCE_AUTOENABLE` mode (0–4 on ArduPilot). Drives the
  // "Auto enable fence on takeoff" switch in the editor; non-zero is treated
  // as ON because every supported mode auto-enables enforcement at some
  // arming/takeoff point.
  const fenceAutoEnableMode = ref<number | undefined>(undefined)

  /**
   * Asks the vehicle for the current `FENCE_ENABLE` value. The reply is
   * received asynchronously via PARAM_VALUE and updates `fenceEnabled`.
   * No-op on non-ArduPilot vehicles or when no vehicle is connected.
   */
  const refreshFenceEnabled = (): void => {
    const v = mainVehicleStore.mainVehicle
    if (!v) return
    if (!isArduPilot.value) return
    v.requestParameter('FENCE_ENABLE')
  }

  /**
   * Asks the vehicle for the current `FENCE_AUTOENABLE` value. The reply
   * arrives asynchronously via PARAM_VALUE and updates `fenceAutoEnableMode`.
   * No-op on non-ArduPilot vehicles or when no vehicle is connected.
   */
  const refreshFenceAutoEnable = (): void => {
    const v = mainVehicleStore.mainVehicle
    if (!v) return
    if (!isArduPilot.value) return
    v.requestParameter('FENCE_AUTOENABLE')
  }

  /**
   * Toggles vehicle-side geofence enforcement by writing the `FENCE_ENABLE`
   * parameter on ArduPilot. Performs an optimistic local update; the real
   * value is reconfirmed when the resulting PARAM_VALUE reply arrives.
   * @param { boolean } enabled Whether enforcement should be active on the vehicle.
   */
  const setFenceEnabled = (enabled: boolean): void => {
    const v = mainVehicleStore.mainVehicle
    if (!v) throw new Error('No vehicle connected.')
    if (!isArduPilot.value) {
      throw new Error('Fence enforcement toggle is only supported on ArduPilot vehicles.')
    }
    v.setParameter({
      id: 'FENCE_ENABLE',
      value: enabled ? 1 : 0,
      type: { type: MavParamType.MAV_PARAM_TYPE_UINT8 },
    })
    fenceEnabled.value = enabled
  }

  /**
   * Writes `FENCE_AUTOENABLE` on ArduPilot, controlling whether the autopilot
   * automatically arms fence enforcement on auto-takeoff. Mode `1` is the
   * common "enable on takeoff, disable on landing" preset; `0` disables it.
   * @param { number } mode `FENCE_AUTOENABLE` mode (vendor-defined; typically 0–4).
   */
  const setFenceAutoEnable = (mode: number): void => {
    const v = mainVehicleStore.mainVehicle
    if (!v) throw new Error('No vehicle connected.')
    if (!isArduPilot.value) {
      throw new Error('FENCE_AUTOENABLE is only supported on ArduPilot vehicles.')
    }
    v.setParameter({
      id: 'FENCE_AUTOENABLE',
      value: mode,
      type: { type: MavParamType.MAV_PARAM_TYPE_UINT8 },
    })
    fenceAutoEnableMode.value = mode
  }

  // Wire PARAM_VALUE updates from the vehicle into `fenceEnabled` /
  // `fenceAutoEnableMode` so that any change — whether triggered by us, by
  // another GCS, or auto-applied by the autopilot itself (e.g.
  // `FENCE_AUTOENABLE` on takeoff) — is reflected in the UI. Re-binds
  // whenever the active vehicle instance changes.
  let attachedVehicle: Vehicle.Abstract | undefined
  const fenceParamSlot = ([param]: [Parameter, number | undefined]): void => {
    if (!param) return
    if (param.name === 'FENCE_ENABLE') {
      fenceEnabled.value = Math.round(param.value) === 1
    } else if (param.name === 'FENCE_AUTOENABLE') {
      fenceAutoEnableMode.value = Math.round(param.value)
    }
  }
  watch(
    () => mainVehicleStore.mainVehicle,
    (newVehicle) => {
      if (attachedVehicle) attachedVehicle.onParameter.remove(fenceParamSlot)
      attachedVehicle = newVehicle
      if (newVehicle) newVehicle.onParameter.add(fenceParamSlot)
    },
    { immediate: true }
  )

  // The autopilot does not emit unsolicited PARAM_VALUE messages when its own
  // logic flips `FENCE_ENABLE` (for example, on `FENCE_AUTOENABLE`-driven
  // takeoff-time activation). To keep the Map widget toggle in sync with the
  // real enforcement state we poll `FENCE_ENABLE` while a fence is loaded on
  // the vehicle. `FENCE_AUTOENABLE` itself never changes autopilot-side, so
  // we only need to refresh it on the rising edge. Polling pauses whenever
  // the tab is hidden so we don't generate idle MAVLink traffic in the
  // background. The interval is intentionally lazy — enforcement state rarely
  // changes mid-flight, so a 10s cadence is enough to keep the UI honest
  // without flooding the link.
  const FENCE_ENABLE_POLL_INTERVAL_MS = 10000
  let fenceEnablePollHandle: ReturnType<typeof setInterval> | undefined
  const visibility = useDocumentVisibility()
  watch(
    [isArduPilot, lastUploadedPlan, () => mainVehicleStore.isVehicleOnline, visibility],
    ([isAP, plan, online, vis]) => {
      if (fenceEnablePollHandle !== undefined) {
        clearInterval(fenceEnablePollHandle)
        fenceEnablePollHandle = undefined
      }
      const baselineActive = Boolean(isAP && plan && online)
      if (!baselineActive) {
        fenceEnabled.value = undefined
        fenceAutoEnableMode.value = undefined
        return
      }
      if (vis !== 'visible') return
      refreshFenceEnabled()
      refreshFenceAutoEnable()
      fenceEnablePollHandle = setInterval(refreshFenceEnabled, FENCE_ENABLE_POLL_INTERVAL_MS)
    },
    { immediate: true }
  )

  // Pinia stores are app-singletons in production, so this never fires in the
  // running app. Kept for tests and any future caller that explicitly
  // `$dispose()`s the store, so the polling timer and parameter listener
  // don't outlive the store's effect scope.
  tryOnScopeDispose(() => {
    if (fenceEnablePollHandle !== undefined) {
      clearInterval(fenceEnablePollHandle)
      fenceEnablePollHandle = undefined
    }
    if (attachedVehicle) {
      attachedVehicle.onParameter.remove(fenceParamSlot)
      attachedVehicle = undefined
    }
  })

  const clearAll = (): void => {
    polygons.splice(0)
    circles.splice(0)
    breachReturn.value = undefined
    draft.setInteractive(undefined)
    markDirty()
    persistDraft()
  }

  const addPolygon = (anchor: FenceLatLng, inclusion: boolean): FencePolygon => {
    const halfSide = POLYGON_DEFAULT_HALF_SIDE_M
    const vertices: FenceLatLng[] = [
      offsetCoordinates(anchor, -halfSide, halfSide),
      offsetCoordinates(anchor, halfSide, halfSide),
      offsetCoordinates(anchor, halfSide, -halfSide),
      offsetCoordinates(anchor, -halfSide, -halfSide),
    ]
    const polygon: FencePolygon = { id: uuid(), inclusion, vertices }
    polygons.push(polygon)
    draft.setInteractive(polygon.id)
    markDirty()
    persistDraft()
    return polygon
  }

  const addCircle = (anchor: FenceLatLng, inclusion: boolean): FenceCircle => {
    const circle: FenceCircle = {
      id: uuid(),
      inclusion,
      center: [anchor[0], anchor[1]],
      radius: CIRCLE_DEFAULT_RADIUS_M,
    }
    circles.push(circle)
    draft.setInteractive(circle.id)
    markDirty()
    persistDraft()
    return circle
  }

  const updatePolygon = (id: string, update: Partial<Omit<FencePolygon, 'id'>>): void => {
    const polygon = polygons.find((p) => p.id === id)
    if (!polygon) return
    if (update.inclusion !== undefined) polygon.inclusion = update.inclusion
    if (update.vertices !== undefined) polygon.vertices = cloneVertices(update.vertices)
    markDirty()
    persistDraftDebounced()
  }

  const updateCircle = (id: string, update: Partial<Omit<FenceCircle, 'id'>>): void => {
    const circle = circles.find((c) => c.id === id)
    if (!circle) return
    if (update.inclusion !== undefined) circle.inclusion = update.inclusion
    if (update.center !== undefined) circle.center = [update.center[0], update.center[1]]
    if (update.radius !== undefined) circle.radius = Math.max(1, Math.min(CIRCLE_MAX_RADIUS_M, update.radius))
    markDirty()
    persistDraftDebounced()
  }

  const togglePolygonInclusion = (id: string): void => {
    const polygon = polygons.find((p) => p.id === id)
    if (!polygon) return
    updatePolygon(id, { inclusion: !polygon.inclusion })
  }

  const toggleCircleInclusion = (id: string): void => {
    const circle = circles.find((c) => c.id === id)
    if (!circle) return
    updateCircle(id, { inclusion: !circle.inclusion })
  }

  const deletePolygon = (id: string): void => {
    const idx = polygons.findIndex((p) => p.id === id)
    if (idx === -1) return
    polygons.splice(idx, 1)
    if (draft.interactiveShapeId === id) draft.setInteractive(undefined)
    markDirty()
    persistDraft()
  }

  const deleteCircle = (id: string): void => {
    const idx = circles.findIndex((c) => c.id === id)
    if (idx === -1) return
    circles.splice(idx, 1)
    if (draft.interactiveShapeId === id) draft.setInteractive(undefined)
    markDirty()
    persistDraft()
  }

  /**
   * Commits the polygon currently being drawn into the persistent fence
   * model. Requires at least 3 vertices, otherwise it cancels silently.
   * @returns { FencePolygon | undefined } The committed polygon, or `undefined` if not enough vertices.
   */
  const finishDrawingPolygon = (): FencePolygon | undefined => {
    if (!draft.isDrawingPolygon || draft.pendingPolygonVertices.length < 3) {
      draft.cancelDrawingPolygon()
      return undefined
    }
    const polygon: FencePolygon = {
      id: uuid(),
      inclusion: draft.pendingPolygonInclusion,
      vertices: cloneVertices(draft.pendingPolygonVertices),
    }
    polygons.push(polygon)
    draft.cancelDrawingPolygon()
    draft.setInteractive(polygon.id)
    markDirty()
    persistDraft()
    return polygon
  }

  /**
   * Commits the circle currently being drawn into the persistent fence
   * model. Requires a center and a radius >= 1m, otherwise it cancels
   * silently.
   * @returns { FenceCircle | undefined } The committed circle, or `undefined` if not enough data.
   */
  const finishDrawingCircle = (): FenceCircle | undefined => {
    if (!draft.isDrawingCircle || !draft.pendingCircleCenter || draft.pendingCircleRadius < 1) {
      draft.cancelDrawingCircle()
      return undefined
    }
    const circle: FenceCircle = {
      id: uuid(),
      inclusion: draft.pendingCircleInclusion,
      center: [draft.pendingCircleCenter[0], draft.pendingCircleCenter[1]],
      radius: draft.pendingCircleRadius,
    }
    circles.push(circle)
    draft.cancelDrawingCircle()
    draft.setInteractive(circle.id)
    markDirty()
    persistDraft()
    return circle
  }

  const setBreachReturn = (point: BreachReturnPoint | undefined): void => {
    breachReturn.value = point ? { coordinates: [...point.coordinates], altitude: point.altitude } : undefined
    markDirty()
    persistDraft()
  }

  /**
   * Loads a complete fence plan into the editor, replacing the current draft.
   * @param { GeoFencePlan } plan The plan to load.
   */
  const loadFromPlan = (plan: GeoFencePlan): void => {
    polygons.splice(
      0,
      polygons.length,
      ...plan.polygons.map((p) => ({
        id: p.id ?? uuid(),
        inclusion: p.inclusion,
        vertices: cloneVertices(p.vertices),
      }))
    )
    circles.splice(
      0,
      circles.length,
      ...plan.circles.map((c) => ({
        id: c.id ?? uuid(),
        inclusion: c.inclusion,
        center: [c.center[0], c.center[1]] as FenceLatLng,
        radius: c.radius,
      }))
    )
    breachReturn.value = plan.breachReturn
      ? { coordinates: [...plan.breachReturn.coordinates], altitude: plan.breachReturn.altitude }
      : undefined
    draft.setInteractive(undefined)
    markDirty()
    persistDraft()
  }

  /**
   * Snapshots the current editor state into a `GeoFencePlan` (e.g. for upload
   * or file export). Always returns a fresh deep copy.
   * @returns { GeoFencePlan } The current plan.
   */
  const exportPlan = (): GeoFencePlan => ({
    version: 2,
    polygons: polygons.map((p) => ({ id: p.id, inclusion: p.inclusion, vertices: cloneVertices(p.vertices) })),
    circles: circles.map((c) => ({
      id: c.id,
      inclusion: c.inclusion,
      center: [c.center[0], c.center[1]],
      radius: c.radius,
    })),
    breachReturn: breachReturn.value
      ? { coordinates: [...breachReturn.value.coordinates], altitude: breachReturn.value.altitude }
      : undefined,
  })

  const inclusionPolygonCount = computed<number>(() => polygons.filter((p) => p.inclusion).length)
  const hasItems = computed<boolean>(
    () => polygons.length > 0 || circles.length > 0 || breachReturn.value !== undefined
  )

  /**
   * Checks the given list of waypoints against the current editor fence
   * plan, with the uploaded plan as a fallback when the editor is empty.
   * @param { WaypointLike[] } waypoints Waypoints to test.
   * @returns { MissionBreachReport } Breach summary with offending indices.
   */
  const detectMissionBreaches = (waypoints: WaypointLike[]): MissionBreachReport => {
    // Read straight from the reactive editor state when it has shapes,
    // otherwise fall back to the (already plain) `lastUploadedPlan`. Avoids
    // a deep copy of every fence shape on every upload attempt.
    const editorHasFences = polygons.length > 0 || circles.length > 0
    const sourcePolygons: FencePolygon[] = editorHasFences ? polygons : lastUploadedPlan.value?.polygons ?? []
    const sourceCircles: FenceCircle[] = editorHasFences ? circles : lastUploadedPlan.value?.circles ?? []
    return detectMissionBreachesInShapes(waypoints, sourcePolygons, sourceCircles)
  }

  /**
   * Uploads the current editor state to the vehicle. Caches the uploaded
   * plan in `lastUploadedPlan` (also persisted to BlueOS) so the live
   * overlay on the flight Map widget can render it without re-downloading.
   * @param { MissionLoadingCallback } loadingCallback Callback invoked with progress.
   */
  const uploadToVehicle = async (loadingCallback?: MissionLoadingCallback): Promise<void> => {
    syncInProgress.value = true
    try {
      const plan = exportPlan()
      await mainVehicleStore.uploadFence(plan, loadingCallback ?? (async () => undefined))
      lastUploadedPlan.value = clonePlan(plan)
      persistedVehicleFence.value = clonePlan(plan)
      dirty.value = false

      // Auto-enable enforcement on ArduPilot so users don't need a second click
      // after upload, and arm `FENCE_AUTOENABLE` so subsequent auto-takeoffs
      // re-engage the fence even if it was manually disabled in between.
      // Failures are non-fatal: the user can still flip the dedicated toggle
      // from the Map widget and tweak the parameter from the parameters panel.
      if (isArduPilot.value) {
        try {
          setFenceEnabled(true)
          setFenceAutoEnable(1)
        } catch (error) {
          console.warn('Auto-enable of vehicle geofence failed:', error)
        }
      }

      openSnackbar({ variant: 'success', message: 'Geofence uploaded to vehicle.', duration: 3000 })
    } finally {
      syncInProgress.value = false
    }
  }

  /**
   * Downloads the current geofence from the vehicle, replaces the editor
   * state with it, and updates the cached `lastUploadedPlan`.
   * @param { MissionLoadingCallback } loadingCallback Callback invoked with progress.
   */
  const downloadFromVehicle = async (loadingCallback?: MissionLoadingCallback): Promise<void> => {
    syncInProgress.value = true
    try {
      const plan = await mainVehicleStore.fetchFence(loadingCallback ?? (async () => undefined))
      loadFromPlan(plan)
      lastUploadedPlan.value = clonePlan(plan)
      persistedVehicleFence.value = clonePlan(plan)
      dirty.value = false
      openSnackbar({ variant: 'success', message: 'Geofence downloaded from vehicle.', duration: 3000 })
    } finally {
      syncInProgress.value = false
    }
  }

  /**
   * Clears the geofence currently stored on the vehicle, and clears the
   * cached overlay so the live overlay control disappears.
   */
  const clearOnVehicle = async (): Promise<void> => {
    syncInProgress.value = true
    try {
      await mainVehicleStore.clearFence()
      lastUploadedPlan.value = undefined
      persistedVehicleFence.value = null
    } finally {
      syncInProgress.value = false
    }
  }

  return {
    polygons,
    circles,
    breachReturn,
    dirty,
    syncInProgress,
    lastUploadedPlan,
    isFenceSupported,
    isArduPilotPlane,
    isPx4,
    isArduPilot,
    fenceEnabled,
    fenceAutoEnableMode,
    setFenceEnabled,
    setFenceAutoEnable,
    refreshFenceEnabled,
    refreshFenceAutoEnable,
    inclusionPolygonCount,
    hasItems,
    detectMissionBreaches,
    addPolygon,
    addCircle,
    updatePolygon,
    updateCircle,
    togglePolygonInclusion,
    toggleCircleInclusion,
    deletePolygon,
    deleteCircle,
    finishDrawingPolygon,
    finishDrawingCircle,
    setBreachReturn,
    clearAll,
    loadFromPlan,
    exportPlan,
    uploadToVehicle,
    downloadFromVehicle,
    clearOnVehicle,
    polygonDefaults: { defaultHalfSideMeters: POLYGON_DEFAULT_HALF_SIDE_M, maxHalfSideMeters: POLYGON_MAX_HALF_SIDE_M },
    circleDefaults: { defaultRadiusMeters: CIRCLE_DEFAULT_RADIUS_M, maxRadiusMeters: CIRCLE_MAX_RADIUS_M },
  }
})
