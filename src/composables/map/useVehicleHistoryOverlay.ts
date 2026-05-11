import L, { type LatLng, type LayerGroup, type LeafletMouseEvent, type Map as LeafletMap, type Polyline } from 'leaflet'
import { t } from 'ttag'
import { type ShallowRef, computed, onBeforeUnmount, watch } from 'vue'

import { useTraveledDistances } from '@/composables/useTraveledDistances'
import { useMissionStore } from '@/stores/mission'

const trailHitTolerancePx = 6

/**
 * Opens a tooltip reporting the total and current-mission traveled distances, with a button to reset
 * the mission odometer, when the user clicks the drawn vehicle trail. The trail stays click-through, so
 * it is hit-tested from the map click instead of listening for the pointer itself.
 * @param {ShallowRef<LeafletMap | undefined>} map - The Leaflet map the trail is drawn on.
 * @param {LayerGroup} trail - The group holding the drawn trail segments.
 * @returns {void}
 */
export const useVehicleHistoryOverlay = (map: ShallowRef<LeafletMap | undefined>, trail: LayerGroup): void => {
  const missionStore = useMissionStore()
  const { formattedTotalDistance, formattedMissionDistance } = useTraveledDistances()

  const resetLabel = t`Reset mission distance`
  const totalLabel = t`Total:`
  const missionLabel = t`Mission:`

  const resetButton = `
        <button
          type="button"
          class="history-tooltip-reset"
          title="${resetLabel}"
          aria-label="${resetLabel}"
        >
          <i class="mdi mdi-restore"></i>
        </button>`

  const tooltipContent = computed<string>(
    () => `
    <div class="history-tooltip-row">
      <span class="history-tooltip-label">
        <i class="mdi mdi-counter"></i>
        ${totalLabel}
      </span>
      <span class="history-tooltip-value">${formattedTotalDistance.value}</span>
    </div>
    <div class="history-tooltip-row">
      <span class="history-tooltip-label">${missionLabel}</span>
      <span class="history-tooltip-row-value-group">${missionStore.areOdometersAvailable ? resetButton : ''}
        <span class="history-tooltip-value">${formattedMissionDistance.value}</span>
      </span>
    </div>
  `
  )

  const tooltip = L.tooltip({ direction: 'top', interactive: true, className: 'history-polyline-tooltip', opacity: 1 })
  tooltip.setContent(tooltipContent.value)
  const stopTooltipWatch = watch(tooltipContent, (content) => tooltip.setContent(content))

  const isNearTrail = (instance: LeafletMap, latlng: LatLng): boolean => {
    const point = instance.latLngToLayerPoint(latlng)
    const reach = L.point(trailHitTolerancePx, trailHitTolerancePx)
    const clickBounds = L.latLngBounds(
      instance.layerPointToLatLng(point.subtract(reach)),
      instance.layerPointToLatLng(point.add(reach))
    )
    return (trail.getLayers() as Polyline[]).some((line) => {
      if (!line.getBounds().intersects(clickBounds)) return false
      return (line.closestLayerPoint(point)?.distanceTo(point) ?? Infinity) <= trailHitTolerancePx
    })
  }

  let instance: LeafletMap | undefined

  const onMapClick = (event: LeafletMouseEvent): void => {
    if (!instance || tooltip.getElement()?.contains(event.originalEvent.target as Node)) return
    if (!isNearTrail(instance, event.latlng)) {
      tooltip.close()
      return
    }
    logUserAction('Opened the traveled distances tooltip on the vehicle trail')
    tooltip.setLatLng(event.latlng).openOn(instance)
  }

  // The tooltip's inner DOM is replaced on every setContent, so the reset-button click is delegated on
  // the map container instead of bound to the button element.
  const onResetClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null
    if (!target?.closest('.history-tooltip-reset')) return
    event.stopPropagation()
    missionStore.resetMissionDistance()
  }

  const detach = (): void => {
    instance?.off('click', onMapClick)
    instance?.getContainer().removeEventListener('click', onResetClick, true)
    tooltip.remove()
    instance = undefined
  }

  const stopMapWatch = watch(
    map,
    (newInstance) => {
      detach()
      if (!newInstance) return
      instance = newInstance
      instance.on('click', onMapClick)
      instance.getContainer().addEventListener('click', onResetClick, true)
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    stopMapWatch()
    stopTooltipWatch()
    detach()
  })
}
