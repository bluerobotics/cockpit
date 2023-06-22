<template>
  <div ref="widgetBar" class="flex flex-col items-center justify-center w-full h-full p-2 rounded-md bg-slate-600/50">
    <MiniWidgetContainer
      :container="widget.options.miniWidgetsContainer"
      :wrap="true"
      :allow-editing="allowEditing || widgetStore.editingMode"
    />
    <button
      v-if="hovering || allowEditing"
      :class="{ 'text-slate-700': !allowEditing }"
      class="absolute top-0 right-0 m-1 transition-all text-slate-100"
      @click="allowEditing = !allowEditing"
    >
      <FontAwesomeIcon icon="fa-solid fa-pen" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { useElementHover } from '@vueuse/core'
import { v4 as uuid } from 'uuid'
import { toRefs } from 'vue'
import { onBeforeMount } from 'vue'
import { ref } from 'vue'

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
const allowEditing = ref(false)

const widgetBar = ref()
const hovering = useElementHover(widgetBar)

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
