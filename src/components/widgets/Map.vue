<template>
  <div
    ref="mapBase"
    v-contextmenu="handleContextMenu"
    class="page-base"
    :class="widgetStore.editingMode ? 'pointer-events-none' : 'pointer-events-auto'"
    :style="glassMenuCssVars"
  >
    <div :id="mapId" ref="mapContainer" class="map">
      <v-menu v-model="downloadMenuOpen" :close-on-content-click="false" location="top end">
        <template #activator="{ props: menuProps }">
          <v-tooltip location="top" text="Download tiles for offline use">
            <template #activator="{ props: tooltipProps }">
              <v-btn
                v-show="showButtons"
                :style="interfaceStore.globalGlassMenuStyles"
                v-bind="{ ...menuProps, ...tooltipProps }"
                class="absolute right-[89px] m-3 bottom-button bg-slate-50 text-[14px]"
                elevation="2"
                size="x-small"
                style="z-index: 1002; border-radius: 0px"
                icon="mdi-download-multiple"
              />
            </template>
          </v-tooltip>
        </template>

        <v-list :style="interfaceStore.globalGlassMenuStyles" class="py-0 min-w-[220px] rounded-lg border-[1px]">
          <v-list-item class="py-0" title="Save visible Esri tiles" @click="saveEsri" />
          <v-divider />
          <v-list-item class="py-0" title="Save visible OSM tiles" @click="saveOSM" />
          <v-divider />
          <v-list-item class="py-0" title="Save visible Seamarks tiles" @click="saveSeamarks" />
        </v-list>
      </v-menu>
      <v-tooltip
        location="top"
        :text="
          missionStore.alwaysShowWaypointNumbers
            ? 'Hide waypoint numbers when zoomed out'
            : 'Always show waypoint numbers'
        "
      >
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-show="showButtons"
            :style="interfaceStore.globalGlassMenuStyles"
            v-bind="tooltipProps"
            class="absolute right-[134px] m-3 bottom-button bg-slate-50 text-[14px]"
            elevation="2"
            size="x-small"
            style="z-index: 1002; border-radius: 0px"
            :color="missionStore.alwaysShowWaypointNumbers ? 'primary' : ''"
            icon="mdi-numeric-1-circle-outline"
            @click="missionStore.toggleAlwaysShowWaypointNumbers()"
          />
        </template>
      </v-tooltip>
      <v-tooltip v-if="showButtons" location="top" text="Switch to Mission Planning mode">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-bind="tooltipProps"
            class="absolute right-[193px] w-[140px] mb-[13px] bottom-button bg-slate-50 text-[12px] font-bold"
            elevation="4"
            text="Edit mission"
            append-icon="mdi-map-marker-radius-outline"
            style="z-index: 1002; border-radius: 0px"
            :style="interfaceStore.globalGlassMenuStyles"
            hide-details
            size="small"
            @click.stop="navigateToMissionPlanning"
          />
        </template>
      </v-tooltip>
      <GeoFenceEnforcementControl
        v-if="showButtons"
        v-model:open="fenceDialOpen"
        :activator-style="{ bottom: bottomButtonsDisplacement, zIndex: 1002 }"
      />
      <MapCenterControl
        v-if="showButtons"
        v-model:open="centerDialOpen"
        :target-follower="targetFollower"
        :follower-target="followerTarget"
        :home="home"
        :vehicle-position="vehiclePosition"
        :is-vehicle-online="vehicleStore.isVehicleOnline"
        :has-mission-waypoints="hasMissionWaypoints"
        :activator-style="{ bottom: bottomButtonsDisplacement, zIndex: 1002 }"
        @center-on-mission="centerOnMission"
      />
      <MapNorthIndicator v-if="showButtons" class="north-indicator" />
      <PoiMapArrows
        :map-ready="mapReady"
        :show-poi-arrows="widget.options.showPoiArrows"
        :show-home-arrow="widget.options.showHomeArrow"
        :show-vehicle-arrow="widget.options.showVehicleArrow"
        :show-base-station-arrow="widget.options.showBaseStationArrow"
        :vehicle-position="vehiclePosition"
        :home="home"
        :base-station="baseStationStore.activePosition"
        :base-station-color="baseStationStore.config.coverageColor"
        :map-center="mapCenter"
        :zoom="zoom"
        :widget="widget"
        :target-follower="targetFollower"
      />
      <GeoFenceMapLayer v-if="fenceStore.lastUploadedPlan" readonly :plan="fenceStore.lastUploadedPlan" />
      <MapLayerControl
        ref="layerControlRef"
        :base-layers="tileSelection.baseLayers.value"
        :overlays="[...tileSelection.overlays.value, ...mapOverlays.selectorEntries.value]"
        @select-base="tileSelection.selectBaseLayer"
        @toggle-overlay="onToggleOverlay"
      />
    </div>
  </div>
  <ContextMenu
    ref="contextMenuRef"
    :key="contextMenuVersion"
    :visible="contextMenuVisible"
    :min-width="'260px'"
    :menu-items="menuItems"
    @close="hideContextMenuAndMarker"
  >
  </ContextMenu>

  <PoiActionPopup
    ref="poiPopupRef"
    :goto-target-id="poiGotoTargetId"
    @goto="poiGoTo.onPoiGoTo"
    @cancel-goto="poiGoTo.onPoiCancelGoTo"
    @edit="onPoiEdit"
    @delete="onPoiDelete"
  />

  <v-dialog v-model="widgetStore.widgetManagerVars(widget.hash).configMenuOpen" width="auto">
    <v-card class="pa-2" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-center">Map widget settings</v-card-title>
      <v-card-text>
        <ExpansiblePanel compact :is-expanded="!interfaceStore.isOnSmallScreen" no-bottom-divider no-top-divider>
          <template #title>Display</template>
          <template #content>
            <v-row>
              <v-col cols="4">
                <v-switch
                  v-model="widget.options.showVehiclePath"
                  class="my-1"
                  label="Vehicle path"
                  :color="widget.options.showVehiclePath ? 'white' : undefined"
                  hide-details
                />
              </v-col>
              <v-col cols="4">
                <v-switch
                  v-model="widget.options.showCoordinateGrid"
                  class="my-1"
                  label="Coordinate grid"
                  :color="widget.options.showCoordinateGrid ? 'white' : undefined"
                  hide-details
                />
              </v-col>
              <v-col cols="4">
                <v-switch
                  v-model="widget.options.showPoiArrows"
                  class="my-1"
                  label="Point of Interest arrows"
                  :color="widget.options.showPoiArrows ? 'white' : undefined"
                  hide-details
                />
              </v-col>
              <v-col cols="4">
                <v-switch
                  v-model="widget.options.showHomeArrow"
                  class="my-1"
                  label="Home arrow"
                  :color="widget.options.showHomeArrow ? 'white' : undefined"
                  hide-details
                />
              </v-col>
              <v-col cols="4">
                <v-switch
                  v-model="widget.options.showVehicleArrow"
                  class="my-1"
                  label="Vehicle arrow"
                  :color="widget.options.showVehicleArrow ? 'white' : undefined"
                  hide-details
                />
              </v-col>
              <v-col cols="4">
                <v-switch
                  v-model="widget.options.showBaseStationArrow"
                  class="my-1"
                  label="Base station arrow"
                  :color="widget.options.showBaseStationArrow ? 'white' : undefined"
                  hide-details
                />
              </v-col>
            </v-row>
          </template>
        </ExpansiblePanel>
      </v-card-text>
    </v-card>
  </v-dialog>

  <v-progress-linear
    v-if="fetchingMission"
    :model-value="missionFetchProgress"
    height="10"
    absolute
    bottom
    color="white"
    :style="`top: ${topProgressBarDisplacement}`"
  />
  <p
    v-if="fetchingMission"
    :style="{ top: topProgressBarDisplacement }"
    class="absolute left-[7px] mt-4 flex text-md font-bold text-white z-30 drop-shadow-md"
  >
    Loading mission...
  </p>

  <PoiManager ref="poiManagerMapWidgetRef" />
  <MapOverlaysDialog v-model="overlaysDialogOpen" :loading-ids="overlayLoadingIds" />
  <MissionChecklist
    :model-value="isMissionChecklistOpen"
    @confirmed="executeMissionOnVehicle"
    @update:model-value="isMissionChecklistOpen = $event"
  />
  <GlobalOriginDialog
    v-model="showGlobalOriginDialog"
    :vehicle="vehicleStore.mainVehicle as unknown as MAVLinkVehicle<string>"
    :initial-latitude="globalOriginLatitude"
    :initial-longitude="globalOriginLongitude"
    @origin-set="onGlobalOriginSet"
  />
  <div
    v-if="isSavingOfflineTiles"
    class="absolute top-14 left-2 flex justify-start items-center text-white text-md py-2 px-4 rounded-lg"
    :style="interfaceStore.globalGlassMenuStyles"
  >
    <p>
      Saving offline map content
      <span v-if="savingLayerName">({{ savingLayerName }})</span>:&nbsp; {{ savePercentage }}%
      <span v-if="estimatedDownloadedMB && estimatedTotalMB">
        (~{{ estimatedDownloadedMB }} / {{ estimatedTotalMB }} MB)
      </span>
    </p>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn, useElementHover } from '@vueuse/core'
import { formatDistanceToNow } from 'date-fns'
import { type Map as MapLibreMap, type MapMouseEvent, type Marker, NavigationControl } from 'maplibre-gl'
import {
  computed,
  nextTick,
  onBeforeMount,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  shallowRef,
  toRefs,
  watch,
} from 'vue'
import { useRouter } from 'vue-router'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import GeoFenceEnforcementControl from '@/components/geofence/GeoFenceEnforcementControl.vue'
import GeoFenceMapLayer from '@/components/geofence/GeoFenceMapLayer.vue'
import GlobalOriginDialog from '@/components/GlobalOriginDialog.vue'
import MapLayerControl from '@/components/map/MapLayerControl.vue'
import MapNorthIndicator from '@/components/map/MapNorthIndicator.vue'
import MapOverlaysDialog from '@/components/map/MapOverlaysDialog.vue'
import MapCenterControl from '@/components/MapCenterControl.vue'
import MissionChecklist from '@/components/MissionChecklist.vue'
import PoiActionPopup from '@/components/poi/PoiActionPopup.vue'
import PoiManager from '@/components/poi/PoiManager.vue'
import PoiMapArrows from '@/components/poi/PoiMapArrows.vue'
import { confirmRemoveBaseStation, useBaseStation } from '@/composables/baseStation/useBaseStation'
import { useBaseStationOverlay } from '@/composables/baseStation/useBaseStationOverlay'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { useMapAutoResize } from '@/composables/map/useMapAutoResize'
import { useMapBoxZoom } from '@/composables/map/useMapBoxZoom'
import { useMapCenterFromUserLocation } from '@/composables/map/useMapCenterFromUserLocation'
import { provideMapContext } from '@/composables/map/useMapContext'
import { useMapMissionLayer } from '@/composables/map/useMapMissionLayer'
import { useMapOverlays } from '@/composables/map/useMapOverlays'
import { useMapPoiGoTo } from '@/composables/map/useMapPoiGoTo'
import { useMapPoiMarkers } from '@/composables/map/useMapPoiMarkers'
import { useMapTileLayers } from '@/composables/map/useMapTileLayers'
import { useMapTileLayerSelection } from '@/composables/map/useMapTileLayerSelection'
import { useMapVehicleMarker } from '@/composables/map/useMapVehicleMarker'
import { useMapVehiclePathLayer } from '@/composables/map/useMapVehiclePathLayer'
import { useWaypointMarkerSize } from '@/composables/map/useWaypointMarkerSize'
import { useActiveMenuRoute } from '@/composables/menuRouting'
import { openSnackbar } from '@/composables/snackbar'
import { useOfflineTiles } from '@/composables/useOfflineTiles'
import { usePointsOfInterest } from '@/composables/usePointsOfInterest'
import { useVehicleHomePosition } from '@/composables/useVehicleHomePosition'
import {
  baseStationMenuIcon,
  baseStationPlaceMenuLabel,
  baseStationSignalVisibilityIcon,
  baseStationSignalVisibilityLabel,
  configureBaseStationMenuIcon,
  configureBaseStationMenuLabel,
  removeBaseStationMenuIcon,
  removeBaseStationMenuLabel,
} from '@/libs/baseStation/menu'
import { MavCmd } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import type { NoiseTileOptions } from '@/libs/map/map-tile-fallback'
import {
  type MarkerTooltip,
  bindTooltip,
  containerPointFromClient,
  createMap,
  divIconMarker,
  eventLatLng,
  framedScaleControl,
  fromLngLat,
  fromMapLibreZoom,
  setDivIcon,
  setMapView,
  toLngLat,
  unprojectFromContainer,
} from '@/libs/map/maplibre'
import {
  applyFollowZoomMode,
  createGridOverlay,
  fitMapToWaypoints,
  metersPerPixel,
  persistLiveMapView,
  recenterMapOnFollowTarget,
  removeGridOverlay,
  TargetFollower,
  WhoToFollow,
} from '@/libs/map/utils-map'
import type { VehicleTooltipState } from '@/libs/map/vehicle-tooltip'
import { vehicleTooltipContent } from '@/libs/map/vehicle-tooltip'
import { missionControlPanelSetupInfo } from '@/libs/mission-control-panel'
import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { copyToClipboard, degrees, messageFromError } from '@/libs/utils'
import type { MAVLinkVehicle } from '@/libs/vehicle/mavlink/vehicle'
import { vehicleMarkerImageUrl } from '@/libs/vehicle/vehicle-marker'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useGeoFenceStore } from '@/stores/geoFence'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type {
  IconDimensions,
  MarkerSizes,
  ResolvedPointOfInterest,
  Waypoint,
  WaypointCoordinates,
} from '@/types/mission'
import { type Widget, WidgetType } from '@/types/widgets'

import ContextMenu from '../ContextMenu.vue'

// Define widget props
// eslint-disable-next-line jsdoc/require-jsdoc
const props = defineProps<{ widget: Widget }>()
const widget = toRefs(props).widget
const interfaceStore = useAppInterfaceStore()
const { showDialog, closeDialog } = useInteractionDialog()
const {
  isSavingOfflineTiles,
  savingLayerName,
  estimatedTotalMB,
  estimatedDownloadedMB,
  savePercentage,
  saveVisibleTiles,
} = useOfflineTiles({ showDialog, closeDialog, openSnackbar })
// Instantiate the necessary stores
const vehicleStore = useMainVehicleStore()
const missionStore = useMissionStore()
const widgetStore = useWidgetManagerStore()
const baseStationStore = useBaseStation()
const fenceStore = useGeoFenceStore()
const router = useRouter()
const { isFlightVisible } = useActiveMenuRoute()

const { removePointOfInterest } = usePointsOfInterest()

const mapContext = provideMapContext()
const { observe: observeMapResize } = useMapAutoResize()

// Declare the general variables
// Published once the map's style has loaded, which is when layers can be added to it.
const map = shallowRef<MapLibreMap | undefined>()
// Held from creation, so teardown reaches a map whose style never finished loading.
let mapInstance: MapLibreMap | undefined
const mapContainer = ref<HTMLElement>()

const zoom = ref(missionStore.userLastMapZoom ?? missionStore.defaultMapZoom)
const mapCenter = ref<WaypointCoordinates>(missionStore.userLastMapCenter ?? missionStore.defaultMapCenter)
const mapId = computed(() => `map-${widget.value.hash}`)
// One flag per dial: their items are teleported out of the widget, so an open
// dial has to keep the buttons mounted without also opening its neighbour.
const centerDialOpen = ref(false)
const fenceDialOpen = ref(false)
const showButtons = computed(
  () =>
    isMouseOver.value ||
    downloadMenuOpen.value ||
    centerDialOpen.value ||
    fenceDialOpen.value ||
    widgetStore.isFullScreen(widget.value)
)
const mapReady = ref(false)
const mapWaypoints = ref<Waypoint[]>([])
const reachedWaypoints = shallowRef<Record<number, Marker>>({})
const waypointTooltips: Record<number, MarkerTooltip> = {}
const contextMenuRef = ref()
const isDragging = ref(false)
const isBoxPress = ref(false)
const { initMapBoxZoom } = useMapBoxZoom({
  onBoxStart: () => {
    isBoxPress.value = true
    targetFollower.setBoxPress(true)
    if (contextMenuVisible.value) hideContextMenuAndMarker()
  },
  onBoxEnd: () => {
    isBoxPress.value = false
    targetFollower.setBoxPress(false)
  },
  onBoxCommit: () => targetFollower.unFollow(),
  isBlocked: () => contextMenuVisible.value,
})
const isPinching = ref(false)
const isMissionChecklistOpen = ref(false)
const downloadMenuOpen = ref(false)
const missionItemsInVehicle = ref<Waypoint[]>([])
const missionSeqToMarkerSeq = shallowRef<Record<number, number>>({})

const home = computed(() => missionStore.homeMarkerPosition)

const { isConfirmedByVehicle: isHomeConfirmedByVehicle } = useVehicleHomePosition()

const glassMenuCssVars = computed(() => ({
  '--glass-background': interfaceStore.globalGlassMenuStyles.backgroundColor,
  '--glass-filter': interfaceStore.globalGlassMenuStyles.backdropFilter,
  '--glass-border': interfaceStore.globalGlassMenuStyles.border,
  '--glass-color': interfaceStore.globalGlassMenuStyles.color,
  '--glass-box-shadow': interfaceStore.globalGlassMenuStyles.boxShadow,
}))

const saveEsri = (): void => {
  logUserAction('Saved visible Esri map tiles for offline use')
  if (map.value) saveVisibleTiles(map.value, esri, 'Esri', 19)
  downloadMenuOpen.value = false
}
const saveOSM = (): void => {
  logUserAction('Saved visible OSM map tiles for offline use')
  if (map.value) saveVisibleTiles(map.value, osm, 'OSM', 19)
  downloadMenuOpen.value = false
}
const saveSeamarks = (): void => {
  logUserAction('Saved visible Seamarks map tiles for offline use')
  if (map.value && seamarks) saveVisibleTiles(map.value, seamarks, 'Seamarks', 18)
  downloadMenuOpen.value = false
}

let pinchTimeout: number | undefined

const contextMenuSelectedWpIndex = ref<number | null>(null)
const contextMenuVersion = ref(0)
const mapWaypointMarkers = shallowRef<Marker[]>([])

const currentMapWpIndex = computed<number>(() => {
  const wpIdx = missionStore.currentWpIndex
  if (wpIdx === undefined || wpIdx <= 0) return -1
  return wpIdx - 1
})

const onTouchStart = (e: TouchEvent): void => {
  if (e.touches.length > 1) {
    isPinching.value = true
    if (contextMenuVisible.value) hideContextMenuAndMarker()
    poiPopupRef.value?.close()
    clearTimeout(pinchTimeout)
  }
}

const onTouchEnd = (e: TouchEvent): void => {
  if (e.touches.length <= 1) {
    pinchTimeout = window.setTimeout(() => (isPinching.value = false), 300)
  }
}

// Maps the reached mission item sequences to the marker sequences for reached waypoints
const getReachedWaypointIndices = computed(() => {
  const waypointIndices = new Set<number>()

  if (!vehicleStore.reachedMissionItemSequences.length) return waypointIndices

  vehicleStore.reachedMissionItemSequences.forEach((missionSeq) => {
    const markerSeq = missionSeqToMarkerSeq.value[missionSeq]
    if (markerSeq !== undefined) waypointIndices.add(markerSeq)
  })

  return waypointIndices
})

const { getEffectiveMarkerSize } = useWaypointMarkerSize(() => {
  if (map.value) refreshReachedWaypointMarkerStyles()
})

const getIconDimensionsFromMarkerSize = (size: MarkerSizes): IconDimensions => {
  if (size === 'xs') {
    return { iconSize: [6, 6], iconAnchor: [3, 3] }
  }
  if (size === 'sm') {
    return { iconSize: [12, 12], iconAnchor: [6, 6] }
  }
  return { iconSize: [26, 26], iconAnchor: [13, 13] } // md size
}

const createWaypointMarkerHtml = (isReached: boolean, isCurrent = false): string => {
  let baseClass = 'marker-icon'
  if (isReached) {
    baseClass = 'marker-icon marker-icon--reached'
  } else if (isCurrent) {
    baseClass = 'marker-icon marker-icon-active'
  }
  const size = getEffectiveMarkerSize(zoom.value)
  const markerSizeClass = `wp-marker-${size}`

  return `
    <div class="${markerSizeClass}">
      <div class="${baseClass} waypoint-main-marker"></div>
    </div>
  `
}

const waypointMarkerIcon = (
  isReached: boolean,
  isCurrent = false
): {
  /**
cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc *
cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
   */
  html: string
  /**
hhhhhhhhhhhhhh *
hhhhhhhhhhhhhh
   */
  size: [number, number]
} => {
  const markerSize = getEffectiveMarkerSize(zoom.value)
  const dimensions = getIconDimensionsFromMarkerSize(markerSize)
  return { html: createWaypointMarkerHtml(isReached, isCurrent), size: dimensions.iconSize }
}

const applyWaypointMarkerStyle = (seq: number): void => {
  const marker = reachedWaypoints.value[seq]
  if (!marker) return
  const isReached = getReachedWaypointIndices.value.has(seq)
  const idx = seq - 1
  const isCurrent = currentMapWpIndex.value >= 0 && idx === currentMapWpIndex.value
  const markerSize = getEffectiveMarkerSize(zoom.value)

  setDivIcon(marker, waypointMarkerIcon(isReached, isCurrent))

  // Updates the tooltip class for reached/current waypoints and visibility based on size
  const tooltip = waypointTooltips[seq]
  if (tooltip) {
    tooltip.setOpacity(markerSize === 'md' ? 1 : 0)

    const tooltipElement = tooltip.getElement()
    if (tooltipElement) {
      tooltipElement.classList.remove('waypoint-tooltip--reached', 'waypoint-tooltip--current-waypoint')
      if (isReached) {
        tooltipElement.classList.add('waypoint-tooltip--reached')
      } else if (isCurrent) {
        tooltipElement.classList.add('waypoint-tooltip--current-waypoint')
      }
    }
  }
}

const refreshReachedWaypointMarkerStyles = (): void => {
  Object.keys(reachedWaypoints.value).forEach((k) => applyWaypointMarkerStyle(Number(k)))
}

const poiManagerMapWidgetRef = ref<typeof PoiManager | null>(null)
const poiPopupRef = ref<InstanceType<typeof PoiActionPopup> | null>(null)

const poiMarkers = useMapPoiMarkers(map, {
  iconClassName: 'poi-marker-icon-widget',
  tooltipClassName: 'poi-tooltip-widget',
  onContextMenu: (poi, event) => {
    if (contextMenuVisible.value) hideContextMenuAndMarker()
    poiPopupRef.value?.open(poi, event)
  },
})
const poiGotoTargetId = poiMarkers.gotoTargetId

// Sends a GoTo-family MAVLink command to the vehicle for the given coordinates, reporting failures via
// the given message. Shared by the regular map-click GoTo flow, PoI GoTo, and PoI-follow target updates.
const sendGoToCommand = async (
  coordinates: WaypointCoordinates,
  failureMessage: string,
  skipConfirmation = false
): Promise<void> => {
  const hold = 0
  const acceptanceRadius = 0
  const passRadius = 0
  const yaw = 0
  const altitude = vehicleStore.coordinates.altitude ?? 0

  try {
    await vehicleStore.goTo(
      hold,
      acceptanceRadius,
      passRadius,
      yaw,
      coordinates[0],
      coordinates[1],
      altitude,
      skipConfirmation
    )
  } catch (error) {
    openSnackbar({ message: `${failureMessage}: ${(error as Error).message}`, variant: 'error' })
    throw error
  }
}

const issueGoto = (coordinates: WaypointCoordinates): Promise<void> =>
  sendGoToCommand(coordinates, 'GoTo request failed')

const updateGotoTarget = (coordinates: WaypointCoordinates): Promise<void> =>
  sendGoToCommand(coordinates, 'Failed to update GoTo target', true)

const poiGoTo = useMapPoiGoTo(poiMarkers, { issueGoto, updateGotoTarget })

const onPoiEdit = (poi: ResolvedPointOfInterest): void => {
  if (!poiManagerMapWidgetRef.value) {
    openSnackbar({ message: 'POI Manager (map widget) is not available.', variant: 'error' })
    return
  }
  poiManagerMapWidgetRef.value.openDialog(undefined, poi)
}

const onPoiDelete = async (poi: ResolvedPointOfInterest): Promise<void> => {
  if (poiMarkers.gotoTargetId.value === poi.id) {
    await poiGoTo.onPoiCancelGoTo()
  }
  removePointOfInterest(poi.id)
}

// Register the usage of the coordinate variables for logging
datalogger.registerUsage(DatalogVariable.latitude)
datalogger.registerUsage(DatalogVariable.longitude)

// Before mounting:
// - set initial widget options if they don't exist
// - enable auto update for target follower
onBeforeMount(() => {
  const defaultOptions = {
    showVehiclePath: true,
    showCoordinateGrid: false,
    showPoiArrows: true,
    showHomeArrow: true,
    showVehicleArrow: true,
    showBaseStationArrow: true,
  }
  widget.value.options = { ...defaultOptions, ...widget.value.options }
  if (isFlightVisible.value) targetFollower.enableAutoUpdate()
})

// Build the shared base maps and overlays (tile-provider definitions live in useMapTileLayers)
const tileLayers = useMapTileLayers({ seamarks: true, marineProfile: true })
const { osm, esri, overlays } = tileLayers
const seamarks = overlays['Seamarks']

// Replace failed tiles with a procedural noise background sampled by lat/lon
const getTileFallbackOptions = (): NoiseTileOptions => ({
  baseColor: missionStore.mapFallbackBaseColor,
  seed: missionStore.mapFallbackSeed,
  intensity: missionStore.mapFallbackNoiseIntensity,
})

// Restore and persist the user's base-map and overlay selection, custom tile providers included
const tileSelection = useMapTileLayerSelection(tileLayers, getTileFallbackOptions)

// Syncs user-loaded GeoTIFF overlays (sonar/bathymetry surveys) onto this map
const mapOverlays = useMapOverlays()
const overlayLoadingIds = mapOverlays.loadingIds
const overlaysDialogOpen = ref(false)

let stopUnFollowOnUserDrag: (() => void) | undefined

// Show buttons when the mouse is over the widget
const mapBase = ref<HTMLElement>()
const isMouseOver = useElementHover(mapBase)

const zoomControl = new NavigationControl({ showCompass: false })
const layerControlRef = ref<InstanceType<typeof MapLayerControl>>()
const scaleControl = framedScaleControl()
let controlsShown = false

// The selector takes GeoTIFF rows next to the tile overlays, which only hide on this map.
const onToggleOverlay = (id: string, enabled: boolean): void => {
  if (mapOverlays.selectorEntries.value.some((entry) => entry.id === id)) mapOverlays.setOverlayShown(id, enabled)
  else tileSelection.setOverlayEnabled(id, enabled)
}

// The layer selector sits in the top-right corner, and the zoom buttons and the scale in the bottom-right one, as
// they always did.
const setMapControlsShown = (shown: boolean): void => {
  const layerControl = layerControlRef.value?.control
  if (!map.value || !layerControl || shown === controlsShown) return
  controlsShown = shown
  if (shown) {
    map.value.addControl(zoomControl, 'bottom-right')
    map.value.addControl(layerControl, 'top-right')
    map.value.addControl(scaleControl, 'bottom-right')
  } else {
    map.value.removeControl(zoomControl)
    map.value.removeControl(layerControl)
    map.value.removeControl(scaleControl)
  }
}

watch(showButtons, (shown) => setMapControlsShown(shown))

// Watch for grid overlay option changes
watch(
  () => widget.value.options.showCoordinateGrid,
  (show) => {
    if (map.value === undefined) return
    if (show) {
      createGridOverlayLocal()
    } else {
      removeGridOverlayLocal()
    }
  }
)

const saveLastMapPositionDebounced = useDebounceFn(
  () => {
    if (!isFlightVisible.value) return
    missionStore.saveLastMapPosition(zoom.value, mapCenter.value)
  },
  3000,
  { maxWait: 8000 }
)

// Watch for zoom/move changes to update the grid
watch([zoom, mapCenter], () => {
  if (widget.value.options.showCoordinateGrid && map.value) {
    createGridOverlayLocal()
  }
  if (isFlightVisible.value) saveLastMapPositionDebounced()
})

// Shallow watch for reached mission item sequences to update marker styles
watch(
  () => vehicleStore.reachedMissionItemSequences,
  () => {
    refreshReachedWaypointMarkerStyles()
  }
)

// Grid overlay functions using centralized utilities
const createGridOverlayLocal = (): void => {
  if (!map.value) return

  try {
    createGridOverlay(map.value)
  } catch (error) {
    console.error('Failed to create grid overlay:', error)
  }
}

const removeGridOverlayLocal = (): void => {
  removeGridOverlay(map.value)
}

onMounted(() => {
  reachedWaypoints.value = {}
  missionItemsInVehicle.value = []
  missionSeqToMarkerSeq.value = {}

  mapBase.value?.addEventListener('touchstart', onTouchStart, { passive: true })
  mapBase.value?.addEventListener('touchend', onTouchEnd, { passive: true })
  if (!mapContainer.value) return
  const instance = createMap(mapContainer.value, { center: mapCenter.value, zoom: zoom.value })
  mapInstance = instance
  observeMapResize(instance)
  // Layers can only be added once the style has loaded, so the map is published to everything that draws then.
  instance.once('load', () => void onMapLoaded(instance))
})

const onMapLoaded = async (instance: MapLibreMap): Promise<void> => {
  if (mapInstance !== instance) return
  map.value = instance

  // Expose the map instance to descendant components via the map context
  mapContext.map.value = instance
  mapContext.mapReady.value = true

  tileSelection.init(instance)

  instance.on('click', (event: MapMouseEvent) => {
    clickedLocation.value = eventLatLng(event)
    poiPopupRef.value?.close()
  })

  // Update center value after panning
  instance.on('moveend', () => {
    const center = fromLngLat(instance.getCenter())
    if (!sameCoordinates(center, mapCenter.value)) mapCenter.value = center
  })

  instance.on('dragstart', () => {
    isDragging.value = true
    // While the user drags the map, suppress the permanent waypoint tooltips and the waypoint marker DOM elements via CSS.
    instance.getContainer().classList.add('cockpit-drag-active')
  })

  instance.on('dragend', () => {
    setTimeout(() => (isDragging.value = false), 200)
    instance.getContainer().classList.remove('cockpit-drag-active')
  })

  // Update zoom value after zooming
  instance.on('zoomend', () => {
    contextMenuVisible.value = false
    zoom.value = fromMapLibreZoom(instance.getZoom())
  })

  instance.on('contextmenu', (event: MapMouseEvent) => {
    clickedLocation.value = eventLatLng(event)
  })
  // Enable auto update for target follower
  if (isFlightVisible.value) targetFollower.enableAutoUpdate()
  stopUnFollowOnUserDrag = targetFollower.unFollowOnUserDrag(instance)
  initMapBoxZoom(instance)

  window.addEventListener('keydown', onKeydown)

  // Pan map to vehicle on mounting if it's position is available, otherwise pan to home
  if (vehiclePosition.value) {
    targetFollower.goToTarget(WhoToFollow.VEHICLE)
  } else {
    targetFollower.goToTarget(WhoToFollow.HOME)
  }

  // If vehicle is offline and a mission have been uploaded recently, draw it
  if (!vehicleStore.isVehicleOnline && missionStore.vehicleMission.length) {
    drawMission(missionStore.vehicleMission)
  }

  // Initialize grid overlay if enabled
  if (widget.value.options.showCoordinateGrid) {
    createGridOverlayLocal()
  }

  mapReady.value = true

  // Apply the current showButtons state to the map controls
  // Registered before the data layers below: rendering a stored GeoTIFF can take seconds, and the map
  // must not be left without its own zoom, layer and scale controls while that runs.
  setMapControlsShown(showButtons.value)

  // Render any user-loaded GeoTIFF overlays and keep them in sync with the stored metadata
  await mapOverlays.initOverlays(instance)

  if (missionStore.followVehicleOnMap === true) {
    targetFollower.follow(WhoToFollow.VEHICLE)
  } else {
    targetFollower.unFollow()
  }
  applyFollowZoomMode(instance, !!followerTarget.value)
  await refreshMission()
}

// The map reports back the center it was moved to with float noise, so a center is only new past that noise.
const sameCoordinates = (a: WaypointCoordinates, b: WaypointCoordinates): boolean =>
  Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9

// React to clear/download requests from any mission-control widget.
watch(
  () => missionStore.mapClearRequestRevision,
  () => clearMapDrawing()
)

// React to "center on coordinates" requests (e.g. from the Map tools menu).
watch(
  () => missionStore.mapCenterOnRequest,
  (request) => {
    if (!request || !map.value || !isFlightVisible.value) return
    setMapView(map.value, request.coordinates, undefined, true)
  }
)

watch(
  () => missionStore.mapDownloadRequestRevision,
  () => {
    downloadMissionFromVehicle()
  }
)

// Frame the map on a GeoTIFF overlay when requested from the configuration panel
watch(
  () => missionStore.mapOverlayFocusRequest.revision,
  () => mapOverlays.zoomToOverlay(missionStore.mapOverlayFocusRequest.id)
)
const handleContextMenu = {
  open: async (event: MouseEvent): Promise<void> => {
    if (!map.value || isPinching.value || isDragging.value || isBoxPress.value) return
    event.preventDefault()
    event.stopPropagation()

    poiPopupRef.value?.close()

    const point = containerPointFromClient(map.value, event)
    clickedLocation.value = unprojectFromContainer(map.value, [point.x, point.y])

    await openContextMenuAt(event, null)
  },
  close: () => hideContextMenuAndMarker(),
}

const clearMapDrawing = (): void => {
  // Only the markers this widget draws for the mission and its own actions; the vehicle, the PoIs and the overlays
  // drawn by other layers are not part of the mission drawing.
  Object.values(waypointTooltips).forEach((tooltip) => tooltip.remove())
  Object.keys(waypointTooltips).forEach((seq) => delete waypointTooltips[Number(seq)])
  Object.values(reachedWaypoints.value).forEach((marker) => marker.remove())
  mapWaypointMarkers.value.forEach((m) => m.remove())
  mapWaypointMarkers.value = []
  mapWaypoints.value = []

  removeIconMarker(homeMarker.value)
  removeIconMarker(gotoMarker.value)
  removeIconMarker(globalOriginMarker.value)
  homeMarker.value = undefined
  gotoMarker.value = undefined
  globalOriginMarker.value = undefined
  reachedWaypoints.value = {}
  missionItemsInVehicle.value = []
  missionSeqToMarkerSeq.value = {}
}

const refreshMission = async (): Promise<void> => {
  if (!mapReady.value) return

  // Load the stored mission if it exists
  if (missionStore.vehicleMission.length > 0) {
    clearMapDrawing()
    rebuildMissionSeqMapping(missionStore.vehicleMission)
    drawMission(missionStore.vehicleMission)
  }

  // If vehicle is online, check if its mission differs from stored/loaded mission
  if (vehicleStore.isVehicleOnline) {
    if (missionStore.vehicleMission.length === 0) {
      await downloadMissionFromVehicle()
    } else {
      await checkIfMissionChanged()
    }
  }
}

//   There are small differences in the waypoint data between the one downloaded from the vehicle and the stored mission.
//   This function normalizes that to make them comparable.
const normalizeWaypointForCompare = (wp: Waypoint): Record<string, unknown> => {
  return {
    coordinates: [normalizeNumber(wp.coordinates?.[0], 7), normalizeNumber(wp.coordinates?.[1], 7)] as [number, number],
    altitude: normalizeNumber(wp.altitude, 2),
    altitudeReferenceType: wp.altitudeReferenceType,
    commands: (wp.commands ?? []).map((rawCmd) => {
      const cmd = normalizeNavWaypointDefaults(rawCmd)
      const base = {
        type: cmd.type,
        command: cmd.command,
        param1: normalizeNumber(cmd.param1, 3),
        param2: normalizeNumber(cmd.param2, 3),
        param3: normalizeNumber(cmd.param3, 3),
        param4: normalizeNumber(cmd.param4, 3),
      }
      return cmd.type === 'MAVLINK_NON_NAV_COMMAND'
        ? {
            ...base,
            x: normalizeNumber((cmd as any).x, 3),
            y: normalizeNumber((cmd as any).y, 3),
            z: normalizeNumber((cmd as any).z, 3),
          }
        : base
    }),
  }
}

const normalizeNumber = (v: number | undefined | null, decimals: number): number => {
  if (v == null || Number.isNaN(v)) return 0
  const factor = 10 ** decimals
  return Math.round(v * factor) / factor
}

const normalizeNavWaypointDefaults = (cmd: any): any => {
  if (cmd?.command !== MavCmd.MAV_CMD_NAV_WAYPOINT) return cmd
  return {
    ...cmd,
    param2: cmd.param2 || 5,
    param4: cmd.param4 || 999,
  }
}

const missionSignature = (mission: Waypoint[]): string => {
  return JSON.stringify((mission ?? []).map(normalizeWaypointForCompare))
}

let missionChangeCheckInFlight: Promise<void> | undefined
let lastKnownVehicleMissionSignature = ''

const checkIfMissionChanged = async (): Promise<void> => {
  if (!vehicleStore.isVehicleOnline || missionStore.vehicleMission.length === 0 || missionChangeCheckInFlight) return

  missionChangeCheckInFlight = (async () => {
    const downloadedMission = await vehicleStore.fetchMission(async () => Promise.resolve())
    const downloadedSig = missionSignature(downloadedMission)
    const storedSig = missionSignature(missionStore.vehicleMission)

    if (downloadedSig === lastKnownVehicleMissionSignature) return
    if (storedSig !== downloadedSig) {
      lastKnownVehicleMissionSignature = downloadedSig
      missionStore.bumpVehicleMissionRevision(downloadedMission)

      openSnackbar({
        message: 'Mission changed on the vehicle. Using vehicle mission.',
        variant: 'info',
        duration: 2500,
      })
      clearMapDrawing()
      rebuildMissionSeqMapping(downloadedMission)
      drawMission(downloadedMission, { fromVehicle: true })
    } else {
      lastKnownVehicleMissionSignature = storedSig
    }
  })().finally(() => {
    missionChangeCheckInFlight = undefined
  })

  return missionChangeCheckInFlight
}

// When back online, checks if there is a stored mission, verify if it matches the one on the vehicle. If not, get from the vehicle
watch(
  () => vehicleStore.isVehicleOnline,
  async () => {
    if (!mapReady.value || !vehicleStore.isVehicleOnline) return
    if (missionStore.vehicleMission.length) {
      await checkIfMissionChanged()
      return
    }

    refreshMission()
  }
)

watch(
  () => missionStore.vehicleMissionRevision,
  () => {
    refreshMission()
  }
)

// - disable auto update for target follower
// - remove event listeners
onBeforeUnmount(() => {
  // Debounced saves may still be pending; write the live view now so Mission Planning mounts with it.
  persistLiveMapView(missionStore.saveLastMapPosition, map.value, zoom.value, mapCenter.value)

  targetFollower.disableAutoUpdate()
  stopUnFollowOnUserDrag?.()
  window.removeEventListener('keydown', onKeydown)

  mapOverlays.destroyOverlays()
  tileSelection.destroy()

  mapBase.value?.removeEventListener('touchstart', onTouchStart)
  mapBase.value?.removeEventListener('touchend', onTouchEnd)

  // Tear down the map instance and reset the map context
  mapContext.mapReady.value = false
  map.value = undefined
  mapContext.map.value = undefined
  mapInstance?.remove()
  mapInstance = undefined
})

// Pan when variables change
watch(mapCenter, (newCenter) => {
  if (!map.value || sameCoordinates(newCenter, fromLngLat(map.value.getCenter()))) return
  map.value.panTo(toLngLat(newCenter), { duration: 250 })
})

// Zoom when the variable changes
watch(zoom, (newZoom, oldZoom) => {
  if (newZoom === oldZoom) return
  contextMenuVisible.value = false
  if (!map.value) return
  recenterMapOnFollowTarget(map.value, zoom.value, targetFollower.currentCoordinates())
})

// Watch for zoom level changes to update waypoint marker sizes
watch(zoom, () => {
  if (map.value) {
    refreshReachedWaypointMarkerStyles()
  }
})

// Allow following a given target
const followerTarget = ref<string | undefined>(undefined)
const targetFollower = new TargetFollower(
  (newTarget: string | undefined) => (followerTarget.value = newTarget),
  (newCenter: WaypointCoordinates) => (mapCenter.value = newCenter)
)
targetFollower.setTrackableTarget(WhoToFollow.VEHICLE, () => vehiclePosition.value)
targetFollower.setTrackableTarget(WhoToFollow.HOME, () => home.value)
targetFollower.setTrackableTarget(WhoToFollow.BASE_STATION, () => baseStationStore.activePosition)

useBaseStationOverlay(map, mapReady)

// Calculate live vehicle position
const vehiclePosition = computed(() =>
  vehicleStore.coordinates.latitude
    ? ([vehicleStore.coordinates.latitude, vehicleStore.coordinates.longitude] as WaypointCoordinates)
    : undefined
)

// Calculate live vehicle heading
const vehicleHeading = computed(() => (vehicleStore.attitude.yaw ? degrees(vehicleStore.attitude?.yaw) : 0))

// Calculate time since last vehicle heartbeat
const timeAgoSeenText = computed(() => {
  const lastBeat = vehicleStore.lastHeartbeat
  return lastBeat ? `${formatDistanceToNow(lastBeat ?? 0, { includeSeconds: true })} ago` : 'never'
})

const vehicleTooltipState = computed<VehicleTooltipState>(() => ({
  coordinates: vehiclePosition.value,
  groundVelocityInMetersPerSecond: vehicleStore.velocity.ground,
  headingInDegrees: vehicleHeading.value,
  isArmed: vehicleStore.isArmed,
  timeAgoSeenText: timeAgoSeenText.value,
}))

useMapCenterFromUserLocation(mapCenter, () => Boolean(home.value || vehiclePosition.value))

// If home position is updated and map was not yet centered on it, center
let mapNotYetCenteredInHome = true
watch([home, map], async () => {
  if (home.value === mapCenter.value || !map.value || !mapNotYetCenteredInHome) return
  targetFollower.goToTarget(WhoToFollow.HOME)
  mapNotYetCenteredInHome = false
})

// Create marker for the vehicle
const vehicleMarker = useMapVehicleMarker(map, {
  position: () => vehiclePosition.value,
  iconUrl: () => vehicleMarkerImageUrl(vehicleStore.vehicleType),
  tooltipContent: () => vehicleTooltipContent(vehicleTooltipState.value, interfaceStore.displayUnitPreferences),
  headingInDegrees: () => vehicleHeading.value,
  tooltipClassName: 'vehicle-tooltip',
  zIndex: 650,
})

watch(followerTarget, (newTarget) => {
  if (newTarget === WhoToFollow.VEHICLE) {
    missionStore.followVehicleOnMap = true
  } else {
    missionStore.followVehicleOnMap = false
  }
  if (map.value) applyFollowZoomMode(map.value, !!newTarget)
})

/**
 * A round marker carrying an icon in a permanent centered tooltip, which is how the home, GoTo, global origin and
 * default-position markers are drawn.
 */
type IconMarker = {
  /** The marker. */
  marker: Marker
  /** The tooltip holding the icon. */
  tooltip: MarkerTooltip
}

const createIconMarker = (
  instance: MapLibreMap,
  at: WaypointCoordinates,
  iconHtml: string,
  draggable = false
): IconMarker => {
  const marker = divIconMarker({ className: 'marker-icon', size: [24, 24], draggable })
  marker.setLngLat(toLngLat(at)).addTo(instance)
  const tooltip = bindTooltip(instance, marker, iconHtml, {
    permanent: true,
    direction: 'center',
    className: 'waypoint-tooltip waypoint-tooltip--icon',
  })
  return { marker, tooltip }
}

const removeIconMarker = (iconMarker: IconMarker | undefined): void => {
  iconMarker?.tooltip.remove()
  iconMarker?.marker.remove()
}

// Create marker for the home position
const homeMarker = shallowRef<IconMarker>()

// An unconfirmed home is a mission's first item or a last known one, so it is signed rather than presented as the
// position the vehicle would actually return to.
const homeMarkerContent = computed(() => {
  const icon = isHomeConfirmedByVehicle.value ? 'mdi-home-map-marker' : 'mdi-home-alert'
  return `<i class="mdi ${icon} text-[18px] "></i>`
})

// Carried by the marker rather than by its tooltip, which is not interactive and so never sees the pointer.
const homeMarkerTitle = computed(() =>
  isHomeConfirmedByVehicle.value ? '' : 'The vehicle has not reported this home position'
)

// Watches the map too, so a home already known when the widget mounts still gets a marker once the map exists.
watch([home, map, isHomeConfirmedByVehicle], () => {
  if (map.value === undefined) return

  const position = home.value
  if (position === undefined) return

  if (!homeMarker.value) {
    homeMarker.value = createIconMarker(map.value, position, homeMarkerContent.value, true)
    const { marker } = homeMarker.value
    marker.getElement().setAttribute('title', homeMarkerTitle.value)
    marker.getElement().addEventListener('click', (event) => event.stopPropagation())
    marker.on('dragend', async () => {
      // A home drawn from a mission is just a rendering of that mission, so dragging it must not command the vehicle.
      // Snapping back keeps the marker honest, as nothing anywhere would hold the dragged-to position.
      if (missionStore.homeMarkerSource === 'mission') {
        if (home.value) marker.setLngLat(toLngLat(home.value))
        openSnackbar({
          message: 'This home point comes from the mission. Use "Set home waypoint" on the map menu to move it.',
          variant: 'info',
          duration: 5000,
        })
        return
      }
      await setHomePosition(fromLngLat(marker.getLngLat()))
      // The vehicle may have refused the new position, so the marker goes back to whichever home is still current.
      if (home.value) marker.setLngLat(toLngLat(home.value))
    })
  } else {
    homeMarker.value.marker.setLngLat(toLngLat(position))
    homeMarker.value.tooltip.setContent(homeMarkerContent.value)
    homeMarker.value.marker.getElement().setAttribute('title', homeMarkerTitle.value)
  }
})

// Draw a marker for each mission waypoint
watch(mapWaypoints, (newWaypoints) => {
  const instance = map.value
  if (!instance) return

  mapWaypointMarkers.value.forEach((m) => m.remove())
  mapWaypointMarkers.value = []

  // Add a marker for each point
  newWaypoints.forEach((waypoint, idx) => {
    const seq = idx + 1
    let marker = reachedWaypoints.value[seq]
    if (!marker) {
      const isReached = getReachedWaypointIndices.value.has(seq)
      const isCurrent = idx === currentMapWpIndex.value
      marker = divIconMarker({ ...waypointMarkerIcon(isReached, isCurrent), className: 'waypoint-marker-icon' })
      reachedWaypoints.value[seq] = marker
      marker.setLngLat(toLngLat(waypoint.coordinates)).addTo(instance)

      const markerSizeForTooltip = getEffectiveMarkerSize(zoom.value)
      waypointTooltips[seq] = bindTooltip(instance, marker, seq.toString(), {
        permanent: true,
        direction: 'center',
        className: isReached
          ? 'waypoint-tooltip waypoint-tooltip--reached'
          : isCurrent
          ? 'waypoint-tooltip waypoint-tooltip--current-waypoint'
          : 'waypoint-tooltip',
        opacity: markerSizeForTooltip === 'md' ? 1 : 0,
      })

      const element = marker.getElement()
      element.addEventListener('click', (event) => event.stopPropagation())
      element.addEventListener('contextmenu', (event: MouseEvent) => {
        event.stopPropagation()
        event.preventDefault()
        openContextMenuAt(event, seq)
      })
    } else {
      marker.setLngLat(toLngLat(waypoint.coordinates))
      const markerSizeForUpdate = getEffectiveMarkerSize(zoom.value)
      const tooltip = waypointTooltips[seq]
      if (tooltip) {
        const showNumber = markerSizeForUpdate === 'md'
        if (showNumber) tooltip.setContent(seq.toString())
        tooltip.setOpacity(showNumber ? 1 : 0)
      }
      applyWaypointMarkerStyle(seq)
    }
  })
})

// Keep an eye on the current mission status and update the waypoint markers accordingly
watch([getReachedWaypointIndices, currentMapWpIndex], () => {
  Object.keys(reachedWaypoints.value).forEach((seqStr) => {
    const seq = Number(seqStr)
    const idx = seq - 1
    const isCurrent = currentMapWpIndex.value >= 0 && idx === currentMapWpIndex.value
    const isReached = getReachedWaypointIndices.value.has(seq)

    applyWaypointMarkerStyle(seq)

    const tooltip = waypointTooltips[seq]
    if (tooltip) {
      const tooltipElement = tooltip.getElement()
      tooltipElement.classList.remove('waypoint-tooltip--reached', 'waypoint-tooltip--current-waypoint')
      if (isReached) {
        tooltipElement.classList.add('waypoint-tooltip--reached')
      } else if (isCurrent) {
        tooltipElement.classList.add('waypoint-tooltip--current-waypoint')
      }
      // A class change resizes the label, so it is re-centered on its marker.
      tooltip.setContent(tooltipElement.innerHTML)
    }
  })
})

useMapMissionLayer(map, {
  waypoints: () => mapWaypoints.value,
  show: () => mapWaypoints.value.length > 0,
  color: '#358AC3',
  shadow: true,
})

useMapVehiclePathLayer(map, {
  path: () => missionStore.vehiclePositionHistory,
  revision: () => missionStore.vehiclePositionHistoryRevision,
  show: () => widget.value.options.showVehiclePath && vehicleMarker.value !== undefined,
})

// Handle context menu toggling and selection
const contextMenuVisible = ref(false)
const clickedLocation = ref<[number, number] | null>(null)

// Global origin dialog state
const showGlobalOriginDialog = ref(false)
const globalOriginLatitude = ref(0)
const globalOriginLongitude = ref(0)
const globalOriginMarker = shallowRef<IconMarker>()

const staticTopMenuItems = [
  { item: 'Set home waypoint', action: () => onMenuOptionSelect('set-home-waypoint'), icon: 'mdi-home-map-marker' },
  { item: 'Set Global Origin', action: () => onMenuOptionSelect('set-global-origin'), icon: 'mdi-crosshairs-question' },
  { item: 'Place Point of Interest', action: () => onMenuOptionSelect('place-poi'), icon: 'mdi-map-marker-plus' },
  {
    item: 'Add overlay (GeoTIFF)',
    action: () => onMenuOptionSelect('add-overlay'),
    icon: 'mdi-image-plus',
    _isOverlay: true,
  },
  { item: 'Copy coordinates', action: () => onMenuOptionSelect('copy-coordinates'), icon: 'mdi-content-copy' },
]

const staticBottomMenuItems = [
  { item: 'GoTo', action: () => onMenuOptionSelect('goto'), icon: 'mdi-crosshairs-gps' },
  { item: 'Set vehicle position', action: () => onMenuOptionSelect('set-position'), icon: 'mdi-map-marker-check' },
  {
    item: 'Set default map position',
    action: () => onMenuOptionSelect('set-default-map-position'),
    icon: 'mdi-map-check',
  },
  {
    item: 'Clear vehicle path history',
    action: () => onMenuOptionSelect('clear-vehicle-path-history'),
    icon: 'mdi-gesture',
  },
]

const baseStationMenuEntries = computed(() => {
  const entries = [
    {
      item: baseStationPlaceMenuLabel(baseStationStore.config.enabled),
      action: () => onMenuOptionSelect('place-base-station'),
      icon: baseStationMenuIcon,
    },
  ]
  if (baseStationStore.config.enabled) {
    entries.push(
      {
        item: removeBaseStationMenuLabel,
        action: () => onMenuOptionSelect('remove-base-station'),
        icon: removeBaseStationMenuIcon,
      },
      {
        item: baseStationSignalVisibilityLabel(baseStationStore.config.showSignalOnMap),
        action: () => onMenuOptionSelect('toggle-base-station-signal-visibility'),
        icon: baseStationSignalVisibilityIcon(baseStationStore.config.showSignalOnMap),
      },
      {
        item: configureBaseStationMenuLabel,
        action: () => onMenuOptionSelect('configure-base-station'),
        icon: configureBaseStationMenuIcon,
      }
    )
  }
  return entries
})

const missionControlPanelSetup = missionControlPanelSetupInfo()

const missionControlPanelMenuEntries = computed(() => {
  if (!missionControlPanelSetup) return []
  const hasPanel = widgetStore.currentView.widgets.some((w) => w.component === WidgetType.MissionControlPanel)
  if (hasPanel) return []
  return [
    {
      item: 'Add mission control panel',
      action: () => onMenuOptionSelect('add-mission-control-panel'),
      icon: 'mdi-plus-box',
    },
  ]
})

const menuItems = reactive([
  ...staticTopMenuItems,
  ...baseStationMenuEntries.value,
  ...missionControlPanelMenuEntries.value,
  ...staticBottomMenuItems,
])

// The base-station entries change label/visibility with the store; rebuild the fixed segments
// around them so the reactive array handed to the context menu keeps its identity.
watch([baseStationMenuEntries, missionControlPanelMenuEntries], ([baseStationEntries, mcpEntries]) => {
  menuItems.splice(
    0,
    menuItems.length,
    ...staticTopMenuItems,
    ...baseStationEntries,
    ...mcpEntries,
    ...staticBottomMenuItems
  )
  // The waypoint entry is appended after construction, so the rebuild has to put it back.
  updateSkipToWpMenu()
})

const updateSkipToWpMenu = (): void => {
  const want = contextMenuSelectedWpIndex.value !== null
  const last = menuItems[menuItems.length - 1] as any
  const lastIsSkip = !!last && last._isSkipToWp === true

  if (want && !lastIsSkip) {
    menuItems.push({
      item: `Skip mission to this Waypoint`,
      action: () => onMenuOptionSelect('skip-to-wp'),
      icon: 'mdi-skip-next-circle',
      _isSkipToWp: true,
    } as any)
  } else if (!want && lastIsSkip) {
    menuItems.pop()
  } else if (want && lastIsSkip) {
    last.item = `Skip mission to this Waypoint`
  }
}

const updateOverlayMenuLabel = (): void => {
  const overlayItem = menuItems.find((item) => (item as any)._isOverlay === true)
  if (overlayItem) {
    overlayItem.item = missionStore.mapOverlays.length > 0 ? 'Manage overlays' : 'Add overlay (GeoTIFF)'
  }
}

const openContextMenuAt = async (mouseEv: MouseEvent, wpIndex: number | null): Promise<void> => {
  if (contextMenuVisible.value) {
    contextMenuVisible.value = false
    await nextTick()
  }

  contextMenuSelectedWpIndex.value = wpIndex
  updateSkipToWpMenu()
  updateOverlayMenuLabel()
  contextMenuVersion.value++
  contextMenuVisible.value = true
  await nextTick()

  if (contextMenuRef.value?.openAt) {
    contextMenuRef.value.openAt(mouseEv)
  } else {
    await nextTick()
    contextMenuRef.value?.openAt?.(mouseEv)
  }
}

const gotoMarker = shallowRef<IconMarker>()

// ponytail: fixed guess of how far a right-click lands from the intended spot; a drag-to-refine marker would measure it.
const clickUncertaintyPixels = 5

const setDefaultMapPosition = async (): Promise<void> => {
  if (!map.value || !clickedLocation.value) return

  try {
    await missionStore.setDefaultMapPosition(clickedLocation.value, zoom.value)
    openSnackbar({ message: 'Default map position set', variant: 'success' })

    const tempMarker = createIconMarker(
      map.value,
      clickedLocation.value,
      '<i class="mdi mdi-map-check text-[18px] border-[1px] rounded-full px-[2px] py-[1px]"></i>'
    )

    const fadingElements = [tempMarker.marker.getElement(), tempMarker.tooltip.getElement()]
    fadingElements.forEach((el) => (el.style.transition = 'opacity 1s'))

    setTimeout(() => {
      tempMarker.marker.setOpacity('0')
      tempMarker.tooltip.setOpacity(0)
      setTimeout(() => removeIconMarker(tempMarker), 1000)
    }, 1500)
  } catch (error) {
    console.error(error)
    openSnackbar({ message: 'Failed to set default map position', variant: 'error' })
  }
}

const clearGotoMarker = (): void => {
  removeIconMarker(gotoMarker.value)
  gotoMarker.value = undefined
}

// Places the regular GoTo marker on the map. Not used for PoI GoTo targets, which show the active state
// via a pulsating border on the PoI marker itself (see useMapPoiMarkers and .poi-marker-goto-target styles).
const placeGotoMarker = (coordinates: WaypointCoordinates): void => {
  if (!map.value) return

  clearGotoMarker()

  gotoMarker.value = createIconMarker(
    map.value,
    coordinates,
    '<i class="mdi mdi-crosshairs-gps border-[1px] rounded-full text-[18px] px-[2px] pt-[1px] "></i>'
  )
}

const onMenuOptionSelect = async (option: string): Promise<void> => {
  logUserAction(`Selected map context-menu action '${option}'`)
  switch (option) {
    case 'goto': {
      if (!clickedLocation.value) break
      poiGoTo.clearTarget()
      placeGotoMarker(clickedLocation.value)
      await issueGoto(clickedLocation.value)
      break
    }

    case 'set-position': {
      if (!clickedLocation.value) break
      const [latitude, longitude] = clickedLocation.value
      const accuracy = metersPerPixel(latitude, zoom.value) * clickUncertaintyPixels
      try {
        await vehicleStore.sendExternalPositionEstimate(latitude, longitude, accuracy)
        openSnackbar({ message: 'Vehicle position updated.', variant: 'success' })
      } catch (error) {
        openSnackbar({ message: `Could not set the vehicle position: ${(error as Error).message}`, variant: 'error' })
      }
      break
    }

    case 'set-default-map-position':
      setDefaultMapPosition()
      break

    case 'copy-coordinates':
      if (clickedLocation.value) {
        const coordinates = `${clickedLocation.value[0].toFixed(7)}, ${clickedLocation.value[1].toFixed(7)}`
        try {
          await copyToClipboard(coordinates)
          logUserAction('Copied map coordinates from the context menu')
          openSnackbar({ message: `Coordinates copied: ${coordinates}`, variant: 'success' })
        } catch (error) {
          openSnackbar({ message: `Failed to copy coordinates: ${(error as Error).message}`, variant: 'error' })
        }
      }
      break

    case 'add-overlay':
      overlaysDialogOpen.value = true
      break

    case 'place-poi':
      if (clickedLocation.value && poiManagerMapWidgetRef.value) {
        poiManagerMapWidgetRef.value.openDialog(clickedLocation.value)
      } else if (!clickedLocation.value) {
        openSnackbar({ message: 'Cannot place Point of Interest without map coordinates.', variant: 'error' })
        console.error('Cannot open POI dialog without click coordinates for new POI')
      } else if (!poiManagerMapWidgetRef.value) {
        openSnackbar({ message: 'POI Manager (map widget) is not available.', variant: 'error' })
        console.error('Cannot open POI dialog, POI Manager (map widget) ref is not set.')
      }
      break

    case 'set-home-waypoint':
      if (clickedLocation.value) {
        setHomePosition(clickedLocation.value as [number, number])
      }
      break

    case 'set-global-origin':
      if (clickedLocation.value) {
        globalOriginLatitude.value = clickedLocation.value[0]
        globalOriginLongitude.value = clickedLocation.value[1]
        showGlobalOriginDialog.value = true
      }
      break

    case 'skip-to-wp': {
      const idx = contextMenuSelectedWpIndex.value
      if (!vehicleStore.isVehicleOnline || idx == null) {
        openSnackbar({ message: 'Cannot skip (vehicle offline or invalid WP).', variant: 'error' })
        break
      }
      try {
        vehicleStore.setMissionCurrent(idx)
      } catch (error) {
        openSnackbar({ message: `Failed to skip to WP #${idx}: ${(error as Error).message}`, variant: 'error' })
      }
      break
    }
    case 'clear-vehicle-path-history':
      missionStore.clearVehicleHistory()
      openSnackbar({ message: 'Vehicle path history cleared', variant: 'success' })
      break

    case 'place-base-station':
      if (!clickedLocation.value) {
        openSnackbar({
          variant: 'error',
          message: 'No map position under the cursor. Right-click on the map where the base station should go.',
          duration: 4000,
        })
        break
      }
      baseStationStore.setPosition(clickedLocation.value)
      baseStationStore.configPanelOpen = true
      logUserAction('Placed the base station via the map context menu')
      break

    case 'configure-base-station':
      baseStationStore.configPanelOpen = true
      break

    case 'remove-base-station':
      confirmRemoveBaseStation(showDialog, closeDialog)
      break

    case 'toggle-base-station-signal-visibility':
      baseStationStore.toggleSignalVisibility()
      break

    case 'add-mission-control-panel': {
      if (!missionControlPanelSetup) break
      const added = widgetStore.addWidget(missionControlPanelSetup, widgetStore.currentView)
      widgetStore.allowMovingAndResizing(added.hash, widgetStore.editingMode)
      logUserAction('Added a mission control panel from the map context menu')
      openSnackbar({ message: 'Mission control panel added to this view', variant: 'success' })
      break
    }

    default:
      console.warn('Unknown menu option selected:', option)
  }

  contextMenuVisible.value = false
}

const hideContextMenuAndMarker = (): void => {
  contextMenuVisible.value = false
  contextMenuSelectedWpIndex.value = null
  updateSkipToWpMenu()
}

const pauseMapWhileHidden = (): void => {
  persistLiveMapView(missionStore.saveLastMapPosition, map.value, zoom.value, mapCenter.value)
  targetFollower.disableAutoUpdate()
  downloadMenuOpen.value = false
  overlaysDialogOpen.value = false
  isMissionChecklistOpen.value = false
  showGlobalOriginDialog.value = false
  centerDialOpen.value = false
  fenceDialOpen.value = false
  hideContextMenuAndMarker()
  poiPopupRef.value?.close()
  poiManagerMapWidgetRef.value?.closeDialog(false)
}

const resumeMapWhenVisible = (): void => {
  const lastZoom = missionStore.userLastMapZoom ?? missionStore.defaultMapZoom
  const lastCenter = missionStore.userLastMapCenter ?? missionStore.defaultMapCenter
  zoom.value = lastZoom
  mapCenter.value = lastCenter
  if (map.value) setMapView(map.value, lastCenter, lastZoom)
  targetFollower.enableAutoUpdate()
  if (missionStore.followVehicleOnMap === true) {
    targetFollower.follow(WhoToFollow.VEHICLE)
  } else {
    targetFollower.unFollow()
  }
  if (map.value) applyFollowZoomMode(map.value, !!followerTarget.value)
}

watch(isFlightVisible, (visible) => {
  if (visible) {
    nextTick(() => resumeMapWhenVisible())
    return
  }
  pauseMapWhileHidden()
})

const onGlobalOriginSet = (latitude: number, longitude: number): void => {
  if (!map.value) return
  logUserAction('Set vehicle global origin from map')

  // Remove existing marker if present
  removeIconMarker(globalOriginMarker.value)

  // Create a new marker with the axis-arrow icon
  globalOriginMarker.value = createIconMarker(
    map.value,
    [latitude, longitude],
    '<i class="mdi mdi-axis-arrow text-[18px]"></i>'
  )
}

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    hideContextMenuAndMarker()
    poiPopupRef.value?.close()
    return
  }
}

const drawMission = (
  missionItems: Waypoint[],
  options?: {
    /** Whether the vehicle just sent this mission, making its first item the home the vehicle holds. */
    fromVehicle?: boolean
  }
): void => {
  const drawn: Waypoint[] = []
  missionItems.forEach((wp, idx) => {
    if (idx === 0) {
      // Only moves the marker. Echoing this back as a set-home command would overwrite the vehicle's home with a
      // possibly stale one, as missions are restored from persistent storage on startup. Which is also why a stored
      // mission's first item must not replace a home the vehicle reported, while one just downloaded may be that home.
      if (options?.fromVehicle) {
        vehicleStore.setHomeFromVehicleMission(wp.coordinates)
      } else {
        missionStore.setHomeFromStoredMission(wp.coordinates)
      }
    } else {
      drawn.push(wp)
    }
  })
  // Avoids paying a deep-walk on every push.
  mapWaypoints.value = drawn
}

// Allow fetching missions
const fetchingMission = ref(false)
const missionFetchProgress = ref(0)

const rebuildMissionSeqMapping = (missionItems: Waypoint[]): void => {
  const remap: Record<number, number> = {}
  let seq = 0

  missionItems.forEach((wp, idx) => {
    const markerSeq = idx === 0 ? undefined : idx

    wp.commands.forEach((cmd) => {
      if (cmd.type !== 'MAVLINK_NAV_COMMAND' && cmd.type !== 'MAVLINK_NON_NAV_COMMAND') return // unchanged intent

      if (markerSeq !== undefined) remap[seq] = markerSeq
      seq += 1
    })
  })

  missionSeqToMarkerSeq.value = remap
}

// Allow fetching missions
const downloadMissionFromVehicle = async (): Promise<void> => {
  fetchingMission.value = true
  clearMapDrawing()

  const loadingCallback = async (loadingPerc: number): Promise<void> => {
    missionFetchProgress.value = loadingPerc
  }

  try {
    missionItemsInVehicle.value = await vehicleStore.fetchMission(loadingCallback)
    rebuildMissionSeqMapping(missionItemsInVehicle.value as Waypoint[])
    drawMission(missionItemsInVehicle.value as Waypoint[], { fromVehicle: true })

    openSnackbar({ variant: 'success', message: 'Mission download succeeded!', duration: 3000 })
  } catch (error) {
    showDialog({ variant: 'error', title: 'Mission download failed', message: messageFromError(error), timer: 5000 })
  } finally {
    fetchingMission.value = false
  }
}

const setHomePosition = async (homePosition: [number, number]): Promise<void> => {
  logUserAction('Set the home position from the map')
  const newHome: [number, number] = [homePosition[0], homePosition[1]]

  // The marker is only moved by the store, once the vehicle has acknowledged the command, so a refusal cannot leave it
  // standing somewhere the vehicle never accepted.
  try {
    await vehicleStore.setHomeWaypoint(newHome, 0)
    openSnackbar({ variant: 'success', message: 'Home position set on the vehicle.', duration: 3000 })
  } catch (error) {
    openSnackbar({ variant: 'error', message: `Failed to set the home position: ${error}`, duration: 5000 })
  }

  if (contextMenuVisible.value) {
    contextMenuVisible.value = false
  }
}

// Allow executing missions
const executeMissionOnVehicle = async (): Promise<void> => {
  logUserAction('Started mission from map')
  const started = await missionStore.executeMissionOnVehicle()
  if (!started) {
    openSnackbar({ message: 'Failed to start mission.', variant: 'error' })
  }
}

// Set dynamic styles for correct displacement of the bottom buttons when the widget is below the bottom bar
const bottomButtonsDisplacement = computed(() => {
  return `${Math.max(-widgetStore.widgetClearanceForVisibleArea(widget.value).bottom, 0)}px`
})

// The fence control only mounts on ArduPilot, so the scale control clears its slot only when it is there.
const scaleControlRightDisplacement = computed(() => (fenceStore.isArduPilot ? '383px' : '338px'))

const topProgressBarDisplacement = computed(() => {
  return `${Math.max(-widgetStore.widgetClearanceForVisibleArea(widget.value).top, 0)}px`
})

const missionFitCoordinates = computed<WaypointCoordinates[]>(() => {
  const drawn = mapWaypoints.value.map((wp) => wp.coordinates)
  if (drawn.length > 0) return drawn
  return missionItemsInVehicle.value.map((wp) => wp.coordinates)
})

const hasMissionWaypoints = computed(() => missionFitCoordinates.value.length > 0)

const navigateToMissionPlanning = (): void => {
  logUserAction('Navigated to Mission Planning from map widget')
  router.push('/mission-planning')
}

const centerOnMission = (): void => {
  if (!map.value || !hasMissionWaypoints.value) return
  logUserAction('Centered map on mission')
  targetFollower.unFollow()
  fitMapToWaypoints(map.value, missionFitCoordinates.value)
}
</script>

<style scoped>
.page-base {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.map {
  position: absolute;
  z-index: 0;
  height: 100%;
  width: 100%;
}

.waypoint-marker-icon {
  background: none;
  border: none;
}

.waypoint-main-marker {
  width: 25px;
  height: 25px;
  border-radius: 50%;
  position: absolute;
}

.wp-marker-xs .waypoint-main-marker {
  width: 4px;
  height: 4px;
  top: 1px;
  left: 1px;
}

.wp-marker-sm .waypoint-main-marker {
  width: 10px;
  height: 10px;
  top: 1px;
  left: 1px;
}

:deep(.marker-icon--reached) {
  background-color: #ffff00;
  border: 2px solid #000000dd;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.2);
}

:global(.marker-icon) {
  background-color: #1e498f;
  border: 1px solid #ffffff55;
  border-radius: 50%;
  box-shadow: 2px 3px 1px rgba(0, 0, 0, 0.2);
}

:global(.marker-icon-active) {
  background-color: #925801;
  border: 2px solid #ffffffaa;
  border-radius: 50%;
  box-shadow: 2px 3px 1px rgba(0, 0, 0, 0.3);
}

:global(.mission-path) {
  filter: drop-shadow(2px 3px 1px rgba(0, 0, 0, 0.2));
}

.waypoint-tooltip {
  background-color: white;
  padding: 0.75rem;
  border: 1px solid rgba(0, 0, 0, 0.2);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  color: black;
  z-index: 100;
}

/* While the user is actively dragging the map, hide the numbered waypoint tooltips and
 * the waypoint marker DOM elements. Singular icon tooltips (home, goto, global origin,
 * default-position) are kept visible. */
:global(.maplibregl-map.cockpit-drag-active .waypoint-tooltip:not(.waypoint-tooltip--icon)),
:global(.maplibregl-map.cockpit-drag-active .waypoint-marker-icon) {
  display: none !important;
}

:deep(.vehicle-tooltip) {
  background-color: var(--glass-background) !important;
  backdrop-filter: var(--glass-filter);
  border: var(--glass-border) !important;
  box-shadow: var(--glass-box-shadow);
  color: var(--glass-color);
  padding: 0.75rem;
  border-radius: 8px;
  z-index: 100;
}

:deep(.vehicle-tooltip::before) {
  border-right-color: var(--glass-background) !important;
}

:deep(.waypoint-tooltip--current-waypoint) {
  background-color: #925801;
  border: 1px solid #ffffffaa;
  border-radius: 50%;
  box-shadow: 2px 3px 1px rgba(0, 0, 0, 0.3);
  color: white;
  padding: 0;
  width: 1.6rem;
  height: 1.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

:deep(.waypoint-tooltip--reached) {
  color: #000000;
  font-weight: bold;
}

.vehicle-marker {
  z-index: 200 !important;
}

.context-menu {
  position: absolute;
  z-index: 1003;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  /* Optional: adds a slight shadow for depth */
  border-radius: 4px;
  /* Optional: rounds the corners */
  top: 50px;
  left: 50px;
}

.context-menu ul {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

.context-menu ul li {
  padding: 5px 10px;
  cursor: pointer;
}

.context-menu ul li:hover {
  background-color: #ddd;
}

.active-events-on-disabled {
  pointer-events: all;
}

.bottom-button {
  bottom: v-bind('bottomButtonsDisplacement');
}

/* Static north reference, stacked just above the bottom-right zoom control. */
.north-indicator {
  position: absolute;
  right: 10px;
  bottom: calc(v-bind('bottomButtonsDisplacement') + 85px);
  z-index: 1002;
}

.poi-marker-icon-widget {
  /* Style for POI markers in map widget, if needed */
  font-size: 20px;
  cursor: pointer;
  background: none;
  color: white;
  border: none;
}

.poi-marker-container {
  position: relative;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.poi-marker-background {
  position: absolute;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.7);
  z-index: 1;
}

.poi-tooltip-widget {
  /* Style for POI tooltips in map widget */
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 5px 8px;
}

:deep(.cockpit-scale-control) {
  position: absolute;
  bottom: v-bind('bottomButtonsDisplacement');
  margin-bottom: 12px;
  right: v-bind('scaleControlRightDisplacement'); /* Position to the left of the buttons */
  background: rgba(255, 255, 255, 0.8);
  border-radius: 1px;
  padding: 6px 6px;
  background: var(--glass-background);
  backdrop-filter: var(--glass-filter);
  box-shadow: var(--glass-box-shadow);
  color: var(--glass-color);
  border: var(--glass-border);
  font-weight: bolder;
}

/* Style the zoom control */
:deep(.maplibregl-ctrl-group:has(.maplibregl-ctrl-zoom-in)) {
  position: relative;
  bottom: v-bind('bottomButtonsDisplacement');
  background: var(--glass-background);
  backdrop-filter: var(--glass-filter);
  box-shadow: var(--glass-box-shadow);
  color: var(--glass-color);
  border: var(--glass-border);
}

:deep(.maplibregl-ctrl-group:has(.maplibregl-ctrl-zoom-in) button) {
  background: transparent !important;
  border: none;
  color: var(--glass-color);
}

:deep(.maplibregl-ctrl-group:has(.maplibregl-ctrl-zoom-in) button:hover),
:deep(.maplibregl-ctrl-group:has(.maplibregl-ctrl-zoom-in) button:focus) {
  background: transparent !important;
}
</style>

<style>
/* Unscoped because the marker DOM is created imperatively (no scope attribute applied).
   Uses box-shadow with a positive spread for the active border so the effect is drawn outside
   the bg circle (revealing the map when transparent) and follows the circular border-radius.
   The static 1px border is hidden during the active state so only the pulsating ring remains. */
.poi-marker-background.poi-marker-goto-target {
  border-color: transparent;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3), 0 0 0 3px rgba(255, 255, 255, 1);
  animation: poi-marker-goto-target-pulse 1s ease-in-out infinite;
}

@keyframes poi-marker-goto-target-pulse {
  0%,
  100% {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3), 0 0 0 3px rgba(255, 255, 255, 1);
  }
  50% {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3), 0 0 0 3px rgba(255, 255, 255, 0);
  }
}
</style>
