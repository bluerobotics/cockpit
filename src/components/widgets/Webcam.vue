<template>
  <div class="w-full h-full">
    <video ref="videoElement" :style="videoStyles" autoplay playsinline></video>
    <v-dialog v-model="widgetStore.widgetManagerVars(widget.hash).configMenuOpen" min-width="400" max-width="35%">
      <v-card class="pa-2" :style="interfaceStore.globalGlassMenuStyles">
        <v-card-title class="text-center">Webcam Settings</v-card-title>
        <v-card-text>
          <div class="mt-4 flex justify-center space-x-4">
            <GlassButton icon="mdi-rotate-left" :icon-size="40" @click="rotateLeft" />
            <GlassButton icon="mdi-rotate-right" :icon-size="40" @click="rotateRight" />
            <GlassButton icon="mdi-flip-horizontal" :icon-size="40" @click="flipHorizontal" />
            <GlassButton icon="mdi-flip-vertical" :icon-size="40" @click="flipVertical" />
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
import { computed, onMounted, onUnmounted, ref, toRefs } from 'vue'

import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Widget } from '@/types/widgets'

import GlassButton from '@/components/GlassButton.vue'

const interfaceStore = useAppInterfaceStore()
const widgetStore = useWidgetManagerStore()

const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()

const widget = toRefs(props).widget

const videoElement = ref<HTMLVideoElement | null>(null)

const videoStyles = computed(() => {
  const rotation = widget.value.options.rotation || 0
  const flipHorizontal = widget.value.options.flipHorizontal ? -1 : 1
  const flipVertical = widget.value.options.flipVertical ? -1 : 1

  return {
    objectFit: widget.value.options.fitStyle,
    transform: `rotate(${rotation}deg) scale(${flipHorizontal}, ${flipVertical})`,
  }
})

const rotateLeft = (): void => {
  widget.value.options.rotation = widget.value.options.rotation - 90
}

const rotateRight = (): void => {
  widget.value.options.rotation = widget.value.options.rotation + 90
}

const flipHorizontal = (): void => {
  widget.value.options.flipHorizontal = !widget.value.options.flipHorizontal
}

const flipVertical = (): void => {
  widget.value.options.flipVertical = !widget.value.options.flipVertical
}

onMounted(async () => {
  if (Object.keys(widget.value.options).length === 0) {
    widget.value.options = {
      fitStyle: 'cover',
      rotation: 0,
      flipHorizontal: false,
      flipVertical: false,
    }
  }
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
  if (videoElement.value) {
    videoElement.value.srcObject = stream
  }
})

onUnmounted(() => {
  if (videoElement.value && videoElement.value.srcObject) {
    const mediaStream = videoElement.value.srcObject as MediaStream
    mediaStream.getTracks().forEach((track) => track.stop())
  }
})
</script>

<style scoped>
video {
  width: 100%;
  height: 100%;
  transition: transform 0.3s ease;
}
</style>
