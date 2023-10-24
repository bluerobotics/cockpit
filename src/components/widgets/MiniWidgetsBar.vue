<template>
  <div class="flex flex-col items-center justify-center w-full h-full p-2 rounded-md bg-slate-600/50">
    <MiniWidgetContainer
      :container="widget.options.miniWidgetsContainer"
      :wrap="true"
      :allow-editing="widgetStore.editingMode"
      @choose-mini-widget="widget.managerVars.allowMoving = false"
      @unchoose-mini-widget="widget.managerVars.allowMoving = true"
    />
  </div>
</template>

<script setup lang="ts">
import { v4 as uuid } from 'uuid'
import { onBeforeMount, toRefs } from 'vue'

import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Widget } from '@/types/widgets'

import MiniWidgetContainer from '../MiniWidgetContainer.vue'

const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()
const widget = toRefs(props).widget

const widgetStore = useWidgetManagerStore()

onBeforeMount(() => {
  // Set initial widget options if they don't exist
  if (Object.keys(widget.value.options).length === 0) {
    widget.value.options = {
      miniWidgetsContainer: {
        name: uuid(),
        widgets: [],
      },
    }
  }
})
</script>
