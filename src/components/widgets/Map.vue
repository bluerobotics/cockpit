<template>
  <div ref="mapBase" class="page-base">
    <div :id="mapId" ref="map" class="map">
      <v-btn
        v-if="showButtons"
        v-tooltip="Boolean(home) ? undefined : 'Home position is currently undefined'"
        class="absolute left-0 m-3 bottom-button bg-slate-50"
        :class="!home ? 'active-events-on-disabled' : ''"
        :color="followerTarget == WhoToFollow.HOME ? 'red' : ''"
        elevation="2"
        style="z-index: 1002; border-radius: 0px"
        icon="mdi-home-map-marker"
        size="x-small"
        :disabled="!home"
        @click.stop="targetFollower.goToTarget(WhoToFollow.HOME, true)"
        @dblclick.stop="targetFollower.follow(WhoToFollow.HOME)"
      />

      <v-btn
        v-if="showButtons"
        v-tooltip="Boolean(vehiclePosition) ? undefined : 'Vehicle position is currently undefined'"
        class="absolute m-3 bottom-button left-10 bg-slate-50"
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

      <v-btn
        v-if="showButtons"
        class="absolute m-3 bottom-button left-20 bg-slate-50"
        elevation="2"
        style="z-index: 1002; border-radius: 0px"
        icon="mdi-download"
        size="x-small"
        @click.stop="downloadMissionFromVehicle"
      />

      <v-btn
        v-if="showButtons"
        class="absolute mb-3 ml-1 bottom-button left-32 bg-slate-50"
        elevation="2"
        style="z-index: 1002; border-radius: 0px"
        icon="mdi-play"
        size="x-small"
        @click.stop="executeMissionOnVehicle"
      />
    </div>
  </div>

  <div v-if="showContextMenu" class="context-menu" :style="{ top: menuPosition.top, left: menuPosition.left }">
    <ul @click.stop="">
      <li @click="onMenuOptionSelect('goto')">GoTo</li>
    </ul>
  </div>

  <v-dialog v-model="widgetStore.widgetManagerVars(widget.hash).configMenuOpen" width="auto">
    <v-card class="pa-2" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-center">Map widget settings</v-card-title>
      <v-card-text>
        <v-switch
          v-model="widget.options.showVehiclePath"
          class="my-1"
          label="Show vehicle path"
          :color="widget.options.showVehiclePath ? 'white' : undefined"
          hide-details
        />
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
  />
</template>

<script setup lang="ts">
import '@/libs/map/LeafletRotatedMarker.js'

import { useElementHover, useRefHistory } from '@vueuse/core'
import { formatDistanceToNow } from 'date-fns'
import L, { type LatLngTuple, Map } from 'leaflet'
import { type Ref, computed, onBeforeMount, onBeforeUnmount, onMounted, reactive, ref, toRefs, watch } from 'vue'

import blueboatMarkerImage from '@/assets/blueboat-marker.png'
import brov2MarkerImage from '@/assets/brov2-marker.png'
import genericVehicleMarkerImage from '@/assets/generic-vehicle-marker.png'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { canByPassCategory, EventCategory, slideToConfirm } from '@/libs/slide-to-confirm'
import { degrees } from '@/libs/utils'
import { TargetFollower, WhoToFollow } from '@/libs/utils-map'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { WaypointCoordinates } from '@/types/mission'
import type { Widget } from '@/types/widgets'

// Define widget props
// eslint-disable-next-line jsdoc/require-jsdoc
const props = defineProps<{ widget: Widget }>()
const widget = toRefs(props).widget
const interfaceStore = useAppInterfaceStore()
const { showDialog } = useInteractionDialog()

// Instantiate the necessary stores
const vehicleStore = useMainVehicleStore()
const missionStore = useMissionStore()

// Declare the general variables
const map: Ref<Map | undefined> = ref()
const zoom = ref(15)
const mapCenter = ref<WaypointCoordinates>([-27.5935, -48.55854])
const home = ref(mapCenter.value)
const mapId = computed(() => `map-${widget.value.hash}`)
const showButtons = ref(false)

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
    }
  }
  targetFollower.enableAutoUpdate()
})

// Configure the available map tile providers
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap',
})

const esri = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 19, attribution: '© Esri World Imagery' }
)

const baseMaps = {
  'OpenStreetMap': osm,
  'Esri World Imagery': esri,
}

// Show buttons when the mouse is over the widget
const mapBase = ref<HTMLElement>()
const isMouseOver = useElementHover(mapBase)

const zoomControl = L.control.zoom({ position: 'bottomright' })
const layerControl = L.control.layers(baseMaps)

watch(showButtons, () => {
  if (map.value === undefined) return
  if (showButtons.value) {
    map.value.addControl(zoomControl)
    map.value.addControl(layerControl)
  } else {
    map.value.removeControl(zoomControl)
    map.value.removeControl(layerControl)
  }
})

watch(isMouseOver, () => {
  showButtons.value = isMouseOver.value
})

onMounted(async () => {
  // Bind leaflet instance to map element
  map.value = L.map(mapId.value, { layers: [osm, esri], attributionControl: false }).setView(
    mapCenter.value as LatLngTuple,
    zoom.value
  ) as Map

  // Remove default zoom control
  map.value.removeControl(map.value.zoomControl)

  // Update center value after panning
  map.value.on('moveend', () => {
    if (map.value === undefined) return
    let { lat, lng } = map.value.getCenter()
    if (lat && lng) {
      mapCenter.value = [lat, lng]
    }
  })

  // Update zoom value after zooming
  map.value.on('zoomend', () => {
    if (map.value === undefined) return
    zoom.value = map.value?.getZoom() ?? mapCenter.value
  })

  // Add click event listener to the map
  map.value.on('click', () => {
    if (map.value === undefined) return
    map.value.on('click', onMapClick)
  })

  // Add context menu event listener to the map
  map.value.on('contextmenu', () => {
    hideContextMenuAndMarker()
  })

  // Enable auto update for target follower
  targetFollower.enableAutoUpdate()

  window.addEventListener('keydown', onKeydown)

  // Pan map to home on mounting
  targetFollower.goToTarget(WhoToFollow.HOME)
})

// Before unmounting:
// - disable auto update for target follower
// - remove event listeners
onBeforeUnmount(() => {
  targetFollower.disableAutoUpdate()
  window.removeEventListener('keydown', onKeydown)

  if (map.value) {
    map.value.off('click', onMapClick)
    map.value.off('contextmenu')
  }
})

// Pan when variables change
watch(mapCenter, (newCenter, oldCenter) => {
  if (newCenter.toString() === oldCenter.toString()) return
  map.value?.panTo(newCenter as LatLngTuple)

  // Update the tooltip content of the home marker
  homeMarker.value?.getTooltip()?.setContent(`Home: ${newCenter[0].toFixed(6)}, ${newCenter[1].toFixed(6)}`)
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
  map.value?.setZoom(zoom.value)
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
  (position) => (home.value = [position.coords.latitude, position.coords.longitude]),
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
const vehicleMarker = ref<L.Marker>()
watch(vehicleStore.coordinates, () => {
  if (!map.value || !vehiclePosition.value) return

  if (vehicleMarker.value === undefined) {
    vehicleMarker.value = L.marker(vehiclePosition.value)

    let vehicleIconUrl = genericVehicleMarkerImage
    if (vehicleStore.vehicleType === MavType.MAV_TYPE_SURFACE_BOAT) {
      vehicleIconUrl = blueboatMarkerImage
    } else if (vehicleStore.vehicleType === MavType.MAV_TYPE_SUBMARINE) {
      vehicleIconUrl = brov2MarkerImage
    }

    const vehicleMarkerIcon = new L.Icon({
      iconUrl: vehicleIconUrl,
      iconSize: [64, 64],
      iconAnchor: [32, 32],
    })

    vehicleMarker.value.setIcon(vehicleMarkerIcon)
    const vehicleMarkerTooltip = L.tooltip({
      content: 'No data available',
      className: 'waypoint-tooltip',
      offset: [64, -12],
    })
    vehicleMarker.value.bindTooltip(vehicleMarkerTooltip)
    map.value.addLayer(vehicleMarker.value)
  }
  vehicleMarker.value.setLatLng(vehiclePosition.value)
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

  // @ts-ignore: LeafletRotatedMarker adds the `setRotationAngle` method and does not have a type definition
  vehicleMarker.value.setRotationAngle(vehicleHeading.value)
})

// Create marker for the home position
const homeMarker = ref<L.Marker>()
watch(home, () => {
  if (map.value === undefined) return

  const position = home.value
  if (position === undefined) return

  if (homeMarker.value === undefined) {
    homeMarker.value = L.marker(position as LatLngTuple)
    const homeMarkerIcon = L.divIcon({ className: 'marker-icon', iconSize: [32, 32], iconAnchor: [16, 16], html: 'H' })
    homeMarker.value.setIcon(homeMarkerIcon)
    const homeMarkerTooltip = L.tooltip({ content: 'No data available', className: 'waypoint-tooltip' })
    homeMarker.value.bindTooltip(homeMarkerTooltip)
    map.value.addLayer(homeMarker.value)
  }
  homeMarker.value.setLatLng(home.value)
})

// Create polyline for the vehicle path
const missionWaypointsPolyline = ref()
watch(missionStore.currentPlanningWaypoints, (newWaypoints) => {
  if (map.value === undefined) return
  if (missionWaypointsPolyline.value === undefined) {
    const coordinates = newWaypoints.map((w) => w.coordinates)
    missionWaypointsPolyline.value = L.polyline(coordinates, { color: '#358AC3' }).addTo(map.value)
  }
  missionWaypointsPolyline.value.setLatLngs(newWaypoints.map((w) => w.coordinates))

  // Add a marker for each point
  newWaypoints.forEach((waypoint, idx) => {
    const marker = L.marker(waypoint.coordinates)
    const markerIcon = L.divIcon({ className: 'marker-icon', iconSize: [32, 32], iconAnchor: [16, 16], html: `${idx}` })
    marker.setIcon(markerIcon)
    map.value?.addLayer(marker)
  })
})

// Create polyline for the vehicle path
const vehicleHistoryPolyline = ref<L.Polyline>()
watch(vehiclePositionHistory, (newPoints) => {
  if (map.value === undefined || newPoints === undefined) return

  if (vehicleHistoryPolyline.value === undefined) {
    vehicleHistoryPolyline.value = L.polyline([], { color: '#358AC3' }).addTo(map.value)
  }

  const latLongHistory = newPoints.filter((posHis) => posHis.snapshot !== undefined).map((posHis) => posHis.snapshot)
  vehicleHistoryPolyline.value.setLatLngs(latLongHistory as L.LatLngExpression[])
})

// Handle context menu toggling and selection
const showContextMenu = ref(false)
const clickedLocation = ref<[number, number] | null>(null)
const menuPosition = reactive({ top: '0px', left: '0px' })
const contextMenuMarker = ref<L.Marker>()

// Handle map click event to show the context menu
const onMapClick = (event: L.LeafletMouseEvent): void => {
  if (contextMenuMarker.value !== undefined && map.value !== undefined) {
    contextMenuMarker.value?.removeFrom(map.value)
  }

  // Check if event.latlng is defined and has the required properties
  if (event?.latlng?.lat != null && event?.latlng?.lng != null) {
    clickedLocation.value = [event.latlng.lat, event.latlng.lng]
    showContextMenu.value = true

    // Calculate and update menu position
    const mapElement = map.value?.getContainer()
    if (mapElement) {
      const { x, y } = mapElement.getBoundingClientRect()
      menuPosition.left = `${event.originalEvent.clientX - x}px`
      menuPosition.top = `${event.originalEvent.clientY - y}px`
    }
  } else {
    console.error('Invalid event structure:', event)
  }

  // Create marker for the clicked location
  if (map.value !== undefined) {
    contextMenuMarker.value = L.marker(clickedLocation.value as LatLngTuple)
    const markerIcon = L.divIcon({ className: 'marker-icon', iconSize: [32, 32], iconAnchor: [16, 16] })
    contextMenuMarker.value.setIcon(markerIcon)
    map.value.addLayer(contextMenuMarker.value)
  }
}

const onMenuOptionSelect = (option: string): void => {
  console.debug(`Map context menu option selected: ${option}.`)

  switch (option) {
    case 'goto':
      if (clickedLocation.value) {
        // Define default values
        const hold = 0
        const acceptanceRadius = 0
        const passRadius = 0
        const yaw = 0
        const altitude = vehicleStore.coordinates.altitude ?? 0

        const latitude = clickedLocation.value[0]
        const longitude = clickedLocation.value[1]

        slideToConfirm(
          () => {
            vehicleStore.goTo(hold, acceptanceRadius, passRadius, yaw, latitude, longitude, altitude)
          },
          {
            command: 'GoTo',
          },
          canByPassCategory(EventCategory.GOTO)
        )
      }
      break

    // Add more cases for other options if needed in the future

    default:
      console.warn('Unknown menu option selected:', option)
  }

  // hide the context menu after an option is selected
  showContextMenu.value = false
}

const hideContextMenuAndMarker = (): void => {
  showContextMenu.value = false
  clickedLocation.value = null
  if (map.value !== undefined && contextMenuMarker.value !== undefined) {
    map.value.removeLayer(contextMenuMarker.value)
  }
}

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    hideContextMenuAndMarker()
  }
}

// Allow fetching missions
const fetchingMission = ref(false)
const missionFetchProgress = ref(0)
const downloadMissionFromVehicle = async (): Promise<void> => {
  fetchingMission.value = true
  missionFetchProgress.value = 0
  while (missionStore.currentPlanningWaypoints.length > 0) {
    missionStore.currentPlanningWaypoints.pop()
  }
  const loadingCallback = async (loadingPerc: number): Promise<void> => {
    missionFetchProgress.value = loadingPerc
  }
  try {
    const missionItemsInVehicle = await vehicleStore.fetchMission(loadingCallback)
    missionItemsInVehicle.forEach((w) => {
      missionStore.currentPlanningWaypoints.push(w)
      showDialog({ variant: 'success', message: 'Mission download succeed!', timer: 2000 })
    })
  } catch (error) {
    showDialog({ variant: 'error', title: 'Mission download failed', message: error as string, timer: 5000 })
  } finally {
    fetchingMission.value = false
  }
}

// Allow executing missions
const executeMissionOnVehicle = (): void => {
  vehicleStore.startMission()
}

// Set dynamic styles for correct displacement of the bottom buttons when the widget is below the bottom bar
const widgetStore = useWidgetManagerStore()
const bottomButtonsDisplacement = computed(() => {
  return `${Math.max(-widgetStore.widgetClearanceForVisibleArea(widget.value).bottom, 0)}px`
})
</script>

<style>
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

.marker-icon {
  color: white;
  background-color: #358ac3;
  padding: 0.75rem;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: 800;
}

.waypoint-tooltip {
  background-color: white;
  padding: 0.75rem;
  border: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  color: black;
}

.leaflet-control-zoom {
  bottom: v-bind('bottomButtonsDisplacement');
}

.context-menu {
  position: absolute;
  z-index: 1003;
  background-color: rgba(255, 255, 255, 0.9);
  /* White with slight transparency */
  border: 1px solid #ccc;
  /* Optional: adds a subtle border */
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
</style>
