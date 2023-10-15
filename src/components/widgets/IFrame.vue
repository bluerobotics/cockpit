<template>
  <div class="w-full h-full relative">
    <iframe
      v-show="iframe_loaded"
      :src="widget.options.source"
      frameborder="0"
      height="100%"
      width="100%"
      @load="loadFinished"
    />
    <v-dialog v-model="widget.managerVars.configMenuOpen" min-width="400" max-width="35%">
      <v-card class="pa-2">
        <v-card-title>Iframe Source</v-card-title>
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
        <v-card-actions>
          <v-btn color="primary" @click="widget.managerVars.configMenuOpen = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { defineProps, onBeforeMount, ref, toRefs } from 'vue'

import type { Widget } from '@/types/widgets'

const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()
const widget = toRefs(props).widget

const iframe_loaded = ref(false)

onBeforeMount(() => {
  if (Object.keys(widget.value.options).length !== 0) {
    return
  }

  widget.value.options = {
    source: 'http://blueos.local',
  }
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
}
</style>
