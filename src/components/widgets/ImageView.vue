<template>
  <div class="w-full h-full">
    <img :src="src" draggable="false" />
    <v-dialog v-model="widgetStore.widgetManagerVars(widget.hash).configMenuOpen" min-width="400" max-width="35%">
      <v-card class="pa-2" :style="interfaceStore.globalGlassMenuStyles">
        <v-card-title class="text-center">Image URL</v-card-title>
        <v-card-text>
          <a>Image URL</a>
          <v-text-field
            :model-value="widget.options.src"
            outlined
            @change="widget.options.src = $event.srcElement.value"
          ></v-text-field>
          <div>
            <span class="text-xs font-semibold leading-3 text-slate-600">Fit style</span>
            <Dropdown
              v-model="widget.options.fitStyle"
              :options="['cover', 'fill', 'contain']"
              class="max-w-[144px]"
              theme="dark"
            />
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
import { computed, onBeforeMount, toRefs } from 'vue'

import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Widget } from '@/types/widgets'
const interfaceStore = useAppInterfaceStore()

import Dropdown from '../Dropdown.vue'

const widgetStore = useWidgetManagerStore()

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
