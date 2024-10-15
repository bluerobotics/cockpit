<template>
  <div
    class="flex items-center h-[30px]"
    :style="{ justifyContent: element.options.align }"
    :class="
      widgetStore.elementToShowOnDrawer?.hash === element.hash && widgetStore.editingMode
        ? 'bg-[#00000010] '
        : 'border-0'
    "
  >
    <p v-if="element.options.label !== ''" class="mr-3 mb-[3px] text-white">{{ element.options.label }}</p>
    <v-checkbox
      v-model="element.options.checked"
      hide-details
      :color="element.options.color"
      class="text-white"
      theme="dark"
    ></v-checkbox>
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
  element: CustomWidgetElementOptions[CustomWidgetElementType.Checkbox]
}>()

const element = toRefs(props).element

onMounted(() => {
  if (!element.value.options || Object.keys(element.value.options).length === 0) {
    widgetStore.updateElementOptions(element.value.hash, {
      label: '',
      checked: true,
      align: 'center',
      color: '#FFFFFF',
      cockpitAction: element.value.options.cockpitAction || '',
    })
  }
})
</script>

<style scoped></style>
