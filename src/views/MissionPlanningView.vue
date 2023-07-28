<template>
  <div class="mission-planning">
    <div id="planningMap" ref="planningMap" />
    <div class="absolute left-0 w-40 h-auto flex flex-col p-2 m-4 rounded-md bg-slate-700 opacity-90 max-h-[85%]">
      <div class="flex flex-col w-full h-full p-2 overflow-y-scroll">
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
        <p class="m-1 overflow-visible text-sm text-slate-200">Altitude type:</p>
        <button
          :class="{ 'bg-slate-50': currentWaypointAltitudeRefType === AltitudeReferenceType.ABSOLUTE_RELATIVE_TO_MSL }"
          class="h-auto p-1 m-2 font-medium rounded-sm bg-slate-300"
          @click="currentWaypointAltitudeRefType = AltitudeReferenceType.ABSOLUTE_RELATIVE_TO_MSL"
        >
          {{ AltitudeReferenceType.ABSOLUTE_RELATIVE_TO_MSL }}
        </button>
        <button
          :class="{ 'bg-slate-50': currentWaypointAltitudeRefType === AltitudeReferenceType.RELATIVE_TO_HOME }"
          class="h-auto p-1 m-2 font-medium rounded-sm bg-slate-300"
          @click="currentWaypointAltitudeRefType = AltitudeReferenceType.RELATIVE_TO_HOME"
        >
          {{ AltitudeReferenceType.RELATIVE_TO_HOME }}
        </button>
        <button
          :class="{ 'bg-slate-50': currentWaypointAltitudeRefType === AltitudeReferenceType.RELATIVE_TO_TERRAIN }"
          class="h-auto p-1 m-2 font-medium rounded-sm bg-slate-300"
          @click="currentWaypointAltitudeRefType = AltitudeReferenceType.RELATIVE_TO_TERRAIN"
        >
          {{ AltitudeReferenceType.RELATIVE_TO_TERRAIN }}
        </button>
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
        <button class="h-6 m-2 font-medium rounded-sm bg-slate-300" @click="uploadMissionToVehicle">Upload</button>
        <button class="h-6 m-2 font-medium rounded-sm bg-slate-300" @click="clearMissionOnVehicle">Clear</button>
      </div>
    </div>
    <div class="absolute flex flex-col right-0 m-4 p-2 rounded-md max-h-[70%] w-52 bg-slate-700 opacity-90">
      <div class="flex flex-col w-full h-full p-2 overflow-y-scroll">
        <p v-if="missionStore.currentPlanningWaypoints.length === 0" class="text-lg text-center text-slate-100">
          No waypoints added to the mission.
        </p>
        <div v-for="(waypoint, index) in missionStore.currentPlanningWaypoints" :key="waypoint.id">
          <div class="flex items-center justify-around px-4">
            <div>
              <p class="text-base text-slate-100">Waypoint {{ index }} ({{ waypoint.type }})</p>
              <p class="text-sm text-slate-200">Altitude: {{ waypoint.altitude }} m</p>
            </div>
            <button
              class="flex items-center justify-center w-6 h-6 m-2 rounded-sm text-slate-400"
              @click="removeWaypoint(waypoint)"
            >
              <v-icon>mdi-delete</v-icon>
            </button>
          </div>
          <div v-if="index !== missionStore.currentPlanningWaypoints.length - 1" class="w-full h-px my-3 bg-gray-50" />
        </div>
      </div>
    </div>
    <v-btn
      class="absolute m-3 rounded-sm shadow-sm left-44 bottom-14 bg-slate-50"
      icon="mdi-home-map-marker"
      size="x-small"
      @click="whoToFollow = WhoToFollow.HOME"
    />
    <v-btn
      class="absolute m-3 rounded-sm shadow-sm bottom-14 left-56 bg-slate-50"
      icon="mdi-image-filter-center-focus-strong"
      size="x-small"
      @click="whoToFollow = WhoToFollow.VEHICLE"
    />
    <v-progress-linear
      v-if="uploadingMission"
      :model-value="missionUploadProgress"
      absolute
      bottom
      height="10"
      color="rgba(0, 110, 255, 0.8)"
    />
  </div>
</template>

<script setup lang="ts">
import 'leaflet/dist/leaflet.css'

import { saveAs } from 'file-saver'
import L, { type LatLngTuple, Map, Marker } from 'leaflet'
import Swal from 'sweetalert2'
import { v4 as uuid } from 'uuid'
import type { Ref } from 'vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import {
  type CockpitMission,
  type Waypoint,
  type WaypointCoordinates,
  AltitudeReferenceType,
  instanceOfCockpitMission,
  WaypointType,
} from '@/types/mission'

const missionStore = useMissionStore()
const vehicleStore = useMainVehicleStore()

const clearMissionOnVehicle = (): void => {
  vehicleStore.clearMissions()
}

const uploadingMission = ref(false)
const missionUploadProgress = ref(0)
const uploadMissionToVehicle = async (): Promise<void> => {
  uploadingMission.value = true
  missionUploadProgress.value = 0
  const loadingCallback = async (loadingPerc: number): Promise<void> => {
    missionUploadProgress.value = loadingPerc
  }
  try {
    await vehicleStore.uploadMission(missionStore.currentPlanningWaypoints, loadingCallback)
    Swal.fire({ icon: 'success', title: 'Mission upload succeed!', timer: 2000 })
  } catch (error) {
    Swal.fire({ icon: 'error', title: 'Mission upload failed', text: error as string, timer: 5000 })
  } finally {
    uploadingMission.value = false
  }
}

const planningMap: Ref<Map | undefined> = ref()
const mapCenter = ref<WaypointCoordinates>([-27.5935, -48.55854])
const home = ref(mapCenter.value)
const zoom = ref(18)
const currentWaypointType = ref<WaypointType>(WaypointType.TAKEOFF)
const currentWaypointAltitude = ref(0)
const defaultCruiseSpeed = ref(1)
const currentWaypointAltitudeRefType = ref<AltitudeReferenceType>(AltitudeReferenceType.RELATIVE_TO_HOME)
const waypointMarkers = ref<{ [id: string]: Marker }>({})

const goHome = async (): Promise<void> => {
  if (!home.value || !planningMap.value) return
  mapCenter.value = home.value
}

watch(mapCenter, (newCenter, oldCenter) => {
  if (newCenter.toString() === oldCenter.toString()) return
  planningMap.value?.panTo(newCenter as LatLngTuple)
})
watch(zoom, (newZoom, oldZoom) => {
  if (newZoom === oldZoom) return
  planningMap.value?.setZoom(zoom.value)
})

const addWaypoint = (
  coordinates: WaypointCoordinates,
  altitude: number,
  type: WaypointType,
  altitudeReferenceType: AltitudeReferenceType
): void => {
  if (planningMap.value === undefined) throw new Error('Map not yet defined')
  const waypointId = uuid()
  const waypoint: Waypoint = { id: waypointId, coordinates, altitude, type, altitudeReferenceType }
  missionStore.currentPlanningWaypoints.push(waypoint)
  const newMarker = L.marker(coordinates, { draggable: true })
  // @ts-ignore - onMove is a valid LeafletMouseEvent
  newMarker.on('move', (e: L.LeafletMouseEvent) => {
    missionStore.moveWaypoint(waypointId, [e.latlng.lat, e.latlng.lng])
  })
  newMarker.on('contextmenu', () => {
    // @ts-ignore: Event has the latlng property
    removeWaypoint(waypoint)
  })
  var markerIcon = L.divIcon({
    className: 'marker-icon',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
  newMarker.setIcon(markerIcon)
  const markerTooltip = L.tooltip({
    content: `${Object.keys(waypointMarkers.value).length}`,
    permanent: true,
    direction: 'center',
    className: 'waypoint-tooltip',
    opacity: 1,
  })
  newMarker.bindTooltip(markerTooltip)
  planningMap.value.addLayer(newMarker)
  // @ts-ignore: Marker type is always a layer and thus can be deleted
  waypointMarkers.value[waypointId] = newMarker
}

const removeWaypoint = (waypoint: Waypoint): void => {
  const index = missionStore.currentPlanningWaypoints.indexOf(waypoint)
  missionStore.currentPlanningWaypoints.splice(index, 1)
  // @ts-ignore: Marker type is always a layer and thus can be deleted
  planningMap.value?.removeLayer(waypointMarkers.value[waypoint.id])
  delete waypointMarkers.value[waypoint.id]
}

const saveMissionToFile = async (): Promise<void> => {
  const cockpitMissionFile: CockpitMission = {
    version: 0,
    settings: {
      mapCenter: mapCenter.value,
      zoom: zoom.value,
      currentWaypointType: currentWaypointType.value,
      currentWaypointAltitude: currentWaypointAltitude.value,
      currentWaypointAltitudeRefType: currentWaypointAltitudeRefType.value,
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
    if (!instanceOfCockpitMission(maybeMission)) {
      Swal.fire({ icon: 'error', text: 'Invalid mission file.', timer: 3000 })
      return
    }
    mapCenter.value = maybeMission['settings']['mapCenter']
    zoom.value = maybeMission['settings']['zoom']
    currentWaypointType.value = maybeMission['settings']['currentWaypointType']
    currentWaypointAltitude.value = maybeMission['settings']['currentWaypointAltitude']
    currentWaypointAltitudeRefType.value = maybeMission['settings']['currentWaypointAltitudeRefType']
    defaultCruiseSpeed.value = maybeMission['settings']['defaultCruiseSpeed']
    maybeMission['waypoints'].forEach((w: Waypoint) => {
      addWaypoint(w.coordinates, w.altitude, w.type, w.altitudeReferenceType)
    })
  }
  // @ts-ignore: We know the event type and need refactor of the event typing
  reader.readAsText(e.target.files[0])
}

// eslint-disable-next-line jsdoc/require-jsdoc
enum WhoToFollow {
  HOME = 'Home',
  VEHICLE = 'Vehicle',
}

const whoToFollow = ref(WhoToFollow.VEHICLE)

const followSomething = (): void => {
  if (whoToFollow.value === WhoToFollow.HOME && home.value) {
    mapCenter.value = home.value
  } else if (whoToFollow.value === WhoToFollow.VEHICLE && vehiclePosition.value) {
    mapCenter.value = vehiclePosition.value
  }
}

let followInterval: ReturnType<typeof setInterval> | undefined = undefined
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

  planningMap.value.on('moveend', () => {
    if (planningMap.value === undefined) return
    mapCenter.value = [planningMap.value?.getCenter().lat, planningMap.value?.getCenter().lng] ?? mapCenter.value
  })
  planningMap.value.on('zoomend', () => {
    if (planningMap.value === undefined) return
    zoom.value = planningMap.value?.getZoom() ?? mapCenter.value
  })

  goHome()

  planningMap.value.on('click', (e) => {
    addWaypoint(
      [e.latlng.lat, e.latlng.lng],
      currentWaypointAltitude.value,
      currentWaypointType.value,
      currentWaypointAltitudeRefType.value
    )
    if (currentWaypointType.value === WaypointType.TAKEOFF) {
      currentWaypointType.value = WaypointType.PASS_BY
    }
  })

  const layerControl = L.control.layers(baseMaps)
  planningMap.value.addControl(layerControl)

  followInterval = setInterval(followSomething, 500)
})

onUnmounted(() => {
  clearInterval(followInterval)
})

const vehiclePosition = computed((): [number, number] | undefined =>
  vehicleStore.coordinates.latitude
    ? [vehicleStore.coordinates.latitude, vehicleStore.coordinates.longitude]
    : undefined
)

const vehicleMarker = ref<L.Marker>()
watch(vehicleStore.coordinates, () => {
  if (planningMap.value === undefined) throw new Error('Map not yet defined')

  if (vehiclePosition.value === undefined) return

  if (vehicleMarker.value === undefined) {
    vehicleMarker.value = L.marker(vehiclePosition.value)
    var vehicleMarkerIcon = L.divIcon({ className: 'marker-icon', iconSize: [16, 16], iconAnchor: [8, 8] })
    vehicleMarker.value.setIcon(vehicleMarkerIcon)
    const vehicleMarkerTooltip = L.tooltip({
      content: 'V',
      permanent: true,
      direction: 'center',
      className: 'waypoint-tooltip',
      opacity: 1,
    })
    vehicleMarker.value.bindTooltip(vehicleMarkerTooltip)
    planningMap.value.addLayer(vehicleMarker.value)
  }
  vehicleMarker.value.setLatLng(vehiclePosition.value)
})

const homeMarker = ref<L.Marker>()
watch(home, () => {
  if (planningMap.value === undefined) throw new Error('Map not yet defined')

  const position = home.value
  if (position === undefined) return

  if (homeMarker.value === undefined) {
    homeMarker.value = L.marker(position as LatLngTuple)
    var homeMarkerIcon = L.divIcon({ className: 'marker-icon', iconSize: [16, 16], iconAnchor: [8, 8] })
    homeMarker.value.setIcon(homeMarkerIcon)
    const homeMarkerTooltip = L.tooltip({
      content: 'H',
      permanent: true,
      direction: 'center',
      className: 'waypoint-tooltip',
      opacity: 1,
    })
    homeMarker.value.bindTooltip(homeMarkerTooltip)
    planningMap.value.addLayer(homeMarker.value)
  }
  homeMarker.value.setLatLng(home.value)
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
.waypoint-tooltip {
  background-color: transparent;
  border: 0;
  box-shadow: none;
  color: white;
}
.leaflet-top {
  margin-top: 50px;
}
</style>
