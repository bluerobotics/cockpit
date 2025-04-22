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
      v-model="sliderValue"
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
      @update:model-value="handleSliderChange"
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

const startListeningDataLakeVariable = (): void => {
  if (miniWidget.value.options.dataLakeVariable) {
    listenerId = listenDataLakeVariable(miniWidget.value.options.dataLakeVariable?.name, (value) => {
      sliderValue.value = value as number
    })
    sliderValue.value = widgetStore.getMiniWidgetLastValue(miniWidget.value.hash) as number
  }
}

watch(
  () => miniWidget.value.options.dataLakeVariable?.name,
  (newVal) => {
    if (newVal) {
      startListeningDataLakeVariable()
    }
  },
  { immediate: true }
)

const handleSliderChange = (): void => {
  if (widgetStore.editingMode) return
  if (miniWidget.value.options.dataLakeVariable) {
    widgetStore.setMiniWidgetLastValue(miniWidget.value.hash, sliderValue.value.toFixed(1))
    setDataLakeVariableData(miniWidget.value.options.dataLakeVariable.name, sliderValue.value.toFixed(1))
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

  startListeningDataLakeVariable()
})

onUnmounted(() => {
  if (miniWidget.value.options.dataLakeVariable) {
    if (listenerId) {
      unlistenDataLakeVariable(miniWidget.value.options.dataLakeVariable.name, listenerId)
    }
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
