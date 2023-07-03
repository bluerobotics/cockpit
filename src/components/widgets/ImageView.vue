<template>
  <div class="w-full h-full">
    <img :src="src" draggable="false" />
    <v-btn
      class="options-btn"
      icon="mdi-dots-vertical"
      size="x-small"
      variant="text"
      flat
      @click="showOptionsDialog = !showOptionsDialog"
    />
    <v-dialog v-model="showOptionsDialog" min-width="400" max-width="35%">
      <v-card class="pa-2">
        <v-card-title>Image URL</v-card-title>
        <v-card-text>
          <v-text-field
            label="Image URL"
            :model-value="widget.options.src"
            outlined
            @change="widget.options.src = $event.srcElement.value"
          ></v-text-field>
          <div>
            <span class="text-xs font-semibold leading-3 text-slate-600">Fit style</span>
            <Dropdown v-model="widget.options.fitStyle" :options="['cover', 'fill', 'contain']" class="max-w-[144px]" />
          </div>
        </v-card-text>
        <v-card-actions>
          <v-btn color="primary" text @click="showOptionsDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, toRefs } from 'vue'

import type { Widget } from '@/types/widgets'

import Dropdown from '../Dropdown.vue'

const showOptionsDialog = ref(false)
const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()
const widget = toRefs(props).widget

onBeforeMount(() => {
  // Set initial widget options if they don't exist
  if (Object.keys(widget.value.options).length === 0) {
    widget.value.options = {
      src: '',
      fitStyle: 'cover',
    }
  }
})

const src = computed(() => widget.value.options.src ?? '')
</script>

<style scoped>
img {
  object-fit: v-bind('widget.options.fitStyle');
  width: 100%;
  height: 100%;
}
</style>
