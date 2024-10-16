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
      :color="element.options.layout?.color || '#FFFFFF'"
      :size="element.options.layout?.size"
      :class="{ 'pointer-events-none': widgetStore.editingMode }"
    />
    <p v-if="element.options.layout?.label !== ''" class="ml-3 mb-[3px]">{{ element.options.layout?.label }}</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, toRefs } from 'vue'

import {
  deleteCockpitActionVariable,
  listenCockpitActionVariable,
  unlistenCockpitActionVariable,
} from '@/libs/actions/data-lake'
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
      layout: {
        align: element.value.options.layout?.align || 'center',
        size: element.value.options.layout?.size || 'medium',
        color: element.value.options.layout?.color || '#FFFFFF',
        label: element.value.options.layout?.label || '',
      },
      actionParameter: undefined,
    })
  }
  if (element.value.options.actionParameter) {
    listenCockpitActionVariable(element.value.options.actionParameter.name, (value) => {
      switchValue.value = value as boolean
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
