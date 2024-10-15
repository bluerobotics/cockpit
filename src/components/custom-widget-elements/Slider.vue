<template>
  <div
    class="slider-container"
    :class="
      widgetStore.elementToShowOnDrawer?.hash === element.hash && widgetStore.editingMode
        ? 'bg-[#00000010] '
        : 'border-0'
    "
  >
    <div :style="{ minWidth: element.options.labelWidth + 'px' }">
      <p v-if="element.options.label !== ''" class="mr-3 mb-[3px]">
        {{ element.options.label }}
      </p>
    </div>
    <v-slider
      v-model="sliderValue"
      :min="element.options.minValue"
      :max="element.options.maxValue"
      :thumb-label="element.options.showValue"
      hide-details
      class="min-w-20"
      :color="element.options.color || 'white'"
      :class="{
        'pointer-events-none': widgetStore.editingMode,
        'scale-75': element.options.size === 'small',
        'scale-125': element.options.size === 'large',
      }"
    ></v-slider>
  </div>
</template>

<script setup lang="ts">
import { toRefs } from '@vueuse/core'
import { onMounted, ref } from 'vue'

import { useWidgetManagerStore } from '@/stores/widgetManager'
import { CustomWidgetElementOptions, CustomWidgetElementType } from '@/types/widgets'

const widgetStore = useWidgetManagerStore()

const props = defineProps<{
  /**
   * Element instance
   */
  element: CustomWidgetElementOptions[CustomWidgetElementType.Slider]
}>()

const element = toRefs(props).element

const sliderValue = ref(0)

onMounted(() => {
  if (!element.value.options || Object.keys(element.value.options).length === 0) {
    widgetStore.updateElementOptions(element.value.hash, {
      label: '',
      minValue: 0,
      maxValue: 100,
      showValue: true,
      color: '#FFFFFF',
      size: 'medium',
      cockpitAction: element.value.options.cockpitAction || '',
      labelWidth: element.value.options.labelWidth || 0,
    })
  }
})
</script>

<style scoped>
.slider-container {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-direction: row;
}

.label-top {
  margin-bottom: 8px;
}

.label-bottom {
  margin-top: 8px;
}

.label-left {
  order: -1;
  margin-right: 16px;
}

.label-right {
  margin-left: 16px;
  order: 1;
}

.slider-container.row {
  flex-direction: row; /* Horizontal layout for left/right labels */
}
</style>
