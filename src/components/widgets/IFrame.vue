<template>
  <div class="h-full w-full">
    <teleport to=".widgets-view">
      <iframe
        v-show="iframe_loaded"
        :src="widget.options.source"
        :style="iframeStyle"
        frameborder="0"
        @load="loadFinished"
      />
    </teleport>
    <v-dialog v-model="widget.managerVars.configMenuOpen" min-width="400" max-width="35%">
      <v-card class="pa-2">
        <v-card-title>Settings</v-card-title>
        <v-card-text>
          <v-text-field
            label="Iframe Source"
            variant="underlined"
            :model-value="widget.options.source"
            outlined
            @change="widget.options.source = $event.srcElement.value"
            @keydown.enter="widget.options.source = $event.srcElement.value"
          />
        </v-card-text>
        <v-card-text>
          <v-slider v-model="transparency" label="Transparency" :min="0" :max="90" />
        </v-card-text>
        <v-card-actions>
          <v-btn color="primary" @click="widget.managerVars.configMenuOpen = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import { computed, defineProps, onBeforeMount, ref, toRefs } from 'vue'

import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Widget } from '@/types/widgets'

const widgetManagerStore = useWidgetManagerStore()

const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()
const widget = toRefs(props).widget

const iframe_loaded = ref(false)
const transparency = ref(0)

onBeforeMount(() => {
  if (Object.keys(widget.value.options).length !== 0) {
    return
  }

  widget.value.options = {
    source: 'http://blueos.local',
  }
})

const { width: windowWidth, height: windowHeight } = useWindowSize()

const iframeStyle = computed<string>(() => {
  let newStyle = ''

  newStyle = newStyle.concat(' ', 'position: absolute;')
  newStyle = newStyle.concat(' ', `left: ${widget.value.position.x * windowWidth.value}px;`)
  newStyle = newStyle.concat(' ', `top: ${widget.value.position.y * windowHeight.value}px;`)
  newStyle = newStyle.concat(' ', `width: ${widget.value.size.width * windowWidth.value}px;`)
  newStyle = newStyle.concat(' ', `height: ${widget.value.size.height * windowHeight.value}px;`)

  if (widgetManagerStore.editingMode) {
    newStyle = newStyle.concat(' ', 'pointer-events:none; border:0;')
  }

  if (!widgetManagerStore.isWidgetVisible(widget.value)) {
    newStyle = newStyle.concat(' ', 'display: none;')
  }

  return newStyle
})

const iframeOpacity = computed<number>(() => {
  return (100 - transparency.value) / 100
})

/**
 * Called when iframe finishes loading
 */
function loadFinished(): void {
  console.log('Finished loading')
  iframe_loaded.value = true
}
</script>

<style scoped>
iframe {
  width: 100%;
  height: 100%;
  border: none;
  flex-grow: 1;
  margin: 0;
  padding: 0;
  opacity: calc(v-bind('iframeOpacity'));
}
</style>
