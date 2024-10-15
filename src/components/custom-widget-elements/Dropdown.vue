<template>
  <div
    class="select-container"
    :class="
      widgetStore.elementToShowOnDrawer?.hash === element.hash && widgetStore.editingMode
        ? 'bg-[#00000010] '
        : 'border-0'
    "
  >
    <v-select
      v-model="selectedOption"
      :items="options"
      theme="dark"
      density="compact"
      variant="filled"
      hide-details
      class="text-white"
      :class="{ 'pointer-events-none': widgetStore.editingMode }"
      @change="handleSelection"
    >
    </v-select>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, toRefs, watch } from 'vue'

import { useWidgetManagerStore } from '@/stores/widgetManager'
import { CustomWidgetElementOptions, CustomWidgetElementType } from '@/types/widgets'

const widgetStore = useWidgetManagerStore()

const props = defineProps<{
  /**
   * Element instance
   */
  element: CustomWidgetElementOptions[CustomWidgetElementType.Dropdown]
}>()

const element = toRefs(props).element
const options = ref(element.value.options.options)
const lastSelectedOption = ref()
const selectedOption = ref()

watch(
  () => element.value.options,
  (newValue) => {
    options.value = newValue.options
  },
  { deep: true, immediate: true }
)

watch(
  () => widgetStore.editingMode,
  (newValue) => {
    if (newValue) {
      lastSelectedOption.value = selectedOption.value
      selectedOption.value = null
      return
    }
    selectedOption.value = lastSelectedOption.value
  }
)

const handleSelection = (value: any): void => {
  console.log('🚀 ~ Selected value:', value)
}

onMounted(() => {
  if (!props.element.options || Object.keys(props.element.options).length === 0) {
    widgetStore.updateElementOptions(props.element.hash, {
      options: ['Option 1', 'Option 2', 'Option 3'],
      align: 'start',
      cockpitActions: ['', '', ''],
    })
  }
})
</script>

<style scoped>
.select-container {
  width: auto;
  margin: auto;
}
</style>
