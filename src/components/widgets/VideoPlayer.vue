<template>
  <div class="video-widget">
    <div v-if="selectedPeer === undefined" class="no-video-alert">
      <span>No video stream selected.</span>
    </div>
    <video ref="videoElement" muted loop autoplay disablePictureInPicture>
      Your browser does not support the video tag.
    </video>
    <v-btn
      class="options-btn"
      icon="mdi-dots-vertical"
      size="x-small"
      variant="text"
      flat
      @click="showOptionsDialog = !showOptionsDialog"
    />
  </div>
  <v-dialog v-model="showOptionsDialog">
    <v-card class="pa-2">
      <v-card-title>Video widget config</v-card-title>
      <v-card-text>
        <v-select
          v-model="selectedPeer"
          label="Video source"
          class="my-3"
          :items="availablePeers"
          item-title="displayName"
          density="compact"
          variant="outlined"
          no-data-text="No streams available."
          hide-details
          return-object
        />
        <v-select
          v-model="widget.options.videoFitStyle"
          label="Fit style"
          class="my-3"
          :items="['cover', 'fill', 'contain']"
          item-title="displayName"
          density="compact"
          variant="outlined"
          no-data-text="No streams available."
          hide-details
          return-object
        />
        <v-switch
          v-model="widget.options.flipHorizontally"
          class="my-1"
          label="Flip horizontally"
          hide-details
        />
        <v-switch
          v-model="widget.options.flipVertically"
          class="my-1"
          label="Flip vertically"
          hide-details
        />
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, toRefs, watch } from 'vue'

import useWebRtcStream from '@/composables/webRTC'
import type { RtcPeer } from '@/types/webrtc'
import type { Widget } from '@/types/widgets'

const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()

const widget = toRefs(props).widget

const selectedPeer = ref<RtcPeer | undefined>()
const showOptionsDialog = ref(false)
const videoElement = ref<HTMLVideoElement | undefined>()

const { availablePeers, stream } = useWebRtcStream(selectedPeer)

onMounted(() => {
  // Set initial widget options if they don't exist
  if (Object.keys(widget.value.options).length === 0) {
    widget.value.options = {
      videoFitStyle: 'cover',
      flipHorizontally: false,
      flipVertically: false,
    }
  }
})

watch(stream, async (newStream, oldStream) => {
  console.debug('Stream changed.', oldStream, newStream)
  if (videoElement.value !== undefined && newStream !== undefined) {
    videoElement.value.srcObject = newStream
    videoElement.value.play()
  }
})

const flipStyle = computed(() => {
  return `scale(${widget.value.options.flipHorizontally ? -1 : 1}, ${
    widget.value.options.flipVertically ? -1 : 1
  })`
})
</script>

<style scoped>
.video-widget {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
video {
  height: 100%;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
  object-fit: v-bind('widget.options.videoFitStyle');
  transform: v-bind('flipStyle');
}
.no-video-alert {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background-color: rgb(143, 183, 236);
  text-align: center;
  vertical-align: middle;
  padding: 10px;
  border: 2px solid rgb(123, 163, 216);
}
.options-btn {
  display: none;
  position: absolute;
  margin: 5px;
  top: 0;
  right: 0;
}
.video-widget:hover .options-btn {
  display: block;
}
</style>
