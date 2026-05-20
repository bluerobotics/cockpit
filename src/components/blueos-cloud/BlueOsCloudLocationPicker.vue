<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <span class="text-xs uppercase tracking-wider opacity-70">Mission location</span>
      <div class="flex gap-1">
        <v-btn
          v-if="hasVehiclePosition"
          variant="text"
          size="x-small"
          prepend-icon="mdi-crosshairs-gps"
          @click="centerOnVehicle"
        >
          Vehicle
        </v-btn>
        <v-btn
          variant="text"
          size="x-small"
          prepend-icon="mdi-map-marker"
          :disabled="!coordinates"
          @click="clearLocation"
        >
          Clear
        </v-btn>
      </div>
    </div>
    <div ref="mapContainer" class="w-full h-[220px] rounded overflow-hidden border border-white/20 relative">
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-[400]">
        <v-icon size="32" color="#ff5252" class="drop-shadow">mdi-map-marker</v-icon>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div class="flex flex-col">
        <span class="text-xs opacity-70 mb-1">Latitude</span>
        <input
          :value="latitudeInput"
          type="number"
          step="0.000001"
          class="px-2 py-1 rounded-sm bg-[#FFFFFF22] text-sm text-white"
          @input="onLatitudeInput(($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="flex flex-col">
        <span class="text-xs opacity-70 mb-1">Longitude</span>
        <input
          :value="longitudeInput"
          type="number"
          step="0.000001"
          class="px-2 py-1 rounded-sm bg-[#FFFFFF22] text-sm text-white"
          @input="onLongitudeInput(($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import 'leaflet/dist/leaflet.css'

import * as L from 'leaflet'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import { MapTileProvider, WaypointCoordinates } from '@/types/mission'

const props = defineProps<{
  /**
   * Currently selected coordinates (`null` while the user has not picked anything yet).
   */
  modelValue: WaypointCoordinates | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: WaypointCoordinates | null): void
}>()

const missionStore = useMissionStore()
const vehicleStore = useMainVehicleStore()

const mapContainer = ref<HTMLDivElement | null>(null)
let map: L.Map | null = null
let baseLayer: L.TileLayer | null = null

const buildBaseLayer = (provider: MapTileProvider): L.TileLayer => {
  if (provider === 'OpenStreetMap') {
    return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 })
  }
  return L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
  })
}

const hasVehiclePosition = ref(false)
const latitudeInput = ref('')
const longitudeInput = ref('')

const formatCoord = (value: number): string => value.toFixed(6)

const updateInputs = (coords: WaypointCoordinates | null): void => {
  latitudeInput.value = coords ? formatCoord(coords[0]) : ''
  longitudeInput.value = coords ? formatCoord(coords[1]) : ''
}

const coordinates = ref<WaypointCoordinates | null>(props.modelValue)

const setCoordinates = (
  coords: WaypointCoordinates | null,
  options: {
    /**
ccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc *
ccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
     */
    panMap?: boolean
  } = {}
): void => {
  coordinates.value = coords
  updateInputs(coords)
  emit('update:modelValue', coords)
  if (options.panMap && coords && map) {
    map.setView(coords as L.LatLngTuple, map.getZoom(), { animate: false })
  }
}

const onLatitudeInput = (raw: string | number): void => {
  const lat = typeof raw === 'number' ? raw : parseFloat(raw)
  if (!Number.isFinite(lat)) {
    setCoordinates(null)
    return
  }
  const lng = coordinates.value?.[1] ?? map?.getCenter().lng ?? 0
  setCoordinates([lat, lng], { panMap: true })
}

const onLongitudeInput = (raw: string | number): void => {
  const lng = typeof raw === 'number' ? raw : parseFloat(raw)
  if (!Number.isFinite(lng)) {
    setCoordinates(null)
    return
  }
  const lat = coordinates.value?.[0] ?? map?.getCenter().lat ?? 0
  setCoordinates([lat, lng], { panMap: true })
}

const clearLocation = (): void => setCoordinates(null)

const centerOnVehicle = (): void => {
  if (!vehicleStore.coordinates.latitude || !vehicleStore.coordinates.longitude) return
  setCoordinates([vehicleStore.coordinates.latitude, vehicleStore.coordinates.longitude], { panMap: true })
}

const initialCenter = (): {
  /**
cccccccccccccccccccccccccccc *
cccccccccccccccccccccccccccc
   */
  center: WaypointCoordinates
  /**
ccccccccccccccccccccccccccccc *
ccccccccccccccccccccccccccccc
   */
  zoom: number
  /**
zzzzzzzzzzzzzz *
zzzzzzzzzzzzzz
   */
  useAsValue: boolean
} => {
  if (props.modelValue) {
    return { center: props.modelValue, zoom: missionStore.userLastMapZoom || 15, useAsValue: true }
  }
  if (vehicleStore.coordinates.latitude && vehicleStore.coordinates.longitude) {
    return {
      center: [vehicleStore.coordinates.latitude, vehicleStore.coordinates.longitude],
      zoom: missionStore.userLastMapZoom || 15,
      useAsValue: true,
    }
  }
  return {
    center: missionStore.userLastMapCenter,
    zoom: missionStore.userLastMapZoom,
    useAsValue: false,
  }
}

onMounted(() => {
  if (!mapContainer.value) return

  const start = initialCenter()
  baseLayer = buildBaseLayer(missionStore.userLastMapTileProvider)
  map = L.map(mapContainer.value, {
    center: start.center as L.LatLngTuple,
    zoom: start.zoom,
    zoomControl: true,
    attributionControl: false,
    layers: [baseLayer],
  })

  map.on('moveend', () => {
    if (!map) return
    const { lat, lng } = map.getCenter()
    setCoordinates([lat, lng])
  })

  hasVehiclePosition.value = !!vehicleStore.coordinates.latitude && !!vehicleStore.coordinates.longitude

  if (start.useAsValue) {
    setCoordinates(start.center)
  } else {
    updateInputs(props.modelValue)
  }

  setTimeout(() => map?.invalidateSize(), 50)
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
})

watch(
  () => props.modelValue,
  (incoming) => {
    if (!incoming) {
      coordinates.value = null
      updateInputs(null)
      return
    }
    if (
      coordinates.value &&
      Math.abs(coordinates.value[0] - incoming[0]) < 1e-7 &&
      Math.abs(coordinates.value[1] - incoming[1]) < 1e-7
    ) {
      return
    }
    coordinates.value = incoming
    updateInputs(incoming)
    if (map) map.setView(incoming as L.LatLngTuple, map.getZoom(), { animate: false })
  }
)
</script>

<style scoped>
.drop-shadow {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));
}
</style>
