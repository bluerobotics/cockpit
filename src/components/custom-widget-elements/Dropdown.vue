<template>
  <div
    class="flex w-full"
    :style="{ width: '100%', justifyContent: miniWidget.options.layout?.align }"
    :class="
      widgetStore.elementToShowOnDrawer?.hash === miniWidget.hash && widgetStore.editingMode
        ? 'bg-[#00000010] '
        : 'border-0'
    "
    @click="widgetStore.editingMode && widgetStore.showElementPropsDrawer(miniWidget.hash)"
  >
    <div>
      <v-select
        v-model="selectedValue"
        :items="options"
        item-title="name"
        item-value="value"
        theme="dark"
        density="compact"
        variant="filled"
        :min-width="miniWidget.options.layout?.width || 168"
        hide-details
        class="text-white"
        :class="{ 'pointer-events-none': widgetStore.editingMode }"
        @update:model-value="handleSelection"
      >
        >
      </v-select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRefs, watch } from 'vue'

import {
  deleteDataLakeVariable,
  listenDataLakeVariable,
  setDataLakeVariableData,
  unlistenDataLakeVariable,
} from '@/libs/actions/data-lake'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { CustomWidgetElementOptions, CustomWidgetElementType, SelectorOption } from '@/types/widgets'

const widgetStore = useWidgetManagerStore()
let listenerId: string | undefined

const props = defineProps<{
  /**
   * Element instance
   */
  miniWidget: CustomWidgetElementOptions[CustomWidgetElementType.Dropdown]
}>()

const options = computed(() => {
  return miniWidget.value.options.layout?.selectorOptions || []
})

const miniWidget = toRefs(props).miniWidget
const selectedOption = ref<SelectorOption | undefined>(
  options.value.find((option) => option.value === props.miniWidget.options.lastSelected?.value) || options.value[0]
)

const selectedValue = ref<string | number | boolean>(
  props.miniWidget.options.lastSelected?.value || options.value[0]?.value
)

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

watch(selectedOption, (newValue) => {
  widgetStore.updateElementOptions(miniWidget.value.hash, {
    ...miniWidget.value.options,
    lastSelected: newValue,
  })
})

const handleSelection = (value: string | number | boolean): void => {
  if (widgetStore.editingMode) return

  const selected = options.value.find((option) => option.value === value)
  if (!selected) return

  selectedValue.value = value

  if (miniWidget.value.options.dataLakeVariable) {
    setDataLakeVariableData(miniWidget.value.options.dataLakeVariable.id, value)
  }
  widgetStore.setMiniWidgetLastValue(miniWidget.value.hash, selected.value)
}

onMounted(() => {
  if (!miniWidget.value.options || Object.keys(miniWidget.value.options).length === 0) {
    miniWidget.value.isCustomElement = true
    widgetStore.updateElementOptions(miniWidget.value.hash, {
      layout: {
        selectorOptions: [],
        align: 'start',
        width: 168,
      },
      variableType: 'string',
      dataLakeVariable: undefined,
    })
  }
  if (miniWidget.value.options.dataLakeVariable) {
    listenerId = listenDataLakeVariable(miniWidget.value.options.dataLakeVariable.name, (value) => {
      selectedOption.value = options.value.find((option) => option.value === value)
    })
    const storedValue = widgetStore.getMiniWidgetLastValue(miniWidget.value.hash)
    selectedOption.value = options.value.find((option: SelectorOption) => option.value === storedValue)
  }
  if (miniWidget.value.options.lastSelected?.name !== '') {
    selectedOption.value = miniWidget.value.options.lastSelected
  }
})

onUnmounted(() => {
  if (miniWidget.value.options.dataLakeVariable) {
    deleteDataLakeVariable(miniWidget.value.options.dataLakeVariable.id)
    if (listenerId) {
      unlistenDataLakeVariable(miniWidget.value.options.dataLakeVariable.name, listenerId)
    }
  }
})
</script>

<style scoped>
.select-container {
  width: 100%;
  align-items: center;
  flex-direction: row;
}
</style>
