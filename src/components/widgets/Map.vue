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
  >
    <v-btn
      class="options-btn"
      icon="mdi-dots-vertical"
      size="x-small"
      variant="text"
      flat
      @click="showOptionsDialog = !showOptionsDialog"
    />
    <v-btn
      class="absolute bottom-0 left-0 m-3 bg-slate-50"
      elevation="2"
      style="z-index: 1002; border-radius: 0px"
      icon="mdi-home-map-marker"
      size="x-small"
      @click="goHome"
    />
    <v-btn
      class="absolute bottom-0 m-3 left-10 bg-slate-50"
      elevation="2"
      style="z-index: 1002; border-radius: 0px"
      icon="mdi-image-filter-center-focus-strong"
      size="x-small"
      @click="vehiclePosition ? (center = vehiclePosition) : null"
    />
    <v-btn
      class="absolute bottom-0 m-3 left-20 bg-slate-50"
      elevation="2"
      style="z-index: 1002; border-radius: 0px"
      icon="mdi-download"
      size="x-small"
      @click="downloadMissionFromVehicle"
    />
    <v-btn
      class="absolute bottom-0 mb-3 ml-1 left-32 bg-slate-50"
      elevation="2"
      style="z-index: 1002; border-radius: 0px"
      icon="mdi-play"
      size="x-small"
      @click="executeMissionOnVehicle"
    />
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
  <v-dialog v-model="showOptionsDialog" width="auto">
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
import { useMouseInElement, useRefHistory } from '@vueuse/core'
import { formatDistanceToNow } from 'date-fns'
import type { Map } from 'leaflet'
import Swal from 'sweetalert2'
import { type Ref, computed, nextTick, onBeforeMount, ref, toRefs } from 'vue'

import { degrees } from '@/libs/utils'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import type { Widget } from '@/types/widgets'

import VehicleIcon from './VehicleIcon.vue'

const vehicleStore = useMainVehicleStore()
const missionStore = useMissionStore()

const zoom = ref(18)
const bounds = ref(null)
const center = ref([-27.5935, -48.55854])
const home = ref(center.value)
const vehiclePosition = computed(() =>
  vehicleStore.coordinates.latitude
    ? [vehicleStore.coordinates.latitude, vehicleStore.coordinates.longitude]
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

const map: Ref<null | any> = ref(null) // eslint-disable-line @typescript-eslint/no-explicit-any
const leafletObject = ref<null | Map>(null)

let first_position = true
navigator?.geolocation?.watchPosition(
  (position) => {
    home.value = [position.coords.latitude, position.coords.longitude]

    // If it's the first time that position is being set, go home
    if (first_position) {
      goHome()
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

const onLeafletReady = async (): Promise<void> => {
  await nextTick()
  leafletObject.value = map.value?.leafletObject

  if (leafletObject.value == undefined) {
    console.warn('Failed to get leaflet reference')
    return
  }

  leafletObject.value.zoomControl.setPosition('bottomright')

  // It was not possible to find a way to change the position
  // automatically besides waiting 2 seconds before changing it
  setTimeout(goHome, 2000)
}

const goHome = async (): Promise<void> => {
  if (home.value === null) {
    return
  }
  center.value = home.value
}

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

onBeforeMount(() => {
  // Set initial widget options if they don't exist
  if (Object.keys(widget.value.options).length === 0) {
    widget.value.options = {
      showVehiclePath: true,
    }
  }
})

const { isOutside } = useMouseInElement(map)
const mouseOverWidgetStyle = computed(() => (isOutside.value ? 'none' : 'block'))
const showOptionsDialog = ref(false)
</script>

<style scoped>
.map {
  z-index: 0;
}
.options-btn {
  z-index: 1002;
  display: none;
  position: absolute;
  margin: 5px;
  top: 0;
  right: 0;
  color: white;
  filter: drop-shadow(0.5px 0.5px 0.5px black);
  display: v-bind('mouseOverWidgetStyle');
}
</style>
