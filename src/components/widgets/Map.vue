<template>
  <l-map
    ref="map"
    v-model="zoom"
    v-model:zoom="zoom"
    v-model:bounds="bounds"
    v-model:center="center"
    class="map"
    @ready="onLeafletReady"
  >
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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid meet"
          viewBox="0 0 24 24"
        >
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
    <l-tile-layer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
  </l-map>
</template>

<script setup lang="ts">
import 'leaflet/dist/leaflet.css'

import { LIcon, LMap, LMarker, LTileLayer } from '@vue-leaflet/vue-leaflet'
import type { Map } from 'leaflet'
import type { Ref } from 'vue'
import { nextTick, ref } from 'vue'

const zoom = ref(11)
const bounds = ref(null)
const center = ref([-27.5935, -48.55854])
const home = ref(center.value)
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

  leafletObject.value.zoomControl.setPosition('topright')

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
</script>

<style scoped>
.map {
  z-index: 0;
}
.top-left-menu {
  margin-left: 8px;
  margin-top: 8px;
}
</style>
