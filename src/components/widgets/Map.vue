<template>
  <l-map
    v-model="zoom"
    v-model:zoom="zoom"
    v-model:bounds="bounds"
    v-model:center="center"
    class="map"
  >
    <l-tile-layer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
  </l-map>
</template>

<script setup lang="ts">
import 'leaflet/dist/leaflet.css'

import { LMap, LTileLayer } from '@vue-leaflet/vue-leaflet'
import { ref } from 'vue'

const zoom = ref(11)
const bounds = ref(null)
const center = ref([-27.5935, -48.55854])
</script>

<style scoped>
.map {
  z-index: 0;
}
</style>
