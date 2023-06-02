<template>
  <div>
    <img :src="src" />
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
    }
  }
})

const src = computed(() => widget.value.options.src ?? '')
</script>

<style scoped>
img {
  object-fit: cover;
  width: 100%;
}
div {
  width: 100%;
  height: 100%;
}
</style>
