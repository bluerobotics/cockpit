<template>
  <div class="mission-planning">
    <div id="planningMap" ref="planningMap" />
    <div class="absolute left-0 flex flex-col w-32 h-auto p-4 m-4 rounded-md bg-slate-700 opacity-90">
      <p class="text-sm text-slate-200">Waypoint type</p>
      <button
        :class="{ 'bg-slate-50': currentWaypointType === WaypointType.TAKEOFF }"
        class="h-6 m-2 font-medium rounded-sm bg-slate-300"
        @click="currentWaypointType = WaypointType.TAKEOFF"
      >
        Takeoff
      </button>
      <button
        :class="{ 'bg-slate-50': currentWaypointType === WaypointType.PASS_BY }"
        class="h-6 m-2 font-medium rounded-sm bg-slate-300"
        @click="currentWaypointType = WaypointType.PASS_BY"
      >
        Pass-by
      </button>
      <button
        :class="{ 'bg-slate-50': currentWaypointType === WaypointType.LAND }"
        class="h-6 m-2 font-medium rounded-sm bg-slate-300"
        @click="currentWaypointType = WaypointType.LAND"
      >
        Land
      </button>
      <div class="w-full h-px my-3 bg-gray-50" />
      <p class="m-1 overflow-visible text-sm text-slate-200">Altitude (m)</p>
      <input v-model="currentWaypointAltitude" class="px-2 m-1 rounded-sm bg-slate-100" />
    </div>
    <div
      class="absolute right-0 flex flex-col p-4 m-4 scrollbar-hide overflow-y-scroll rounded-md max-h-[70%] w-52 bg-slate-700 opacity-90"
    >
      <p v-if="missionStore.currentPlanningWaypoints.length === 0" class="text-lg text-center text-slate-100">
        No waypoints added to the mission.
      </p>
      <div v-for="(waypoint, index) in missionStore.currentPlanningWaypoints" :key="waypoint.id">
        <p class="text-base text-slate-100">Waypoint {{ index }} ({{ waypoint.type }})</p>
        <p class="text-sm text-slate-200">Altitude: {{ waypoint.altitude }} m</p>
        <div v-if="index !== missionStore.currentPlanningWaypoints.length - 1" class="w-full h-px my-3 bg-gray-50" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import 'leaflet/dist/leaflet.css'

import L, { type LatLngTuple, Map } from 'leaflet'
import { v4 as uuid } from 'uuid'
import type { Ref } from 'vue'
import { onMounted, ref, watch } from 'vue'

import { useMissionStore } from '@/stores/mission'
import { WaypointType } from '@/types/mission'

const missionStore = useMissionStore()

const planningMap: Ref<Map | undefined> = ref()
const mapCenter = ref([-27.5935, -48.55854])
const home = ref(mapCenter.value)
const zoom = ref(18)
const currentWaypointType = ref<WaypointType>(WaypointType.TAKEOFF)
const currentWaypointAltitude = ref(0)

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
  var markerIcon = L.divIcon({
    className: 'marker-icon',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
  newMarker.setIcon(markerIcon)
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
    addWaypoint(e.latlng as unknown as [number, number], currentWaypointAltitude.value, currentWaypointType.value)
  })
})

watch(planningMap, (newMap, oldMap) => {
  if (planningMap.value !== undefined && newMap?.options === undefined) {
    planningMap.value = oldMap
  }
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
.marker-icon {
  background-color: rgb(0, 110, 255);
  border-radius: 12px;
}
</style>
