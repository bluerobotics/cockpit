<template>
  <div ref="videoWidget" class="video-widget">
    <div v-if="nameSelectedStream === undefined" class="no-video-alert">
      <span>No video stream selected.</span>
    </div>
    <div
      v-else-if="!namesAvailableStreams.isEmpty() && !namesAvailableStreams.includes(nameSelectedStream)"
      class="no-video-alert"
    >
      <p>The selected stream "{{ nameSelectedStream }}" is not available.</p>
      <p>Available ones are: {{ namesAvailableStreams.map((name) => `"${name}"`).join(', ') }}.</p>
      <br />
      <p>
        This can happen if you changed vehicles and the stream name in the new one is different from the former, or if
        the source is not available at all.
      </p>
      <br />
      <p>
        Please open this video player configuration and select a new stream from the ones available, or check your
        source for issues.
      </p>
    </div>
    <div v-else-if="!streamConnected" class="no-video-alert">
      <div class="no-video-alert">
        <p>
          <span class="text-xl font-bold">Server status: </span>
          <span v-for="(statusParagraph, i) in serverStatus.toString().split('\\n')" :key="i">
            {{ statusParagraph }}
            <br />
          </span>
        </p>
        <p>
          <span class="text-xl font-bold">Stream status: </span>
          <span v-for="(statusParagraph, i) in streamStatus.toString().split('\\n')" :key="i">
            {{ statusParagraph }}
            <br />
          </span>
        </p>
      </div>
    </div>
    <div v-else class="no-video-alert">
      <p>Loading stream...</p>
    </div>
    <video id="mainDisplayStream" ref="videoElement" muted autoplay playsinline disablePictureInPicture>
      Your browser does not support the video tag.
    </video>
  </div>
  <v-dialog v-model="widgetStore.widgetManagerVars(widget.hash).configMenuOpen" width="auto">
    <v-card class="pa-4 text-white" style="border-radius: 15px" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-center">Video widget config</v-card-title>
      <v-card-text class="flex flex-col gap-y-4">
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
          :color="widget.options.flipHorizontally ? 'white' : undefined"
          hide-details
        />
        <v-switch
          v-model="widget.options.flipVertically"
          class="my-1"
          label="Flip vertically"
          :color="widget.options.flipVertically ? 'white' : undefined"
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
import { computed, onBeforeMount, onBeforeUnmount, ref, toRefs, watch } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { isEqual } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useVideoStore } from '@/stores/video'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Widget } from '@/types/widgets'
const interfaceStore = useAppInterfaceStore()

const { showDialog } = useInteractionDialog()
const videoStore = useVideoStore()
const widgetStore = useWidgetManagerStore()

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
const streamConnected = ref(false)

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
      showDialog({ maxWidth: 600, title: 'Multiple streams detected', message: text, variant: 'info' })
    }
  }

  const updatedMediaStream = videoStore.getMediaStream(widget.value.options.streamName)
  // If the widget is not connected to the MediaStream, try to connect it
  if (!isEqual(updatedMediaStream, mediaStream.value)) {
    mediaStream.value = updatedMediaStream
  }

  const updatedStreamState = videoStore.getStreamData(widget.value.options.streamName)?.connected ?? false
  if (updatedStreamState !== streamConnected.value) {
    streamConnected.value = updatedStreamState
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

const serverStatus = computed(() => {
  if (nameSelectedStream.value === undefined) return 'Unknown.'
  return videoStore.getStreamData(nameSelectedStream.value)?.webRtcManager.signallerStatus ?? 'Unknown.'
})

const streamStatus = computed(() => {
  if (nameSelectedStream.value === undefined) return 'Unknown.'

  const availableSources = videoStore.availableIceIps
  if (!availableSources.isEmpty() && !availableSources.find((ip) => videoStore.allowedIceIps.includes(ip))) {
    return `Stream is coming from IPs [${availableSources.join(', ')}], which are not in the list of allowed sources
      [${videoStore.allowedIceIps.join(', ')}].\\n Please check your configuration.`
  }
  return videoStore.getStreamData(nameSelectedStream.value)?.webRtcManager.streamStatus ?? 'Unknown.'
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
  padding: 3rem;
  color: white;
  border: 2px solid rgb(0, 20, 80);
}
</style>
