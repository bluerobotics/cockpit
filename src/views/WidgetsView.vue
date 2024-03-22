<template>
  <SnappingGrid v-if="store.showGrid && store.editingMode" :grid-interval="store.gridInterval" class="snapping-grid" />
  <div class="widgets-view">
    <div v-for="view in store.viewsToShow" :key="view.hash" class="widget-view">
      <template v-for="widget in view.widgets.slice().reverse()" :key="widget">
        <WidgetHugger
          v-if="Object.values(WidgetType).includes(widget.component)"
          :widget="widget"
          :allow-moving="widget.managerVars.allowMoving"
          :allow-resizing="store.editingMode"
        >
          <component :is="componentFromType(widget.component)" :widget="widget" />
        </WidgetHugger>
      </template>
      <div class="w-full h-full bg-slate-500" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { type AsyncComponentLoader, defineAsyncComponent } from 'vue'

import { useWidgetManagerStore } from '@/stores/widgetManager'
import { WidgetType } from '@/types/widgets'

import SnappingGrid from '../components/SnappingGrid.vue'
import WidgetHugger from '../components/WidgetHugger.vue'

const store = useWidgetManagerStore()

const componentCache: Record<string, AsyncComponentLoader> = {}

const componentFromType = (componentType: WidgetType): AsyncComponentLoader => {
  if (componentCache[componentType] === undefined) {
    componentCache[componentType] = defineAsyncComponent(() => import(`../components/widgets/${componentType}.vue`))
  }

  return componentCache[componentType]
}
</script>

<style scoped>
.widgets-view {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}
.snapping-grid {
  z-index: 40;
}
.widget-view {
  position: absolute;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  background-color: rgb(122, 25, 25);
  z-index: 50;
}
</style>
