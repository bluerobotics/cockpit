<template>
  <div
    class="minimap-root"
    :class="[
      widgetStore.editingMode ? 'pointer-events-none' : 'pointer-events-auto',
      { 'minimap-root--offline': targetOffline },
    ]"
  >
    <div ref="mapEl" class="minimap-canvas"></div>
    <v-icon
      class="minimap-drag-handle"
      color="white"
      aria-label="Drag to move the MiniMap"
      title="Drag to move the MiniMap"
      @mousedown="enableMovingOnDrag"
      @mouseup="disableMovingOnDrag"
      >mdi-drag</v-icon
    >
    <div
      v-if="showVehicleGlyph"
      class="minimap-vehicle"
      :style="{ transform: `translate(-50%, -50%) rotate(${vehicleRotation}deg)` }"
    >
      <img class="minimap-vehicle-icon" :src="vehicleImageUrl" alt="Vehicle" />
    </div>
    <PoiMapArrows
      :map-ready="mapReady"
      :show-poi-arrows="widget.options.showPois"
      :show-home-arrow="false"
      :show-vehicle-arrow="trackingPoi"
      :show-base-station-arrow="false"
      :vehicle-position="vehiclePosition"
      :home="undefined"
      :base-station="undefined"
      :map-center="mapCenter"
      :zoom="zoom"
      boundary="circle"
      :bearing="bearing"
      :interactive="false"
    />
    <button
      v-if="widget.options.showNorthIndicator"
      type="button"
      class="minimap-north"
      :class="{ 'minimap-north--active': !effectiveHeadingUp }"
      aria-label="Align map to north"
      title="Align map to north"
      @click="toggleHeadingUp"
    >
      <MapNorthIndicator
        :style="{
          transform: `rotate(${northRotation}deg)`,
          width: 'clamp(20px, 11cqmin, 34px)',
          height: 'clamp(20px, 11cqmin, 34px)',
          borderRadius: '50%',
          padding: '5px',
        }"
      />
    </button>
    <div v-if="targetOffline" class="minimap-offline-overlay flex items-center justify-center">
      <span class="minimap-offline-text">{{ offlineText }}</span>
    </div>
  </div>

  <v-dialog v-model="widgetStore.widgetManagerVars(widget.hash).configMenuOpen" min-width="400" max-width="35%">
    <v-card class="py-2 px-5" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-center">MiniMap widget settings</v-card-title>
      <v-btn
        class="absolute top-2 right-2 text-lg rounded-full"
        icon
        variant="text"
        size="small"
        aria-label="Close the MiniMap settings"
        @click="closeConfig"
      >
        <v-icon>mdi-close</v-icon>
      </v-btn>
      <v-card-text>
        <v-select
          :model-value="selectedTileProvider"
          label="Map provider"
          :items="tileProviderItems"
          variant="outlined"
          density="compact"
          hide-details
          theme="dark"
          class="my-3"
          @update:model-value="onTileProviderSelected"
        />
        <v-slider
          v-model="widget.options.edgeFadeAmount"
          label="Edge fade"
          color="white"
          :min="0"
          :max="0.9"
          :step="0.05"
          thumb-label
          hide-details
          class="mt-4 mb-2 w-[90%]"
          @end="onEdgeFadeCommitted"
        />

        <v-switch
          v-model="widget.options.headingUp"
          :disabled="trackingPoi"
          label="Rotate map so the vehicle points up"
          :color="widget.options.headingUp ? 'white' : undefined"
          hide-details
          @update:model-value="onHeadingUpToggled"
        />
        <v-switch
          v-model="widget.options.showMission"
          label="Mission"
          :color="widget.options.showMission ? 'white' : undefined"
          hide-details
          @update:model-value="onShowMissionToggled"
        />
        <v-switch
          v-model="widget.options.showVehiclePath"
          label="Vehicle path"
          :color="widget.options.showVehiclePath ? 'white' : undefined"
          hide-details
          @update:model-value="onShowVehiclePathToggled"
        />
        <v-switch
          v-model="widget.options.showPois"
          label="Points of interest"
          :color="widget.options.showPois ? 'white' : undefined"
          hide-details
          @update:model-value="onShowPoisToggled"
        />
        <v-switch
          v-model="widget.options.showNorthIndicator"
          label="North indicator"
          :color="widget.options.showNorthIndicator ? 'white' : undefined"
          hide-details
          @update:model-value="onShowNorthIndicatorToggled"
        />
        <v-switch
          v-model="widget.options.showMapOverlays"
          label="Map overlays (GeoTIFF)"
          :color="widget.options.showMapOverlays ? 'white' : undefined"
          hide-details
          @update:model-value="onShowMapOverlaysToggled"
        />

        <v-divider class="opacity-10 mb-4" />
        <div class="mb-3">
          <p class="text-md text-white mb-1">Tracking target</p>
          <div class="flex items-center gap-3">
            <v-radio-group
              v-model="widget.options.trackTarget"
              hide-details
              density="compact"
              theme="dark"
              color="white"
              class="flex-none"
              @update:model-value="onTrackTargetSelected"
            >
              <v-radio label="Vehicle" value="vehicle" class="my-2" />
              <v-radio label="Dynamic POI" value="poi" />
            </v-radio-group>
            <div class="flex flex-1 justify-end">
              <v-select
                v-if="trackingPoi"
                v-model="widget.options.trackedPoiId"
                variant="outlined"
                label="Point of interest"
                :items="poiSelectItems"
                no-data-text="No dynamic POIs available"
                density="compact"
                hide-details
                theme="dark"
                class="w-4/5"
                @update:model-value="onTrackedPoiSelected"
              />
            </div>
          </div>
        </div>
      </v-card-text>
      <v-divider width="80%" inset />
      <v-card-actions class="flex justify-end mt-2">
        <v-btn variant="text" @click="closeConfig">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onBeforeUnmount, onMounted, ref, toRefs, watch } from 'vue'

import MapNorthIndicator from '@/components/map/MapNorthIndicator.vue'
import PoiMapArrows from '@/components/poi/PoiMapArrows.vue'
import { useMapMissionLayer } from '@/composables/map/useMapMissionLayer'
import { useMapOverlays } from '@/composables/map/useMapOverlays'
import { useMapPoiMarkers } from '@/composables/map/useMapPoiMarkers'
import { useMapVehiclePathLayer } from '@/composables/map/useMapVehiclePathLayer'
import { useMiniMap } from '@/composables/map/useMiniMap'
import { useDataLakeVariable } from '@/composables/useDataLakeVariable'
import { usePointsOfInterest } from '@/composables/usePointsOfInterest'
import { useResolvedDataLakeTemplate } from '@/composables/useResolvedDataLakeTemplate'
import { useWidgetContextMenu } from '@/composables/useWidgetContextMenu'
import { defaultHeadingVariableId, rawHeadingToDegrees } from '@/libs/data-sources/heading'
import {
  defaultLatitudeVariableId,
  defaultLongitudeVariableId,
  rawCoordinateToDegrees,
} from '@/libs/data-sources/position'
import { vehicleMarkerImageUrl } from '@/libs/vehicle/vehicle-marker'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { MapTileProvider, WaypointCoordinates } from '@/types/mission'
import type { ContextMenuItem } from '@/types/user-interface'
import type { Widget } from '@/types/widgets'

const builtInTileProviders: MapTileProvider[] = ['Esri World Imagery', 'OpenStreetMap']

type TrackTarget = 'vehicle' | 'poi'

const interfaceStore = useAppInterfaceStore()
const vehicleStore = useMainVehicleStore()
const missionStore = useMissionStore()
const widgetStore = useWidgetManagerStore()

const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()
const widget = toRefs(props).widget

const defaultOptions = {
  vehicleLatitudeVariableId: defaultLatitudeVariableId,
  vehicleLongitudeVariableId: defaultLongitudeVariableId,
  vehicleYawVariableId: defaultHeadingVariableId,
  trackTarget: 'vehicle' as TrackTarget,
  trackedPoiId: null as string | null,
  tileProvider: 'Esri World Imagery' as string,
  edgeFadeAmount: 0.1,
  headingUp: true,
  showPois: true,
  showNorthIndicator: true,
  showMission: false,
  showVehiclePath: false,
  showMapOverlays: false,
  zoom: 18,
}

onBeforeMount(() => {
  widget.value.options = { ...defaultOptions, ...widget.value.options }
})

const resolvedLatitudeId = useResolvedDataLakeTemplate(() => widget.value.options.vehicleLatitudeVariableId)
const resolvedLongitudeId = useResolvedDataLakeTemplate(() => widget.value.options.vehicleLongitudeVariableId)
const resolvedYawId = useResolvedDataLakeTemplate(() => widget.value.options.vehicleYawVariableId)

const { value: rawLatitude } = useDataLakeVariable(resolvedLatitudeId)
const { value: rawLongitude } = useDataLakeVariable(resolvedLongitudeId)
const { value: rawYaw } = useDataLakeVariable(resolvedYawId)

// The position sources are configurable, so each raw value is scaled by whatever its own source needs.
const vehiclePosition = computed<WaypointCoordinates | undefined>(() => {
  if (resolvedLatitudeId.value === undefined || resolvedLongitudeId.value === undefined) return undefined
  if (typeof rawLatitude.value !== 'number' || typeof rawLongitude.value !== 'number') return undefined
  return [
    rawCoordinateToDegrees(resolvedLatitudeId.value, rawLatitude.value),
    rawCoordinateToDegrees(resolvedLongitudeId.value, rawLongitude.value),
  ]
})
const vehicleHeading = computed(() => {
  if (resolvedYawId.value === undefined || typeof rawYaw.value !== 'number') return 0
  return rawHeadingToDegrees(resolvedYawId.value, rawYaw.value)
})

const { resolvedPointsOfInterest } = usePointsOfInterest()
const dynamicPois = computed(() => resolvedPointsOfInterest.value.filter((poi) => poi.isLiveTracked))
const trackingPoi = computed(() => widget.value.options.trackTarget === 'poi')
const trackedPoi = computed(() => dynamicPois.value.find((poi) => poi.id === widget.value.options.trackedPoiId))

// The minimap follows either the vehicle or a selected live-tracked POI. A POI carries no heading, so
// tracking one forces the map north-up and pins the tracked target's heading to zero.
const trackedPosition = computed<WaypointCoordinates | undefined>(() => {
  if (!trackingPoi.value) return vehiclePosition.value
  return trackedPoi.value?.hasValidPosition ? trackedPoi.value.coordinates : undefined
})
const trackedHeading = computed(() => (trackingPoi.value ? 0 : vehicleHeading.value))
const effectiveHeadingUp = computed(() => !trackingPoi.value && widget.value.options.headingUp)
const targetOnline = computed(() =>
  trackingPoi.value ? Boolean(trackedPoi.value?.hasValidPosition) : vehicleStore.isVehicleOnline
)
const targetOffline = computed(() => !targetOnline.value)

// The vehicle glyph is pinned to the center of the circle, so it can only stand for the vehicle while the
// vehicle is what the map follows. Tracking a POI puts the POI at the center, and from there the vehicle is
// marked by its edge arrow whenever it leaves the visible disc.
const showVehicleGlyph = computed(() => !trackingPoi.value && !targetOffline.value)

const offlineText = computed(() => {
  if (!trackingPoi.value) return 'Vehicle offline'
  return trackedPoi.value ? 'POI position unavailable' : 'No POI selected'
})

const mapCenter = computed<WaypointCoordinates>(() => trackedPosition.value ?? [0, 0])

// When the map is heading-up, the vehicle stays fixed pointing to the top; otherwise it rotates to
// show its heading against a north-up map. The north indicator does the inverse.
const vehicleRotation = computed(() => (effectiveHeadingUp.value ? 0 : trackedHeading.value))
const northRotation = computed(() => (effectiveHeadingUp.value ? -trackedHeading.value : 0))
const vehicleImageUrl = computed(() => vehicleMarkerImageUrl(vehicleStore.vehicleType))

// The built-in base maps plus every provider configured under Settings > Sources. Custom ones are selected by
// id, since their names are not guaranteed to be unique.
const tileProviderItems = computed(() => [
  ...builtInTileProviders.map((provider) => ({ title: provider, value: provider as string })),
  ...missionStore.customTileProviders.map((provider) => ({ title: provider.name, value: provider.id })),
])

// Deleting the selected custom provider leaves the option naming an id that no longer exists, so both the map
// and the selector show the default until the user picks again.
const selectedTileProvider = computed(() => {
  const selection = widget.value.options.tileProvider
  return tileProviderItems.value.some((item) => item.value === selection) ? selection : defaultOptions.tileProvider
})

const mapEl = ref<HTMLElement>()
const { mapReady, zoom, operatorZoom, bearing, map, init } = useMiniMap({
  vehiclePosition: () => trackedPosition.value,
  vehicleHeading: () => trackedHeading.value,
  headingUp: () => effectiveHeadingUp.value,
  edgeFadeAmount: () => widget.value.options.edgeFadeAmount,
  defaultZoom: () => widget.value.options.zoom,
  tileProvider: () => selectedTileProvider.value,
  vehicleOnline: () => targetOnline.value,
})

// Zooming is the widget's only map gesture, so keep where the operator left it instead of reopening at the
// built-in level on every remount.
watch(operatorZoom, (level) => {
  widget.value.options.zoom = level
})

// The icon class carries no styles of its own: it is what replaces Leaflet's default divIcon box, which
// would otherwise draw a white square behind every marker.
useMapPoiMarkers(map, {
  iconClassName: 'minimap-poi-marker-icon',
  draggable: false,
  tooltip: false,
  show: () => widget.value.options.showPois,
})

// Map widgets share the vehicle mission (index 0 is home), so its navigation waypoints tell us whether a
// mission exists to show, on the vehicle or on any other map widget.
const missionWaypoints = computed(() => missionStore.vehicleMission.slice(1))
const hasMission = computed(() => missionWaypoints.value.length > 0)

useMapMissionLayer(map, {
  waypoints: () => missionWaypoints.value,
  show: () => widget.value.options.showMission && hasMission.value,
  showWaypointDots: true,
})

useMapVehiclePathLayer(map, {
  path: () => missionStore.vehiclePositionHistory,
  revision: () => missionStore.vehiclePositionHistoryRevision,
  show: () => widget.value.options.showVehiclePath,
})

// Which GeoTIFFs are visible is a mission-wide setting, so the widget option gates the whole registry rather
// than individual overlays: while it is off nothing is bound, and no raster is rendered for this widget.
const mapOverlays = useMapOverlays()
const hasMapOverlays = computed(() => missionStore.mapOverlays.length > 0)

const bindMapOverlays = (): void => {
  if (!map.value) return
  mapOverlays
    .initOverlays(map.value)
    .catch((error) => console.error('Failed to show the map overlays on the MiniMap:', error))
}

onMounted(() => {
  if (mapEl.value) init(mapEl.value)
  if (widget.value.options.showMapOverlays) bindMapOverlays()
})

watch(
  () => widget.value.options.showMapOverlays,
  (show) => {
    if (show) bindMapOverlays()
    else mapOverlays.destroyOverlays()
  }
)

onBeforeUnmount(mapOverlays.destroyOverlays)

// The minimap has no leaflet dragging, so this handle temporarily flags the widget as movable, letting the
// WidgetHugger drag it even outside edit mode, then restores the flag when the drag ends.
const enableMovingOnDrag = (): void => {
  logUserAction('Started dragging the MiniMap widget')
  widgetStore.allowMovingAndResizing(widget.value.hash, true)
  window.addEventListener('mouseup', disableMovingOnDrag)
  window.addEventListener('dragend', disableMovingOnDrag)
}

const disableMovingOnDrag = (): void => {
  widgetStore.allowMovingAndResizing(widget.value.hash, widgetStore.editingMode)
  window.removeEventListener('mouseup', disableMovingOnDrag)
  window.removeEventListener('dragend', disableMovingOnDrag)
}

onBeforeUnmount(() => {
  window.removeEventListener('mouseup', disableMovingOnDrag)
  window.removeEventListener('dragend', disableMovingOnDrag)
})

const toggleShowMission = (): void => {
  widget.value.options.showMission = !widget.value.options.showMission
  logUserAction(`${widget.value.options.showMission ? 'Showed' : 'Hid'} the mission on the MiniMap`)
}

const toggleShowVehiclePath = (): void => {
  widget.value.options.showVehiclePath = !widget.value.options.showVehiclePath
  logUserAction(`${widget.value.options.showVehiclePath ? 'Showed' : 'Hid'} the vehicle path on the MiniMap`)
}

const toggleShowMapOverlays = (): void => {
  widget.value.options.showMapOverlays = !widget.value.options.showMapOverlays
  logUserAction(`${widget.value.options.showMapOverlays ? 'Showed' : 'Hid'} the map overlays on the MiniMap`)
}

const toggleShowNorthIndicator = (): void => {
  widget.value.options.showNorthIndicator = !widget.value.options.showNorthIndicator
  logUserAction(`${widget.value.options.showNorthIndicator ? 'Showed' : 'Hid'} the MiniMap north indicator`)
}

const toggleShowPois = (): void => {
  widget.value.options.showPois = !widget.value.options.showPois
  logUserAction(`${widget.value.options.showPois ? 'Showed' : 'Hid'} the MiniMap Points of Interest`)
}

// The north indicator doubles as a heading-up toggle: aligning to north turns it blue, clicking again
// restores the vehicle-heads-up orientation.
const toggleHeadingUp = (): void => {
  if (trackingPoi.value) return
  widget.value.options.headingUp = !widget.value.options.headingUp
  logUserAction(`${widget.value.options.headingUp ? 'Enabled' : 'Disabled'} MiniMap heading-up rotation`)
}

const menuItems = computed<ContextMenuItem[]>(() => {
  const items: ContextMenuItem[] = []
  if (hasMission.value) {
    items.push({
      item: `${widget.value.options.showMission ? 'Hide' : 'Show'} mission`,
      icon: 'mdi-map-marker-path',
      action: toggleShowMission,
    })
  }
  if (hasMapOverlays.value) {
    items.push({
      item: `${widget.value.options.showMapOverlays ? 'Hide' : 'Show'} map overlays`,
      icon: 'mdi-image-multiple',
      action: toggleShowMapOverlays,
    })
  }
  items.push(
    {
      item: `${widget.value.options.showVehiclePath ? 'Hide' : 'Show'} vehicle path`,
      icon: 'mdi-vector-polyline',
      action: toggleShowVehiclePath,
    },
    {
      item: `${widget.value.options.showNorthIndicator ? 'Hide' : 'Show'} north indicator`,
      icon: 'mdi-compass',
      action: toggleShowNorthIndicator,
    },
    {
      item: `${widget.value.options.showPois ? 'Hide' : 'Show'} POIs`,
      icon: 'mdi-map-marker',
      action: toggleShowPois,
    }
  )
  return items
})

useWidgetContextMenu(widget.value.hash, () => menuItems.value)

const closeConfig = (): void => {
  logUserAction('Closed the MiniMap settings menu')
  widgetStore.widgetManagerVars(widget.value.hash).configMenuOpen = false
}

const onTileProviderSelected = (value: string | null): void => {
  if (value === null) return
  widget.value.options.tileProvider = value
  const name = tileProviderItems.value.find((item) => item.value === value)?.title ?? value
  logUserAction(`Set MiniMap map provider to ${name}`)
}

const onEdgeFadeCommitted = (value: number): void => {
  logUserAction(`Set MiniMap edge fade to ${value}`)
}

const onHeadingUpToggled = (value: boolean | null): void => {
  logUserAction(`${value ? 'Enabled' : 'Disabled'} MiniMap heading-up rotation`)
}

const onShowPoisToggled = (value: boolean | null): void => {
  logUserAction(`${value ? 'Enabled' : 'Disabled'} MiniMap Points of Interest`)
}

const onShowMissionToggled = (value: boolean | null): void => {
  logUserAction(`${value ? 'Showed' : 'Hid'} the mission on the MiniMap`)
}

const onShowVehiclePathToggled = (value: boolean | null): void => {
  logUserAction(`${value ? 'Showed' : 'Hid'} the vehicle path on the MiniMap`)
}

const onShowNorthIndicatorToggled = (value: boolean | null): void => {
  logUserAction(`${value ? 'Enabled' : 'Disabled'} MiniMap north indicator`)
}

const onShowMapOverlaysToggled = (value: boolean | null): void => {
  logUserAction(`${value ? 'Enabled' : 'Disabled'} MiniMap map overlays`)
}

const poiSelectItems = computed(() => dynamicPois.value.map((poi) => ({ title: poi.name, value: poi.id })))

const onTrackTargetSelected = (value: TrackTarget | null): void => {
  logUserAction(`Set MiniMap tracking target to ${value === 'poi' ? 'Point of Interest' : 'Vehicle'}`)
}

const onTrackedPoiSelected = (value: string | null): void => {
  const name = dynamicPois.value.find((poi) => poi.id === value)?.name ?? value
  logUserAction(`Set MiniMap tracked POI to ${name}`)
}
</script>

<style scoped>
.minimap-root {
  position: relative;
  isolation: isolate;
  /* Size container so the corner controls can scale with the widget's shorter side (the mask circle's
     diameter), keeping them tucked in the transparent corner instead of creeping over the map when shrunk. */
  container-type: size;
  width: 100%;
  height: 100%;
  overflow: hidden;
  min-width: 120px;
  min-height: 120px;
}

.minimap-canvas {
  position: absolute;
  inset: 0;
  z-index: 0;
  /* Rotating about the exact center is what keeps the masked circle covered at every bearing. */
  transform: rotate(var(--minimap-bearing, 0deg));
  transform-origin: 50% 50%;
}

.minimap-root--offline > *:not(.minimap-offline-overlay) {
  opacity: 0.5;
}

.minimap-root--offline > .minimap-canvas {
  opacity: 0.25;
}

.minimap-offline-overlay {
  position: absolute;
  inset: 0;
  z-index: 1002;
  pointer-events: none;
}

.minimap-offline-text {
  width: 75%;
  text-align: center;
  color: #ffffff;
  -webkit-text-stroke: 1px #000000;
  font-weight: 700;
  font-size: clamp(11px, 13cqmin, 28px);
  line-height: 1.1;
  opacity: 0.6;
}

/* The rotation transform exposes hairline gaps between adjacent tiles; overlapping them by 1px hides the seams. */
.minimap-canvas :deep(.leaflet-tile) {
  width: 257px !important;
  height: 257px !important;
}

.minimap-drag-handle {
  position: absolute;
  top: clamp(6px, 6.7cqmin, 20px);
  right: clamp(4px, 3.3cqmin, 10px);
  z-index: 1001;
  width: clamp(16px, 12cqmin, 36px);
  height: clamp(16px, 12cqmin, 36px);
  font-size: clamp(16px, 12cqmin, 36px);
  opacity: 0.4;
  cursor: grab;
}

.minimap-vehicle {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 1000;
  pointer-events: none;
}

.minimap-vehicle-icon {
  width: 32px;
  height: 32px;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));
}

.minimap-north {
  position: absolute;
  display: flex;
  bottom: clamp(4px, 3.3cqmin, 10px);
  right: clamp(6px, 5cqmin, 15px);
  z-index: 1001;
  padding: 0;
  background: none;
  border: none;
  pointer-events: auto;
  cursor: pointer;
}

.minimap-north :deep(.map-north-indicator__arrow) {
  font-size: clamp(6px, 3.3cqmin, 10px);
}

.minimap-north :deep(.map-north-indicator__label) {
  font-size: clamp(7px, 4cqmin, 12px);
}

.minimap-north--active :deep(.map-north-indicator__arrow),
.minimap-north--active :deep(.map-north-indicator__label) {
  color: #2196f3;
}
</style>
