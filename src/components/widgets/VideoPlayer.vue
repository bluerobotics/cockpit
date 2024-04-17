<template>
  <div ref="videoWidget" class="video-widget">
    <div v-if="nameSelectedStream === undefined" class="no-video-alert">
      <span>No video stream selected.</span>
    </div>
    <div v-else-if="!namesAvailableStreams.includes(nameSelectedStream)" class="no-video-alert">
      <p>The selected stream is not available.</p>
      <p>Please check its source or select another stream.</p>
    </div>
    <div v-else-if="mediaStream === undefined" class="no-video-alert">
      <span>Loading stream...</span>
    </div>
    <video id="mainDisplayStream" ref="videoElement" muted autoplay playsinline disablePictureInPicture>
      Your browser does not support the video tag.
    </video>
  </div>
  <v-dialog v-model="widget.managerVars.configMenuOpen" width="auto">
    <v-card class="pa-2">
      <v-card-title>Video widget config</v-card-title>
      <v-card-text>
        <v-select
          v-model="nameSelectedStream"
          label="Stream name"
          class="my-3"
          :items="namesAvailableStreams"
          item-title="name"
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
          item-title="style"
          density="compact"
          variant="outlined"
          no-data-text="No streams available."
          hide-details
          return-object
        />
        <v-banner-text>Saved stream name: "{{ widget.options.streamName }}"</v-banner-text>
        <v-switch
          v-model="widget.options.flipHorizontally"
          class="my-1"
          label="Flip horizontally"
          :color="widget.options.flipHorizontally ? 'rgb(0, 20, 80)' : undefined"
          hide-details
        />
        <v-switch
          v-model="widget.options.flipVertically"
          class="my-1"
          label="Flip vertically"
          :color="widget.options.flipVertically ? 'rgb(0, 20, 80)' : undefined"
          hide-details
        />
        <div class="flex-wrap justify-center d-flex ga-5">
          <v-btn prepend-icon="mdi-file-rotate-left" variant="outlined" @click="rotateVideo(-90)"> Rotate Left</v-btn>
          <v-btn prepend-icon="mdi-file-rotate-right" variant="outlined" @click="rotateVideo(+90)"> Rotate Right</v-btn>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import Swal from 'sweetalert2'
import { computed, onBeforeMount, onBeforeUnmount, ref, toRefs, watch } from 'vue'

import { isEqual } from '@/libs/utils'
import { useVideoStore } from '@/stores/video'
import type { Widget } from '@/types/widgets'

const videoStore = useVideoStore()
const { namesAvailableStreams } = storeToRefs(videoStore)

const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()

const widget = toRefs(props).widget

const nameSelectedStream = ref<string | undefined>()
const videoElement = ref<HTMLVideoElement | undefined>()
const mediaStream = ref<MediaStream | undefined>()

onBeforeMount(() => {
  // Set the default initial values that are not present in the widget options
  const defaultOptions = {
    videoFitStyle: 'cover',
    flipHorizontally: false,
    flipVertically: false,
    rotationAngle: 0,
    streamName: undefined as string | undefined,
  }
  widget.value.options = Object.assign({}, defaultOptions, widget.value.options)
  nameSelectedStream.value = widget.value.options.streamName
})

const streamConnectionRoutine = setInterval(() => {
  // If the video player widget is cold booted, assign the first stream to it
  if (widget.value.options.streamName === undefined && !namesAvailableStreams.value.isEmpty()) {
    widget.value.options.streamName = namesAvailableStreams.value[0]
    nameSelectedStream.value = widget.value.options.streamName

    // If there are multiple streams available, warn user that we chose one automatically and he should change if wanted
    if (namesAvailableStreams.value.length > 1) {
      const text = `You have multiple streams available, so we chose one randomly to start with.
        If you want to change it, please open the widget configuration on the edit-menu.`
      Swal.fire({ title: 'Multiple streams detected', text: text, icon: 'info', confirmButtonText: 'OK' })
    }
  }

  const updatedMediaStream = videoStore.getMediaStream(widget.value.options.streamName)
  // If the widget is not connected to the MediaStream, try to connect it
  if (!isEqual(updatedMediaStream, mediaStream.value)) {
    mediaStream.value = updatedMediaStream
  }
}, 1000)
onBeforeUnmount(() => clearInterval(streamConnectionRoutine))

watch(nameSelectedStream, () => {
  widget.value.options.streamName = nameSelectedStream.value
  mediaStream.value = undefined
})

watch(mediaStream, () => {
  if (!videoElement.value || !mediaStream.value) return
  videoElement.value.srcObject = mediaStream.value
  videoElement.value
    .play()
    .then(() => console.log('[VideoPlayer] Stream is playing'))
    .catch((reason) => {
      const msg = `Failed to play stream. Reason: ${reason}`
      console.error(`[VideoPlayer] ${msg}`)
    })
})

const rotateVideo = (angle: number): void => {
  widget.value.options.rotationAngle += angle
}

const flipStyle = computed(() => {
  return `scale(${widget.value.options.flipHorizontally ? -1 : 1}, ${widget.value.options.flipVertically ? -1 : 1})`
})

const rotateStyle = computed(() => {
  return `rotate(${widget.value.options.rotationAngle ?? 0}deg)`
})

const transformStyle = computed(() => {
  return `${flipStyle.value} ${rotateStyle.value}`
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
  transform: v-bind('transformStyle');
}
.no-video-alert {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background-color: rgb(0, 20, 60);
  text-align: center;
  vertical-align: middle;
  padding: 10px;
  color: white;
  border: 2px solid rgb(0, 20, 80);
}
</style>
