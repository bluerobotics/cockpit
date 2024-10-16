<template>
  <div @click="widgetStore.showElementPropsDrawer(element.hash)">
    <component :is="componentFromType(element.component)" :element="element" />
  </div>
</template>

<script setup lang="ts">
import { type AsyncComponentLoader, defineAsyncComponent, onMounted, toRefs } from 'vue'

import { createCockpitActionVariable } from '@/libs/actions/data-lake'
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

const registerCockpitActions = (): void => {
  if (element.value.options.actionParameter) {
    createCockpitActionVariable(element.value.options.actionParameter)
  }
}

onMounted(() => registerCockpitActions())
</script>
