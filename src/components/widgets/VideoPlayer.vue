<template>
  <div ref="videoWidget" class="video-widget">
    <statsForNerds v-if="widget.options.statsForNerds" :stream-name="externalStreamId" />
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
  <v-dialog v-model="widgetStore.widgetManagerVars(widget.hash).configMenuOpen" :width="debugPanelExpanded ? 800 : 500">
    <v-card class="pa-4" :style="interfaceStore.globalGlassMenuStyles" style="border-radius: 15px">
      <v-card-title class="text-center">Video widget config</v-card-title>
      <v-card-text>
        <!-- Stream Selection (centered, alone) -->
        <div class="d-flex justify-center mb-4">
          <v-select
            v-model="nameSelectedStream"
            label="Stream name"
            :items="namesAvailableStreams"
            item-title="name"
            density="compact"
            variant="outlined"
            no-data-text="No streams available."
            hide-details
            return-object
            style="max-width: 300px"
          />
        </div>

        <!-- Display Options: Switches (left) + Fit Style (right) -->
        <div class="d-flex justify-center gap-12 my-6">
          <!-- Switches column -->
          <div class="d-flex flex-column">
            <v-switch
              v-model="widget.options.flipHorizontally"
              label="Flip horizontally"
              :color="widget.options.flipHorizontally ? 'white' : undefined"
              density="compact"
              hide-details
            />
            <v-switch
              v-model="widget.options.flipVertically"
              label="Flip vertically"
              :color="widget.options.flipVertically ? 'white' : undefined"
              density="compact"
              hide-details
            />
            <v-switch
              v-model="widget.options.statsForNerds"
              label="Stats for nerds"
              :color="widget.options.statsForNerds ? 'white' : undefined"
              density="compact"
              hide-details
            />
          </div>

          <!-- Fit style radio group column -->
          <div class="d-flex flex-column">
            <span class="text-caption opacity-70 mb-1">Fit style</span>
            <v-radio-group v-model="widget.options.videoFitStyle" density="compact" hide-details>
              <v-radio label="Cover" value="cover" />
              <v-radio label="Fill" value="fill" />
              <v-radio label="Contain" value="contain" />
            </v-radio-group>
          </div>
        </div>

        <!-- Actions -->
        <div class="d-flex justify-center align-center gap-2 mb-2">
          <v-btn icon="mdi-rotate-left" variant="text" @click="rotateVideo(-90)" />
          <v-btn icon="mdi-rotate-right" variant="text" @click="rotateVideo(+90)" />
          <v-btn
            prepend-icon="mdi-reload"
            variant="text"
            :disabled="!nameSelectedStream || isReloading || !hasBeenMountedFor5Seconds"
            :loading="isReloading"
            @click="reloadVideo"
          >
            Reload stream
          </v-btn>
        </div>

        <v-progress-linear
          v-if="isReloading"
          :model-value="reloadProgress"
          color="white"
          height="4"
          rounded
          class="mb-4"
        />

        <!-- Debug Console (Collapsible) -->
        <v-expansion-panels v-model="debugPanelExpanded" variant="accordion" class="mt-6">
          <v-expansion-panel value="debug" class="bg-[#FFFFFF11]">
            <v-expansion-panel-title class="text-white">Debug console</v-expansion-panel-title>
            <v-expansion-panel-text class="pa-0">
              <WebRTCDebugConsole v-if="debugStreamId" :stream-id="debugStreamId" />
              <div v-else class="text-center opacity-60 py-4">Select a stream to view debug logs.</div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onBeforeMount, onBeforeUnmount, ref, toRefs, watch } from 'vue'

import StatsForNerds from '@/components/VideoPlayerStatsForNerds.vue'
import WebRTCDebugConsole from '@/components/WebRTCDebugConsole.vue'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useVideoStore } from '@/stores/video'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Widget } from '@/types/widgets'
const interfaceStore = useAppInterfaceStore()

const videoStore = useVideoStore()
const widgetStore = useWidgetManagerStore()

const { namessAvailableAbstractedStreams: namesAvailableStreams } = storeToRefs(videoStore)

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
const isReloading = ref(false)
const reloadProgress = ref(0)
const previousStream = ref<string | undefined>()
const hasBeenMountedFor5Seconds = ref(false)
const debugPanelExpanded = ref<string | undefined>()

onBeforeMount(() => {
  // Set the default initial values that are not present in the widget options
  const defaultOptions = {
    videoFitStyle: 'cover',
    flipHorizontally: false,
    flipVertically: false,
    rotationAngle: 0,
    statsForNerds: false,
    internalStreamName: undefined as string | undefined,
  }
  widget.value.options = Object.assign({}, defaultOptions, widget.value.options)
  nameSelectedStream.value = widget.value.options.internalStreamName

  // Set the 5-second delay before showing reload buttons
  setTimeout(() => {
    hasBeenMountedFor5Seconds.value = true
  }, 5000)
})

const externalStreamId = computed(() => {
  return nameSelectedStream.value ? videoStore.externalStreamId(nameSelectedStream.value) : undefined
})

watch(
  () => videoStore.streamsCorrespondency,
  () => {
    mediaStream.value = undefined

    if (!nameSelectedStream.value) return

    const selectedExternalId = videoStore.externalStreamId(nameSelectedStream.value)
    if (!selectedExternalId) return

    const newStreamCorr = videoStore.streamsCorrespondency.find((stream) => stream.externalId === selectedExternalId)
    if (!newStreamCorr) return

    const newInternalName = newStreamCorr.name

    if (nameSelectedStream.value !== newInternalName) {
      nameSelectedStream.value = newInternalName
      widget.value.options.internalStreamName = newInternalName
    }
  },
  { deep: true }
)

const streamConnectionRoutine = setInterval(() => {
  // If the video player widget is cold booted, assign the first stream to it
  if (widget.value.options.internalStreamName === undefined && !namesAvailableStreams.value.isEmpty()) {
    widget.value.options.internalStreamName = namesAvailableStreams.value[0]
    nameSelectedStream.value = widget.value.options.internalStreamName
  }

  if (externalStreamId.value !== undefined) {
    const updatedMediaStream = videoStore.getMediaStream(externalStreamId.value)
    // If the widget is not connected to the MediaStream, try to connect it
    // Use reference comparison for MediaStream objects, not deep equality, as the media stream can be the same with one
    // or more attributes having changed.
    if (updatedMediaStream !== mediaStream.value) {
      mediaStream.value = updatedMediaStream
    }

    const updatedStreamState = videoStore.getStreamData(externalStreamId.value)?.connected ?? false
    if (updatedStreamState !== streamConnected.value) {
      streamConnected.value = updatedStreamState
    }
  }

  if (!namesAvailableStreams.value.isEmpty() && !namesAvailableStreams.value.includes(nameSelectedStream.value!)) {
    if (videoStore.lastRenamedStreamName !== '') {
      nameSelectedStream.value = videoStore.lastRenamedStreamName
      return
    }
    nameSelectedStream.value = namesAvailableStreams.value[0]
  }
}, 1000)
onBeforeUnmount(() => clearInterval(streamConnectionRoutine))

watch(nameSelectedStream, () => {
  widget.value.options.internalStreamName = nameSelectedStream.value
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

const reloadVideo = (): void => {
  if (isReloading.value || !nameSelectedStream.value) return

  // Store the current stream to re-select later
  previousStream.value = nameSelectedStream.value
  isReloading.value = true
  reloadProgress.value = 0

  // Clear the current stream
  nameSelectedStream.value = undefined

  // Progress bar animation
  const progressInterval = setInterval(() => {
    reloadProgress.value += 100 / 30 // Update 30 times over 3 seconds
    if (reloadProgress.value >= 100) {
      clearInterval(progressInterval)
    }
  }, 100)

  // Re-select the stream after 3 seconds
  setTimeout(() => {
    nameSelectedStream.value = previousStream.value
    isReloading.value = false
    reloadProgress.value = 0
    clearInterval(progressInterval)
  }, 3000)
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
  if (externalStreamId.value === undefined) return 'Unknown.'
  return videoStore.getStreamData(externalStreamId.value)?.webRtcManager.signallerStatus ?? 'Unknown.'
})

const streamStatus = computed(() => {
  if (externalStreamId.value === undefined) return 'Unknown.'

  const availableSources = videoStore.availableIceIps
  if (!availableSources.isEmpty() && !availableSources.find((ip) => videoStore.allowedIceIps.includes(ip))) {
    return `Stream is coming from IPs [${availableSources.join(', ')}], which are not in the list of allowed sources
      [${videoStore.allowedIceIps.join(', ')}].\\n Please check your configuration.`
  }
  return videoStore.getStreamData(externalStreamId.value)?.webRtcManager.streamStatus ?? 'Unknown.'
})

const debugStreamId = computed(() => {
  if (!externalStreamId.value) return undefined
  const streamData = videoStore.getStreamData(externalStreamId.value)
  return streamData?.webRtcManager.getDebugStreamId()
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
  transform: v-bind('transformStyle');
}
video {
  height: 100%;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
  object-fit: v-bind('widget.options.videoFitStyle');
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

.reload-section {
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.reload-button {
  border-color: rgba(255, 255, 255, 0.6) !important;
  color: white !important;
  transition: all 0.3s ease;
}

.reload-button:hover {
  border-color: white !important;
  background-color: rgba(255, 255, 255, 0.1) !important;
  transform: rotate(90deg);
}

.reload-progress-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.reload-icon {
  animation: spin 2s linear infinite;
}

.reload-progress-bar {
  width: 200px;
  max-width: 80%;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.reload-progress-config {
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>
