<template>
  <div
    class="flex items-center h-[30px] px-4"
    :class="
      widgetStore.elementToShowOnDrawer?.hash === miniWidget.hash && widgetStore.editingMode
        ? 'bg-[#00000010] '
        : 'border-0'
    "
    @click="widgetStore.editingMode && widgetStore.showElementPropsDrawer(miniWidget.hash)"
  >
    <v-switch
      v-model="switchValue"
      hide-details
      :color="miniWidget.options.layout?.color || '#FFFFFF'"
      :class="{ 'pointer-events-none': widgetStore.editingMode }"
      class="min-w-[35px]"
      @change="handleToggleAction"
    />
    <p v-if="miniWidget.options.layout?.label !== ''" class="ml-3 mb-[3px] whitespace-nowrap">
      {{ miniWidget.options.layout?.label }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, toRefs, watch } from 'vue'

import {
  deleteDataLakeVariable,
  listenDataLakeVariable,
  setDataLakeVariableData,
  unlistenDataLakeVariable,
} from '@/libs/actions/data-lake'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { CustomWidgetElementOptions, CustomWidgetElementType } from '@/types/widgets'

const widgetStore = useWidgetManagerStore()

const props = defineProps<{
  /**
   * Element instance
   */
  miniWidget: CustomWidgetElementOptions[CustomWidgetElementType.Switch]
}>()

const miniWidget = toRefs(props).miniWidget
const switchValue = ref(true)
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

const handleToggleAction = (): void => {
  if (widgetStore.editingMode) return
  if (miniWidget.value.options.dataLakeVariable) {
    widgetStore.setMiniWidgetLastValue(miniWidget.value.hash, switchValue.value)
    setDataLakeVariableData(miniWidget.value.options.dataLakeVariable.name, switchValue.value)
  }
}

onMounted(() => {
  if (!props.miniWidget.options || Object.keys(props.miniWidget.options).length === 0) {
    miniWidget.value.isCustomElement = true
    widgetStore.updateElementOptions(props.miniWidget.hash, {
      layout: {
        align: miniWidget.value.options.layout?.align || 'center',
        color: miniWidget.value.options.layout?.color || '#FFFFFF',
        label: miniWidget.value.options.layout?.label || '',
      },
      variableType: 'boolean',
      dataLakeVariable: undefined,
      toggled: true,
    })

    switchValue.value = true
  } else if (miniWidget.value.options.dataLakeVariable) {
    listenerId = listenDataLakeVariable(miniWidget.value.options.dataLakeVariable.name, (value) => {
      switchValue.value = value as boolean
    })
    switchValue.value = widgetStore.getMiniWidgetLastValue(miniWidget.value.hash) as boolean
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

<style scoped></style>
