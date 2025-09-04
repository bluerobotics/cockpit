<template>
  <div
    class="slider-container"
    :class="
      widgetStore.elementToShowOnDrawer?.hash === miniWidget.hash && widgetStore.editingMode
        ? 'bg-[#00000010] '
        : 'border-0'
    "
    @click="widgetStore.editingMode && widgetStore.showElementPropsDrawer(miniWidget.hash)"
  >
    <div :style="{ minWidth: miniWidget.options.layout?.labelWidth + 'px' }">
      <p
        v-if="miniWidget.options.layout?.label !== ''"
        :style="{ color: miniWidget.options.layout?.coloredLabel ? miniWidget.options.layout?.color : '#FFFFFF' }"
        class="mr-3 mb-[3px]"
      >
        {{ miniWidget.options.layout?.label }}
      </p>
    </div>
    <v-slider
      :model-value="sliderValue"
      :min="miniWidget.options.layout?.minValue"
      :max="miniWidget.options.layout?.maxValue"
      :thumb-label="miniWidget.options.layout?.showTooltip"
      hide-details
      class="min-w-20"
      :color="miniWidget.options.layout?.color || 'white'"
      :class="{
        'pointer-events-none': widgetStore.editingMode,
        'scale-75': miniWidget.options.layout?.size === 'small',
      }"
      @update:model-value="(v) => handleSliderInput(v)"
    ></v-slider>
  </div>
</template>

<script setup lang="ts">
import { toRefs } from '@vueuse/core'
import { onMounted, onUnmounted, ref, watch } from 'vue'

import {
  listenDataLakeVariable,
  setDataLakeVariableData,
  unlistenDataLakeVariable,
  updateDataLakeVariableInfo,
} from '@/libs/actions/data-lake'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { CustomWidgetElementOptions, CustomWidgetElementType } from '@/types/widgets'

const widgetStore = useWidgetManagerStore()

const props = defineProps<{
  /**
   * Element instance
   */
  miniWidget: CustomWidgetElementOptions[CustomWidgetElementType.Slider]
}>()

const miniWidget = toRefs(props).miniWidget

const sliderValue = ref(0)
let listenerId: string | undefined
let currentlyTrackedVariableName: string | undefined = undefined
let lastUpdateListenedValue: Date | undefined = undefined

const setSliderValue = (value: number | string | undefined): void => {
  let numValue: number
  if (value === undefined || value === null || isNaN(Number(value))) {
    numValue = miniWidget.value.options.layout?.minValue || 0
  } else {
    numValue = Number(value)
  }

  sliderValue.value = numValue
}

watch(
  () => widgetStore.miniWidgetManagerVars(miniWidget.value.hash).configMenuOpen,
  (newValue) => {
    if (newValue === true) {
      widgetStore.showElementPropsDrawer(miniWidget.value.hash)
      setTimeout(() => {
        widgetStore.miniWidgetManagerVars(miniWidget.value.hash).configMenuOpen = false
      }, 200)
    }
  },
  { immediate: true, deep: true }
)

const stopListeningDataLakeVariable = (): void => {
  if (listenerId && currentlyTrackedVariableName) {
    console.debug(`Will stop listening to variable ${currentlyTrackedVariableName}.`)
    unlistenDataLakeVariable(currentlyTrackedVariableName, listenerId)
  }
}

const startListeningDataLakeVariable = (variableName: string): void => {
  console.debug(`Will start listening to variable ${variableName}.`)
  const initialValue = widgetStore.getMiniWidgetLastValue(miniWidget.value.hash)
  setSliderValue(initialValue)

  // Stop listening to the data lake variable before starting to listen to a new one
  stopListeningDataLakeVariable()

  listenerId = listenDataLakeVariable(variableName, (value) => {
    // Ignore updates that happen within 100ms of the last update
    if (lastUpdateListenedValue && new Date().getTime() - lastUpdateListenedValue.getTime() < 100) return
    lastUpdateListenedValue = new Date()

    setSliderValue(value as number | string | undefined)
  })
  currentlyTrackedVariableName = variableName
}

watch(
  () => miniWidget.value.options.dataLakeVariable?.name,
  (newVal) => {
    if (!newVal) return
    startListeningDataLakeVariable(newVal)
  }
)

const handleSliderInput = (value: number): void => {
  if (widgetStore.editingMode) return
  if (miniWidget.value.options.dataLakeVariable) {
    const roundedValue = Number(value.toFixed(1))
    widgetStore.setMiniWidgetLastValue(miniWidget.value.hash, roundedValue)
    setDataLakeVariableData(miniWidget.value.options.dataLakeVariable.name, roundedValue)
  }
}

onMounted(() => {
  if (!miniWidget.value.options || Object.keys(miniWidget.value.options).length === 0) {
    miniWidget.value.isCustomElement = true
    widgetStore.updateElementOptions(miniWidget.value.hash, {
      layout: {
        label: '',
        minValue: 0,
        maxValue: 100,
        showTooltip: true,
        color: '#FFFFFF',
        coloredLabel: false,
        labelWidth: miniWidget.value.options.layout?.labelWidth || 0,
      },
      variableType: 'number',
      dataLakeVariable: undefined,
    })
  }

  if (miniWidget.value.options.dataLakeVariable && !miniWidget.value.options.dataLakeVariable.allowUserToChangeValue) {
    updateDataLakeVariableInfo({ ...miniWidget.value.options.dataLakeVariable, allowUserToChangeValue: true })
  }

  if (miniWidget.value.options.dataLakeVariable?.name) {
    startListeningDataLakeVariable(miniWidget.value.options.dataLakeVariable.name)
  }
})

onUnmounted(() => {
  stopListeningDataLakeVariable()
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
