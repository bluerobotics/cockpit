<template>
  <component :is="componentFromType(miniWidget.component)" :mini-widget="miniWidget" />
</template>

<script setup lang="ts">
import { defineAsyncComponent, onMounted, toRefs } from 'vue'

import { createCockpitActionVariable, getCockpitActionVariableInfo } from '@/libs/actions/data-lake'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { type MiniWidget, CustomWidgetElement } from '@/types/widgets'

const widgetStore = useWidgetManagerStore()

const props = defineProps<{
  /**
   * Mini-widget instance
   */
  miniWidget: MiniWidget | CustomWidgetElement
}>()

const miniWidget = toRefs(props).miniWidget

const componentCache: Record<string, ReturnType<typeof defineAsyncComponent>> = {}

const componentFromType = (componentType: string): ReturnType<typeof defineAsyncComponent> => {
  if (!componentCache[componentType]) {
    componentCache[componentType] = defineAsyncComponent(async () => {
      try {
        return await import(`../components/mini-widgets/${componentType}.vue`)
      } catch (error) {
        return await import(`../components/custom-widget-elements/${componentType}.vue`)
      }
    })
  }
  return componentCache[componentType]
}

const registerCockpitActions = (): void => {
  if (
    miniWidget.value.options.actionVariable &&
    getCockpitActionVariableInfo(miniWidget.value.options.actionVariable.id) !== undefined
  )
    return
  if (miniWidget.value.options.actionVariable) {
    createCockpitActionVariable(
      miniWidget.value.options.actionVariable,
      widgetStore.getMiniWidgetLastValue(miniWidget.value.hash)
    )
  }
}

onMounted(() => registerCockpitActions())
</script>
