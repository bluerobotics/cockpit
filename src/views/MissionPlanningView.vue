<template>
  <div class="mission-planning">
    <div id="planningMap" ref="planningMap" />
  </div>
</template>

<script setup lang="ts">
import 'leaflet/dist/leaflet.css'

import L, { type LatLngTuple, type Map } from 'leaflet'
import { v4 as uuid } from 'uuid'
import type { Ref } from 'vue'
import { onMounted, ref, watch } from 'vue'

import { useMissionStore } from '@/stores/mission'
import type { WaypointType } from '@/types/mission'

const missionStore = useMissionStore()

const planningMap: Ref<Map | undefined> = ref()
const mapCenter = ref([-27.5935, -48.55854])
const home = ref(mapCenter.value)
const zoom = ref(18)

const goHome = async (): Promise<void> => {
  if (!home.value || !planningMap.value) return
  planningMap.value?.panTo(home.value as LatLngTuple)
}

const addWaypoint = (coordinates: [number, number], altitude: number, type: WaypointType): void => {
  if (planningMap.value === undefined) throw new Error('Map not yet defined')
  const waypointId = uuid()
  missionStore.currentPlanningWaypoints.push({ id: waypointId, coordinates, altitude, type })
  const newMarker = L.marker(coordinates, { draggable: true })
  newMarker.on('move', (e) => {
    // @ts-ignore: Event has the latlng property
    missionStore.moveWaypoint(waypointId, e.latlng)
  })
  newMarker.addTo(planningMap.value)
}

onMounted(() => {
  planningMap.value = L.map('planningMap').setView(mapCenter.value as LatLngTuple, zoom.value)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(planningMap.value)
  planningMap.value.zoomControl.setPosition('bottomright')

  goHome()

  planningMap.value.on('click', (e) => {
    addWaypoint(e.latlng as unknown as [number, number], 0, 'pass_by')
  })
})

const missionWaypointsPolyline = ref()
watch(missionStore.currentPlanningWaypoints, (newWaypoints) => {
  if (planningMap.value === undefined) throw new Error('Map not yet defined')
  if (missionWaypointsPolyline.value === undefined) {
    missionWaypointsPolyline.value = L.polyline(newWaypoints.map((w) => w.coordinates)).addTo(planningMap.value)
  }
  missionWaypointsPolyline.value.setLatLngs(newWaypoints.map((w) => w.coordinates))
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
