<template>
  <div class="floating-inspector-container">
    <vue-draggable-resizable
      :drag-handle="'.drag-handle'"
      :w="650"
      :h="500"
      :min-width="300"
      :min-height="300"
      :handles="['tm', 'mr', 'bm', 'ml']"
    >
      <div class="mavlink-inspector-card pa-4" :style="interfaceStore.globalGlassMenuStyles">
        <div class="drag-handle flex items-center justify-between p-2 cursor-grab">
          <div class="text-lg font-bold">MAVLink Inspector</div>
          <v-btn icon size="small" variant="text" title="Close window" @click="props.onClose">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </div>

        <div class="max-h-[70vh] overflow-y-auto">
          <MAVLinkInspector />
        </div>
      </div>
    </vue-draggable-resizable>
  </div>
</template>

<script setup lang="ts">
import VueDraggableResizable from 'vue-draggable-resizable'

import MAVLinkInspector from '@/components/development/MAVLinkInspector.vue'
import { useAppInterfaceStore } from '@/stores/appInterface'

/**
 * Props for the FloatingMAVLinkInspector component
 * @property {Function} onClose - Callback function to close the window
 */
const props = defineProps<{
  /**
   * Callback function to close the floating window
   */
  onClose: () => void
}>()

const interfaceStore = useAppInterfaceStore()
</script>

<style scoped>
.floating-inspector-container {
  position: fixed;
  top: 20%;
  right: 300px;
  z-index: 1000000;
}

.mavlink-inspector-card {
  width: 870px;
  height: fit-content;
  border-radius: 8px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5);
  color: white;
}

.drag-handle {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 12px;
}
</style>
