<template>
  <div class="w-full h-full">
    <!-- Some browsers only do autoplay if video is muted -->
    <video
      ref="videoPlayer"
      :key="widget.options.source"
      :autoplay="widget.options.autoplay"
      :controls="widget.options.controls"
      :loop="widget.options.loop"
      :muted="widget.options.muted"
    >
      <source :src="widget.options.source" />
    </video>
    <v-dialog v-model="widgetStore.widgetManagerVars(widget.hash).configMenuOpen" min-width="400" max-width="35%">
      <v-card class="pa-2" :style="interfaceStore.globalGlassMenuStyles">
        <v-card-title class="text-center">Video Source</v-card-title>
        <v-card-text>
          <a>Video Source</a>
          <v-text-field
            variant="filled"
            :model-value="widget.options.source"
            outlined
            @change="widget.options.source = $event.srcElement.value"
            @keydown.enter="widget.options.source = $event.srcElement.value"
          ></v-text-field>
          <div>
            <span class="text-xs font-semibold leading-3 text-slate-600">Fit style</span>
            <Dropdown
              v-model="widget.options.fitStyle"
              :options="['cover', 'fill', 'contain']"
              variant="outlined"
              class="max-w-[144px]"
            />
            <v-checkbox v-model="widget.options.autoplay" label="Autoplay" hide-details />
            <v-checkbox v-model="widget.options.controls" label="Controls" hide-details />
            <v-checkbox v-model="widget.options.loop" label="Loop" hide-details />
            <v-checkbox v-model="widget.options.muted" label="Muted" hide-details />
          </div>
        </v-card-text>
        <v-card-actions class="flex justify-end">
          <v-btn color="white" @click="widgetStore.widgetManagerVars(widget.hash).configMenuOpen = false">
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { onBeforeMount, ref, toRefs, watch } from 'vue'

import Dropdown from '@/components/Dropdown.vue'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Widget } from '@/types/widgets'

const interfaceStore = useAppInterfaceStore()

const widgetStore = useWidgetManagerStore()

const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()
const widget = toRefs(props).widget

const videoPlayer = ref()
watch(widget.value.options, () => {
  videoPlayer.value.pause()
  videoPlayer.value.play()
})

onBeforeMount(() => {
  if (Object.keys(widget.value.options).length !== 0) {
    return
  }

  widget.value.options = {
    source: '',
    fitStyle: 'cover',
    autoplay: true,
    controls: true,
    loop: true,
    muted: true,
  }
})
</script>
<style scoped>
video {
  object-fit: v-bind('widget.options.fitStyle');
  width: 100%;
  height: 100%;
}
</style>
