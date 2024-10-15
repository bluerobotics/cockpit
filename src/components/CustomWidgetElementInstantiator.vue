<template>
  <div @click="widgetStore.showElementPropsDrawer(element.hash)">
    <component :is="componentFromType(element.component)" :element="element" />
  </div>
</template>

<script setup lang="ts">
import { type AsyncComponentLoader, defineAsyncComponent, toRefs } from 'vue'

import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { CustomWidgetElement, CustomWidgetElementType } from '@/types/widgets'

const props = defineProps<{
  /**
   * Element instance
   */
  element: CustomWidgetElement
}>()

const element = toRefs(props).element
const widgetStore = useWidgetManagerStore()

const componentCache: Record<string, AsyncComponentLoader> = {}

const componentFromType = (componentType: CustomWidgetElementType): AsyncComponentLoader => {
  if (componentCache[componentType] === undefined) {
    componentCache[componentType] = defineAsyncComponent(
      () => import(`../components/custom-widget-elements/${componentType}.vue`)
    )
  }

  return componentCache[componentType]
}
</script>
