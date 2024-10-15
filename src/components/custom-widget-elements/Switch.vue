<template>
  <div
    class="flex items-center h-[30px]"
    :class="
      widgetStore.elementToShowOnDrawer?.hash === element.hash && widgetStore.editingMode
        ? 'bg-[#00000010] '
        : 'border-0'
    "
  >
    <v-switch
      v-model="switchValue"
      hide-details
      :color="element.options.color || '#FFFFFF'"
      :size="element.options.size"
      :class="{ 'pointer-events-none': widgetStore.editingMode }"
    />
    <p v-if="element.options.label !== ''" class="ml-3 mb-[3px]">{{ element.options.label }}</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, toRefs } from 'vue'

import { useWidgetManagerStore } from '@/stores/widgetManager'
import { CustomWidgetElementOptions, CustomWidgetElementType } from '@/types/widgets'

const widgetStore = useWidgetManagerStore()

const props = defineProps<{
  /**
   * Element instance
   */
  element: CustomWidgetElementOptions[CustomWidgetElementType.Switch]
}>()

const element = toRefs(props).element
const switchValue = ref(true)

onMounted(() => {
  if (!props.element.options || Object.keys(props.element.options).length === 0) {
    widgetStore.updateElementOptions(props.element.hash, {
      color: element.value.options.color || '#FFFFFF',
      cockpitAction: element.value.options.cockpitAction || '',
      label: element.value.options.label || '',
    })
  }
})
</script>

<style scoped></style>
