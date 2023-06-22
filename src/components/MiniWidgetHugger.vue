<template>
  <div ref="miniWidgetHugger" class="relative flex items-center h-full mx-1 transition-all justify-space-between">
    <div ref="widgetComponent" class="transition-all">
      <slot></slot>
    </div>
    <div
      ref="deleteButton"
      class="transition-all z-[63] absolute flex items-center justify-center text-slate-50 hover:text-red-500 cursor-pointer top-1/2 right-4 -translate-y-2 h-4"
      :class="{ 'pointer-events-none opacity-0': !showWidgetRemoveButton }"
      @click="store.removeWidgetFromContainer(widget, container)"
    >
      <FontAwesomeIcon icon="fa-solid fa-trash" size="lg" class="transition-all" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useElementHover } from '@vueuse/core'
import { ref, toRefs } from 'vue'
import { watch } from 'vue'

import { useMiniWidgetsManagerStore } from '@/stores/miniWidgetsManager'
import type { MiniWidget, MiniWidgetContainer } from '@/types/miniWidgets'

// eslint-disable-next-line vue/valid-define-props
const props = defineProps<{
  // eslint-disable-next-line jsdoc/require-jsdoc
  widget: MiniWidget
  // eslint-disable-next-line jsdoc/require-jsdoc
  container: MiniWidgetContainer
}>()
const widget = toRefs(props).widget
const container = toRefs(props).container

const store = useMiniWidgetsManagerStore()

const deleteButton = ref<HTMLElement>()
const widgetComponent = ref<HTMLElement>()

let originalWidgetWidth: number | undefined = undefined
const showWidgetRemoveButton = ref(false)
const miniWidgetHugger = ref()
const hoveringWidget = useElementHover(miniWidgetHugger)

watch(hoveringWidget, (isHovered, wasHovered) => {
  if (widgetComponent.value === undefined || deleteButton.value === undefined) return
  if (!wasHovered && isHovered) {
    if (originalWidgetWidth === undefined) {
      originalWidgetWidth = miniWidgetHugger.value.getBoundingClientRect().width
    }
    if (originalWidgetWidth === undefined) return
    deleteButton.value.style.right = '4px'
    miniWidgetHugger.value.style.width = `${originalWidgetWidth + 28}px`
    showWidgetRemoveButton.value = true
  }
  if (wasHovered && !isHovered) {
    deleteButton.value.style.right = '16px'
    miniWidgetHugger.value.style.width = `${originalWidgetWidth}px`
    showWidgetRemoveButton.value = false
  }
})
</script>

<style>
.fa-circle-plus {
  color: whitesmoke;
}
.fa-circle-plus:hover {
  color: rgb(177, 179, 181);
}
</style>
