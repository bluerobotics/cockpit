<template>
  <div class="root">
    <l-map
      v-model="zoom"
      v-model:zoom="zoom"
      v-model:bounds="bounds"
      v-model:center="center"
      class="map"
    >
      <l-tile-layer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      ></l-tile-layer>
    </l-map>
  </div>
</template>

<script setup lang="ts">
import 'leaflet/dist/leaflet.css'

import { LMap, LTileLayer } from '@vue-leaflet/vue-leaflet'
import { ref } from 'vue'
// import { ref, watch } from 'vue'

// const props = defineProps<{
//   locked: boolean
// }>()

const zoom = ref(11)
const bounds = ref(null)
const center = ref([-27.5935, -48.55854])

// watch(zoom, (newValue, oldValue) => {
//   if (!props.locked && newValue !== oldValue) {
//     zoom.value = oldValue
//     console.log(`zoom value didnt change!`)
//   }
//   console.log(newValue, oldValue)
// })
// watch(bounds, (newValue, oldValue) => {
//   if (!props.locked && newValue !== oldValue) {
//     bounds.value = oldValue
//     console.log(`bounds value didnt change!`)
//   }
//   console.log(newValue, oldValue)
// })
// watch(center, (newValue, oldValue) => {
//   if (!props.locked && newValue !== oldValue) {
//     center.value = oldValue
//     console.log(`center value didnt change!`)
//   }
//   console.log(newValue, oldValue)
// })
</script>

<style scoped>
.root {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.map {
  z-index: 0;
}
</style>
