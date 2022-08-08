<template>
  <v-btn class="ma-1 edit-mode-btn" @click="editingMode = !editingMode"><v-icon>mdi-pencil</v-icon></v-btn>
  <div class="main">
    <v-card
      class="edit-menu pa-2"
      v-if="editingMode"
      width="500"
    >
      <v-card-title>Edit menu</v-card-title>
      <v-card-text>
        <span>Edit layer</span>
      </v-card-text>
      <v-select
        v-model="selectedLayer"
        :items="availableLayers"
      />
      <div class="d-flex">
        <v-select
          v-model="selectedWidgetType"
          :items="availableWidgetTypes"
        />
        <v-btn class="ma-1" @click="addComponent(selectedWidgetType, selectedLayer.hash)">Add widget</v-btn>
      </div>
      <v-btn class="ma-1" @click="deleteLayer(selectedLayer.hash)">Remove layer</v-btn>
      <v-btn class="ma-1" @click="addLayer()">Add new layer</v-btn>
    </v-card>
    <div v-for="layer in layers" :key="layer.hash" class="widget-layer">
      <template v-for="widget in layer.widgets" :key="widget.hash">
        <MinimalWidget
          :position="widget.position"
          :size="widget.size"
          :locked="!editingMode"
          @move="(position) => updatePosition(widget.hash, position)"
          @resize="(size) => updateSize(widget.hash, size)"
          @drop="(position) => behaveForDrop(widget.hash, position)"
          @send-back="sendWidgetBack(widget.hash)"
          @bring-front="bringWidgetFront(widget.hash)"
        >
          <template v-if="widget.component === 'CounterCard'">
            <CounterCard />
          </template>
          <template v-if="widget.component === 'IndependentReactor'">
            <IndependentReactor />
          </template>
          <template v-if="widget.component === 'IndicatorsWidget'">
            <IndicatorsWidget />
          </template>
          <template v-if="widget.component === 'VideoPlayer'">
            <VideoPlayer />
          </template>
          <!-- <component :is="componentFromName(widget.component)"></component> -->
        </MinimalWidget>
      </template>
    </div>
    <div v-if="editingMode">
      <DropzoneWidget class="dropzone" v-if="showOverlay" />
      <div v-if="showOverlay" class="overlay" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMouse, useMousePressed, useStorage } from '@vueuse/core'
import { v4 as uuid4 } from 'uuid'
import { computed, ref, watch } from 'vue'

import type { Point2D, SizeRect2D } from '@/types/general'

import DropzoneWidget from '../components/DropzoneWidget.vue'
import MinimalWidget from '../components/MinimalWidget.vue'
import CounterCard from '../components/widgets/CounterCard.vue'
import IndependentReactor from '../components/widgets/IndependentReactor.vue'
import IndicatorsWidget from '../components/widgets/IndicatorsWidget.vue'
import VideoPlayer from '../components/widgets/VideoPlayer.vue'

// const { x: mouseX, y: mouseY } = useMouse()

enum WidgetComponent {
  IndicatorsWidget = 'IndicatorsWidget',
  CounterCard = 'CounterCard',
  IndependentReactor = 'IndependentReactor',
  VideoPlayer = 'VideoPlayer',
}

interface Widget {
  hash: string
  component: WidgetComponent
  position: Point2D
  size: SizeRect2D
}

interface Layer {
  hash: string
  widgets: Widget[]
}

const cockpitGridStore: {
  layers: Layer[]
} = {
  layers: [],
}
const state = useStorage('cockpit-grid-store', cockpitGridStore)

const showOverlay = ref(false)
const editingMode = ref(false)
const { pressed } = useMousePressed()

// const componentFromName = (componentName: string): AsyncComponentLoader => {
//   return defineAsyncComponent(
//     () => import(`../components/widgets/${componentName}.vue`)
//   )
// }

const layers = computed(() => {
  let originalLayers = state.value.layers.slice(0)
  return originalLayers.reverse()
})

const availableWidgetTypes = computed(() => {
  return [
    WidgetComponent.IndicatorsWidget,
    WidgetComponent.CounterCard,
    WidgetComponent.IndependentReactor,
    WidgetComponent.VideoPlayer,
  ]
})

const availableLayers = computed(() => {
  return layers.value.map((layer) => {
    return {
      title: layer.hash,
      value: layer,
    }
  })
})

const selectedLayer = ref<Layer>(layers.value[0])
const selectedWidgetType = ref<WidgetComponent>(availableWidgetTypes.value[0])

const behaveForDrop = (hash: string, position: Point2D): void => {
  const widget = widgetFromHash(hash)
  if (shouldDeleteWidget(position)) {
    deleteWidget(widget.hash)
  }
  showOverlay.value = false
}

const shouldDeleteWidget = (position: Point2D): boolean => {
  const trash = document.getElementById('trash')
  if (trash === null) {
    return false
  }
  const trashLimits = trash.getBoundingClientRect()
  return (
    position.x > trashLimits.left &&
    position.x < trashLimits.right &&
    position.y > trashLimits.top &&
    position.y < trashLimits.bottom
  )
}

const deleteWidget = (hash: string): void => {
  const widget = widgetFromHash(hash)
  const layer = layerFromWidgetHash(hash)
  const index = layer.widgets.indexOf(widget)
  layer.widgets.splice(index, 1)
}

const deleteLayer = (hash: string): void => {
  const layer = layerFromHash(hash)
  const index = state.value.layers.indexOf(layer)
  state.value.layers.splice(index, 1)
}

const updatePosition = (hash: string, position: Point2D): void => {
  if (pressed.value) {
    showOverlay.value = true
  }
  const widget = widgetFromHash(hash)
  widget.position = position
}

const updateSize = (hash: string, size: SizeRect2D): void => {
  const widget = widgetFromHash(hash)
  widget.size = size
}

const bringWidgetFront = (hash: string): void => {
  const widget = widgetFromHash(hash)
  const layer = layerFromWidgetHash(hash)
  const index = layer.widgets.indexOf(widget)
  layer.widgets.splice(index, 1)
  layer.widgets.unshift(widget)
}

const sendWidgetBack = (hash: string): void => {
  const widget = widgetFromHash(hash)
  const layer = layerFromWidgetHash(hash)
  const index = layer.widgets.indexOf(widget)
  layer.widgets.splice(index, 1)
  layer.widgets.push(widget)
}

const widgetFromHash = (hash: string): Widget => {
  for (const layer of state.value.layers) {
    for (const widget of layer.widgets) {
      if (widget.hash === hash) {
        return widget
      }
    }
  }
  throw new Error(`No widget found with hash ${hash}`)
}

const layerFromHash = (hash: string): Layer => {
  const layer = state.value.layers.find((l) => l.hash === hash)
  if (layer === undefined) {
    throw new Error(`No layer found with hash ${hash}`)
  }
  return layer
}

const layerFromWidgetHash = (hash: string): Layer => {
  for (const layer of state.value.layers) {
    for (const widget of layer.widgets) {
      if (widget.hash === hash) {
        return layer
      }
    }
  }
  throw new Error(`Widget with hash ${hash} not found in any layer.`)
}

const addLayer = (): void => {
  state.value.layers.push({ hash: uuid4(), widgets: [] })
}

const addComponent = (componentType: WidgetComponent, layerHash: string): void => {
  const layer = layerFromHash(layerHash)
  layer.widgets.push({
    hash: uuid4(),
    component: componentType,
    position: { x: 10, y: 10 },
    size: { width: 200, height: 200 },
  })
}
</script>

<style>
.main {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.widget-layer {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  background-color: rgb(152, 204, 144);
}
/* The Overlay (background) */
.overlay {
  height: 100%;
  width: 100%;
  position: fixed;
  z-index: 1;
  left: 0;
  top: 0;
  background-color: rgb(0, 0, 0);
  background-color: rgba(0, 0, 0, 0.25);
  overflow-x: hidden;
  transition: 0.5s;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
}
.dropzone {
  position: absolute;
  right: 0;
  bottom: 0;
  z-index: 2;
}
.edit-mode-btn {
  position: absolute;
  left: 10;
  top: 10;
  z-index: 1;
}
.edit-menu {
  z-index: 1;
}
</style>
