<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-[2500] pointer-events-none">
      <vue-draggable-resizable
        class="pointer-events-auto"
        :drag-handle="'.floating-drag-handle'"
        :parent="true"
        :x="initialX"
        :y="initialY"
        :w="initialW"
        :h="initialH"
        :min-width="minWidth"
        :min-height="minHeight"
        :class="{ 'floating-fullscreen': isFullscreen }"
      >
        <v-card
          class="flex flex-col w-full h-full text-white"
          :style="[interfaceStore.globalGlassMenuStyles, { borderRadius: isFullscreen ? '0' : '15px' }]"
        >
          <div class="floating-drag-handle flex items-center justify-between px-4 py-2 cursor-grab">
            <div class="flex items-center gap-2 min-w-0">
              <v-icon size="20">mdi-drag</v-icon>
              <span class="text-lg font-medium truncate">{{ title }}</span>
            </div>
            <div class="flex items-center">
              <v-btn
                icon
                size="30"
                variant="text"
                class="text-white cursor-pointer"
                :aria-label="isFullscreen ? $t('Exit full screen') : $t('Full screen')"
                @click="isFullscreen = !isFullscreen"
              >
                <v-icon>{{ isFullscreen ? 'mdi-fullscreen-exit' : 'mdi-fullscreen' }}</v-icon>
              </v-btn>
              <v-btn icon size="30" variant="text" class="text-white cursor-pointer" :aria-label="$t('Close')" @click="close">
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </div>
          </div>
          <div class="px-4 pb-4 flex-1 min-h-0">
            <slot />
          </div>
        </v-card>
      </vue-draggable-resizable>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useAppInterfaceStore } from '@/stores/appInterface'

const props = withDefaults(
  defineProps<{
    /** Whether the floating window is open (v-model) */
    modelValue: boolean
    /** Title shown in the window header */
    title?: string
    /** Initial window width in pixels (defaults to 70% of the viewport, capped) */
    initialWidth?: number
    /** Initial window height in pixels (defaults to 70% of the viewport, capped) */
    initialHeight?: number
    /** Minimum window width in pixels */
    minWidth?: number
    /** Minimum window height in pixels */
    minHeight?: number
  }>(),
  {
    title: '',
    initialWidth: undefined,
    initialHeight: undefined,
    minWidth: 320,
    minHeight: 240,
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const interfaceStore = useAppInterfaceStore()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const isFullscreen = ref(false)

const initialW = props.initialWidth ?? Math.round(Math.min(window.innerWidth * 0.7, 1100))
const initialH = props.initialHeight ?? Math.round(Math.min(window.innerHeight * 0.7, 600))
const initialX = Math.round((window.innerWidth - initialW) / 2)
const initialY = Math.round((window.innerHeight - initialH) / 2)

const close = (): void => {
  isOpen.value = false
}

// Always start non-fullscreen on the next open.
watch(isOpen, (open) => {
  if (!open) isFullscreen.value = false
})
</script>

<style scoped>
/* vue-draggable-resizable ships its handle CSS in a stylesheet that isn't imported globally, so style the
   handles here. The window must be absolutely positioned (the library moves/sizes it via transform + width/
   height); otherwise resizing from a corner would grow it symmetrically. Handles are kept invisible but
   grabbable. */
:deep(.vdr) {
  position: absolute;
  border: none;
}
:deep(.vdr .handle) {
  box-sizing: border-box;
  position: absolute;
  width: 14px;
  height: 14px;
  background: transparent;
  border: none;
}
:deep(.vdr .handle-tl) {
  top: -6px;
  left: -6px;
  cursor: nwse-resize;
}
:deep(.vdr .handle-tm) {
  top: -6px;
  left: 50%;
  margin-left: -6px;
  cursor: ns-resize;
}
:deep(.vdr .handle-tr) {
  top: -6px;
  right: -6px;
  cursor: nesw-resize;
}
:deep(.vdr .handle-ml) {
  top: 50%;
  margin-top: -6px;
  left: -6px;
  cursor: ew-resize;
}
:deep(.vdr .handle-mr) {
  top: 50%;
  margin-top: -6px;
  right: -6px;
  cursor: ew-resize;
}
:deep(.vdr .handle-bl) {
  bottom: -6px;
  left: -6px;
  cursor: nesw-resize;
}
:deep(.vdr .handle-bm) {
  bottom: -6px;
  left: 50%;
  margin-left: -6px;
  cursor: ns-resize;
}
:deep(.vdr .handle-br) {
  bottom: -6px;
  right: -6px;
  cursor: nwse-resize;
}

/* Full-screen mode: override the library's inline transform/size so the window fills the viewport. */
:deep(.vdr.floating-fullscreen) {
  transform: none !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
}
:deep(.vdr.floating-fullscreen .handle) {
  display: none;
}
</style>
