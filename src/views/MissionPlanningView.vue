<template>
  <div class="mission-planning">
    <div id="planningMap" ref="planningMap" />
  </div>
</template>

<script setup lang="ts">
import 'leaflet/dist/leaflet.css'

import L, { type LatLngTuple, type Map } from 'leaflet'
import type { Ref } from 'vue'
import { onMounted, ref, watch } from 'vue'

const planningMap: Ref<Map | undefined> = ref()
const mapCenter = ref([-27.5935, -48.55854])
const home = ref(mapCenter.value)
const zoom = ref(18)

const goHome = async (): Promise<void> => {
  if (!home.value || !planningMap.value) return
  planningMap.value?.flyTo(home.value as LatLngTuple)
}

onMounted(() => {
  planningMap.value = L.map('planningMap').setView(mapCenter.value as LatLngTuple, zoom.value)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(planningMap.value)
  planningMap.value.zoomControl.setPosition('bottomright')

  goHome()
})

// Try to update home position based on browser geolocation
navigator?.geolocation?.watchPosition(
  (position) => (home.value = [position.coords.latitude, position.coords.longitude]),
  (error) => console.error(`Failed to get position: (${error.code}) ${error.message}`),
  { enableHighAccuracy: false, timeout: 5000, maximumAge: 0 }
)

// If home position is updated and map was not yet centered on it, center
let mapNotYetCenteredInHome = true
watch([home, planningMap], () => {
  if (home.value === mapCenter.value || !planningMap.value || !mapNotYetCenteredInHome) return
  goHome()
  mapNotYetCenteredInHome = false
})
</script>

<style scoped>
#planningMap {
  position: absolute;
  z-index: 0;
  height: 100%;
  width: 100%;
}
.mission-planning {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
