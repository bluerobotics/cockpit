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
      {{ miniWidget.options.layout?.text || 'Label' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, toRefs, watch } from 'vue'

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
      layout: {
        text: 'Label',
        textSize: 20,
        weight: 'normal',
        decoration: 'none',
        color: '#FFFFFF',
        align: 'center',
      },
      variableType: null,
    })
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
