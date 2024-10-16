<template>
  <div
    class="slider-container"
    :class="
      widgetStore.elementToShowOnDrawer?.hash === element.hash && widgetStore.editingMode
        ? 'bg-[#00000010] '
        : 'border-0'
    "
  >
    <div :style="{ minWidth: element.options.layout?.labelWidth + 'px' }">
      <p v-if="element.options.layout?.label !== ''" class="mr-3 mb-[3px]">
        {{ element.options.layout?.label }}
      </p>
    </div>
    <v-slider
      v-model="sliderValue"
      :min="element.options.layout?.minValue"
      :max="element.options.layout?.maxValue"
      :thumb-label="element.options.layout?.showTooltip"
      hide-details
      class="min-w-20"
      :color="element.options.layout?.color || 'white'"
      :class="{
        'pointer-events-none': widgetStore.editingMode,
        'scale-75': element.options.layout?.size === 'small',
        'scale-125': element.options.layout?.size === 'large',
      }"
      @change="
        () => {
          if (element.options.actionParameter) {
            setCockpitActionVariableData(element.options.actionParameter.name, sliderValue.toFixed(1))
          }
        }
      "
    ></v-slider>
  </div>
</template>

<script setup lang="ts">
import { toRefs } from '@vueuse/core'
import { onMounted, onUnmounted, ref } from 'vue'

import {
  deleteCockpitActionVariable,
  listenCockpitActionVariable,
  setCockpitActionVariableData,
  unlistenCockpitActionVariable,
} from '@/libs/actions/data-lake'
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
      layout: {
        label: '',
        minValue: 0,
        maxValue: 100,
        showTooltip: true,
        color: '#FFFFFF',
        size: 'medium',
        labelWidth: element.value.options.layout?.labelWidth || 0,
      },
      actionParameter: undefined,
    })
  }
  if (element.value.options.actionParameter) {
    listenCockpitActionVariable(element.value.options.actionParameter?.name, (value) => {
      sliderValue.value = value as number
    })
  }
})

onUnmounted(() => {
  if (element.value.options.actionParameter) {
    unlistenCockpitActionVariable(element.value.options.actionParameter.name)
    deleteCockpitActionVariable(element.value.options.actionParameter.name)
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
