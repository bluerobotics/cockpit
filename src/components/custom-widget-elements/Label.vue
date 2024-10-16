<template>
  <div
    class="label-container"
    :class="
      widgetStore.elementToShowOnDrawer?.hash === element.hash && widgetStore.editingMode
        ? 'bg-[#00000010] '
        : 'border-0'
    "
  >
    <div
      :style="{
        width: '100%',
        fontSize: `${element.options.layout?.textSize}px` || '35px',
        fontWeight: element.options.layout?.weight,
        textDecoration: element.options.layout?.decoration,
        color: element.options.layout?.color || '#FFFFFF',
        textAlign: element.options.layout?.align || 'center',
        margin: '1px',
      }"
    >
      {{ element.options.text || 'Label' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, toRefs } from 'vue'

import {
  deleteCockpitActionVariable,
  listenCockpitActionVariable,
  unlistenCockpitActionVariable,
} from '@/libs/actions/data-lake'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { CustomWidgetElementOptions, CustomWidgetElementType } from '@/types/widgets'

const widgetStore = useWidgetManagerStore()

const props = defineProps<{
  /**
   * Element instance
   */
  element: CustomWidgetElementOptions[CustomWidgetElementType.Label]
}>()

const element = toRefs(props).element

onMounted(() => {
  if (!props.element.options || Object.keys(props.element.options).length === 0) {
    widgetStore.updateElementOptions(props.element.hash, {
      text: 'Label',
      layout: {
        textSize: 20,
        weight: 'normal',
        decoration: 'none',
        color: '#FFFFFF',
        align: 'center',
      },
      variableType: 'string',
      actionParameter: undefined,
    })
  }
  if (props.element.options.actionParameter) {
    listenCockpitActionVariable(props.element.options.actionParameter?.name, (value) => {
      element.value.options.text = value as string
    })
  }
})

onUnmounted(() => {
  if (props.element.options.actionParameter) {
    unlistenCockpitActionVariable(props.element.options.actionParameter.name)
    deleteCockpitActionVariable(props.element.options.actionParameter.name)
  }
})
</script>

<style scoped>
.label-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
