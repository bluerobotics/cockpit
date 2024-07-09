<template>
  <div class="flex h-full w-full flex-col items-center justify-center rounded-md bg-slate-600/50 p-2">
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
import { capitalize, onBeforeMount, toRefs } from 'vue'

import * as Words from '@/libs/funny-name/words'
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
        name: `${capitalize(Words.animalsOcean.random() || 'Plankton')} floating container`,
        widgets: [],
      },
    }
  }
})
</script>
