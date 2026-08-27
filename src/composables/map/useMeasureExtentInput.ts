import L, { type Map as LeafletMap } from 'leaflet'
import { type ComputedRef, type Ref, computed, onBeforeUnmount, ref, shallowRef } from 'vue'

import { clampExtent, minExtentInMeters, pointAtDistanceToward } from '@/libs/map/typed-extent'

/** A segment on the map whose extent can be typed instead of drawn. */
export interface MeasureExtentTarget {
  /** What the segment measures, named as it is read out and logged. */
  label: string
  /** Where the segment starts. */
  from: L.LatLng
  /** Where the segment ends. */
  to: L.LatLng
  /** Extent the segment currently has, in meters, which is the number a backspace starts deleting from. */
  liveValue: number
  /** Redraws the segment, so what is typed shows on the map without waiting for the cursor to move again. */
  refresh: () => void
  /** Takes the typed extent as final, the way a click on the map would, and moves the drawing on. */
  apply: () => void
}

/** An extent field laid over the map, ready to be rendered. */
export interface MeasureExtentBox {
  /** Identifies which extent the field types. */
  id: string
  /** What the field measures, named as it is read out and logged. */
  label: string
  /** Distance from the left of the map, in pixels. */
  left: number
  /** Distance from the top of the map, in pixels. */
  top: number
  /** Extent that has been typed, in meters, or null while the segment still follows the cursor. */
  value: number | null
  /** Extent the tag is reading back while nothing has been typed, in meters. */
  liveValue: number
  /** Whether the number was typed away, which leaves the field empty on purpose rather than untouched. */
  cleared: boolean
  /** Whether the field takes the keyboard as it appears. */
  autofocus: boolean
  /** Bumped whenever the keyboard is asked for again, since a field already focused sees no prop change. */
  focusTicket: number
}

/** Wiring {@link useMeasureExtentInput} needs from the view that measures on the map. */
export interface UseMeasureExtentInputOptions {
  /** Which extent the keyboard shortcut hands the field to, or null when nothing is being measured. */
  shortcutFocus: () => string | null
  /** Called once the fields are up, so the segment they were asked for can be redrawn under them. */
  onOpened: () => void
}

/** Return type of {@link useMeasureExtentInput}. */
export interface UseMeasureExtentInputReturn {
  /** The fields to render over the map. */
  extentBoxes: ComputedRef<MeasureExtentBox[]>
  /** Whether typing is currently offered. */
  extentInputsOpen: Ref<boolean>
  /** Offers typing, handing the keyboard to the given extent. */
  openExtentInputs: (focusId: string) => void
  /** Hands the keyboard back to an extent whose field is already up, after a tap on its tag. */
  focusExtentInput: (id: string) => void
  /** Withdraws the offer and forgets what was typed. */
  closeExtentInputs: () => void
  /** Forgets what was typed, leaving the fields up for the next segment. */
  clearExtentValues: () => void
  /** Points an extent at a segment, or takes it off the map with null. */
  setExtentTarget: (id: string, target: MeasureExtentTarget | null) => void
  /** Records what was typed for an extent. */
  setExtentValue: (id: string, value: number | null) => void
  /** Takes what was typed for an extent as final. */
  applyExtent: (id: string) => void
  /** Whether an extent was typed away, so its tag reads blank instead of the measure it was showing. */
  isExtentCleared: (id: string) => boolean
  /** Applies a typed extent to a point still being chosen with the cursor, keeping only its direction. */
  projectToLockedExtent: (id: string, from: L.LatLng, towards: L.LatLng) => L.LatLng
  /** Binds the fields to a Leaflet map. */
  initExtentInputs: (map: LeafletMap) => void
}

/**
 * Offers the extents being measured on the map as typed numbers: one field per live measurement tag, sitting on the
 * tag itself, whose value takes that extent over while the cursor keeps choosing the direction or the side. The
 * field is rendered invisible, since the tag under it already reads back the number as it is typed.
 * @param {UseMeasureExtentInputOptions} options - What the shortcut opens and what to redraw once it has.
 * @returns {UseMeasureExtentInputReturn} The fields to render and the handlers to drive and read them.
 */
export const useMeasureExtentInput = (options: UseMeasureExtentInputOptions): UseMeasureExtentInputReturn => {
  const { shortcutFocus, onOpened } = options

  let mapRef: LeafletMap | undefined

  const extentInputsOpen = ref(false)
  const focusedId = ref<string | null>(null)
  const focusTicket = ref(0)
  // Shallow so the coordinates and the redraw handlers the consumers hand over are kept as they were given.
  const targets = shallowRef<Record<string, MeasureExtentTarget>>({})
  const values = ref<Record<string, number | null>>({})

  const initExtentInputs = (map: LeafletMap): void => {
    mapRef = map
  }

  const boxPosition = (map: LeafletMap, target: MeasureExtentTarget): Pick<MeasureExtentBox, 'left' | 'top'> => {
    const from = map.latLngToContainerPoint(target.from)
    const to = map.latLngToContainerPoint(target.to)

    return { left: (from.x + to.x) / 2, top: (from.y + to.y) / 2 }
  }

  // A recorded null is a number that was typed away, while an id nobody recorded was never typed into at all.
  const isExtentCleared = (id: string): boolean => id in values.value && values.value[id] == null

  const extentBoxes = computed<MeasureExtentBox[]>(() => {
    const map = mapRef
    if (!extentInputsOpen.value || !map) return []

    return Object.entries(targets.value).map(([id, target]) => ({
      id,
      label: target.label,
      ...boxPosition(map, target),
      value: values.value[id] ?? null,
      liveValue: target.liveValue,
      cleared: isExtentCleared(id),
      autofocus: id === focusedId.value,
      focusTicket: focusTicket.value,
    }))
  })

  const openExtentInputs = (focusId: string): void => {
    extentInputsOpen.value = true
    focusedId.value = focusId
    values.value = {}
  }

  const focusExtentInput = (id: string): void => {
    focusedId.value = id
    focusTicket.value += 1
  }

  const closeExtentInputs = (): void => {
    if (!extentInputsOpen.value) return

    extentInputsOpen.value = false
    focusedId.value = null
    values.value = {}
  }

  const clearExtentValues = (): void => {
    values.value = {}
  }

  const setExtentTarget = (id: string, target: MeasureExtentTarget | null): void => {
    const known = id in targets.value
    // The consumers follow the cursor whether or not typing was ever asked for, so a closed box records nothing.
    if (!extentInputsOpen.value && !known) return

    if (target) {
      targets.value = { ...targets.value, [id]: target }
      return
    }
    if (!known) return
    // The box being typed into keeps its place, since dropping the target unmounts the field and takes the
    // keyboard with it, and the segment it measures is cleared for a frame every time a point is placed.
    if (extentInputsOpen.value && focusedId.value === id) return

    const remaining = { ...targets.value }
    delete remaining[id]
    targets.value = remaining
  }

  const setExtentValue = (id: string, value: number | null): void => {
    values.value = { ...values.value, [id]: value }
    targets.value[id]?.refresh()
  }

  const applyExtent = (id: string): void => {
    targets.value[id]?.apply()
  }

  // The extent typed for an id, held to the flyable range, or null when nothing was typed.
  const lockedExtent = (id: string): number | null => {
    const value = values.value[id]
    return value != null && Number.isFinite(value) ? clampExtent(value, minExtentInMeters) : null
  }

  const projectToLockedExtent = (id: string, from: L.LatLng, towards: L.LatLng): L.LatLng => {
    const locked = lockedExtent(id)
    if (locked === null) return towards

    const [lat, lng] = pointAtDistanceToward([from.lat, from.lng], [towards.lat, towards.lng], locked)
    return L.latLng(lat, lng)
  }

  // Shapes that do not put the box up on their own are typed by asking for it, and the ones that do can bring it
  // back after it was dismissed.
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key.toLowerCase() !== 't' || event.ctrlKey || event.metaKey || event.altKey) return

    const target = event.target as HTMLElement | null
    if (target && (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable)) return

    if (extentInputsOpen.value) {
      logUserAction('Hid the distance box')
      closeExtentInputs()
      return
    }

    const focusId = shortcutFocus()
    if (!focusId) return

    logUserAction('Showed the distance box')
    openExtentInputs(focusId)
    onOpened()
  }

  window.addEventListener('keydown', onKeyDown)
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))

  return {
    extentBoxes,
    extentInputsOpen,
    openExtentInputs,
    focusExtentInput,
    closeExtentInputs,
    clearExtentValues,
    setExtentTarget,
    setExtentValue,
    applyExtent,
    isExtentCleared,
    projectToLockedExtent,
    initExtentInputs,
  }
}
