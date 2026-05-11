import L, { type Map as LeafletMap } from 'leaflet'
import { computed, watch } from 'vue'

import { useTraveledDistances } from '@/composables/useTraveledDistances'
import { useMissionStore } from '@/stores/mission'

/**
 * Return type of {@link useVehicleHistoryOverlay}.
 */
export interface UseVehicleHistoryOverlayReturn {
  /** Binds the trail to a Leaflet map and starts following the vehicle position history. */
  initVehicleHistory: (map: LeafletMap, isDrawable: () => boolean) => void
  /** Removes the trail and stops following the history. */
  destroyVehicleHistory: () => void
}

/**
 * Draws the vehicle position history as a polyline on a Leaflet map, with a tooltip reporting the total
 * and current-mission traveled distances and a button to reset the mission odometer. Shared by the Map
 * widget and the Mission Planning view, which both render the same trail.
 * @returns {UseVehicleHistoryOverlayReturn} Methods to initialize, refresh, and tear down the trail.
 */
export const useVehicleHistoryOverlay = (): UseVehicleHistoryOverlayReturn => {
  const missionStore = useMissionStore()
  const { formattedTotalDistance, formattedMissionDistance } = useTraveledDistances()

  // Dedicated Canvas renderer to prevent performance issues, since the trail can reach hundreds of
  // thousands of points.
  const renderer = L.canvas()

  let mapRef: LeafletMap | undefined
  let isDrawable: () => boolean = () => true
  let polyline: L.Polyline | undefined
  let lastDrawnLength = 0
  let stopHistoryWatch: (() => void) | undefined
  let stopTooltipWatch: (() => void) | undefined

  const tooltipContent = computed<string>(
    () => `
    <div class="history-tooltip-row">
      <span class="history-tooltip-label">
        <i class="mdi mdi-counter"></i>
        Total:
      </span>
      <span class="history-tooltip-value">${formattedTotalDistance.value}</span>
    </div>
    <div class="history-tooltip-row">
      <span class="history-tooltip-label">Mission:</span>
      <span class="history-tooltip-row-value-group">
        <button
          type="button"
          class="history-tooltip-reset"
          title="Reset mission distance"
          aria-label="Reset mission distance"
        >
          <i class="mdi mdi-restore"></i>
        </button>
        <span class="history-tooltip-value">${formattedMissionDistance.value}</span>
      </span>
    </div>
  `
  )

  const attachTooltip = (trail: L.Polyline): void => {
    // Pass content as a function so every Leaflet re-evaluation reads the latest reactive value.
    // The watcher in `initVehicleHistory` complements this by pushing live updates while the tooltip
    // is already open.
    trail.bindTooltip(() => tooltipContent.value, {
      sticky: true,
      direction: 'top',
      className: 'history-polyline-tooltip',
      opacity: 1,
    })
    trail.on('click', (event: L.LeafletMouseEvent) => trail.openTooltip(event.latlng))
  }

  const removeTrail = (): void => {
    if (polyline && mapRef) mapRef.removeLayer(polyline)
    polyline = undefined
    lastDrawnLength = 0
  }

  const draw = (): void => {
    const points = missionStore.vehiclePositionHistory
    if (!mapRef || !isDrawable() || points.length === 0) {
      removeTrail()
      return
    }

    if (polyline === undefined) {
      polyline = L.polyline([], { color: '#ffff00', renderer }).addTo(mapRef)
      lastDrawnLength = 0
      attachTooltip(polyline)
    }

    if (points.length > lastDrawnLength && lastDrawnLength > 0) {
      // Append only the new points — O(1) per fire instead of O(N) full rebuild.
      for (let i = lastDrawnLength; i < points.length; i++) {
        polyline.addLatLng(points[i] as L.LatLngExpression)
      }
    } else {
      // First draw, or the history shrank (clear/simplify) / stayed same length (push+shift):
      // fall back to a full rebuild to stay correct.
      polyline.setLatLngs(points as L.LatLngExpression[])
    }
    lastDrawnLength = points.length
  }

  // The tooltip's inner DOM is replaced on every setContent, so the reset-button click is delegated on
  // document instead of bound to the button element.
  const onResetClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null
    if (!target?.closest('.history-tooltip-reset')) return
    event.stopPropagation()
    missionStore.resetMissionDistance()
  }

  const initVehicleHistory = (map: LeafletMap, drawable: () => boolean): void => {
    mapRef = map
    isDrawable = drawable
    stopHistoryWatch = watch(() => missionStore.vehiclePositionHistoryRevision, draw)
    stopTooltipWatch = watch(tooltipContent, (content) => polyline?.getTooltip()?.setContent(content))
    document.addEventListener('click', onResetClick, true)
    draw()
  }

  const destroyVehicleHistory = (): void => {
    stopHistoryWatch?.()
    stopTooltipWatch?.()
    stopHistoryWatch = undefined
    stopTooltipWatch = undefined
    document.removeEventListener('click', onResetClick, true)
    removeTrail()
    mapRef = undefined
  }

  return { initVehicleHistory, destroyVehicleHistory }
}
