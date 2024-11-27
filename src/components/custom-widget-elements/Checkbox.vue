<template>
  <div
    class="flex items-center h-[30px]"
    :style="{ justifyContent: miniWidget.options.layout?.align }"
    :class="
      widgetStore.elementToShowOnDrawer?.hash === miniWidget.hash && widgetStore.editingMode
        ? 'bg-[#00000010] '
        : 'border-0'
    "
    @click="widgetStore.editingMode && widgetStore.showElementPropsDrawer(miniWidget.hash)"
  >
    <p v-if="miniWidget.options.layout?.label !== ''" class="mr-3 mb-[3px] text-white">
      {{ miniWidget.options.layout?.label }}
    </p>
    <v-checkbox
      v-model="isChecked"
      hide-details
      :color="miniWidget.options.layout?.color"
      class="text-white"
      :class="{ 'pointer-events-none': widgetStore.editingMode }"
      theme="dark"
      @update:model-value="handleToggleAction"
    ></v-checkbox>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, toRefs, watch } from 'vue'

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
  miniWidget: CustomWidgetElementOptions[CustomWidgetElementType.Checkbox]
}>()

const miniWidget = toRefs(props).miniWidget
const isChecked = ref(false)

const handleToggleAction = (): void => {
  if (widgetStore.editingMode) return
  widgetStore.setMiniWidgetLastValue(miniWidget.value.hash, isChecked.value)
  if (miniWidget.value.options.actionVariable) {
    setCockpitActionVariableData(miniWidget.value.options.actionVariable.name, isChecked.value)
  }
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

onMounted(() => {
  if (!miniWidget.value.options || Object.keys(miniWidget.value.options).length === 0) {
    miniWidget.value.isCustomElement = true
    widgetStore.updateElementOptions(miniWidget.value.hash, {
      layout: {
        label: '',
        align: 'center',
        color: '#FFFFFF',
      },
      variableType: 'boolean',
      actionVariable: undefined,
    })
  }
  if (miniWidget.value.options.actionVariable) {
    listenCockpitActionVariable(miniWidget.value.options.actionVariable.name, (value) => {
      isChecked.value = value as boolean
    })
    isChecked.value = widgetStore.getMiniWidgetLastValue(miniWidget.value.hash) as boolean
  }
})

onUnmounted(() => {
  if (miniWidget.value.options.actionVariable) {
    unlistenCockpitActionVariable(miniWidget.value.options.actionVariable.name)
    deleteCockpitActionVariable(miniWidget.value.options.actionVariable.id)
  }
})
</script>

<style scoped></style>
