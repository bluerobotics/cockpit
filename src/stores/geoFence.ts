import * as turf from '@turf/turf'
import { defineStore } from 'pinia'
import { v4 as uuid } from 'uuid'
import { computed, reactive, ref, watch } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { useSnackbar } from '@/composables/snackbar'
import { MavParamType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import type { Parameter } from '@/libs/vehicle/types'
import * as Vehicle from '@/libs/vehicle/vehicle'
import type { BreachReturnPoint, FenceCircle, FenceLatLng, FencePolygon, GeoFencePlan } from '@/types/geofence'
import type { MissionLoadingCallback } from '@/types/mission'

import { useMainVehicleStore } from './mainVehicle'

const POLYGON_DEFAULT_HALF_SIDE_M = 100
const POLYGON_MAX_HALF_SIDE_M = 1500
const CIRCLE_DEFAULT_RADIUS_M = 100
const CIRCLE_MAX_RADIUS_M = 1500

const EARTH_RADIUS_M = 6378137

/**
 * Minimal shape required by `detectMissionBreaches`. Accepts both Cockpit's
 * `Waypoint` and any caller-supplied object that exposes `[lat, lng]`
 * coordinates, so the breach check stays decoupled from the mission types.
 */
type WaypointLike = {
  /**
   * Geographic location of the waypoint as `[latitude, longitude]` in degrees.
   */
  coordinates: [number, number]
}

/**
 * Result of a `detectMissionBreaches` call.
 */
type MissionBreachReport = {
  /**
   * True when at least one waypoint breaches the active fence.
   */
  hasBreaches: boolean
  /**
   * Indices (within the input waypoint list) of every breaching waypoint.
   */
  breachedIndices: number[]
  /**
   * Total number of waypoints inspected.
   */
  totalChecked: number
  /**
   * False when no fence plan was available to check against (editor empty
   * and no `lastUploadedPlan`); callers can use this to differentiate "no
   * breaches" from "no fence to check".
   */
  hadPlan: boolean
}

const cloneVertices = (vertices: FenceLatLng[]): FenceLatLng[] => vertices.map(([lat, lng]) => [lat, lng])

const clonePlan = (plan: GeoFencePlan): GeoFencePlan => JSON.parse(JSON.stringify(plan)) as GeoFencePlan

/**
 * Computes the offset (in degrees) needed to move a point on the WGS84
 * spheroid by `dxMeters` east and `dyMeters` north. Used to seed default
 * polygon and circle sizes around a given anchor.
 * @param { FenceLatLng } anchor The anchor point `[lat, lng]`.
 * @param { number } dxMeters Offset east in meters.
 * @param { number } dyMeters Offset north in meters.
 * @returns { FenceLatLng } The offset coordinates.
 */
const offsetCoordinates = (anchor: FenceLatLng, dxMeters: number, dyMeters: number): FenceLatLng => {
  const [lat, lng] = anchor
  const dLat = (dyMeters / EARTH_RADIUS_M) * (180 / Math.PI)
  const dLng = ((dxMeters / EARTH_RADIUS_M) * (180 / Math.PI)) / Math.cos((lat * Math.PI) / 180)
  return [lat + dLat, lng + dLng]
}

export const useGeoFenceStore = defineStore('geo-fence', () => {
  const mainVehicleStore = useMainVehicleStore()
  const { openSnackbar } = useSnackbar()

  const polygons = reactive<FencePolygon[]>([])
  const circles = reactive<FenceCircle[]>([])
  const breachReturn = ref<BreachReturnPoint | undefined>(undefined)

  const dirty = ref(false)
  const syncInProgress = ref(false)
  const lastUploadedPlan = ref<GeoFencePlan | undefined>(undefined)

  const draftFence = useBlueOsStorage<GeoFencePlan>('cockpit-draft-fence', {
    version: 2,
    polygons: [],
    circles: [],
  })
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

  // Single "interactive" shape selector — only one polygon/circle is in
  // edit mode at any given time so vertex handles, the type switch, and
  // the delete button always operate on an unambiguous target.
  const interactiveShapeId = ref<string | undefined>(undefined)

  // Click-to-draw state for the polygon-fence creation flow. Mirrors the
  // `isDrawingSurveyPolygon` pattern in `MissionPlanningView`: while `true`,
  // map clicks append vertices to `pendingPolygonVertices` instead of doing
  // their normal behavior. The polygon is only committed once the user
  // finishes (>=3 vertices).
  const isDrawingPolygon = ref(false)
  const pendingPolygonInclusion = ref(true)
  const pendingPolygonVertices = reactive<FenceLatLng[]>([])

  // Two-click draw state for the circle-fence creation flow:
  // 1) first map click sets `pendingCircleCenter`; 2) mouse-move updates
  // `pendingCircleRadius` live; 3) second map click commits the circle.
  const isDrawingCircle = ref(false)
  const pendingCircleInclusion = ref(true)
  const pendingCircleCenter = ref<FenceLatLng | undefined>(undefined)
  const pendingCircleRadius = ref(0)

  const markDirty = (): void => {
    dirty.value = true
  }

  const persistDraft = (): void => {
    draftFence.value = exportPlan()
  }

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
   * @returns { Promise<void> } Resolves once the PARAM_SET request has been sent.
   */
  const setFenceEnabled = async (enabled: boolean): Promise<void> => {
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
   * @returns { Promise<void> } Resolves once the PARAM_SET request has been sent.
   */
  const setFenceAutoEnable = async (mode: number): Promise<void> => {
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
  // we only need to refresh it on the rising edge.
  const FENCE_ENABLE_POLL_INTERVAL_MS = 3000
  let fenceEnablePollHandle: ReturnType<typeof setInterval> | undefined
  watch(
    [isArduPilot, lastUploadedPlan, () => mainVehicleStore.isVehicleOnline],
    ([isAP, plan, online]) => {
      if (fenceEnablePollHandle !== undefined) {
        clearInterval(fenceEnablePollHandle)
        fenceEnablePollHandle = undefined
      }
      if (isAP && plan && online) {
        refreshFenceEnabled()
        refreshFenceAutoEnable()
        fenceEnablePollHandle = setInterval(refreshFenceEnabled, FENCE_ENABLE_POLL_INTERVAL_MS)
      } else {
        fenceEnabled.value = undefined
        fenceAutoEnableMode.value = undefined
      }
    },
    { immediate: true }
  )

  const setInteractive = (id: string | undefined): void => {
    interactiveShapeId.value = id
  }

  const clearAll = (): void => {
    polygons.splice(0)
    circles.splice(0)
    breachReturn.value = undefined
    interactiveShapeId.value = undefined
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
    interactiveShapeId.value = polygon.id
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
    interactiveShapeId.value = circle.id
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
    persistDraft()
  }

  const updateCircle = (id: string, update: Partial<Omit<FenceCircle, 'id'>>): void => {
    const circle = circles.find((c) => c.id === id)
    if (!circle) return
    if (update.inclusion !== undefined) circle.inclusion = update.inclusion
    if (update.center !== undefined) circle.center = [update.center[0], update.center[1]]
    if (update.radius !== undefined) circle.radius = Math.max(1, Math.min(CIRCLE_MAX_RADIUS_M, update.radius))
    markDirty()
    persistDraft()
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
    if (interactiveShapeId.value === id) interactiveShapeId.value = undefined
    markDirty()
    persistDraft()
  }

  const deleteCircle = (id: string): void => {
    const idx = circles.findIndex((c) => c.id === id)
    if (idx === -1) return
    circles.splice(idx, 1)
    if (interactiveShapeId.value === id) interactiveShapeId.value = undefined
    markDirty()
    persistDraft()
  }

  /**
   * Enters the click-to-draw polygon-fence flow. Clears any previously
   * pending vertices so a fresh polygon can be drawn.
   * @param { boolean } inclusion Whether the polygon being drawn is an inclusion fence.
   */
  const startDrawingPolygon = (inclusion: boolean): void => {
    pendingPolygonInclusion.value = inclusion
    pendingPolygonVertices.splice(0)
    isDrawingPolygon.value = true
    interactiveShapeId.value = undefined
  }

  /**
   * Appends a vertex to the polygon currently being drawn. No-op when the
   * editor is not in drawing mode.
   * @param { FenceLatLng } vertex The vertex to append, in `[lat, lng]`.
   */
  const addPendingPolygonVertex = (vertex: FenceLatLng): void => {
    if (!isDrawingPolygon.value) return
    pendingPolygonVertices.push([vertex[0], vertex[1]])
  }

  /**
   * Removes the last vertex appended to the polygon currently being drawn.
   * Used by the editor's "undo last vertex" affordance.
   */
  const popPendingPolygonVertex = (): void => {
    if (!isDrawingPolygon.value) return
    pendingPolygonVertices.pop()
  }

  /**
   * Commits the polygon currently being drawn into the persistent fence
   * model. Requires at least 3 vertices, otherwise it cancels silently.
   * @returns { FencePolygon | undefined } The committed polygon, or `undefined` if not enough vertices.
   */
  const finishDrawingPolygon = (): FencePolygon | undefined => {
    if (!isDrawingPolygon.value || pendingPolygonVertices.length < 3) {
      cancelDrawingPolygon()
      return undefined
    }
    const polygon: FencePolygon = {
      id: uuid(),
      inclusion: pendingPolygonInclusion.value,
      vertices: cloneVertices(pendingPolygonVertices),
    }
    polygons.push(polygon)
    pendingPolygonVertices.splice(0)
    isDrawingPolygon.value = false
    interactiveShapeId.value = polygon.id
    markDirty()
    persistDraft()
    return polygon
  }

  /**
   * Aborts the polygon currently being drawn, discarding any pending vertices.
   */
  const cancelDrawingPolygon = (): void => {
    pendingPolygonVertices.splice(0)
    isDrawingPolygon.value = false
  }

  /**
   * Enters the click-to-draw circle-fence flow. Clears any pending center /
   * radius so a fresh circle can be drawn.
   * @param { boolean } inclusion Whether the circle being drawn is an inclusion fence.
   */
  const startDrawingCircle = (inclusion: boolean): void => {
    pendingCircleInclusion.value = inclusion
    pendingCircleCenter.value = undefined
    pendingCircleRadius.value = 0
    isDrawingCircle.value = true
    interactiveShapeId.value = undefined
  }

  /**
   * Sets the center of the circle currently being drawn (first map click).
   * No-op when the editor is not in circle drawing mode.
   * @param { FenceLatLng } center The center coordinates, in `[lat, lng]`.
   */
  const setPendingCircleCenter = (center: FenceLatLng): void => {
    if (!isDrawingCircle.value) return
    pendingCircleCenter.value = [center[0], center[1]]
    pendingCircleRadius.value = 0
  }

  /**
   * Updates the radius (in meters) of the circle currently being drawn. The
   * radius is clamped to `[1, CIRCLE_MAX_RADIUS_M]`. No-op when the editor
   * is not in circle drawing mode or the center has not yet been set.
   * @param { number } radius The new radius in meters.
   */
  const setPendingCircleRadius = (radius: number): void => {
    if (!isDrawingCircle.value || !pendingCircleCenter.value) return
    pendingCircleRadius.value = Math.max(1, Math.min(CIRCLE_MAX_RADIUS_M, radius))
  }

  /**
   * Commits the circle currently being drawn into the persistent fence
   * model. Requires a center and a radius >= 1m, otherwise it cancels
   * silently.
   * @returns { FenceCircle | undefined } The committed circle, or `undefined` if not enough data.
   */
  const finishDrawingCircle = (): FenceCircle | undefined => {
    if (!isDrawingCircle.value || !pendingCircleCenter.value || pendingCircleRadius.value < 1) {
      cancelDrawingCircle()
      return undefined
    }
    const circle: FenceCircle = {
      id: uuid(),
      inclusion: pendingCircleInclusion.value,
      center: [pendingCircleCenter.value[0], pendingCircleCenter.value[1]],
      radius: pendingCircleRadius.value,
    }
    circles.push(circle)
    pendingCircleCenter.value = undefined
    pendingCircleRadius.value = 0
    isDrawingCircle.value = false
    interactiveShapeId.value = circle.id
    markDirty()
    persistDraft()
    return circle
  }

  /**
   * Aborts the circle currently being drawn, discarding any pending data.
   */
  const cancelDrawingCircle = (): void => {
    pendingCircleCenter.value = undefined
    pendingCircleRadius.value = 0
    isDrawingCircle.value = false
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
    interactiveShapeId.value = undefined
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
   * Tests whether a `[lat, lng]` point lies inside the polygon defined by
   * the given vertex ring. Vertices are given in `[lat, lng]` order, the
   * ring is implicitly closed, and the check uses turf's well-tested
   * `booleanPointInPolygon` (ray casting).
   * @param { FenceLatLng } point The `[lat, lng]` point to test.
   * @param { FenceLatLng[] } vertices Polygon vertices `[lat, lng]`, open ring.
   * @returns { boolean } True if the point is inside the polygon.
   */
  const isPointInsidePolygon = (point: FenceLatLng, vertices: FenceLatLng[]): boolean => {
    if (vertices.length < 3) return false
    const closed = [...vertices, vertices[0]]
    const turfPoly = turf.polygon([closed.map(([lat, lng]) => [lng, lat])])
    const turfPoint = turf.point([point[1], point[0]])
    return turf.booleanPointInPolygon(turfPoint, turfPoly)
  }

  /**
   * Great-circle distance in meters between two `[lat, lng]` points using
   * turf's haversine implementation.
   * @param { FenceLatLng } a First `[lat, lng]` point.
   * @param { FenceLatLng } b Second `[lat, lng]` point.
   * @returns { number } Distance between the two points in meters.
   */
  const distanceMeters = (a: FenceLatLng, b: FenceLatLng): number => {
    return turf.distance(turf.point([a[1], a[0]]), turf.point([b[1], b[0]]), { units: 'meters' })
  }

  /**
   * Checks the given list of waypoints against the current editor fence
   * plan, with the uploaded plan as a fallback when the editor is empty.
   * A waypoint is flagged when it sits outside every inclusion shape (and
   * at least one inclusion shape exists) or inside any exclusion shape.
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
    if (sourcePolygons.length === 0 && sourceCircles.length === 0) {
      return { hasBreaches: false, breachedIndices: [], totalChecked: waypoints.length, hadPlan: false }
    }

    const inclusionPolygons = sourcePolygons.filter((p) => p.inclusion)
    const exclusionPolygons = sourcePolygons.filter((p) => !p.inclusion)
    const inclusionCircles = sourceCircles.filter((c) => c.inclusion)
    const exclusionCircles = sourceCircles.filter((c) => !c.inclusion)
    const hasInclusion = inclusionPolygons.length > 0 || inclusionCircles.length > 0

    const breachedIndices: number[] = []
    waypoints.forEach((wp, index) => {
      const point: FenceLatLng = [wp.coordinates[0], wp.coordinates[1]]
      const insideAnyInclusion =
        !hasInclusion ||
        inclusionPolygons.some((p) => isPointInsidePolygon(point, p.vertices)) ||
        inclusionCircles.some((c) => distanceMeters(point, c.center) <= c.radius)
      const insideAnyExclusion =
        exclusionPolygons.some((p) => isPointInsidePolygon(point, p.vertices)) ||
        exclusionCircles.some((c) => distanceMeters(point, c.center) <= c.radius)
      if (!insideAnyInclusion || insideAnyExclusion) breachedIndices.push(index)
    })

    return {
      hasBreaches: breachedIndices.length > 0,
      breachedIndices,
      totalChecked: waypoints.length,
      hadPlan: true,
    }
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
          await setFenceEnabled(true)
          await setFenceAutoEnable(1)
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
    interactiveShapeId,
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
    isDrawingPolygon,
    pendingPolygonInclusion,
    pendingPolygonVertices,
    isDrawingCircle,
    pendingCircleInclusion,
    pendingCircleCenter,
    pendingCircleRadius,
    addPolygon,
    addCircle,
    updatePolygon,
    updateCircle,
    togglePolygonInclusion,
    toggleCircleInclusion,
    deletePolygon,
    deleteCircle,
    startDrawingPolygon,
    addPendingPolygonVertex,
    popPendingPolygonVertex,
    finishDrawingPolygon,
    cancelDrawingPolygon,
    startDrawingCircle,
    setPendingCircleCenter,
    setPendingCircleRadius,
    finishDrawingCircle,
    cancelDrawingCircle,
    setBreachReturn,
    setInteractive,
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
