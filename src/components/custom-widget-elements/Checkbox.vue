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
      :class="{ 'pointer-events-none': widgetStore.editingMode || !isInput }"
      theme="dark"
      @update:model-value="handleToggleAction"
    ></v-checkbox>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRefs, watch } from 'vue'

import {
  getDataLakeVariableData,
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
  miniWidget: CustomWidgetElementOptions[CustomWidgetElementType.Checkbox]
}>()

const miniWidget = toRefs(props).miniWidget
const isChecked = ref(false)
let listenerId: string | undefined

const handleToggleAction = (): void => {
  if (widgetStore.editingMode) return
  widgetStore.setMiniWidgetLastValue(miniWidget.value.hash, isChecked.value)
  if (miniWidget.value.options.dataLakeVariable) {
    setDataLakeVariableData(miniWidget.value.options.dataLakeVariable.id, isChecked.value)
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

const isInput = computed(() => {
  return miniWidget.value.options?.dataLakeVariable?.persistent === true
})

const startListeningDataLakeVariable = (): void => {
  if (miniWidget.value.options.dataLakeVariable) {
    listenerId = listenDataLakeVariable(miniWidget.value.options.dataLakeVariable.id, (value) => {
      isChecked.value = Boolean(value)
    })
    isChecked.value = Boolean(getDataLakeVariableData(miniWidget.value.options.dataLakeVariable.id))
  }
}

watch(
  () => miniWidget.value.options.dataLakeVariable?.id,
  (newId, oldId) => {
    if (oldId && listenerId) {
      unlistenDataLakeVariable(oldId, listenerId)
    }
    if (newId) {
      startListeningDataLakeVariable()
    }
  }
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
      dataLakeVariable: undefined,
    })
  }

  if (miniWidget.value.options.dataLakeVariable) {
    if (!miniWidget.value.options.dataLakeVariable.allowUserToChangeValue) {
      updateDataLakeVariableInfo({ ...miniWidget.value.options.dataLakeVariable, allowUserToChangeValue: true })
    }
    startListeningDataLakeVariable()
  } else {
    isChecked.value = widgetStore.getMiniWidgetLastValue(miniWidget.value.hash) as boolean
  }
})

onUnmounted(() => {
  if (miniWidget.value.options.dataLakeVariable && listenerId) {
    unlistenDataLakeVariable(miniWidget.value.options.dataLakeVariable.id, listenerId)
  }
})
</script>

<style scoped></style>
