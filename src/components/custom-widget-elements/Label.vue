<template>
  <div
    class="label-container"
    :class="
      widgetStore.elementToShowOnDrawer?.hash === miniWidget.hash && widgetStore.editingMode
        ? 'bg-[#00000010] '
        : 'border-0'
    "
    @click="widgetStore.editingMode && widgetStore.showElementPropsDrawer(miniWidget.hash)"
  >
    <div
      :style="{
        width: '100%',
        fontSize: `${miniWidget.options.layout?.textSize}px` || '35px',
        fontWeight: miniWidget.options.layout?.weight,
        textDecoration: miniWidget.options.layout?.decoration,
        color: miniWidget.options.layout?.color || '#FFFFFF',
        textAlign: miniWidget.options.layout?.align || 'center',
        margin: '1px',
      }"
    >
      {{ miniWidget.options.text || 'Label' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, toRefs, watch } from 'vue'

import { deleteDataLakeVariable, listenDataLakeVariable, unlistenDataLakeVariable } from '@/libs/actions/data-lake'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { CustomWidgetElementOptions, CustomWidgetElementType } from '@/types/widgets'

const widgetStore = useWidgetManagerStore()

const props = defineProps<{
  /**
   * Element instance
   */
  miniWidget: CustomWidgetElementOptions[CustomWidgetElementType.Label]
}>()

const miniWidget = toRefs(props).miniWidget
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

onMounted(() => {
  if (!props.miniWidget.options || Object.keys(props.miniWidget.options).length === 0) {
    miniWidget.value.isCustomElement = true
    widgetStore.updateElementOptions(props.miniWidget.hash, {
      text: 'Label',
      layout: {
        textSize: 20,
        weight: 'normal',
        decoration: 'none',
        color: '#FFFFFF',
        align: 'center',
      },
      variableType: 'string',
      dataLakeVariable: undefined,
    })
  }
  if (props.miniWidget.options.dataLakeVariable) {
    listenerId = listenDataLakeVariable(props.miniWidget.options.dataLakeVariable?.name, (value) => {
      miniWidget.value.options.text = value as string
    })
    miniWidget.value.options.text = widgetStore.getMiniWidgetLastValue(miniWidget.value.hash) as string
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
.label-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
