<template>
  <div class="floating-component-container">
    <vue-draggable-resizable
      :drag-handle="'.drag-handle'"
      :w="width"
      :h="height"
      :min-width="minWidth"
      :min-height="minHeight"
      :handles="['tm', 'mr', 'bm', 'ml']"
      :z-index="zIndex"
    >
      <div class="floating-component-card pa-4" :style="interfaceStore.globalGlassMenuStyles">
        <div class="drag-handle flex items-center justify-between p-2 cursor-grab">
          <div class="text-lg font-bold">{{ title }}</div>
          <v-btn icon size="small" variant="text" title="Close window" @click="props.onClose">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </div>

        <div class="component-container max-h-[70vh] overflow-y-auto">
          <component :is="componentToRender" v-bind="componentProps" />
        </div>
      </div>
    </vue-draggable-resizable>
  </div>
</template>

<script setup lang="ts">
import { type ComponentPublicInstance } from 'vue'
import VueDraggableResizable from 'vue-draggable-resizable'

import { useAppInterfaceStore } from '@/stores/appInterface'

/**
 * Props for the FloatingComponentWrapper
 */
const props = defineProps<{
  /**
   * The component to render in the floating window
   */
  componentToRender: any // Use 'any' for component type to avoid import issues

  /**
   * Props to pass to the rendered component
   */
  componentProps?: Record<string, any>

  /**
   * Title of the floating window
   */
  title: string

  /**
   * Callback function to close the floating window
   */
  onClose: () => void

  /**
   * Initial width of the floating window
   */
  width?: number

  /**
   * Initial height of the floating window
   */
  height?: number

  /**
   * Minimum width of the floating window
   */
  minWidth?: number

  /**
   * Minimum height of the floating window
   */
  minHeight?: number

  /**
   * Z-index of the floating window
   */
  zIndex?: number
}>()

const interfaceStore = useAppInterfaceStore()

// Define default values for optional props
const width = props.width || 650
const height = props.height || 500
const minWidth = props.minWidth || 300
const minHeight = props.minHeight || 300
const zIndex = props.zIndex || 9999
</script>

<style scoped>
.floating-component-container {
  position: fixed;
  top: 20%;
  right: 300px;
  z-index: 1000000;
}

.floating-component-card {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5);
  color: white;
}

.drag-handle {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 12px;
}
</style>
