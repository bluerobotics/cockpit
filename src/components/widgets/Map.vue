<template>
  <l-map
    ref="map"
    v-model="zoom"
    v-model:zoom="zoom"
    v-model:bounds="bounds"
    v-model:center="center"
    :max-zoom="19"
    class="map"
    @ready="onLeafletReady"
    @click="onMapClick"
  >
    <!-- Marker bound to clickedLocation -->
    <l-marker v-if="clickedLocation" :lat-lng="clickedLocation">
      <l-tooltip>
        <div>coordinates: {{ clickedLocation }}</div>
      </l-tooltip>
    </l-marker>
    <v-btn
      v-tooltip="Boolean(home) ? undefined : 'Home position is currently undefined'"
      class="absolute left-0 m-3 bottom-12 bg-slate-50"
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
    <div v-if="showContextMenu" class="context-menu" :style="{ top: menuPosition.top, left: menuPosition.left }">
      <ul @click.stop="">
        <li @click="onMenuOptionSelect('goto')">GoTo</li>
      </ul>
    </div>
    <v-btn
      v-tooltip="Boolean(vehiclePosition) ? undefined : 'Vehicle position is currently undefined'"
      class="absolute m-3 bottom-12 left-10 bg-slate-50"
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
      class="absolute m-3 bottom-12 left-20 bg-slate-50"
      elevation="2"
      style="z-index: 1002; border-radius: 0px"
      icon="mdi-download"
      size="x-small"
      @click.stop="downloadMissionFromVehicle"
    />
    <v-btn
      class="absolute mb-3 ml-1 bottom-12 left-32 bg-slate-50"
      elevation="2"
      style="z-index: 1002; border-radius: 0px"
      icon="mdi-play"
      size="x-small"
      @click.stop="executeMissionOnVehicle"
    />
    <l-marker
      v-for="(waypoint, i) in missionStore.currentPlanningWaypoints"
      :key="waypoint.id"
      :lat-lng="waypoint.coordinates"
    >
      <l-icon :icon-anchor="[12, 12]" class-name="markerIcon">
        <div>{{ i }}</div>
      </l-icon>
    </l-marker>
    <l-polyline
      :lat-lngs="missionStore.currentPlanningWaypoints.map((w) => w.coordinates)"
      color="rgba(1, 1, 1, 0.5)"
    ></l-polyline>
    <l-marker v-if="home" :lat-lng="home">
      <l-icon :icon-size="[24, 24]">
        <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" viewBox="0 0 24 24">
          <path
            fill="blue"
            d="M12 3L2 12h3v8h14v-8h3L12 3m0 4.7c2.1 0 3.8 1.7
            3.8 3.8c0 3-3.8 6.5-3.8 6.5s-3.8-3.5-3.8-6.5c0-2.1
            1.7-3.8 3.8-3.8m0 2.3a1.5 1.5 0 0 0-1.5 1.5A1.5 1.5
            0 0 0 12 13a1.5 1.5 0 0 0 1.5-1.5A1.5 1.5 0 0 0 12 10Z"
          />
        </svg>
      </l-icon>
    </l-marker>
    <l-marker :lat-lng="vehiclePosition ?? [0, 0]" name="Vehicle">
      <l-tooltip>
        <p>Coordinates: {{ vehiclePosition ?? 'No data available' }}</p>
        <p>Velocity: {{ `${vehicleStore.velocity.ground?.toFixed(2)} m/s` ?? 'No data available' }}</p>
        <p>Heading: {{ `${vehicleHeading.toFixed(2)}°` ?? 'No data available' }}</p>
        <p>{{ vehicleStore.isArmed ? 'Armed' : 'Disarmed' }}</p>
        <p>Last seen: {{ timeAgoSeenText }}</p>
      </l-tooltip>
      <l-icon :icon-anchor="[50, 50]">
        <vehicle-icon :type="vehicleStore.vehicleType" :heading="vehicleHeading" />
      </l-icon>
    </l-marker>
    <l-polyline v-if="widget.options.showVehiclePath" :lat-lngs="vehicleLatLongHistory" />
    <l-tile-layer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
  </l-map>
  <v-dialog v-model="widget.managerVars.configMenuOpen" width="auto">
    <v-card class="pa-2">
      <v-card-title>Map widget settings</v-card-title>
      <v-card-text>
        <v-switch
          v-model="widget.options.showVehiclePath"
          class="my-1"
          label="Show vehicle path"
          :color="widget.options.showVehiclePath ? 'rgb(0, 20, 80)' : undefined"
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
    color="rgba(0, 110, 255, 0.8)"
  />
</template>

<script setup lang="ts">
import 'leaflet/dist/leaflet.css'

import { LIcon, LMap, LMarker, LPolyline, LTileLayer, LTooltip } from '@vue-leaflet/vue-leaflet'
import { useRefHistory } from '@vueuse/core'
import { formatDistanceToNow } from 'date-fns'
import type { Map } from 'leaflet'
import Swal from 'sweetalert2'
import {
  type Ref,
  computed,
  nextTick,
  onBeforeMount,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  toRefs,
  watch,
} from 'vue'

import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { canByPassCategory, EventCategory, slideToConfirm } from '@/libs/slide-to-confirm'
import { degrees } from '@/libs/utils'
import { TargetFollower, WhoToFollow } from '@/libs/utils-map'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import type { WaypointCoordinates } from '@/types/mission'
import type { Widget } from '@/types/widgets'

import VehicleIcon from './VehicleIcon.vue'

datalogger.registerUsage(DatalogVariable.latitude)
datalogger.registerUsage(DatalogVariable.longitude)
const vehicleStore = useMainVehicleStore()
const missionStore = useMissionStore()

const zoom = ref(18)
const bounds = ref(null)
const center = ref<WaypointCoordinates>([-27.5935, -48.55854])
const home = ref(center.value)
const followerTarget = ref<WhoToFollow | undefined>(undefined)

const vehiclePosition = computed(() =>
  vehicleStore.coordinates.latitude
    ? ([vehicleStore.coordinates.latitude, vehicleStore.coordinates.longitude] as WaypointCoordinates)
    : undefined
)
const vehicleHeading = computed(() => (vehicleStore.attitude.yaw ? degrees(vehicleStore.attitude?.yaw) : 0))
const { history: vehiclePositionHistory } = useRefHistory(vehiclePosition)
const vehicleLatLongHistory = computed(() =>
  vehiclePositionHistory.value.filter((posHis) => posHis.snapshot !== undefined).map((posHis) => posHis.snapshot)
)
const timeAgoSeenText = computed(() => {
  const lastBeat = vehicleStore.lastHeartbeat
  return lastBeat ? `${formatDistanceToNow(lastBeat ?? 0, { includeSeconds: true })} ago` : 'never'
})

const targetFollower = new TargetFollower(
  (newTarget: WhoToFollow | undefined) => (followerTarget.value = newTarget),
  (newCenter: WaypointCoordinates) => (center.value = newCenter)
)
targetFollower.setTrackableTarget(WhoToFollow.VEHICLE, () => vehiclePosition.value)
targetFollower.setTrackableTarget(WhoToFollow.HOME, () => home.value)

const map: Ref<null | any> = ref(null) // eslint-disable-line @typescript-eslint/no-explicit-any
const leafletObject = ref<null | Map>(null)

let first_position = true
navigator?.geolocation?.watchPosition(
  (position) => {
    home.value = [position.coords.latitude, position.coords.longitude]

    // If it's the first time that position is being set, go home
    if (first_position) {
      targetFollower.goToTarget(WhoToFollow.HOME)
      first_position = leafletObject.value !== null
    }
  },
  (error) => {
    console.error(`Failed to get position: (${error.code}) ${error.message}`)
  },
  {
    enableHighAccuracy: false,
    timeout: 5000,
    maximumAge: 0,
  }
)

let leafletMap: L.Map | null = null // eslint-disable-line no-undef

const onLeafletReady = async (): Promise<void> => {
  await nextTick()
  leafletMap = map.value?.leafletObject

  if (!leafletMap) {
    console.warn('Failed to get leaflet reference')
    return
  }
  leafletObject.value = map.value?.leafletObject

  leafletMap.on('click', onMapClick)

  if (leafletObject.value == undefined) {
    console.warn('Failed to get leaflet reference')
    return
  }

  leafletObject.value.zoomControl.setPosition('bottomright')

  leafletMap.on('contextmenu', () => {
    hideContextMenuAndMarker()
  })

  // It was not possible to find a way to change the position
  // automatically besides waiting 2 seconds before changing it
  setTimeout(() => targetFollower.goToTarget(WhoToFollow.HOME), 2000)
}

const clickedLocation = ref<[number, number] | null>(null)

// hide context menu and marker
const hideContextMenuAndMarker = (): void => {
  showContextMenu.value = false
  clickedLocation.value = null
}

// Handle the Escape key press
const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    hideContextMenuAndMarker()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

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
      Swal.fire({ icon: 'success', title: 'Mission download succeed!', timer: 2000 })
    })
  } catch (error) {
    Swal.fire({ icon: 'error', title: 'Mission download failed', text: error as string, timer: 5000 })
  } finally {
    fetchingMission.value = false
  }
}

const executeMissionOnVehicle = (): void => {
  vehicleStore.startMission()
}

const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()

const widget = toRefs(props).widget

watch(props.widget, () => {
  leafletObject.value?.invalidateSize()
})

onBeforeMount(() => {
  // Set initial widget options if they don't exist
  if (Object.keys(widget.value.options).length === 0) {
    widget.value.options = {
      showVehiclePath: true,
    }
  }
  targetFollower.enableAutoUpdate()
})

onBeforeUnmount(() => {
  targetFollower.disableAutoUpdate()

  if (leafletMap) {
    leafletMap.off('click', onMapClick)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (leafletMap) {
    leafletMap.off('contextmenu')
  }
})

const showContextMenu = ref(false)
const menuPosition = reactive({ top: '0px', left: '0px' })

// eslint-disable-next-line no-undef
const onMapClick = (event: L.LeafletMouseEvent): void => {
  console.log('Map click event:', event) // Log the event object

  // Check if event.latlng is defined and has the required properties
  if (event?.latlng?.lat != null && event?.latlng?.lng != null) {
    clickedLocation.value = [event.latlng.lat, event.latlng.lng]
    showContextMenu.value = true

    // Calculate and update menu position
    const mapElement = leafletObject.value?.getContainer()
    if (mapElement) {
      const { x, y } = mapElement.getBoundingClientRect()
      menuPosition.left = `${event.originalEvent.clientX - x}px`
      menuPosition.top = `${event.originalEvent.clientY - y}px`
    }
  } else {
    console.error('Invalid event structure:', event)
  }
}

const onMenuOptionSelect = (option: string): void => {
  console.log(`Option selected: ${option}`)

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
</script>

<style>
.map {
  z-index: 0;
}
.markerIcon {
  background-color: rgb(0, 110, 255);
  width: 24px;
  height: 24px;
  border-radius: 12px;
  box-shadow: 1px 1px 1px rgba(0, 0, 0, 0.2);
  text-align: center;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}
.leaflet-control-zoom {
  transform: translateY(-30px);
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
</style>
