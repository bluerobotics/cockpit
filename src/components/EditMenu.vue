<template>
  <WidgetHugger
    :position="{ x: 500, y: 200 }"
    :size="{ width: 500, height: 400 }"
    :snap-to-grid="false"
    :allow-resizing="false"
    :allow-ordering="false"
    :allow-deleting="false"
  >
    <div class="menu">
      <v-card class="pa-3 card" width="500">
        <v-card-title>Edit menu</v-card-title>
        <template v-if="selectedLayer !== undefined">
          <v-card-subtitle class="mt-4">Layer</v-card-subtitle>
          <div class="d-flex align-center ma-2">
            <v-select
              v-model="selectedLayer"
              :items="store.availableLayers"
              density="compact"
              variant="outlined"
              no-data-text="No layers available."
              hide-details
            />
            <v-btn
              class="ml-2"
              icon="mdi-delete"
              size="small"
              rounded="lg"
              @click="deleteLayer"
            />
          </div>
          <v-card-subtitle class="mt-4">Widgets</v-card-subtitle>
          <template v-if="selectedLayer.widgets.length > 0">
            <li
              v-for="widget in selectedLayer.widgets"
              :key="widget.hash"
              class="pl-6"
            >
              {{ widget.component }}
            </li>
          </template>
          <p v-else class="pl-6">No widgets in layer.</p>
          <div class="d-flex align-center ma-3">
            <v-select
              v-model="selectedWidgetType"
              :items="availableWidgetTypes"
              density="compact"
              variant="outlined"
              hide-details
            />
            <v-btn
              class="ml-2"
              icon="mdi-plus"
              size="small"
              rounded="lg"
              @click="store.addWidget(selectedWidgetType, selectedLayer.hash)"
            />
          </div>
        </template>
        <v-card-actions>
          <v-btn class="ma-1" @click="addLayer">Add new layer</v-btn>
          <v-switch
            class="ma-1"
            label="Grid"
            :model-value="showGrid"
            hide-details
            @change="emit('update:showGrid', !showGrid)"
          />
        </v-card-actions>
      </v-card>
    </div>
  </WidgetHugger>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { useWidgetManagerStore } from '@/stores/widgetManager'
import { type Layer, WidgetType } from '@/types/widgets'

import WidgetHugger from './WidgetHugger.vue'

const store = useWidgetManagerStore()

defineProps<{ showGrid: boolean }>()

const emit = defineEmits<{
  (e: 'update:showGrid', showGrid: boolean): void
}>()

const availableWidgetTypes = computed(() => Object.values(WidgetType))
const selectedWidgetType = ref<WidgetType>(availableWidgetTypes.value[0])
const selectedLayer = ref<Layer>(store.layers[0])

const deleteLayer = (): void => {
  store.deleteLayer(selectedLayer.value.hash)
  selectedLayer.value = store.layers[store.layers.length - 1]
}
const addLayer = (): void => {
  store.addLayer()
  selectedLayer.value = store.layers[store.layers.length - 1]
}
</script>

<style scoped>
.menu {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.card {
  height: 100%;
}
</style>
