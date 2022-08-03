<template>
  <div class="home">
    <h1>This is the main view</h1>
    <div v-for="layer in layers" :key="layer.hash" class="widget-layer">
      <template v-for="widget in layer.widgets" :key="widget.hash">
        <MinimalWidget
          :position="widget.position"
          :size="widget.size"
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
          <!-- <component :is="componentFromName(widget.component)"></component> -->
        </MinimalWidget>
      </template>
      <span>Layer {{ layer.hash }}</span>
      <v-btn class="ma-1" @click="addComponent(WidgetComponent.CounterCard, layer.hash)"
        >Add new CounterCard</v-btn
      >
      <v-btn class="ma-1" @click="addComponent(WidgetComponent.IndependentReactor, layer.hash)"
        >Add new IndependentReactor</v-btn
      >
      <v-btn class="ma-1" @click="addComponent(WidgetComponent.IndicatorsWidget, layer.hash)"
        >Add new IndicatorsWidget</v-btn
      >
      <v-btn class="ma-1" @click="deleteLayer(layer.hash)">X</v-btn>
    </div>
    <DropzoneWidget />
    <div>
      <h1>X: {{ mouseX }}</h1>
      <h1>Y: {{ mouseY }}</h1>
    </div>
    <v-btn class="ma-1" @click="addLayer()">Add new layer</v-btn>
  </div>
</template>

<script setup lang="ts">
import { useMouse, useStorage } from '@vueuse/core'
import { v4 as uuid4 } from 'uuid'
import { computed } from 'vue'

import type { Point2D, SizeRect2D } from '@/types/general'

import DropzoneWidget from '../components/DropzoneWidget.vue'
import MinimalWidget from '../components/MinimalWidget.vue'
import CounterCard from '../components/widgets/CounterCard.vue'
import IndependentReactor from '../components/widgets/IndependentReactor.vue'
import IndicatorsWidget from '../components/widgets/IndicatorsWidget.vue'

const { x: mouseX, y: mouseY } = useMouse()

enum WidgetComponent {
  IndicatorsWidget = 'IndicatorsWidget',
  CounterCard = 'CounterCard',
  IndependentReactor = 'IndependentReactor',
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

const defaultWidgets: Widget[] = [
  {
    hash: uuid4(),
    component: WidgetComponent.CounterCard,
    position: { x: 50, y: 50 },
    size: { width: 200, height: 200 },
  },
  {
    hash: uuid4(),
    component: WidgetComponent.CounterCard,
    position: { x: 150, y: 150 },
    size: { width: 200, height: 200 },
  },
  {
    hash: uuid4(),
    component: WidgetComponent.IndependentReactor,
    position: { x: 250, y: 250 },
    size: { width: 200, height: 200 },
  },
]

const defaultLayers: Layer[] = [
  {
    hash: uuid4(),
    widgets: defaultWidgets,
  },
]

const state = useStorage('cockpit-grid-store', {
  layers: defaultLayers,
})

// const componentFromName = (componentName: string): AsyncComponentLoader => {
//   return defineAsyncComponent(
//     () => import(`../components/widgets/${componentName}.vue`)
//   )
// }

const layers = computed(() => {
  let originalLayers = state.value.layers.slice(0)
  return originalLayers.reverse()
})

const behaveForDrop = (hash: string, position: Point2D): void => {
  const widget = widgetFromHash(hash)
  if (shouldDeleteWidget(position)) {
    deleteWidget(widget.hash)
  }
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
  console.log(state.value.layers)
  state.value.layers.push({ hash: uuid4(), widgets: [] })
  console.log('new layer added')
  console.log(state.value.layers)
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
.home {
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
</style>
