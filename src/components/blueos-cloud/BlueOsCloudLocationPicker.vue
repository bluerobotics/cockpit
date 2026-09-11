<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <span class="text-subtitle-2 font-weight-bold">Mission location</span>
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
    <div class="w-full h-[200px] rounded-lg overflow-hidden border border-[#FFFFFF1F] relative">
      <div ref="mapContainer" class="absolute inset-0" />
    </div>
    <div class="grid grid-cols-2 gap-3 pt-2">
      <v-text-field
        :model-value="latitudeInput"
        label="Latitude"
        type="number"
        step="0.000001"
        variant="outlined"
        density="compact"
        theme="dark"
        hide-details
        @update:model-value="onLatitudeInput"
      />
      <v-text-field
        :model-value="longitudeInput"
        label="Longitude"
        type="number"
        step="0.000001"
        variant="outlined"
        density="compact"
        theme="dark"
        hide-details
        @update:model-value="onLongitudeInput"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import 'leaflet/dist/leaflet.css'

import * as L from 'leaflet'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useMapTileLayers } from '@/composables/map/useMapTileLayers'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import { WaypointCoordinates } from '@/types/mission'

const leafletDefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
})

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
let centerMarker: L.Marker | null = null

const hasVehiclePosition = computed(() => !!vehicleStore.coordinates.latitude && !!vehicleStore.coordinates.longitude)
const latitudeInput = ref('')
const longitudeInput = ref('')

// Typing a coordinate pans the map, whose `moveend` reports the new center back: echoing that into the field being
// typed in would rewrite it with a six-decimal value, so only that field is held back while its handler runs.
let fieldBeingEdited: 'latitude' | 'longitude' | null = null

const formatCoord = (value: number): string => value.toFixed(6)

const updateInputs = (coords: WaypointCoordinates | null): void => {
  if (fieldBeingEdited !== 'latitude') latitudeInput.value = coords ? formatCoord(coords[0]) : ''
  if (fieldBeingEdited !== 'longitude') longitudeInput.value = coords ? formatCoord(coords[1]) : ''
}

const coordinates = ref<WaypointCoordinates | null>(props.modelValue)

const setCoordinates = (
  coords: WaypointCoordinates | null,
  options: {
    /**
     * Whether to recenter the map on the new coordinates.
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

// A half-typed or emptied field is not a request to drop the location, or backspacing the latitude would throw the
// longitude away too. Clearing the location is what the Clear button is for.
const onLatitudeInput = (raw: string | number): void => {
  fieldBeingEdited = 'latitude'
  latitudeInput.value = String(raw)
  const lat = typeof raw === 'number' ? raw : parseFloat(raw)
  if (Number.isFinite(lat)) {
    const lng = coordinates.value?.[1] ?? map?.getCenter().lng ?? 0
    setCoordinates([lat, lng], { panMap: true })
  }
  fieldBeingEdited = null
}

const onLongitudeInput = (raw: string | number): void => {
  fieldBeingEdited = 'longitude'
  longitudeInput.value = String(raw)
  const lng = typeof raw === 'number' ? raw : parseFloat(raw)
  if (Number.isFinite(lng)) {
    const lat = coordinates.value?.[0] ?? map?.getCenter().lat ?? 0
    setCoordinates([lat, lng], { panMap: true })
  }
  fieldBeingEdited = null
}

const clearLocation = (): void => {
  logUserAction('Cleared the BlueOS Cloud mission location')
  setCoordinates(null)
}

const centerOnVehicle = (): void => {
  if (!vehicleStore.coordinates.latitude || !vehicleStore.coordinates.longitude) return
  logUserAction('Centered the BlueOS Cloud mission location on the vehicle')
  setCoordinates([vehicleStore.coordinates.latitude, vehicleStore.coordinates.longitude], { panMap: true })
}

const initialCenter = (): {
  /**
   * Coordinates the map should open centered on.
   */
  center: WaypointCoordinates
  /**
   * Initial zoom level for the map.
   */
  zoom: number
  /**
   * Whether `center` should also be emitted as the selected value.
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
  // Shared tile layers, so the picker serves the tiles the user already cached for the other map surfaces.
  baseLayer = useMapTileLayers().baseMaps[missionStore.userLastMapTileProvider]
  map = L.map(mapContainer.value, {
    center: start.center as L.LatLngTuple,
    zoom: start.zoom,
    zoomControl: false,
    attributionControl: false,
    layers: [baseLayer],
  })

  centerMarker = L.marker(map.getCenter(), {
    icon: leafletDefaultIcon,
    interactive: false,
    keyboard: false,
  }).addTo(map)
  map.on('move', () => {
    if (!map || !centerMarker) return
    centerMarker.setLatLng(map.getCenter())
  })
  map.on('moveend', () => {
    if (!map) return
    const { lat, lng } = map.getCenter()
    setCoordinates([lat, lng])
  })

  if (start.useAsValue) {
    setCoordinates(start.center)
  } else {
    updateInputs(props.modelValue)
  }

  setTimeout(() => map?.invalidateSize(), 50)
})

onBeforeUnmount(() => {
  centerMarker = null
  baseLayer = null
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
