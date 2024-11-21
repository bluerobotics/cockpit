<template>
  <component :is="componentFromType(miniWidget.component)" :mini-widget="miniWidget" />
</template>

<script setup lang="ts">
import { type AsyncComponentLoader, defineAsyncComponent, toRefs } from 'vue'

import { type MiniWidget, MiniWidgetType } from '@/types/widgets'

const props = defineProps<{
  /**
   * Mini-widget instance
   */
  miniWidget: MiniWidget
}>()

const miniWidget = toRefs(props).miniWidget

const componentCache: Record<string, AsyncComponentLoader> = {}

const componentFromType = (componentType: MiniWidgetType): AsyncComponentLoader => {
  if (!Object.values(MiniWidgetType).includes(componentType)) {
    console.error(`Trying to import mini-widget with unknown '${componentType}' type. Import aborted.`)
    return
  }

  if (componentCache[componentType] === undefined) {
    try {
      componentCache[componentType] = defineAsyncComponent(
        () => import(`../components/mini-widgets/${componentType}.vue`)
      )
    } catch (error) {
      console.error(`Failed to load mini-widget component: ${componentType}`, error)
    }
  }

  return componentCache[componentType]
}
</script>
