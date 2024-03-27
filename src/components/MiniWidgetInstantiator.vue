<template>
  <component :is="componentFromType(miniWidget.component)" :mini-widget="miniWidget" />
</template>

<script setup lang="ts">
import { type AsyncComponentLoader, defineAsyncComponent, toRefs } from 'vue'

import type { MiniWidget, MiniWidgetType } from '@/types/miniWidgets'

const props = defineProps<{
  /**
   * Mini-widget instance
   */
  miniWidget: MiniWidget
}>()

const miniWidget = toRefs(props).miniWidget

const componentCache: Record<string, AsyncComponentLoader> = {}

const componentFromType = (componentType: MiniWidgetType): AsyncComponentLoader => {
  if (componentCache[componentType] === undefined) {
    componentCache[componentType] = defineAsyncComponent(
      () => import(`../components/mini-widgets/${componentType}.vue`)
    )
  }

  return componentCache[componentType]
}
</script>
