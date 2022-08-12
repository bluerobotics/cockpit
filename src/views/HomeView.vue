<template>
  <v-btn
    v-if="showEditButton"
    class="ml-2 edit-mode-btn"
    icon="mdi-pencil"
    @click="editingMode = !editingMode"
  />
  <div v-if="showGrid && editingMode" class="snapping-grid"></div>
  <div class="main">
    <MinimalWidget
      v-if="editingMode"
      :position="{ x: 500, y: 200 }"
      :size="{ width: 500, height: 400 }"
      :locked="!editingMode"
      :snap-to-grid="showGrid"
      :grid-interval="gridInterval"
    >
      <div class="edit-menu">
        <v-card class="pa-3 edit-card" width="500">
          <v-card-title>Edit menu</v-card-title>
          <template v-if="selectedLayer !== undefined">
            <v-card-subtitle class="mt-4">Layer</v-card-subtitle>
            <div class="d-flex align-center ma-2">
              <v-select
                v-model="selectedLayer"
                :items="availableLayers"
                no-data-text="No layers available."
                hide-details
              />
              <v-btn
                class="ml-2"
                icon="mdi-delete"
                size="small"
                rounded="lg"
                @click="deleteLayer(selectedLayer.hash)"
              />
            </div>
            <v-card-subtitle class="mt-4">Widgets</v-card-subtitle>
            <template v-for="widget in selectedLayer.widgets" :key="widget.hash">
              <li class="pl-6">{{ widget.component }}</li>
            </template>
            <div class="d-flex align-center ma-2">
              <v-select
                v-model="selectedWidgetType"
                :items="availableWidgetTypes"
                hide-details
              />
              <v-btn
                class="ml-2"
                icon="mdi-plus"
                size="small"
                rounded="lg"
                @click="addComponent(selectedWidgetType, selectedLayer.hash)"
              />
            </div>
          </template>
          <v-card-actions>
            <v-spacer />
            <v-btn class="ma-1" @click="addLayer()">Add new layer</v-btn>
            <v-btn class="ma-1" @click="showGrid = !showGrid">Use grid</v-btn>
          </v-card-actions>
        </v-card>
      </div>
    </MinimalWidget>
    <div
      v-for="layer in state.layers.slice().reverse()"
      :key="layer.hash"
      class="widget-layer"
    >
      <template
        v-for="widget in layer.widgets.slice().reverse()"
        :key="widget.hash"
      >
        <MinimalWidget
          :position="widget.position"
          :size="widget.size"
          :locked="!editingMode"
          :snap-to-grid="showGrid"
          :grid-interval="gridInterval"
          @move="(position) => updatePosition(widget.hash, position)"
          @resize="(size) => updateSize(widget.hash, size)"
          @send-back="sendWidgetBack(widget.hash)"
          @bring-front="bringWidgetFront(widget.hash)"
          @remove="deleteWidget(widget.hash)"
        >
          <template v-if="widget.component === WidgetType.CounterCardComponent">
            <CounterCard />
          </template>
          <template
            v-if="widget.component === WidgetType.CompassWidgetComponent"
          >
            <CompassWidget />
          </template>
          <template
            v-if="widget.component === WidgetType.IndependentReactorComponent"
          >
            <IndependentReactor />
          </template>
          <template
            v-if="widget.component === WidgetType.IndicatorsWidgetComponent"
          >
            <IndicatorsWidget />
          </template>
          <template v-if="widget.component === WidgetType.VideoPlayerComponent">
            <VideoPlayer />
          </template>
          <template v-if="widget.component === WidgetType.MapWidgetComponent">
            <MapWidget />
          </template>
          <!-- <component :is="componentFromName(widget.component)"></component> -->
        </MinimalWidget>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMouse, useStorage } from '@vueuse/core'
import { v4 as uuid4 } from 'uuid'
import { computed, ref, watch } from 'vue'

import type { Point2D, SizeRect2D } from '@/types/general'

import MinimalWidget from '../components/MinimalWidget.vue'
import CompassWidget from '../components/widgets/CompassWidget.vue'
import CounterCard from '../components/widgets/CounterCard.vue'
import IndependentReactor from '../components/widgets/IndependentReactor.vue'
import IndicatorsWidget from '../components/widgets/IndicatorsWidget.vue'
import MapWidget from '../components/widgets/MapWidget.vue'
import VideoPlayer from '../components/widgets/VideoPlayer.vue'

enum WidgetType {
  IndicatorsWidgetComponent = 'IndicatorsWidget',
  CounterCardComponent = 'CounterCard',
  IndependentReactorComponent = 'IndependentReactor',
  VideoPlayerComponent = 'VideoPlayer',
  MapWidgetComponent = 'MapWidget',
  CompassWidgetComponent = 'CompassWidget',
}

interface Widget {
  hash: string
  component: WidgetType
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

const { x: mouseX } = useMouse()
const showEditButton = ref(false)
const editingMode = ref(false)
const showGrid = ref(false)
const gridInterval = ref(15)

watch(mouseX, () => {
  if (mouseX.value < 100) {
    showEditButton.value = true
    return
  }
  showEditButton.value = false
})

// const componentFromName = (componentName: string): AsyncComponentLoader => {
//   return defineAsyncComponent(
//     () => import(`../components/widgets/${componentName}.vue`)
//   )
// }

const availableWidgetTypes = computed(() => {
  return [
    WidgetType.IndicatorsWidgetComponent,
    WidgetType.CounterCardComponent,
    WidgetType.CompassWidgetComponent,
    WidgetType.IndependentReactorComponent,
    WidgetType.VideoPlayerComponent,
    WidgetType.MapWidgetComponent,
  ]
})

const availableLayers = computed(() => {
  return state.value.layers.slice().map((layer) => {
    return {
      title: layer.hash,
      value: layer,
    }
  })
})

const selectedLayer = ref<Layer>(state.value.layers[0])
const selectedWidgetType = ref<WidgetType>(availableWidgetTypes.value[0])

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
  selectedLayer.value = state.value.layers[0]
}

const updatePosition = (hash: string, position: Point2D): void => {
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
  state.value.layers.unshift({ hash: uuid4(), widgets: [] })
  selectedLayer.value = state.value.layers[state.value.layers.length - 1]
}

const addComponent = (componentType: WidgetType, layerHash: string): void => {
  const layer = layerFromHash(layerHash)
  layer.widgets.unshift({
    hash: uuid4(),
    component: componentType,
    position: { x: 10, y: 10 },
    size: { width: 200, height: 200 },
  })
}

const gridIntervalStop = computed(() => {
  return `${gridInterval.value}px`
})
const gridIntervalStart = computed(() => {
  return `${gridInterval.value - 1}px`
})
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
  z-index: 50;
}
.edit-mode-btn {
  position: absolute;
  left: 10;
  top: 50%;
  z-index: 60;
}
.edit-menu {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.edit-card {
  height: 100%;
}
.snapping-grid {
  z-index: 40;
  position: absolute;
  height: 100%;
  width: 100%;
  background-image: repeating-linear-gradient(
      0deg,
      transparent,
      transparent v-bind('gridIntervalStart'),
      #88f v-bind('gridIntervalStart'),
      #88f v-bind('gridIntervalStop')
    ),
    repeating-linear-gradient(
      -90deg,
      transparent,
      transparent v-bind('gridIntervalStart'),
      #88f v-bind('gridIntervalStart'),
      #88f v-bind('gridIntervalStop')
    );
  background-size: v-bind('gridIntervalStop') v-bind('gridIntervalStop');
  background-repeat: repeat;
}
</style>
