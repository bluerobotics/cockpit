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
      <div class="w-full h-px my-3 bg-gray-50" />
      <p class="m-1 overflow-visible text-sm text-slate-200">Use relative altitude?</p>
      <input v-model="useRelativeAltitude" type="checkbox" class="m-1" />
      <div class="w-full h-px my-3 bg-gray-50" />
      <p class="m-1 overflow-visible text-sm text-slate-200">Default cruise speed (m/s)</p>
      <input v-model="defaultCruiseSpeed" class="px-2 m-1 rounded-sm bg-slate-100" />
      <div class="w-full h-px my-3 bg-gray-50" />
      <button class="h-6 m-2 font-medium rounded-sm bg-slate-300" @click="saveMissionToFile">Save</button>
      <button class="h-6 m-2 font-medium rounded-sm bg-slate-300">
        <label class="block w-full h-full cursor-pointer">
          <input type="file" accept=".cmp" hidden @change="(e) => loadMissionFromFile(e)" />
          Load
        </label>
      </button>
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

import { saveAs } from 'file-saver'
import L, { type LatLngTuple, Map } from 'leaflet'
import Swal from 'sweetalert2'
import { v4 as uuid } from 'uuid'
import type { Ref } from 'vue'
import { onMounted, ref, watch } from 'vue'

import { useMissionStore } from '@/stores/mission'
import { type CockpitMission, type Waypoint, WaypointType } from '@/types/mission'

const missionStore = useMissionStore()

const planningMap: Ref<Map | undefined> = ref()
const mapCenter = ref([-27.5935, -48.55854])
const home = ref(mapCenter.value)
const zoom = ref(18)
const currentWaypointType = ref<WaypointType>(WaypointType.TAKEOFF)
const currentWaypointAltitude = ref(0)
const defaultCruiseSpeed = ref(1)
const useRelativeAltitude = ref(true)

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

const saveMissionToFile = async (): Promise<void> => {
  const cockpitMissionFile: CockpitMission = {
    version: 0,
    settings: {
      mapCenter: mapCenter.value,
      zoom: zoom.value,
      currentWaypointType: currentWaypointType.value,
      currentWaypointAltitude: currentWaypointAltitude.value,
      useRelativeAltitude: useRelativeAltitude.value,
      defaultCruiseSpeed: defaultCruiseSpeed.value,
    },
    waypoints: missionStore.currentPlanningWaypoints,
  }
  const blob = new Blob([JSON.stringify(cockpitMissionFile, null, 2)], {
    type: 'application/json',
  })
  saveAs(blob, 'mission_plan.cmp')
}

const loadMissionFromFile = async (e: Event): Promise<void> => {
  var reader = new FileReader()
  reader.onload = (event: Event) => {
    // @ts-ignore: We know the event type and need refactor of the event typing
    const contents = event.target.result
    const maybeMission = JSON.parse(contents)
    if (
      !(
        maybeMission['version'] !== undefined &&
        maybeMission['settings'] !== undefined &&
        maybeMission['settings']['mapCenter'] !== undefined &&
        maybeMission['settings']['zoom'] !== undefined &&
        maybeMission['settings']['currentWaypointType'] !== undefined &&
        maybeMission['settings']['currentWaypointAltitude'] !== undefined &&
        maybeMission['settings']['useRelativeAltitude'] !== undefined &&
        maybeMission['settings']['defaultCruiseSpeed'] !== undefined &&
        maybeMission['waypoints'] !== undefined
      )
    ) {
      Swal.fire({ icon: 'error', text: 'Invalid mission file.', timer: 3000 })
      return
    }
    mapCenter.value = maybeMission['settings']['mapCenter']
    zoom.value = maybeMission['settings']['zoom']
    currentWaypointType.value = maybeMission['settings']['currentWaypointType']
    currentWaypointAltitude.value = maybeMission['settings']['currentWaypointAltitude']
    useRelativeAltitude.value = maybeMission['settings']['useRelativeAltitude']
    defaultCruiseSpeed.value = maybeMission['settings']['defaultCruiseSpeed']
    maybeMission['waypoints'].forEach((w: Waypoint) => {
      addWaypoint(w.coordinates, w.altitude, w.type)
    })
  }
  // @ts-ignore: We know the event type and need refactor of the event typing
  reader.readAsText(e.target.files[0])
}

onMounted(() => {
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
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

  planningMap.value = L.map('planningMap', { layers: [osm, esri] }).setView(mapCenter.value as LatLngTuple, zoom.value)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(planningMap.value)
  planningMap.value.zoomControl.setPosition('bottomright')

  goHome()

  planningMap.value.on('click', (e) => {
    addWaypoint(e.latlng as unknown as [number, number], currentWaypointAltitude.value, currentWaypointType.value)
  })

  const layerControl = L.control.layers(baseMaps)
  planningMap.value.addControl(layerControl)
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

<style>
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
