<template>
  <div
    class="flex items-center"
    :style="{ justifyContent: element.options.align }"
    :class="
      widgetStore.elementToShowOnDrawer?.hash === element.hash && widgetStore.editingMode
        ? 'bg-[#00000010] '
        : 'border-0'
    "
  >
    <div :class="widgetStore.editingMode ? 'pointer-events-none' : 'pointer-events-auto'">
      <v-btn
        :size="element.options.buttonSize"
        :variant="element.options.variant"
        :style="{
          color: element.options.textColor || '#FFFFFF',
          backgroundColor:
            element.options.variant !== 'text' && element.options.variant !== 'outlined'
              ? element.options.backgroundColor || '#FFFFFF33'
              : 'transparent',
        }"
      >
        {{ element.options.label || 'Button' }}
      </v-btn>
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
  element: CustomWidgetElementOptions[CustomWidgetElementType.Button]
}>()

const element = toRefs(props).element

onMounted(() => {
  if (!props.element.options || Object.keys(props.element.options).length === 0) {
    widgetStore.updateElementOptions(props.element.hash, {
      align: element.value.options.align || 'center',
      backgroundColor: element.value.options.backgroundColor || '#FFFFFF33',
      label: element.value.options.label || 'Button',
      buttonSize: element.value.options.buttonSize || 'small',
      textColor: element.value.options.textColor || '#FFFFFF',
      variant: element.value.options.variant || 'contained',
      cockpitAction: element.value.options.cockpitAction || '',
    })
  }
})
</script>

<style scoped></style>
