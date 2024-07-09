<template>
  <div class="widgets-view">
    <div v-for="view in store.viewsToShow" :key="view.hash" class="widget-view">
      <div class="h-full w-full bg-slate-500" />
      <SnappingGrid v-if="store.snapToGrid && store.editingMode" :grid-interval="store.gridInterval" />
      <template v-for="widget in view.widgets.slice().reverse()" :key="widget.hash">
        <WidgetHugger
          v-if="Object.values(WidgetType).includes(widget.component)"
          :widget="widget"
          :allow-moving="widget.managerVars.allowMoving"
          :allow-resizing="store.editingMode"
        >
          <component :is="componentFromType(widget.component)" :widget="widget" />
        </WidgetHugger>
      </template>
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
.widget-view {
  position: absolute;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  background-color: rgb(122, 25, 25);
}
</style>
