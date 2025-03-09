<template>
  <div class="widgets-view">
    <div v-for="view in store.viewsToShow" :key="view.hash" class="widget-view">
      <div class="w-full h-full bg-slate-500 flex justify-center align-center">
        <div
          v-if="view.widgets.isEmpty()"
          class="px-10 py-16 rounded-md flex flex-col justify-center align-center bg-slate-400 font-extrabold text-slate-600 w-[480px] text-center text-3xl"
        >
          <p>You currently have no widgets!</p>
          <br />
          <p>Open edit mode to start tweaking this view.</p>
        </div>
      </div>
      <SnappingGrid v-if="store.snapToGrid && store.editingMode" :grid-interval="store.gridInterval" />
      <template v-for="widget in view.widgets.slice().reverse()" :key="widget.hash">
        <WidgetHugger
          v-if="componentExists(widget.component)"
          :widget="widget"
          :allow-moving="store.widgetManagerVars(widget.hash).allowMoving"
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

// TODO: Remove this non-migration implementation once we have a better solution that doesn't cause sync conflicts
const mappedComponentType = (componentName: string): WidgetType => {
  const mappingWidgetComponentName = {
    CustomWidgetBase: 'CollapsibleContainer',
  }
  return (mappingWidgetComponentName[componentName] || componentName) as WidgetType
}

const componentCache: Record<string, AsyncComponentLoader> = {}

const componentFromType = (componentName: string): AsyncComponentLoader => {
  const componentType = mappedComponentType(componentName)

  if (componentCache[componentType] === undefined) {
    componentCache[componentType] = defineAsyncComponent(() => import(`../components/widgets/${componentType}.vue`))
  }

  return componentCache[componentType]
}

const componentExists = (componentName: string): boolean => {
  return Object.values(WidgetType).includes(mappedComponentType(componentName))
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
