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
    <div class="top-left-menu">
      <v-btn
        class="ma-1"
        elevation="2"
        style="z-index: 1002; border-radius: 0px"
        icon="mdi-home-map-marker"
        size="x-small"
        @click="goHome"
      ></v-btn>
    </div>
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
    <l-marker :lat-lng="vehiclePosition" name="Vehicle">
      <l-icon :icon-anchor="[50, 50]">
        <svg
          version="1.1"
          viewBox="0 0 100 100"
          width="100"
          height="100"
          xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            id="path188"
            :transform="`rotate(${vehicleHeading}, 50, 50) scale(0.7) translate(25, 25)`"
            d="m 50.137948,2.4018877 c 6.564396,5.061536 14.178589,20.9374463 16.210615,35.7093823 0.98559,
            7.142609 1.338459,14.857115 1.0586,23.119175 -0.158182,4.34397 -0.474545,9.18683 -0.863915,
            12.95891 -0.438042,4.17362 -0.803076,7.05743 -1.33846,10.58615 -0.219021,1.39931 -0.45021,4.24662 -0.705734,
            8.760954 -0.133846,2.12939 -0.328531,2.71346 -1.119439,3.23668 -4.751168,0.9569 -22.113373,
            1.18244 -26.611018,0.13385 -0.912586,-0.47455 -1.204614,-1.33848 -1.314124,-3.79641 -0.121679,
            -2.83514 -0.425874,-6.619394 -0.608391,-7.848364 -0.109511,-0.63273 -0.243356,-1.61834 -0.304196,
            -2.19023 -0.07301,-0.5719 -0.146017,-1.1195 -0.182517,-1.2168 -0.07301,-0.24336 -0.742237,
            -5.93798 -0.900419,-7.66583 -0.07301,-0.76659 -0.182514,-2.00772 -0.255524,-2.7378 C 32.18133,
            60.439525 32.278672,48.174195 33.45895,39.328069 35.094446,27.416621 42.369192,8.4623327 49.761287,2.4160307"
            style="fill: #0d47a1"
          />
        </svg>
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
</template>

<script setup lang="ts">
import 'leaflet/dist/leaflet.css'

import { LIcon, LMap, LMarker, LPolyline, LTileLayer } from '@vue-leaflet/vue-leaflet'
import { useMouseInElement, useRefHistory } from '@vueuse/core'
import type { Map } from 'leaflet'
import type { Ref } from 'vue'
import { computed, nextTick, ref } from 'vue'
import { onBeforeMount } from 'vue'
import { toRefs } from 'vue'

import { degrees } from '@/libs/utils'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import type { Widget } from '@/types/widgets'

const vehicleStore = useMainVehicleStore()

const zoom = ref(18)
const bounds = ref(null)
const center = ref([-27.5935, -48.55854])
const home = ref(center.value)
const vehiclePosition = computed(() =>
  vehicleStore.coordinates.latitude ? [vehicleStore.coordinates.latitude, vehicleStore.coordinates.longitude] : [0, 0]
)
const vehicleHeading = computed(() => (vehicleStore.attitude.yaw ? degrees(vehicleStore.attitude?.yaw).toFixed(2) : 0))
const { history: vehiclePositionHistory } = useRefHistory(vehiclePosition)
const vehicleLatLongHistory = computed(() => vehiclePositionHistory.value.map((posHis) => posHis.snapshot))
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
.top-left-menu {
  margin-left: 8px;
  margin-top: 8px;
}
.options-btn {
  z-index: 1002;
  display: none;
  position: absolute;
  margin: 5px;
  top: 0;
  right: 0;
  color: white;
  filter: drop-shadow(2px 2px black);
  display: v-bind('mouseOverWidgetStyle');
}
</style>
