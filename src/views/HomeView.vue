<template>
  <div class="home">
    <h1>This is the main view</h1>
    <template v-for="widget in state.widgets" :key="widget.hash">
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
    <v-btn class="ma-1" @click="addComponent(WidgetComponent.CounterCard)"
      >Add new CounterCard</v-btn
    >
    <v-btn class="ma-1" @click="addComponent(WidgetComponent.IndependentReactor)"
      >Add new IndependentReactor</v-btn
    >
    <v-btn class="ma-1" @click="addComponent(WidgetComponent.IndicatorsWidget)"
      >Add new IndicatorsWidget</v-btn
    >
    <DropzoneWidget />
    <div>
      <h1>X: {{ mouseX }}</h1>
      <h1>Y: {{ mouseY }}</h1>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMouse, useStorage } from '@vueuse/core'
import { v4 as uuid4 } from 'uuid'

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

const state = useStorage('cockpit-grid-store', {
  widgets: defaultWidgets,
})

// const componentFromName = (componentName: string): AsyncComponentLoader => {
//   return defineAsyncComponent(
//     () => import(`../components/widgets/${componentName}.vue`)
//   )
// }

const behaveForDrop = (hash: string, position: Point2D): void => {
  const widget = widgetFromHash(hash)
  if (shouldDeleteComponent(position)) {
    deleteComponent(widget.hash)
  }
}

const shouldDeleteComponent = (position: Point2D): boolean => {
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

const deleteComponent = (hash: string): void => {
  const widget = widgetFromHash(hash)
  const index = state.value.widgets.indexOf(widget)
  state.value.widgets.splice(index, 1)
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
  const index = state.value.widgets.indexOf(widget)
  state.value.widgets.splice(index, 1)
  state.value.widgets.splice(0, 0, widget)
}

const sendWidgetBack = (hash: string): void => {
  const widget = widgetFromHash(hash)
  const index = state.value.widgets.indexOf(widget)
  state.value.widgets.splice(index, 1)
  state.value.widgets.splice(state.value.widgets.length - 1, 0, widget)
}

const widgetFromHash = (hash: string): Widget => {
  const widget = state.value.widgets.find((w) => w.hash === hash)
  if (widget === undefined) {
    throw new Error(`No widget found with hash ${hash}`)
  }
  return widget
}

const addComponent = (componentType: WidgetComponent): void => {
  state.value.widgets.push({
    hash: uuid4(),
    component: componentType,
    position: { x: 10, y: 10 },
    size: { width: 200, height: 200 },
  })
  console.log(state.value.widgets[0])
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
</style>
