<template>
  <div class="w-full h-full relative">
    <iframe
      v-show="iframe_loaded"
      :src="widget.options.source"
      :style="iframeStyle"
      frameborder="0"
      height="100%"
      width="100%"
      @load="loadFinished"
    />
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

const iframeStyle = computed<string>(() => {
  if (widgetManagerStore.editingMode) {
    return 'pointer-events:none; border:0;'
  }
  return ''
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
