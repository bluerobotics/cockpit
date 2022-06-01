<template>
  <div class="home">
    <h1>This is the main view</h1>
    <template v-for="widget in state.widgets" :key="widget.hash">
      <MinimalWidget
        :component-hash="widget.hash"
        :position="widget.position"
        :size="widget.size"
        @move="updatePosition"
        @delete="deleteComponent"
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
    <v-btn class="ma-1" @click="addComponent('CounterCard')">Add new CounterCard</v-btn>
    <v-btn class="ma-1" @click="addComponent('IndependentReactor')">Add new IndependentReactor</v-btn>
    <v-btn class="ma-1" @click="addComponent('IndicatorsWidget')">Add new IndicatorsWidget</v-btn>
    <DropzoneWidget />
  </div>
</template>

<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { v4 as uuid4 } from 'uuid'

import DropzoneWidget from '../components/DropzoneWidget.vue'
import MinimalWidget from '../components/MinimalWidget.vue'
import CounterCard from '../components/widgets/CounterCard.vue'
import IndependentReactor from '../components/widgets/IndependentReactor.vue'
import IndicatorsWidget from '../components/widgets/IndicatorsWidget.vue'

const state = useStorage('cockpit-grid-store', {
  widgets: [
    { hash: uuid4(), component: 'CounterCard', position: { x: 50, y: 50 }, size: { width: 300, height: 200 } },
    { hash: uuid4(), component: 'CounterCard', position: { x: 150, y: 150 }, size: { width: 300, height: 200 } },
    { hash: uuid4(), component: 'IndependentReactor', position: { x: 250, y: 250 }, size: { width: 300, height: 200 } },
  ],
})

// const componentFromName = (componentName: string): AsyncComponentLoader => {
//   return defineAsyncComponent(
//     () => import(`../components/widgets/${componentName}.vue`)
//   )
// }

const updatePosition = (value: { hash: string, position: { x: number, y: number }}): void => {
  const widget = state.value.widgets.find(
    (widget) => widget.hash === value.hash
  )
  if (widget === undefined) {
    return
  }
  widget.position = value.position
}

const addComponent = (componentType: string) => {
  state.value.widgets.push(
    { hash: uuid4(), component: componentType, position: { x: 50, y: 50 }, size: { width: 300, height: 200 } }
  )
}

const deleteComponent = (value: { hash: string }) => {
  const widget = state.value.widgets.find(
    (widget) => widget.hash === value.hash
  )
  const index = state.value.widgets.indexOf(widget)
  state.value.widgets.splice(index, 1)

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
