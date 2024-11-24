<template>
  <div class="w-full h-full relative">
    <div ref="cesiumContainer" class="w-full h-full"></div>

    <v-dialog v-model="widgetStore.widgetManagerVars(widget.hash).configMenuOpen" min-width="400" max-width="35%">
      <v-card class="pa-2" :style="interfaceStore.globalGlassMenuStyles">
        <v-card-title class="text-center">Map Settings</v-card-title>
        <v-card-text>
          <div>
            <span class="text-xs font-semibold leading-3 text-slate-600">Map Style</span>
            <Dropdown
              v-model="widget.options.mapStyle"
              :options="['Satellite', 'OSM', 'Dark']"
              class="max-w-[144px]"
              theme="dark"
            />
          </div>
          <div class="mt-4">
            <v-switch
              v-model="widget.options.showTerrain"
              label="Show 3D Terrain"
              :color="widget.options.showTerrain ? 'white' : undefined"
              hide-details
            />
          </div>
          <div class="mt-4">
            <v-switch
              v-model="widget.options.debugFPS"
              label="Show FPS Counter"
              :color="widget.options.debugFPS ? 'white' : undefined"
              hide-details
            />
          </div>
        </v-card-text>
        <v-card-actions class="flex justify-end">
          <v-btn color="white" @click="widgetStore.widgetManagerVars(widget.hash).configMenuOpen = false">
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, onBeforeUnmount, ref, toRefs, watch } from 'vue'
import {
  Viewer,
  createWorldTerrainAsync,
  OpenStreetMapImageryProvider,
  TileMapServiceImageryProvider,
  UrlTemplateImageryProvider
} from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'

import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Widget } from '@/types/widgets'
import Dropdown from '../Dropdown.vue'

// Initialize stores
const interfaceStore = useAppInterfaceStore()
const widgetStore = useWidgetManagerStore()

// Define props
const props = defineProps<{
  widget: Widget
}>()
const widget = toRefs(props).widget

// Set up refs
const cesiumContainer = ref<HTMLElement | null>(null)
const viewer = ref<Viewer | null>(null)

// Initialize widget options
onBeforeMount(() => {
  if (Object.keys(widget.value.options).length === 0) {
    widget.value.options = {
      mapStyle: 'Satellite',
      showTerrain: true,
      debugFPS: true
    }
  }
})

// Initialize Cesium viewer
onMounted(async () => {
  if (!cesiumContainer.value) return

  const terrainProvider = widget.value.options.showTerrain ? await createWorldTerrainAsync() : undefined

  // Create the Cesium viewer with minimal controls
  viewer.value = new Viewer(cesiumContainer.value, {
    baseLayerPicker: false,
    timeline: false,
    animation: false,
    homeButton: false,
    navigationHelpButton: false,
    sceneModePicker: false,
    requestRenderMode: true,
    geocoder: false,
    fullscreenButton: false
  })

  if (terrainProvider) {
    viewer.value.terrainProvider = terrainProvider
  }

  // Set initial map style
  updateMapStyle(widget.value.options.mapStyle)
  
  // Set debug FPS display
  viewer.value.scene.debugShowFramesPerSecond = widget.value.options.debugFPS
})

// Watch for option changes
watch(() => widget.value.options.mapStyle, (newStyle) => {
  updateMapStyle(newStyle)
})

watch(() => widget.value.options.showTerrain, async (showTerrain) => {
  if (!viewer.value) return
  const terrainProvider = showTerrain ? await createWorldTerrainAsync() : undefined
  if (terrainProvider) {
    viewer.value.terrainProvider = terrainProvider
  }
})

watch(() => widget.value.options.debugFPS, (showFPS) => {
  if (!viewer.value) return
  viewer.value.scene.debugShowFramesPerSecond = showFPS
})

// Update map style function
const updateMapStyle = (style: string) => {
  if (!viewer.value) return

  // Remove existing imagery layers
  viewer.value.imageryLayers.removeAll()

  switch (style) {
    case 'Satellite':
      viewer.value.imageryLayers.addImageryProvider(
        new UrlTemplateImageryProvider({
          url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
          minimumLevel: 0,
          maximumLevel: 14,
          credit: 'Sentinel-2 cloudless by EOX IT Services GmbH'
        })
      )
      break
    case 'OSM':
      viewer.value.imageryLayers.addImageryProvider(
        new OpenStreetMapImageryProvider({
          url: 'https://a.tile.openstreetmap.org/'
        })
      )
      break
    case 'Dark':
      viewer.value.imageryLayers.addImageryProvider(
        new UrlTemplateImageryProvider({
          url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png',
          minimumLevel: 0,
          maximumLevel: 20,
          credit: 'Dark theme by Stadia Maps'
        })
      )
      break
  }
}

// Cleanup on unmount
onBeforeUnmount(() => {
  if (viewer.value) {
    viewer.value.destroy()
    viewer.value = null
  }
})
</script>

<style>
/* Hide Cesium credits */
.cesium-viewer-bottom {
  display: none;
}

.cesium-widget-credits {
  display: none !important;
}
</style>