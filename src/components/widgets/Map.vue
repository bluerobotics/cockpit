<template>
  <div
    ref="mapBase"
    v-contextmenu="handleContextMenu"
    class="page-base"
    :class="widgetStore.editingMode ? 'pointer-events-none' : 'pointer-events-auto'"
    :style="glassMenuCssVars"
  >
    <div :id="mapId" ref="map" class="map">
      <v-menu v-model="downloadMenuOpen" :close-on-content-click="false" location="top end">
        <template #activator="{ props: menuProps }">
          <v-btn
            v-show="showButtons"
            :style="interfaceStore.globalGlassMenuStyles"
            v-bind="menuProps"
            class="absolute right-[209px] m-3 bottom-button bg-slate-50 text-[14px]"
            elevation="2"
            size="x-small"
            style="z-index: 1002; border-radius: 0px"
            icon="mdi-download-multiple"
          />
        </template>

        <v-list :style="interfaceStore.globalGlassMenuStyles" class="py-0 min-w-[220px] rounded-lg border-[1px]">
          <v-list-item class="py-0" title="Save visible Esri tiles" @click="saveEsri" />
          <v-divider />
          <v-list-item class="py-0" title="Save visible OSM tiles" @click="saveOSM" />
          <v-divider />
          <v-list-item class="py-0" title="Save visible Seamarks tiles" @click="saveSeamarks" />
        </v-list>
      </v-menu>
      <v-tooltip location="top" text="Switch to Mission Planning mode">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-if="showButtons"
            v-bind="tooltipProps"
            class="absolute right-[265px] w-[140px] mb-[14px] bottom-button bg-slate-50 text-[12px] font-bold"
            elevation="4"
            text="Edit mission"
            append-icon="mdi-map-marker-radius-outline"
            style="z-index: 1002; border-radius: 0px"
            :style="interfaceStore.globalGlassMenuStyles"
            hide-details
            size="small"
            @click.stop="router.push('/mission-planning')"
          />
        </template>
      </v-tooltip>
      <v-tooltip location="top" :text="centerHomeButtonTooltipText">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-if="showButtons"
            :style="[interfaceStore.globalGlassMenuStyles, !home ? { color: '#FFFFFF33' } : {}]"
            v-bind="tooltipProps"
            class="absolute right-[166px] m-3 bottom-button bg-slate-50 text-[14px]"
            :class="!home ? 'active-events-on-disabled' : ''"
            :color="followerTarget == WhoToFollow.HOME ? 'red' : ''"
            elevation="2"
            style="z-index: 1002; border-radius: 0px"
            icon="mdi-home-search"
            size="x-small"
            :disabled="!home"
            @click.stop="targetFollower.goToTarget(WhoToFollow.HOME, true)"
            @dblclick.stop="targetFollower.follow(WhoToFollow.HOME)"
          />
        </template>
      </v-tooltip>

      <v-tooltip location="top" :text="centerVehicleButtonTooltipText">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-if="showButtons"
            :style="[interfaceStore.globalGlassMenuStyles, !vehiclePosition ? { color: '#FFFFFF33' } : {}]"
            v-bind="tooltipProps"
            class="absolute m-3 bottom-button right-[124px] bg-slate-50 text-[14px]"
            :class="!vehiclePosition ? 'active-events-on-disabled' : ''"
            :color="followerTarget == WhoToFollow.VEHICLE ? 'red' : ''"
            elevation="2"
            style="z-index: 1002; border-radius: 0px"
            icon="mdi-airplane-marker"
            size="x-small"
            :disabled="!vehiclePosition"
            @click.stop="targetFollower.goToTarget(WhoToFollow.VEHICLE, true)"
            @dblclick.stop="targetFollower.follow(WhoToFollow.VEHICLE)"
          />
        </template>
      </v-tooltip>

      <v-tooltip location="top" :text="vehicleDownloadMissionButtonTooltipText">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-if="showButtons"
            :style="[interfaceStore.globalGlassMenuStyles, !vehicleStore.isVehicleOnline ? { color: '#FFFFFF33' } : {}]"
            v-bind="tooltipProps"
            class="absolute m-3 bottom-button right-[82px] bg-slate-50 text-[14px]"
            :class="!vehicleStore.isVehicleOnline ? 'active-events-on-disabled' : ''"
            :disabled="!vehicleStore.isVehicleOnline"
            elevation="2"
            style="z-index: 1002; border-radius: 0px"
            icon="mdi-download"
            size="x-small"
            @click.stop="downloadMissionFromVehicle"
          />
        </template>
      </v-tooltip>
      <v-tooltip location="top" :text="vehicleExecuteMissionButtonTooltipText">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-if="showButtons"
            :style="[interfaceStore.globalGlassMenuStyles, !vehicleStore.isVehicleOnline ? { color: '#FFFFFF33' } : {}]"
            v-bind="tooltipProps"
            class="absolute mb-3 ml-1 bottom-button right-[52px] bg-slate-50 text-[14px]"
            :class="!vehicleStore.isVehicleOnline ? 'active-events-on-disabled' : ''"
            :disabled="!vehicleStore.isVehicleOnline"
            elevation="2"
            style="z-index: 1002; border-radius: 0px"
            icon="mdi-play"
            size="x-small"
            @click.stop="tryToStartMission"
          />
        </template>
      </v-tooltip>
      <!-- POI Edge Arrows -->
      <template v-if="mapReady && widget.options.showPoiArrows">
        <div v-for="arrow in poiEdgeArrows" :key="arrow.poiId" class="poi-edge-arrow" :style="arrow.style">
          <v-tooltip location="top" :text="arrow.tooltipText" content-class="poi-arrow-tooltip">
            <template #activator="{ props: tooltipProps }">
              <div v-bind="tooltipProps" class="poi-arrow-container" @click.stop="centerMapOnPoi(arrow.poiId)">
                <i
                  class="mdi mdi-arrow-up-bold poi-arrow-icon"
                  :style="{ transform: `rotate(${arrow.angle}deg)`, color: arrow.color }"
                ></i>
              </div>
            </template>
          </v-tooltip>
        </div>
      </template>
      <!-- Vehicle Edge Arrow -->
      <template v-if="mapReady && vehicleEdgeArrow">
        <div class="poi-edge-arrow" :style="vehicleEdgeArrow.style">
          <v-tooltip location="top" :text="vehicleEdgeArrow.tooltipText" content-class="poi-arrow-tooltip">
            <template #activator="{ props: tooltipProps }">
              <div
                v-bind="tooltipProps"
                class="poi-arrow-container"
                @click.stop="targetFollower.goToTarget(WhoToFollow.VEHICLE, true)"
              >
                <i
                  class="mdi mdi-send-variant poi-arrow-icon"
                  :style="{ transform: `rotate(${vehicleEdgeArrow.angle}deg)`, color: vehicleEdgeArrow.color }"
                ></i>
              </div>
            </template>
          </v-tooltip>
        </div>
      </template>
      <!-- Home Edge Arrow -->
      <template v-if="mapReady && homeEdgeArrow">
        <div class="poi-edge-arrow" :style="homeEdgeArrow.style">
          <v-tooltip location="top" :text="homeEdgeArrow.tooltipText" content-class="poi-arrow-tooltip">
            <template #activator="{ props: tooltipProps }">
              <div
                v-bind="tooltipProps"
                class="poi-arrow-container"
                @click.stop="targetFollower.goToTarget(WhoToFollow.HOME, true)"
              >
                <i
                  class="mdi mdi-home poi-arrow-icon"
                  :style="{ transform: `rotate(${homeEdgeArrow.angle + 90}deg)`, color: homeEdgeArrow.color }"
                ></i>
              </div>
            </template>
          </v-tooltip>
        </div>
      </template>
    </div>
  </div>

  <ContextMenu
    ref="contextMenuRef"
    :visible="contextMenuVisible"
    :width="'260px'"
    :menu-items="menuItems"
    @close="hideContextMenuAndMarker"
  >
  </ContextMenu>

  <v-dialog v-model="widgetStore.widgetManagerVars(widget.hash).configMenuOpen" width="auto">
    <v-card class="pa-2 max-w-[800px]" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="flex justify-between items-center">
        <span class="text-center flex-1">Map widget settings</span>
        <v-btn
          icon="mdi-close"
          size="small"
          variant="text"
          class="absolute right-2 top-2 text-lg"
          @click="widgetStore.widgetManagerVars(widget.hash).configMenuOpen = false"
        />
      </v-card-title>
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
            </v-row>
          </template>
        </ExpansiblePanel>
      </v-card-text>
      <v-divider class="mx-10" />
      <v-card-actions class="flex justify-end pt-3">
        <v-btn @click="widgetStore.widgetManagerVars(widget.hash).configMenuOpen = false">Close</v-btn>
      </v-card-actions>
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
      <span v-if="savingLayerName">({{ savingLayerName }})</span>:&nbsp;
      {{ tilesTotal ? Math.round((tilesSaved / tilesTotal) * 100) : 0 }}%
    </p>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn, useElementHover, useRefHistory, useThrottleFn } from '@vueuse/core'
import { formatDistanceToNow } from 'date-fns'
import L, { type LatLngTuple, LayersControlEvent, LeafletMouseEvent, Map } from 'leaflet'
import { SaveStatus, savetiles, tileLayerOffline } from 'leaflet.offline'
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

import copterMarkerImage from '@/assets/arducopter-top-view.png'
import blueboatMarkerImage from '@/assets/blueboat-marker.png'
import brov2MarkerImage from '@/assets/brov2-marker.png'
import genericVehicleMarkerImage from '@/assets/generic-vehicle-marker.png'
import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import GlobalOriginDialog from '@/components/GlobalOriginDialog.vue'
import MissionChecklist from '@/components/MissionChecklist.vue'
import PoiManager from '@/components/poi/PoiManager.vue'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { openSnackbar } from '@/composables/snackbar'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { calculateHaversineDistance } from '@/libs/mission/general-estimates'
import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { degrees } from '@/libs/utils'
import { createGridOverlay, TargetFollower, WhoToFollow } from '@/libs/utils-map'
import type { MAVLinkVehicle } from '@/libs/vehicle/mavlink/vehicle'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { DialogActions } from '@/types/general'
import type {
  Edge,
  EdgeIntersection,
  IconDimensions,
  MapTileProvider,
  MarkerSizes,
  PoiEdgeArrow,
  PointOfInterest,
  TargetEdgeArrow,
  Waypoint,
  WaypointCoordinates,
} from '@/types/mission'
import type { Widget } from '@/types/widgets'

import ContextMenu from '../ContextMenu.vue'

// Define widget props
// eslint-disable-next-line jsdoc/require-jsdoc
const props = defineProps<{ widget: Widget }>()
const widget = toRefs(props).widget
const interfaceStore = useAppInterfaceStore()
const { showDialog, closeDialog } = useInteractionDialog()
// Instantiate the necessary stores
const vehicleStore = useMainVehicleStore()
const missionStore = useMissionStore()
const router = useRouter()

// Declare the general variables
const map = shallowRef<Map | undefined>()
const zoom = ref(missionStore.defaultMapZoom)
const mapCenter = ref<WaypointCoordinates>(missionStore.defaultMapCenter)
const home = ref()
const mapId = computed(() => `map-${widget.value.hash}`)
const showButtons = computed(() => isMouseOver.value || downloadMenuOpen.value)
const mapReady = ref(false)
const mapWaypoints = ref<Waypoint[]>([])
const reachedWaypoints = shallowRef<Record<number, L.Marker>>({})
const contextMenuRef = ref()
const isDragging = ref(false)
const isPinching = ref(false)
const isMissionChecklistOpen = ref(false)
const isSavingOfflineTiles = ref(false)
const tilesSaved = ref(0)
const tilesTotal = ref(0)
const savingLayerName = ref<string>('')
let esriSaveBtn: HTMLAnchorElement | undefined
let osmSaveBtn: HTMLAnchorElement | undefined
let seamarksSaveBtn: HTMLAnchorElement | undefined
const downloadMenuOpen = ref(false)
const missionItemsInVehicle = ref<Waypoint[]>([])
const missionSeqToMarkerSeq = shallowRef<Record<number, number>>({})

const glassMenuCssVars = computed(() => ({
  '--glass-background': interfaceStore.globalGlassMenuStyles.backgroundColor,
  '--glass-filter': interfaceStore.globalGlassMenuStyles.backdropFilter,
  '--glass-border': interfaceStore.globalGlassMenuStyles.border,
  '--glass-color': interfaceStore.globalGlassMenuStyles.color,
  '--glass-box-shadow': interfaceStore.globalGlassMenuStyles.boxShadow,
}))

const saveEsri = (): void => {
  esriSaveBtn?.click()
  downloadMenuOpen.value = false
}
const saveOSM = (): void => {
  osmSaveBtn?.click()
  downloadMenuOpen.value = false
}
const saveSeamarks = (): void => {
  seamarksSaveBtn?.click()
  downloadMenuOpen.value = false
}

let pinchTimeout: number | undefined

const onTouchStart = (e: TouchEvent): void => {
  if (e.touches.length > 1) {
    isPinching.value = true
    if (contextMenuVisible.value) hideContextMenuAndMarker()
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

const getMarkerSizeFromZoom = (zoomLevel: number): MarkerSizes => {
  if (zoomLevel <= 17) return 'xs'
  if (zoomLevel > 17 && zoomLevel <= 19) return 'sm'
  return 'md'
}

const getIconDimensionsFromMarkerSize = (size: MarkerSizes): IconDimensions => {
  if (size === 'xs') {
    return { iconSize: [6, 6], iconAnchor: [3, 3] }
  }
  if (size === 'sm') {
    return { iconSize: [12, 12], iconAnchor: [6, 6] }
  }
  return { iconSize: [26, 26], iconAnchor: [13, 13] } // md size
}

const createWaypointMarkerHtml = (isReached: boolean): string => {
  const baseClass = isReached ? 'marker-icon marker-icon--reached' : 'marker-icon'
  const size = getMarkerSizeFromZoom(zoom.value)
  const markerSizeClass = `wp-marker-${size}`

  return `
    <div class="${markerSizeClass}">
      <div class="${baseClass} waypoint-main-marker"></div>
    </div>
  `
}

const createWaypointMarkerIcon = (seq: number, isReached: boolean): L.DivIcon => {
  const markerSize = getMarkerSizeFromZoom(zoom.value)
  const dimensions = getIconDimensionsFromMarkerSize(markerSize)

  return L.divIcon({
    html: createWaypointMarkerHtml(isReached),
    className: 'waypoint-marker-icon',
    iconSize: dimensions.iconSize,
    iconAnchor: dimensions.iconAnchor,
  })
}

const applyWaypointMarkerStyle = (seq: number): void => {
  const marker = reachedWaypoints.value[seq]
  if (!marker) return
  const isReached = getReachedWaypointIndices.value.has(seq)
  const markerSize = getMarkerSizeFromZoom(zoom.value)
  const dimensions = getIconDimensionsFromMarkerSize(markerSize)

  marker.setIcon(
    L.divIcon({
      html: createWaypointMarkerHtml(isReached),
      className: 'waypoint-marker-icon',
      iconSize: dimensions.iconSize,
      iconAnchor: dimensions.iconAnchor,
    })
  )

  // Updates the tooltip class for reached waypoints and visibility based on size
  const tooltip = marker.getTooltip()
  if (tooltip) {
    if (markerSize === 'xs' || markerSize === 'sm') {
      tooltip.setOpacity(0)
    } else {
      tooltip.setOpacity(1)
    }

    const tooltipElement = tooltip.getElement()
    if (tooltipElement) {
      if (isReached) {
        tooltipElement.classList.add('waypoint-tooltip--reached')
      } else {
        tooltipElement.classList.remove('waypoint-tooltip--reached')
      }
    }
  }
}

const refreshReachedWaypointMarkerStyles = (): void => {
  Object.keys(reachedWaypoints.value).forEach((k) => applyWaypointMarkerStyle(Number(k)))
}

const poiManagerMapWidgetRef = ref<typeof PoiManager | null>(null)
const mapWidgetPoiMarkers = shallowRef<{ [id: string]: L.Marker }>({})

// Register the usage of the coordinate variables for logging
datalogger.registerUsage(DatalogVariable.latitude)
datalogger.registerUsage(DatalogVariable.longitude)

// Before mounting:
// - set initial widget options if they don't exist
// - enable auto update for target follower
onBeforeMount(() => {
  if (Object.keys(widget.value.options).length === 0) {
    widget.value.options = {
      showVehiclePath: true,
      showCoordinateGrid: false,
      showPoiArrows: true,
      showHomeArrow: true,
      showVehicleArrow: true,
    }
  }
  // Ensure new options exist for existing widgets
  if (widget.value.options.showCoordinateGrid === undefined) {
    widget.value.options.showCoordinateGrid = false
  }
  if (widget.value.options.showPoiArrows === undefined) {
    widget.value.options.showPoiArrows = true
  }
  if (widget.value.options.showHomeArrow === undefined) {
    widget.value.options.showHomeArrow = true
  }
  if (widget.value.options.showVehicleArrow === undefined) {
    widget.value.options.showVehicleArrow = true
  }
  targetFollower.enableAutoUpdate()
})

// Configure the available map tile providers
const osm = tileLayerOffline('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 23,
  maxNativeZoom: 19,
  attribution: '© OpenStreetMap',
})

const esri = tileLayerOffline(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  {
    maxZoom: 23,
    maxNativeZoom: 19,
    attribution: '© Esri World Imagery',
  }
)

// Overlays
const seamarks = tileLayerOffline('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '© OpenSeaMap contributors',
})

const marineProfile = L.tileLayer.wms('https://geoserver.openseamap.org/geoserver/gwc/service/wms', {
  layers: 'gebco2021:gebco_2021',
  format: 'image/png',
  transparent: true,
  version: '1.1.1',
  attribution: '© GEBCO, OpenSeaMap',
  tileSize: 256,
  maxZoom: 19,
})

const baseMaps = {
  'OpenStreetMap': osm,
  'Esri World Imagery': esri,
}

const overlays = {
  'Seamarks': seamarks,
  'Marine Profile': marineProfile,
}

// Show buttons when the mouse is over the widget
const mapBase = ref<HTMLElement>()
const isMouseOver = useElementHover(mapBase)

const zoomControl = L.control.zoom({ position: 'bottomright' })
const layerControl = L.control.layers(baseMaps, overlays)
const gridLayer = shallowRef<L.LayerGroup | undefined>(undefined)

watch(showButtons, () => {
  if (map.value === undefined) return
  if (showButtons.value) {
    map.value.addControl(zoomControl)
    map.value.addControl(layerControl)
    createScaleControl()
  } else {
    map.value.removeControl(zoomControl)
    map.value.removeControl(layerControl)
    removeScaleControl()
  }
})

watch(isMouseOver, () => {
  showButtons.value = isMouseOver.value
})

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

// Watch for zoom/move changes to update grid and scale
watch([zoom, mapCenter], () => {
  if (widget.value.options.showCoordinateGrid && map.value) {
    createGridOverlayLocal()
  }
  if (showButtons.value && map.value) {
    createScaleControl()
  }
})

// Watch for reached mission item sequences to update marker styles
watch(
  () => vehicleStore.reachedMissionItemSequences,
  () => {
    refreshReachedWaypointMarkerStyles()
  },
  { deep: true }
)

// Grid overlay functions using centralized utilities
const createGridOverlayLocal = (): void => {
  if (!map.value) return

  try {
    gridLayer.value = createGridOverlay(map.value, gridLayer.value as L.LayerGroup)
  } catch (error) {
    console.error('Failed to create grid overlay:', error)
  }
}

const removeGridOverlayLocal = (): void => {
  if (gridLayer.value && map.value) {
    map.value.removeLayer(gridLayer.value as L.LayerGroup)
    gridLayer.value = undefined
  }
}

// Standard Leaflet scale control
const scaleControl = L.control.scale({
  position: 'bottomright',
  metric: true,
  imperial: false,
  maxWidth: 100,
})

const createScaleControl = (): void => {
  if (!map.value) return

  // Remove existing scale control
  removeScaleControl()

  // Add standard Leaflet scale control
  scaleControl.addTo(map.value)
}

const removeScaleControl = (): void => {
  if (map.value) {
    try {
      map.value.removeControl(scaleControl)
    } catch (e) {
      // Control might not be added yet, ignore error
    }
  }
}

onMounted(async () => {
  reachedWaypoints.value = {}
  missionItemsInVehicle.value = []
  missionSeqToMarkerSeq.value = {}
  vehicleStore.clearReachedMissionItems()

  mapBase.value?.addEventListener('touchstart', onTouchStart, { passive: true })
  mapBase.value?.addEventListener('touchend', onTouchEnd, { passive: true })
  const initialBaseLayer = baseMaps[missionStore.userLastMapTileProvider] || esri

  // Bind leaflet instance to map element
  map.value = L.map(mapId.value, {
    layers: [initialBaseLayer, seamarks, marineProfile],
    attributionControl: false,
  }).setView(mapCenter.value as LatLngTuple, zoom.value) as Map

  // Listen for base layer changes to save user preference
  map.value.on('baselayerchange', (event: LayersControlEvent) => {
    const name = event.name
    if (!name.includes(name as MapTileProvider)) {
      return
    }
    missionStore.userLastMapTileProvider = event.name as MapTileProvider
  })

  // Remove default zoom control
  map.value.removeControl(map.value.zoomControl)

  map.value.on('click', (event: LeafletMouseEvent) => {
    clickedLocation.value = [event.latlng.lat, event.latlng.lng]
  })

  // Update center value after panning
  map.value.on('moveend', () => {
    if (map.value === undefined) return
    let { lat, lng } = map.value.getCenter()
    if (lat && lng) {
      mapCenter.value = [lat, lng]
    }
  })

  // Builds map layers offline content controls
  const saveCtlEsri = downloadOfflineMapTiles(esri, 'Esri', 19)
  const saveCtlOSM = downloadOfflineMapTiles(osm, 'OSM', 19)
  const saveCtlSeamarks = downloadOfflineMapTiles(seamarks, 'Seamarks', 18)

  if (map.value) {
    saveCtlEsri.addTo(map.value)
    saveCtlOSM.addTo(map.value)
    saveCtlSeamarks.addTo(map.value)
  }

  // Hide native UI for offline map download controls
  const hideCtl = (ctl: any): void => {
    const el = (ctl.getContainer?.() ?? ctl._container) as HTMLElement | undefined
    if (!el) return
    el.classList.add('hidden-savetiles')
    el.style.display = 'none'
  }

  hideCtl(saveCtlEsri)
  hideCtl(saveCtlOSM)
  hideCtl(saveCtlSeamarks)

  await nextTick()

  const getBtns = (ctl: any): HTMLAnchorElement[] => {
    const container = (ctl.getContainer?.() ?? ctl._container) as HTMLElement | undefined
    return Array.from(container?.querySelectorAll('a') ?? []) as HTMLAnchorElement[]
  }

  const [esriSave] = getBtns(saveCtlEsri)
  const [osmSave] = getBtns(saveCtlOSM)
  const [seaSave] = getBtns(saveCtlSeamarks)

  esriSaveBtn = esriSave
  osmSaveBtn = osmSave
  seamarksSaveBtn = seaSave

  attachOfflineProgress(esri, 'Esri')
  attachOfflineProgress(osm, 'OSM')
  attachOfflineProgress(seamarks, 'Seamarks')

  map.value.on('dragstart', () => {
    isDragging.value = true
  })

  map.value.on('dragend', () => {
    setTimeout(() => (isDragging.value = false), 200)
  })

  map.value.on('move', () => {
    if (mapReady.value && map.value && map.value instanceof L.Map) {
      throttledUpdateArrows()
      throttledUpdateVehicleAndHomeArrows()
    }
  })

  // Update zoom value after zooming
  map.value.on('zoomend', () => {
    contextMenuVisible.value = false
    if (map.value === undefined) return
    zoom.value = map.value?.getZoom() ?? mapCenter.value
  })

  // Refreshes the marker positions when the map is ready
  map.value.whenReady(() => {
    nextTick(() => {
      Object.entries(reachedWaypoints.value).forEach(([seq, marker]) => {
        const isReached = getReachedWaypointIndices.value.has(Number(seq))
        marker.setIcon(createWaypointMarkerIcon(Number(seq), isReached))
      })
    })
  })

  map.value.on('contextmenu', (event: LeafletMouseEvent) => {
    clickedLocation.value = [event.latlng.lat, event.latlng.lng]
  })
  // Enable auto update for target follower
  targetFollower.enableAutoUpdate()

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
  await refreshMission()
})

const confirmDownloadDialog =
  (layerLabel: string) =>
  (status: SaveStatus, ok: () => void): void => {
    showDialog({
      variant: 'info',
      message: `Save ${status._tilesforSave.length} ${layerLabel} tiles for offline use?`,
      persistent: false,
      maxWidth: '450px',
      actions: [
        { text: 'Cancel', color: 'white', action: closeDialog },
        {
          text: 'Save tiles',
          color: 'white',
          action: () => {
            ok()
            closeDialog()
          },
        },
      ] as DialogActions[],
    })
  }

const deleteDownloadedTilesDialog =
  (layerLabel: string) =>
  (_status: SaveStatus, ok: () => void): void => {
    showDialog({
      variant: 'warning',
      message: `Remove all saved ${layerLabel} tiles for this layer?`,
      persistent: false,
      maxWidth: '450px',
      actions: [
        { text: 'Cancel', color: 'white', action: closeDialog },
        {
          text: 'Remove tiles',
          color: 'white',
          action: () => {
            ok()
            closeDialog()
            openSnackbar({ message: `${layerLabel} offline tiles removed`, variant: 'info', duration: 3000 })
          },
        },
      ] as DialogActions[],
    })
  }

const downloadOfflineMapTiles = (layer: any, layerLabel: string, maxZoom: number): L.Control => {
  return savetiles(layer, {
    saveWhatYouSee: true,
    maxZoom,
    alwaysDownload: false,
    position: 'topright',
    parallel: 20,
    confirm: confirmDownloadDialog(layerLabel),
    confirmRemoval: deleteDownloadedTilesDialog(layerLabel),
    saveText: `<i class="mdi mdi-download" title="Save ${layerLabel} tiles"></i>`,
    rmText: `<i class="mdi mdi-trash-can" title="Remove ${layerLabel} tiles"></i>`,
  })
}

const attachOfflineProgress = (layer: any, layerName: string): void => {
  layer.on('savestart', (e: any) => {
    tilesSaved.value = 0
    tilesTotal.value = e?._tilesforSave?.length ?? 0
    savingLayerName.value = layerName
    isSavingOfflineTiles.value = true
    openSnackbar({ message: `Saving ${tilesTotal.value} ${layerName} tiles...`, variant: 'info', duration: 2000 })
  })

  layer.on('loadtileend', () => {
    tilesSaved.value += 1
    if (tilesTotal.value > 0 && tilesSaved.value >= tilesTotal.value) {
      openSnackbar({ message: `${layerName} offline tiles saved!`, variant: 'success', duration: 3000 })
      isSavingOfflineTiles.value = false
      savingLayerName.value = ''
      tilesSaved.value = 0
      tilesTotal.value = 0
    }
  })
}

const handleContextMenu = {
  open: (event: MouseEvent): void => {
    if (!map.value || isPinching.value || isDragging.value) return
    event.preventDefault()
    event.stopPropagation()

    const pt = map.value.mouseEventToContainerPoint(event)
    const ll = map.value.containerPointToLatLng(pt)
    clickedLocation.value = [ll.lat, ll.lng]

    contextMenuRef.value.openAt(event)
    contextMenuVisible.value = true
  },
  close: () => {
    hideContextMenuAndMarker()
  },
}

const clearMapDrawing = (): void => {
  const poiMarkers = new Set(Object.values(mapWidgetPoiMarkers.value))

  map.value?.eachLayer((l) => {
    if (l instanceof L.Marker || (l instanceof L.Polyline && l.options.color === '#358AC3')) {
      if (poiMarkers.has(l as L.Marker)) return
      map.value!.removeLayer(l)
    }
  })

  mapWaypoints.value = []

  missionWaypointsPolyline.value = undefined
  homeMarker.value = undefined
  gotoMarker.value = undefined
  vehicleMarker.value = undefined
  reachedWaypoints.value = {}
  missionItemsInVehicle.value = []
  missionSeqToMarkerSeq.value = {}
}

const refreshMission = async (): Promise<void> => {
  if (!mapReady.value) return
  clearMapDrawing()

  if (vehicleStore.isVehicleOnline) {
    await downloadMissionFromVehicle()
  } else if (missionStore.vehicleMission.length) {
    rebuildMissionSeqMapping(missionStore.vehicleMission)
    drawMission(missionStore.vehicleMission)
  }
}

watch(
  () => vehicleStore.isVehicleOnline,
  () => {
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
  targetFollower.disableAutoUpdate()
  window.removeEventListener('keydown', onKeydown)

  if (map.value) {
    map.value.off('contextmenu')
    // Clean up POI markers
    Object.values(mapWidgetPoiMarkers.value).forEach((marker) => marker.remove())
    mapWidgetPoiMarkers.value = {}
  }

  mapBase.value?.removeEventListener('touchstart', onTouchStart)
  mapBase.value?.removeEventListener('touchend', onTouchEnd)
})

// Pan when variables change
watch(mapCenter, (newCenter, oldCenter) => {
  if (newCenter.toString() === oldCenter.toString()) return
  map.value?.panTo(newCenter as LatLngTuple)
})

// Keep map binded
watch(map, (newMap, oldMap) => {
  if (map.value === undefined) return
  if (newMap?.options !== undefined) return

  map.value = oldMap
})

// Zoom when the variable changes
watch(zoom, (newZoom, oldZoom) => {
  if (newZoom === oldZoom) return
  contextMenuVisible.value = false
  map.value?.setZoom(zoom.value)
})

// Watch for zoom level changes to update waypoint marker sizes
watch(zoom, () => {
  if (map.value) {
    refreshReachedWaypointMarkerStyles()
  }
})

// Re-render the map when the widget changes
watch(props.widget, () => {
  map.value?.invalidateSize()
})

// Allow following a given target
const followerTarget = ref<WhoToFollow | undefined>(undefined)
const targetFollower = new TargetFollower(
  (newTarget: WhoToFollow | undefined) => (followerTarget.value = newTarget),
  (newCenter: WaypointCoordinates) => (mapCenter.value = newCenter)
)
targetFollower.setTrackableTarget(WhoToFollow.VEHICLE, () => vehiclePosition.value)
targetFollower.setTrackableTarget(WhoToFollow.HOME, () => home.value)

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

// Save vehicle position history
const { history: vehiclePositionHistory } = useRefHistory(vehiclePosition)

// Update home position when location is available
// Try to update home position based on browser geolocation
navigator?.geolocation?.watchPosition(
  (position) => {
    if (!home.value) {
      home.value = [position.coords.latitude, position.coords.longitude]
    }
  },
  (error) => console.error(`Failed to get position: (${error.code}) ${error.message}`),
  { enableHighAccuracy: false, timeout: 5000, maximumAge: 0 }
)

// If home position is updated and map was not yet centered on it, center
let mapNotYetCenteredInHome = true
watch([home, map], async () => {
  if (home.value === mapCenter.value || !map.value || !mapNotYetCenteredInHome) return
  targetFollower.goToTarget(WhoToFollow.HOME)
  mapNotYetCenteredInHome = false
})

// Create marker for the vehicle
const vehicleMarker = shallowRef<L.Marker>()
watch(vehicleStore.coordinates, () => {
  if (!map.value || !vehiclePosition.value) return

  if (vehicleMarker.value === undefined) {
    let vehicleIconUrl = genericVehicleMarkerImage

    if (vehicleStore.vehicleType === MavType.MAV_TYPE_SURFACE_BOAT) {
      vehicleIconUrl = blueboatMarkerImage
    } else if (vehicleStore.vehicleType === MavType.MAV_TYPE_SUBMARINE) {
      vehicleIconUrl = brov2MarkerImage
    } else if (
      [
        MavType.MAV_TYPE_QUADROTOR,
        MavType.MAV_TYPE_HEXAROTOR,
        MavType.MAV_TYPE_OCTOROTOR,
        MavType.MAV_TYPE_TRICOPTER,
        MavType.MAV_TYPE_DODECAROTOR,
      ].includes(vehicleStore.vehicleType)
    ) {
      vehicleIconUrl = copterMarkerImage
    }

    const vehicleMarkerIcon = L.divIcon({
      className: 'vehicle-marker',
      html: `<img src="${vehicleIconUrl}" style="width: 64px; height: 64px;">`,
      iconSize: [64, 64],
      iconAnchor: [32, 32],
    })

    vehicleMarker.value = L.marker(vehiclePosition.value, { icon: vehicleMarkerIcon })

    const vehicleMarkerTooltip = L.tooltip({
      content: 'No data available',
      className: 'waypoint-tooltip',
      offset: [40, 0],
    })
    vehicleMarker.value.bindTooltip(vehicleMarkerTooltip)
    map.value.addLayer(vehicleMarker.value)
  }
  vehicleMarker.value.setLatLng(vehiclePosition.value)
})

// If vehicle position was not available and now it is, start following it
watch(vehiclePosition, (_, oldPosition) => {
  if (followerTarget.value === WhoToFollow.VEHICLE || oldPosition !== undefined) return
  targetFollower.follow(WhoToFollow.VEHICLE)
})

// Dinamically update data of the vehicle tooltip
watch([vehiclePosition, vehicleHeading, timeAgoSeenText, () => vehicleStore.isArmed], () => {
  if (vehicleMarker.value === undefined) return

  vehicleMarker.value.getTooltip()?.setContent(`
    <p>Coordinates: ${vehiclePosition.value?.[0].toFixed(6)}, ${vehiclePosition.value?.[1].toFixed(6)}</p>
    <p>Velocity: ${vehicleStore.velocity.ground?.toFixed(2) ?? 'N/A'} m/s</p>
    <p>Heading: ${vehicleHeading.value.toFixed(2)}°</p>
    <p>${vehicleStore.isArmed ? 'Armed' : 'Disarmed'}</p>
    <p>Last seen: ${timeAgoSeenText.value}</p>
  `)

  // Update the rotation
  const iconElement = vehicleMarker.value.getElement()?.querySelector('img')
  if (iconElement) {
    iconElement.style.transform = `rotate(${vehicleHeading.value}deg)`
  }
})

// Create marker for the home position
const homeMarker = shallowRef<L.Marker>()
watch(home, () => {
  if (map.value === undefined) return

  const position = home.value
  if (position === undefined) return

  if (!homeMarker.value) {
    homeMarker.value = L.marker(position as LatLngTuple, {
      icon: L.divIcon({ className: 'marker-icon', iconSize: [24, 24], iconAnchor: [12, 12] }),
      draggable: true,
    })
    const homeMarkerTooltip = L.tooltip({
      content: '<i class="mdi mdi-home-map-marker text-[18px] "></i>',
      permanent: true,
      direction: 'center',
      className: 'waypoint-tooltip',
      opacity: 1,
    })
    homeMarker.value.bindTooltip(homeMarkerTooltip)
    homeMarker.value.on('dragend', (e: L.DragEndEvent) => {
      const marker = e.target as L.Marker
      const latlng = marker.getLatLng()
      setHomePosition([latlng.lat, latlng.lng])
    })
    map.value.addLayer(homeMarker.value)
  } else {
    homeMarker.value.setLatLng(position as LatLngTuple)
  }
})

// Create polyline for the vehicle path
const missionWaypointsPolyline = shallowRef<L.Polyline>()
watch(
  mapWaypoints,
  (newWaypoints) => {
    if (!map.value) return

    if (!missionWaypointsPolyline.value) {
      missionWaypointsPolyline.value = L.polyline([], { color: '#358AC3' }).addTo(map.value)
    }
    missionWaypointsPolyline.value.setLatLngs(newWaypoints.map((w) => w.coordinates))

    // Add a marker for each point
    newWaypoints.forEach((waypoint, idx) => {
      const seq = idx + 1
      let marker = reachedWaypoints.value[seq]
      if (!marker) {
        const isReached = getReachedWaypointIndices.value.has(seq)
        const markerIcon = createWaypointMarkerIcon(seq, isReached)
        marker = L.marker(waypoint.coordinates, { icon: markerIcon })
        reachedWaypoints.value[seq] = marker

        const markerSizeForTooltip = getMarkerSizeFromZoom(zoom.value)
        const markerTooltip = L.tooltip({
          content: seq.toString(),
          permanent: true,
          direction: 'center',
          className: isReached ? 'waypoint-tooltip waypoint-tooltip--reached' : 'waypoint-tooltip',
          opacity: markerSizeForTooltip === 'md' ? 1 : 0,
        })

        marker.bindTooltip(markerTooltip)
        map.value?.addLayer(marker)
      } else {
        marker.setLatLng(waypoint.coordinates as LatLngTuple)
        const markerSizeForUpdate = getMarkerSizeFromZoom(zoom.value)
        const tooltip = marker.getTooltip()
        if (tooltip) {
          if (markerSizeForUpdate === 'xs' || markerSizeForUpdate === 'sm') {
            tooltip.setOpacity(0)
          } else {
            tooltip.setContent(seq.toString())
            tooltip.setOpacity(1)
          }
        }
        applyWaypointMarkerStyle(seq)
      }
    })
  },
  { deep: true }
)

// Create polyline for the vehicle path
const vehicleHistoryPolyline = shallowRef<L.Polyline>()
watch(vehiclePositionHistory, (newPoints) => {
  if (map.value === undefined || newPoints === undefined) return

  if (vehicleHistoryPolyline.value === undefined) {
    vehicleHistoryPolyline.value = L.polyline([], { color: '#ffff00' }).addTo(map.value)
  }

  const latLongHistory = newPoints.filter((posHis) => posHis.snapshot !== undefined).map((posHis) => posHis.snapshot)
  vehicleHistoryPolyline.value.setLatLngs(latLongHistory as L.LatLngExpression[])
})

// Handle context menu toggling and selection
const contextMenuVisible = ref(false)
const clickedLocation = ref<[number, number] | null>(null)
const contextMenuMarker = shallowRef<L.Marker>()

// Global origin dialog state
const showGlobalOriginDialog = ref(false)
const globalOriginLatitude = ref(0)
const globalOriginLongitude = ref(0)
const globalOriginMarker = shallowRef<L.Marker>()

const menuItems = reactive([
  {
    item: 'Set home waypoint',
    action: () => onMenuOptionSelect('set-home-waypoint'),
    icon: 'mdi-home-map-marker',
  },
  {
    item: 'Set Global Origin',
    action: () => onMenuOptionSelect('set-global-origin'),
    icon: 'mdi-crosshairs-question',
  },
  {
    item: 'Place Point of Interest',
    action: () => onMenuOptionSelect('place-poi'),
    icon: 'mdi-map-marker-plus',
  },
  { item: 'GoTo', action: () => onMenuOptionSelect('goto'), icon: 'mdi-crosshairs-gps' },
  {
    item: 'Set default map position',
    action: () => onMenuOptionSelect('set-default-map-position'),
    icon: 'mdi-map-check',
  },
])

const gotoMarker = shallowRef<L.Marker>()

const setDefaultMapPosition = async (): Promise<void> => {
  if (!map.value || !clickedLocation.value) return

  try {
    await missionStore.setDefaultMapPosition(clickedLocation.value, zoom.value)
    openSnackbar({ message: 'Default map position set', variant: 'success' })

    const tempMarker = L.marker(clickedLocation.value as LatLngTuple, {
      icon: L.divIcon({
        className: 'marker-icon',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    }).addTo(map.value)

    const tempTooltip = L.tooltip({
      content: '<i class="mdi mdi-map-check text-[18px] border-[1px] rounded-full px-[2px] py-[1px]"></i>',
      permanent: true,
      direction: 'center',
      className: 'waypoint-tooltip',
      opacity: 1,
    })
    tempMarker.bindTooltip(tempTooltip).openTooltip()

    const markerEl = tempMarker.getElement() as HTMLElement | null
    const tooltipEl = tempMarker.getTooltip()?.getElement() as HTMLElement | null

    ;[markerEl, tooltipEl].forEach((el) => {
      if (el) {
        el.style.transition = 'opacity 1s'
        el.style.opacity = '1'
      }
    })

    setTimeout(() => {
      ;[markerEl, tooltipEl].forEach((el) => {
        if (el) el.style.opacity = '0'
      })
      setTimeout(() => {
        map.value?.removeLayer(tempMarker)
      }, 1000)
    }, 1500)
  } catch (error) {
    console.error(error)
    openSnackbar({ message: 'Failed to set default map position', variant: 'error' })
  }
}

const executeGoToOption = async (): Promise<void> => {
  if (!clickedLocation.value || !map.value) return

  if (gotoMarker.value) {
    map.value.removeLayer(gotoMarker.value)
    gotoMarker.value = undefined
  }

  gotoMarker.value = L.marker(clickedLocation.value as LatLngTuple, {
    icon: L.divIcon({
      className: 'marker-icon',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    }),
  }).addTo(map.value)

  const gotoTooltip = L.tooltip({
    content: '<i class="mdi mdi-crosshairs-gps border-[1px] rounded-full text-[18px] px-[2px] pt-[1px] "></i>',
    permanent: true,
    direction: 'center',
    className: 'waypoint-tooltip',
    opacity: 1,
  })
  gotoMarker.value.bindTooltip(gotoTooltip)

  if (clickedLocation.value) {
    // Define default values
    const hold = 0
    const acceptanceRadius = 0
    const passRadius = 0
    const yaw = 0
    const altitude = vehicleStore.coordinates.altitude ?? 0

    const latitude = clickedLocation.value[0]
    const longitude = clickedLocation.value[1]

    try {
      await vehicleStore.goTo(hold, acceptanceRadius, passRadius, yaw, latitude, longitude, altitude)
    } catch (error) {
      openSnackbar({ message: `GoTo request failed: ${(error as Error).message}`, variant: 'error' })
    }
  }
}

const onMenuOptionSelect = async (option: string): Promise<void> => {
  switch (option) {
    case 'goto': {
      executeGoToOption()
      break
    }

    case 'set-default-map-position':
      setDefaultMapPosition()
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

    default:
      console.warn('Unknown menu option selected:', option)
  }

  contextMenuVisible.value = false
}

const hideContextMenuAndMarker = (): void => {
  contextMenuVisible.value = false
  if (map.value !== undefined && contextMenuMarker.value !== undefined) {
    map.value.removeLayer(contextMenuMarker.value)
  }
}

const onGlobalOriginSet = (latitude: number, longitude: number): void => {
  if (!map.value) return

  // Remove existing marker if present
  if (globalOriginMarker.value) {
    map.value.removeLayer(globalOriginMarker.value)
  }

  // Create a new marker with the axis-arrow icon
  const icon = L.divIcon({ className: 'marker-icon', iconSize: [24, 24], iconAnchor: [12, 12] })
  const marker = L.marker([latitude, longitude] as LatLngTuple, { icon }).addTo(map.value)

  const globalOriginTooltip = L.tooltip({
    content: '<i class="mdi mdi-axis-arrow text-[18px]"></i>',
    permanent: true,
    direction: 'center',
    className: 'waypoint-tooltip',
    opacity: 1,
  })

  marker.bindTooltip(globalOriginTooltip)
  globalOriginMarker.value = marker
}

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    hideContextMenuAndMarker()
  }
}

const drawMission = (missionItems: Waypoint[]): void => {
  missionItems.forEach((wp, idx) => {
    if (idx === 0) {
      home.value = wp.coordinates
      setHomePosition(wp.coordinates)
    } else {
      mapWaypoints.value.push(wp)
    }
  })
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
    drawMission(missionItemsInVehicle.value as Waypoint[])

    openSnackbar({ variant: 'success', message: 'Mission download succeeded!', duration: 3000 })
  } catch (error) {
    showDialog({ variant: 'error', title: 'Mission download failed', message: error as string, timer: 5000 })
  } finally {
    fetchingMission.value = false
  }
}

const setHomePosition = async (homePosition: [number, number]): Promise<void> => {
  const newHome: [number, number] = [homePosition[0], homePosition[1]]
  home.value = newHome

  await vehicleStore.setHomeWaypoint(newHome, 0)
  if (contextMenuVisible.value) {
    contextMenuVisible.value = false
  }
}

// Allow executing missions
const executeMissionOnVehicle = async (): Promise<void> => {
  try {
    await vehicleStore.startMission()
  } catch (error) {
    openSnackbar({ message: 'Failed to start mission.', variant: 'error' })
  }
  return
}

const tryToStartMission = async (): Promise<void> => {
  if (missionStore.showChecklistBeforeArm) {
    isMissionChecklistOpen.value = true
    return
  }
  executeMissionOnVehicle()
}

// Set dynamic styles for correct displacement of the bottom buttons when the widget is below the bottom bar
const widgetStore = useWidgetManagerStore()
const bottomButtonsDisplacement = computed(() => {
  return `${Math.max(-widgetStore.widgetClearanceForVisibleArea(widget.value).bottom, 0)}px`
})

const topProgressBarDisplacement = computed(() => {
  return `${Math.max(-widgetStore.widgetClearanceForVisibleArea(widget.value).top, 0)}px`
})

const vehicleDownloadMissionButtonTooltipText = computed(() => {
  return vehicleStore.isVehicleOnline
    ? 'Download the mission that is stored in the vehicle.'
    : 'Cannot download mission (vehicle offline).'
})

const vehicleExecuteMissionButtonTooltipText = computed(() => {
  return vehicleStore.isVehicleOnline
    ? 'Execute the mission that is stored in the vehicle.'
    : 'Cannot execute mission (vehicle offline).'
})

const centerHomeButtonTooltipText = computed(() => {
  if (home.value === undefined) {
    return 'Cannot center map on home (home position undefined).'
  }
  if (followerTarget.value === WhoToFollow.HOME) {
    return 'Tracking home position. Click to stop tracking.'
  }
  return 'Click once to center on home or twice to track it.'
})

const centerVehicleButtonTooltipText = computed(() => {
  if (!vehicleStore.isVehicleOnline) {
    return 'Cannot center map on vehicle (vehicle offline).'
  }
  if (vehiclePosition.value === undefined) {
    return 'Cannot center map on vehicle (vehicle position undefined).'
  }
  if (followerTarget.value === WhoToFollow.VEHICLE) {
    return 'Tracking vehicle position. Click to stop tracking.'
  }
  return 'Click once to center on vehicle or twice to track it.'
})

// POI Marker Management Functions for Map Widget
const poiIconConfig = (poi: PointOfInterest): L.DivIconOptions => {
  const poiIconHtml = `
    <div class="poi-marker-container">
      <div class="poi-marker-background" style="background-color: ${poi.color}80;"></div>
      <i class="v-icon notranslate mdi ${poi.icon}" style="color: rgba(255, 255, 255, 0.7); position: relative; z-index: 2;"></i>
    </div>
  `

  return {
    html: poiIconHtml,
    className: 'poi-marker-icon-widget',
    iconSize: [32, 32], // Match the actual container size
    iconAnchor: [16, 32], // Center horizontally, bottom vertically (like a pin)
  }
}

const addPoiMarkerToMapWidget = (poi: PointOfInterest): void => {
  if (!map.value || !map.value.getContainer()) return

  const poiMarkerIcon = L.divIcon(poiIconConfig(poi))

  const marker = L.marker(poi.coordinates as LatLngTuple, { icon: poiMarkerIcon, draggable: true }).addTo(map.value)

  const tooltipContent = `
    <strong>${poi.name}</strong><br>
    ${poi.description ? poi.description + '<br>' : ''}
    Lat: ${poi.coordinates[0].toFixed(8)}, Lng: ${poi.coordinates[1].toFixed(8)}
  `
  const tooltipConfig = {
    permanent: false,
    direction: 'top' as const,
    offset: [0, -40] as [number, number],
    className: 'poi-tooltip-widget',
  }
  marker.bindTooltip(tooltipContent, tooltipConfig)

  marker.on('drag', (event) => {
    const newCoords = event.target.getLatLng()
    const updatedTooltipContent = `
      <strong>${poi.name}</strong><br>
      ${poi.description ? poi.description + '<br>' : ''}
      Lat: ${newCoords.lat.toFixed(8)}, Lng: ${newCoords.lng.toFixed(8)}
    `
    marker.getTooltip()?.setContent(updatedTooltipContent)
  })

  marker.on('dragend', (event) => {
    const newCoords = event.target.getLatLng()
    missionStore.movePointOfInterest(poi.id, [newCoords.lat, newCoords.lng])
  })

  marker.on('click', (event) => {
    L.DomEvent.stopPropagation(event)
    if (poiManagerMapWidgetRef.value) {
      // Get fresh POI data from store instead of using potentially stale poi object
      const freshPoi = missionStore.pointsOfInterest.find((p) => p.id === poi.id)
      if (freshPoi) {
        poiManagerMapWidgetRef.value.openDialog(undefined, freshPoi)
      } else {
        console.warn('POI not found in store:', poi.id)
      }
    }
  })

  mapWidgetPoiMarkers.value[poi.id] = marker
}

const updatePoiMarkerOnMapWidget = (poi: PointOfInterest): void => {
  if (!map.value || !map.value.getContainer() || !mapWidgetPoiMarkers.value[poi.id]) return

  const marker = mapWidgetPoiMarkers.value[poi.id]
  marker.setLatLng(poi.coordinates as LatLngTuple)

  marker.setIcon(L.divIcon(poiIconConfig(poi)))

  const updatedTooltipContent = `
    <strong>${poi.name}</strong><br>
    ${poi.description ? poi.description + '<br>' : ''}
    Lat: ${poi.coordinates[0].toFixed(8)}, Lng: ${poi.coordinates[1].toFixed(8)}
  `
  marker.getTooltip()?.setContent(updatedTooltipContent)
}

const removePoiMarkerFromMapWidget = (poiId: string): void => {
  if (!map.value || !mapWidgetPoiMarkers.value[poiId]) return

  mapWidgetPoiMarkers.value[poiId].remove()
  delete mapWidgetPoiMarkers.value[poiId]
}

// Watch for changes in POIs from the store and update markers on this map widget
watch(
  () => missionStore.pointsOfInterest,
  async (newPois) => {
    if (!map.value || !map.value.getContainer()) {
      await nextTick() // Wait for map to potentially become available
      if (!map.value || !map.value.getContainer()) {
        console.warn('Map.vue: POI watcher - map not ready after nextTick.')
        return
      }
    }

    const newPoiIds = new Set(newPois.map((p) => p.id))

    Object.keys(mapWidgetPoiMarkers.value).forEach((poiId) => {
      if (!newPoiIds.has(poiId)) {
        removePoiMarkerFromMapWidget(poiId)
      }
    })

    newPois.forEach((poi) => {
      if (mapWidgetPoiMarkers.value[poi.id]) {
        updatePoiMarkerOnMapWidget(poi)
      } else {
        addPoiMarkerToMapWidget(poi)
      }
    })
  },
  { deep: true, immediate: true }
)

// Ensure POIs are drawn when the map instance becomes available
watch(
  map,
  (currentMapInstance) => {
    if (currentMapInstance && currentMapInstance.getContainer()) {
      missionStore.pointsOfInterest.forEach((poi) => {
        if (!mapWidgetPoiMarkers.value[poi.id]) {
          addPoiMarkerToMapWidget(poi)
        } else {
          updatePoiMarkerOnMapWidget(poi) // Update if already exists, in case details changed
        }
      })
    }
  },
  { immediate: true }
)

const poiEdgeArrows = ref<PoiEdgeArrow[]>([])
const vehicleEdgeArrow = ref<TargetEdgeArrow | null>(null)
const homeEdgeArrow = ref<TargetEdgeArrow | null>(null)

// Calculate intersection with map edges
const calculateMapEdgesIntersections = (
  centerPoint: L.Point,
  distanceX: number,
  distanceY: number,
  width: number,
  height: number,
  topEdgeY: number,
  validYMin: number
): EdgeIntersection[] => {
  const intersections: EdgeIntersection[] = []
  // Top edge
  if (distanceY < 0) {
    const t = (topEdgeY - centerPoint.y) / distanceY
    if (t > 0) {
      const x = centerPoint.x + distanceX * t
      if (x >= -1 && x <= width + 1) {
        intersections.push({ t, edge: 'top', x, y: topEdgeY })
      }
    }
  }
  // Bottom edge
  if (distanceY > 0) {
    const t = (height - centerPoint.y) / distanceY
    if (t > 0) {
      const x = centerPoint.x + distanceX * t
      if (x >= -1 && x <= width + 1) {
        intersections.push({ t, edge: 'bottom', x, y: height })
      }
    }
  }
  // Left edge
  if (distanceX < 0) {
    const t = -centerPoint.x / distanceX
    if (t > 0) {
      const y = centerPoint.y + distanceY * t
      if (y >= validYMin - 1 && y <= height + 1) {
        intersections.push({ t, edge: 'left', x: 0, y })
      }
    }
  }
  // Right edge
  if (distanceX > 0) {
    const t = (width - centerPoint.x) / distanceX
    if (t > 0) {
      const y = centerPoint.y + distanceY * t
      if (y >= validYMin - 1 && y <= height + 1) {
        intersections.push({ t, edge: 'right', x: width, y })
      }
    }
  }
  return intersections
}

// Handle POI Arrow corner cases for smooth edge transitions
const handleMapEdgeCorners = (
  intersections: EdgeIntersection[],
  edgeX: number,
  edgeY: number,
  width: number,
  height: number,
  cornerThreshold: number
): EdgeIntersection | null => {
  const isNearBottomRight = edgeX > width - cornerThreshold && edgeY > height - cornerThreshold - 30
  const isNearBottomLeft = edgeX < cornerThreshold && edgeY > height - cornerThreshold - 30

  if (isNearBottomRight) {
    const right = intersections.find((i) => i.edge === 'right')
    const bottom = intersections.find((i) => i.edge === 'bottom')
    if (right && bottom && right.t <= bottom.t * 1.15) return right
  } else if (isNearBottomLeft) {
    const left = intersections.find((i) => i.edge === 'left')
    const bottom = intersections.find((i) => i.edge === 'bottom')
    if (left && bottom && left.t <= bottom.t * 1.15) return left
  }
  return null
}

// Generate CSS style for POI Arrow based on edge
const getPoiArrowStyle = (
  edge: Edge,
  x: number,
  y: number,
  topEdgeY: number,
  isFullscreen: boolean
): PoiEdgeArrow['style'] => {
  const bottomOffset = isFullscreen ? '22px' : '-25px'
  const styles: Record<Edge, PoiEdgeArrow['style']> = {
    top: { top: `${topEdgeY + 2}px`, left: `${x}px`, transform: 'translate(-50%, -25%)' },
    bottom: { bottom: bottomOffset, left: `${x}px`, transform: 'translate(-50%, -50%)' },
    left: { left: '5px', top: `${y}px`, transform: 'translate(-25%, -50%)' },
    right: { right: '5px', top: `${y}px`, transform: 'translate(25%, -50%)' },
  }
  return styles[edge]
}

// Calculate edge arrow for a generic target (vehicle, home waypoint, or a second vehicle).
const calculateTargetEdgeArrow = (
  targetPosition: WaypointCoordinates | undefined,
  targetName: string,
  targetColor: string
): TargetEdgeArrow | null => {
  if (!mapReady.value || !map.value || !(map.value instanceof L.Map) || !targetPosition) {
    return null
  }

  const container = map.value.getContainer()
  if (!container) {
    return null
  }

  let bounds: L.LatLngBounds
  let containerSize: L.Point
  let center: L.LatLng

  try {
    bounds = map.value.getBounds()
    containerSize = map.value.getSize()
    center = map.value.getCenter()
  } catch {
    return null
  }

  const targetLatLng = L.latLng(targetPosition[0], targetPosition[1])

  const width = containerSize.x
  const height = containerSize.y
  const isFullscreen = widgetStore.isFullScreen(widget.value)
  const topEdgeY = isFullscreen ? widgetStore.currentTopBarHeightPixels : 0
  const bottomEdgeY = isFullscreen ? height - widgetStore.currentBottomBarHeightPixels : height
  const validYMin = topEdgeY
  const validYMax = bottomEdgeY
  const cornerThreshold = 40

  let targetPoint: L.Point
  let centerPoint: L.Point

  try {
    targetPoint = map.value.latLngToContainerPoint(targetLatLng)
    centerPoint = map.value.latLngToContainerPoint(center)
  } catch {
    return null
  }

  // Check if target is visible on the map (within container bounds)
  if (
    targetPoint.x >= 0 &&
    targetPoint.x <= width &&
    targetPoint.y >= validYMin &&
    targetPoint.y <= validYMax &&
    bounds.contains(targetLatLng)
  ) {
    return null
  }

  const distanceMeters = calculateHaversineDistance([center.lat, center.lng], targetPosition)
  const distanceText =
    distanceMeters >= 1000 ? `${(distanceMeters / 1000).toFixed(2)} km` : `${distanceMeters.toFixed(0)} m`

  const distanceX = targetPoint.x - centerPoint.x
  const distanceY = targetPoint.y - centerPoint.y

  if (Math.abs(distanceX) < 0.001 && Math.abs(distanceY) < 0.001) return null

  const intersections = calculateMapEdgesIntersections(
    centerPoint,
    distanceX,
    distanceY,
    width,
    height,
    topEdgeY,
    validYMin
  )
  if (intersections.length === 0) return null

  const closest = intersections.reduce((min: EdgeIntersection, current: EdgeIntersection) =>
    current.t < min.t ? current : min
  )
  let selectedIntersection = closest

  // Handle corner cases
  const cornerIntersection = handleMapEdgeCorners(intersections, closest.x, closest.y, width, height, cornerThreshold)
  if (cornerIntersection) selectedIntersection = cornerIntersection

  // Clamp positions to contain the arrow within the map container
  let edgeX = Math.max(0, Math.min(width, selectedIntersection.x))
  let edgeY = selectedIntersection.y

  if (selectedIntersection.edge === 'bottom') {
    edgeY = Math.max(0, Math.min(height, edgeY))
  } else if (selectedIntersection.edge === 'left' || selectedIntersection.edge === 'right') {
    edgeY = Math.max(validYMin, Math.min(validYMax - 10, edgeY))
  } else {
    edgeY = Math.max(validYMin, Math.min(validYMax, edgeY))
  }

  const angle = ((Math.atan2(distanceY, distanceX) * 180) / Math.PI + 360) % 360

  return {
    style: getPoiArrowStyle(selectedIntersection.edge, edgeX, edgeY, topEdgeY, isFullscreen),
    angle,
    tooltipText: `${targetName} - ${distanceText}`,
    color: targetColor,
  }
}

// Calculate POI arrow angle and position to be placed on the edges of the map
const calculatePoiEdgeArrows = (): void => {
  if (!mapReady.value || !map.value || !(map.value instanceof L.Map)) {
    poiEdgeArrows.value = []
    return
  }

  const container = map.value.getContainer()
  if (!container) {
    poiEdgeArrows.value = []
    return
  }

  let bounds: L.LatLngBounds
  let containerSize: L.Point
  let center: L.LatLng

  try {
    bounds = map.value.getBounds()
    containerSize = map.value.getSize()
    center = map.value.getCenter()
  } catch {
    poiEdgeArrows.value = []
    return
  }

  const width = containerSize.x
  const height = containerSize.y
  const isFullscreen = widgetStore.isFullScreen(widget.value)
  const topEdgeY = isFullscreen ? widgetStore.currentTopBarHeightPixels : 0
  const bottomEdgeY = isFullscreen ? height - widgetStore.currentBottomBarHeightPixels : height
  const validYMin = topEdgeY
  const validYMax = bottomEdgeY
  const cornerThreshold = 40
  const arrows: PoiEdgeArrow[] = []

  missionStore.pointsOfInterest.forEach((poi) => {
    const poiLatLng = L.latLng(poi.coordinates[0], poi.coordinates[1])
    if (!map.value) return

    let poiPoint: L.Point
    let centerPoint: L.Point

    try {
      poiPoint = map.value.latLngToContainerPoint(poiLatLng)
      centerPoint = map.value.latLngToContainerPoint(center)
    } catch {
      return
    }

    // Check if POI is visible on the map (within container bounds)
    if (
      poiPoint.x >= 0 &&
      poiPoint.x <= width &&
      poiPoint.y >= validYMin &&
      poiPoint.y <= validYMax &&
      bounds.contains(poiLatLng)
    ) {
      return
    }

    const distanceMeters = calculateHaversineDistance([center.lat, center.lng], poi.coordinates)
    const distanceText =
      distanceMeters >= 1000 ? `${(distanceMeters / 1000).toFixed(2)} km` : `${distanceMeters.toFixed(0)} m`

    const distanceX = poiPoint.x - centerPoint.x
    const distanceY = poiPoint.y - centerPoint.y

    if (Math.abs(distanceX) < 0.001 && Math.abs(distanceY) < 0.001) return

    const intersections = calculateMapEdgesIntersections(
      centerPoint,
      distanceX,
      distanceY,
      width,
      height,
      topEdgeY,
      validYMin
    )
    if (intersections.length === 0) return

    const closest = intersections.reduce((min: EdgeIntersection, current: EdgeIntersection) =>
      current.t < min.t ? current : min
    )
    let selectedIntersection = closest

    // Handle corner cases
    const cornerIntersection = handleMapEdgeCorners(intersections, closest.x, closest.y, width, height, cornerThreshold)
    if (cornerIntersection) selectedIntersection = cornerIntersection

    // Clamp positions to contain the arrow within the map container
    let edgeX = Math.max(0, Math.min(width, selectedIntersection.x))
    let edgeY = selectedIntersection.y

    if (selectedIntersection.edge === 'bottom') {
      edgeY = Math.max(0, Math.min(height, edgeY))
    } else if (selectedIntersection.edge === 'left' || selectedIntersection.edge === 'right') {
      edgeY = Math.max(validYMin, Math.min(validYMax - 10, edgeY))
    } else {
      edgeY = Math.max(validYMin, Math.min(validYMax, edgeY))
    }

    const angle = ((Math.atan2(distanceY, distanceX) * 180) / Math.PI + 360) % 360

    arrows.push({
      poiId: poi.id,
      style: getPoiArrowStyle(selectedIntersection.edge, edgeX, edgeY, topEdgeY, isFullscreen),
      angle: angle + 90,
      tooltipText: `${poi.name} - ${distanceText}`,
      color: poi.color,
    })
  })

  poiEdgeArrows.value = arrows
}

/**
 * Calculate and update edge arrows for vehicle and home waypoint.
 */
const calculateVehicleAndHomeEdgeArrows = (): void => {
  vehicleEdgeArrow.value = calculateTargetEdgeArrow(vehiclePosition.value, 'Vehicle', '#1e498f')
  homeEdgeArrow.value = calculateTargetEdgeArrow(home.value, 'Home', '#1e498f')
}

// Prevent poi arrows calculation from overloading the UI
const debouncedUpdateArrows = useDebounceFn(calculatePoiEdgeArrows, 150)
const throttledUpdateArrows = useThrottleFn(calculatePoiEdgeArrows, 15) // Max 60fps
const debouncedUpdateVehicleAndHomeArrows = useDebounceFn(calculateVehicleAndHomeEdgeArrows, 150)
const throttledUpdateVehicleAndHomeArrows = useThrottleFn(calculateVehicleAndHomeEdgeArrows, 15)

// Watch for map changes and POI changes
watch(
  [mapCenter, zoom, () => missionStore.pointsOfInterest],
  () => {
    if (mapReady.value && map.value && map.value instanceof L.Map) {
      debouncedUpdateArrows()
      throttledUpdateVehicleAndHomeArrows()
    }
  },
  { immediate: true }
)

// Update POI Edge Arrows when map becomes ready
watch(mapReady, (ready) => {
  if (ready && map.value && map.value instanceof L.Map) {
    debouncedUpdateArrows()
    debouncedUpdateVehicleAndHomeArrows()
  }
})

// Watch for vehicle and home position changes
watch(
  [vehiclePosition, home, mapCenter, zoom],
  () => {
    if (mapReady.value && map.value && map.value instanceof L.Map) {
      throttledUpdateVehicleAndHomeArrows()
    }
  },
  { immediate: true }
)

const centerMapOnPoi = (poiId: string): void => {
  if (!map.value) return

  const poi = missionStore.pointsOfInterest.find((p) => p.id === poiId)
  if (!poi) return

  map.value.setView(poi.coordinates as LatLngTuple, map.value.getZoom(), { animate: true })
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

:deep(.marker-icon) {
  background-color: #1e498f;
  border: 1px solid #ffffff55;
  border-radius: 50%;
  z-index: 100 !important;
}

:deep(.marker-icon--reached) {
  background-color: #ffff00;
  border: 2px solid #000000dd;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.2);
}

.waypoint-tooltip {
  background-color: white;
  padding: 0.75rem;
  border: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  color: black;
  z-index: 100;
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

:deep(.leaflet-control-savetiles),
:deep(.hidden-savetiles) {
  display: none !important;
}

/* Style the standard Leaflet scale control */
:deep(.leaflet-control-scale) {
  position: absolute;
  bottom: v-bind('bottomButtonsDisplacement');
  margin-bottom: 12px;
  right: 407px; /* Position to the left of the buttons */
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

/* Style the Leaflet zoom control */
:deep(.leaflet-control-zoom.leaflet-bar) {
  bottom: v-bind('bottomButtonsDisplacement');
  background: var(--glass-background);
  backdrop-filter: var(--glass-filter);
  box-shadow: var(--glass-box-shadow);
  color: var(--glass-color);
  border: var(--glass-border);
}

:deep(.leaflet-control-zoom.leaflet-bar a) {
  background: transparent !important;
  border: none;
  color: var(--glass-color);
}

:deep(.leaflet-control-zoom.leaflet-bar a:hover),
:deep(.leaflet-control-zoom.leaflet-bar a:focus) {
  background: transparent !important;
}

/* Style the Leaflet layer provider selector */
:deep(.leaflet-control-layers) {
  background: var(--glass-background) !important;
  backdrop-filter: var(--glass-filter) !important;
  box-shadow: var(--glass-box-shadow) !important;
  color: var(--glass-color) !important;
  border: var(--glass-border) !important;
  border-radius: 4px;
}

:deep(.leaflet-control-layers-expanded) {
  background: var(--glass-background) !important;
  backdrop-filter: var(--glass-filter) !important;
  box-shadow: var(--glass-box-shadow) !important;
  color: var(--glass-color) !important;
  border: var(--glass-border) !important;
}

:deep(.leaflet-control-layers-list) {
  background: transparent !important;
  color: var(--glass-color) !important;
}

:deep(.leaflet-control-layers-selector) {
  accent-color: var(--glass-color) !important;
}

:deep(.leaflet-control-layers label) {
  color: var(--glass-color) !important;
}

.poi-edge-arrow {
  position: absolute;
  z-index: 1001;
  pointer-events: none;
}

.poi-arrow-container {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: transform 0.2s ease, background-color 0.2s ease;
  pointer-events: all;
  cursor: pointer;
}

.poi-arrow-container:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: scale(1.3);
}

.poi-arrow-icon {
  font-size: 36px;
  font-weight: 900;
  -webkit-text-stroke: 1px white;
  transition: transform 0.2s ease;
  text-shadow: -1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white, 0 -1px 0 white, 0 1px 0 white,
    -1px 0 0 white, 1px 0 0 white;
}

:deep(.poi-arrow-tooltip) {
  background-color: rgba(255, 255, 255) !important;
  color: black !important;
  border: none !important;
  border-radius: 4px !important;
  padding: 5px 8px !important;
}
</style>
