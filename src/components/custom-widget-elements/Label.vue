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
        fontSize: `${element.options.textSize}px` || '35px',
        fontWeight: element.options.weight,
        textDecoration: element.options.decoration,
        color: element.options.color || '#FFFFFF',
        textAlign: element.options.align || 'center',
        margin: '1px',
      }"
    >
      {{ element.options.text || 'Label' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, toRefs } from 'vue'

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
      textSize: 20,
      weight: 'normal',
      decoration: 'none',
      color: '#FFFFFF',
      align: 'center',
    })
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
