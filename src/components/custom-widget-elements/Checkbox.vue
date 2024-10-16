<template>
  <div
    class="flex items-center h-[30px]"
    :style="{ justifyContent: element.options.layout?.align }"
    :class="
      widgetStore.elementToShowOnDrawer?.hash === element.hash && widgetStore.editingMode
        ? 'bg-[#00000010] '
        : 'border-0'
    "
  >
    <p v-if="element.options.layout?.label !== ''" class="mr-3 mb-[3px] text-white">
      {{ element.options.layout?.label }}
    </p>
    <v-checkbox
      v-model="element.checked"
      hide-details
      :color="element.options.layout?.color"
      class="text-white"
      :class="{ 'pointer-events-none': widgetStore.editingMode }"
      theme="dark"
      @change="toggleActionFromCheckbox"
    ></v-checkbox>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, toRefs } from 'vue'

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
  element: CustomWidgetElementOptions[CustomWidgetElementType.Checkbox]
}>()

const element = toRefs(props).element

const toggleActionFromCheckbox = (): void => {
  setCockpitActionVariableData(element.value.options.actionParameter.name, element.value.checked)
}

onMounted(() => {
  if (!element.value.options || Object.keys(element.value.options).length === 0) {
    widgetStore.updateElementOptions(element.value.hash, {
      variableType: 'boolean',
      actionParameter: undefined,
      checked: true,
      layout: {
        label: '',
        align: 'center',
        color: '#FFFFFF',
      },
    })
  }
  if (element.value.options.actionParameter) {
    listenCockpitActionVariable(element.value.options.actionParameter.name, (value) => {
      element.value.checked = value as boolean
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

<style scoped></style>
