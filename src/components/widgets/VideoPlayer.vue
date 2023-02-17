<template>
  <div ref="videoWidget" class="video-widget">
    <div v-if="selectedStream === undefined" class="no-video-alert">
      <span>No video stream selected.</span>
    </div>
    <video ref="videoElement" muted autoplay playsinline disablePictureInPicture>
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
  <v-dialog v-model="showOptionsDialog" width="auto">
    <v-card class="pa-2">
      <v-card-title>Video widget config</v-card-title>
      <v-card-text>
        <v-select
          v-model="selectedStream"
          label="Stream name"
          class="my-3"
          :items="availableStreams"
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
        <v-banner-text>Signaller Status: {{ signallerStatus }}</v-banner-text>
        <v-banner-text>Stream Status: {{ streamStatus }}</v-banner-text>
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
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useMouseInElement } from '@vueuse/core'
import { computed, onBeforeMount, onBeforeUnmount, ref, toRefs, watch } from 'vue'
import adapter from 'webrtc-adapter'

import { WebRTCManager } from '@/composables/webRTC'
import type { Stream } from '@/libs/webrtc/signalling_protocol'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import type { Widget } from '@/types/widgets'

const { webRTCSignallingURI } = useMainVehicleStore()

const globalAddress = 'blueos.local'

console.debug('[WebRTC] Using webrtc-adapter for', adapter.browserDetails)

const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()

const widget = toRefs(props).widget

const rtcConfiguration = {
  bundlePolicy: 'max-bundle',
  iceServers: [
    {
      urls: `turn:${globalAddress}:3478`,
      username: 'user',
      credential: 'pwd',
    },
    {
      urls: `stun:${globalAddress}:3478`,
    },
  ],
  // eslint-disable-next-line no-undef
} as RTCConfiguration

const selectedStream = ref<Stream | undefined>()
const showOptionsDialog = ref(false)
const videoElement = ref<HTMLVideoElement | undefined>()
const webRTCManager = new WebRTCManager(webRTCSignallingURI.val, rtcConfiguration)
const { availableStreams, mediaStream, signallerStatus, streamStatus } = webRTCManager.startStream(selectedStream)

onBeforeMount(() => {
  // Set initial widget options if they don't exist
  if (Object.keys(widget.value.options).length === 0) {
    widget.value.options = {
      videoFitStyle: 'cover',
      flipHorizontally: false,
      flipVertically: false,
      streamName: undefined as string | undefined,
    }
  }
})

onBeforeUnmount(() => {
  webRTCManager.close('WebRTC Widget was removed')
})

watch(mediaStream, async (newStream, oldStream) => {
  console.debug(`[WebRTC] Stream changed. From: ${oldStream?.id} to ${newStream?.id}`)
  if (videoElement.value === undefined || newStream === undefined) {
    return
  }

  widget.value.options.streamName = selectedStream.value?.name
  videoElement.value.srcObject = newStream
  videoElement.value
    .play()
    .then(() => {
      console.log('[VideoPlayer] Stream is playing')
    })
    .catch((reason) => {
      const msg = `Failed to play stream. Reason: ${reason}`
      console.log(`[VideoPlayer] ${msg}`)
      streamStatus.value = msg
    })
})

watch(availableStreams, () => {
  const savedStreamName: string | undefined = widget.value.options.streamName
  if (availableStreams.value.isEmpty()) {
    return
  }

  // Retrieve stream from the savedStreamName, otherwise choose the first available stream as a fallback
  const savedStream =
    savedStreamName !== undefined
      ? availableStreams.value.find((s) => s.name === savedStreamName)
      : availableStreams.value.first()

  if (savedStream !== undefined && savedStream !== selectedStream.value) {
    console.debug!('[WebRTC] trying to set stream...')
    selectedStream.value = savedStream
  }
})

const flipStyle = computed(() => {
  return `scale(${widget.value.options.flipHorizontally ? -1 : 1}, ${widget.value.options.flipVertically ? -1 : 1})`
})

const videoWidget = ref()
const { isOutside } = useMouseInElement(videoWidget)
const mouseOverWidgetStyle = computed(() => (isOutside.value ? 'none' : 'block'))
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
  background-color: rgb(0, 20, 60);
  text-align: center;
  vertical-align: middle;
  padding: 10px;
  color: white;
  border: 2px solid rgb(0, 20, 80);
}
.options-btn {
  display: none;
  position: absolute;
  margin: 5px;
  top: 0;
  right: 0;
  color: white;
  filter: drop-shadow(2px 2px black);
  display: v-bind('mouseOverWidgetStyle');
}
</style>
