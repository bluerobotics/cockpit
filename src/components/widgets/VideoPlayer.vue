<template>
  <div ref="videoWidget" class="video-widget">
    <statsForNerds v-if="widget.options.statsForNerds" :stream-name="externalStreamId" />
    <div v-if="nameSelectedStream === undefined" class="no-video-alert">
      <span>{{ $t('components.widgets.VideoPlayer.noVideoStreamSelected') }}</span>
    </div>
    <div
      v-else-if="!namesAvailableStreams.isEmpty() && !namesAvailableStreams.includes(nameSelectedStream)"
      class="no-video-alert"
    >
      <p>{{ $t('components.widgets.VideoPlayer.streamNotAvailable', { streamName: nameSelectedStream }) }}</p>
      <p>
        {{
          $t('components.widgets.VideoPlayer.availableStreams', {
            streams: namesAvailableStreams.map((name) => `"${name}"`).join(', '),
          })
        }}
      </p>
      <br />
      <p>
        {{ $t('components.widgets.VideoPlayer.streamChangeInfo') }}
      </p>
      <br />
      <p>
        {{ $t('components.widgets.VideoPlayer.selectNewStream') }}
        source for issues.
      </p>
    </div>
    <Transition name="loading-complete">
      <div v-if="showLoadingOverlay" class="loading-overlay">
        <div v-if="showSuccessState" class="success-icon mb-4">
          <v-icon size="48" color="white">mdi-check-circle</v-icon>
        </div>
        <v-progress-circular v-else indeterminate color="white" size="48" width="3" class="mb-4" />
        <p class="loading-text">{{ loadingMessage }}</p>
        <div v-if="shouldShowVerboseLoading && !streamConnected && !showSuccessState" class="verbose-status">
          <p class="status-line">
            <span class="status-label">Server: </span>
            <span v-for="(statusParagraph, i) in serverStatus.toString().split('\\n')" :key="'server-' + i">
              {{ statusParagraph }}
            </span>
          </p>
          <p class="status-line">
            <span class="status-label">Stream: </span>
            <span v-for="(statusParagraph, i) in streamStatus.toString().split('\\n')" :key="'stream-' + i">
              {{ statusParagraph }}
            </span>
          </p>
        </div>
        <v-btn
          v-if="!streamConnected && !showSuccessState"
          variant="text"
          size="small"
          class="mt-3 toggle-details-btn"
          @click="toggleVerboseLoading"
        >
          {{ shouldShowVerboseLoading ? $t('components.widgets.VideoPlayer.hideDetails') : $t('components.widgets.VideoPlayer.showDetails') }}
        </v-btn>
      </div>
    </Transition>
    <video id="mainDisplayStream" ref="videoElement" muted autoplay playsinline disablePictureInPicture>
      Your browser does not support the video tag.
    </video>
  </div>
  <v-dialog v-model="widgetStore.widgetManagerVars(widget.hash).configMenuOpen" width="auto">
    <v-card class="pa-4 text-white" style="border-radius: 15px" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-center">{{ $t('components.widgets.VideoPlayer.widgetConfig') }}</v-card-title>
      <v-card-text class="flex flex-col gap-y-4">
        <v-select
          v-model="nameSelectedStream"
          :label="$t('components.widgets.VideoPlayer.streamName')"
          class="my-3"
          :items="namesAvailableStreams"
          item-title="name"
          density="compact"
          variant="outlined"
          :no-data-text="$t('components.widgets.VideoPlayer.noStreamsAvailable')"
          hide-details
          return-object
        />
        <v-select
          v-model="widget.options.videoFitStyle"
          :label="$t('components.widgets.VideoPlayer.fitStyle')"
          class="my-3"
          :items="['cover', 'fill', 'contain']"
          item-title="style"
          density="compact"
          variant="outlined"
          :no-data-text="$t('components.widgets.VideoPlayer.noStreamsAvailable')"
          hide-details
          return-object
        />
        <v-banner-text>{{
          $t('components.widgets.VideoPlayer.savedStreamName', { name: widget.options.internalStreamName })
        }}</v-banner-text>
        <v-switch
          v-model="widget.options.flipHorizontally"
          class="my-1"
          :label="$t('components.widgets.VideoPlayer.flipHorizontally')"
          :color="widget.options.flipHorizontally ? 'white' : undefined"
          hide-details
        />
        <v-switch
          v-model="widget.options.flipVertically"
          class="my-1"
          :label="$t('components.widgets.VideoPlayer.flipVertically')"
          :color="widget.options.flipVertically ? 'white' : undefined"
          hide-details
        />
        <v-switch
          v-model="widget.options.statsForNerds"
          class="my-1"
          :label="$t('components.widgets.VideoPlayer.statsForNerds')"
          :color="widget.options.statsForNerds ? 'white' : undefined"
          hide-details
        />
        <v-switch
          v-model="widget.options.showVerboseLoading"
          class="my-1"
          label="Verbose loading status"
          :color="widget.options.showVerboseLoading ? 'white' : undefined"
          hide-details
        />
        <div class="flex-wrap justify-center d-flex ga-5">
          <v-btn prepend-icon="mdi-file-rotate-left" variant="outlined" @click="rotateVideo(-90)">
            {{ $t('components.widgets.VideoPlayer.rotateLeft') }}</v-btn
          >
          <v-btn prepend-icon="mdi-file-rotate-right" variant="outlined" @click="rotateVideo(+90)">
            {{ $t('components.widgets.VideoPlayer.rotateRight') }}</v-btn
          >
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onBeforeMount, onBeforeUnmount, ref, toRefs, watch } from 'vue'

import StatsForNerds from '@/components/VideoPlayerStatsForNerds.vue'
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
const showVerboseLoadingTemporary = ref(false)
const videoPlaying = ref(false)
const showSuccessState = ref(false)
let successTimeoutId: ReturnType<typeof setTimeout> | null = null

onBeforeMount(() => {
  // Set the default initial values that are not present in the widget options
  const defaultOptions = {
    videoFitStyle: 'cover',
    flipHorizontally: false,
    flipVertically: false,
    rotationAngle: 0,
    statsForNerds: false,
    internalStreamName: undefined as string | undefined,
    showVerboseLoading: false,
  }
  widget.value.options = { ...defaultOptions, ...widget.value.options }
  nameSelectedStream.value = widget.value.options.internalStreamName
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
onBeforeUnmount(() => {
  clearInterval(streamConnectionRoutine)
  if (successTimeoutId) clearTimeout(successTimeoutId)
})

watch(nameSelectedStream, () => {
  widget.value.options.internalStreamName = nameSelectedStream.value
  mediaStream.value = undefined
  videoPlaying.value = false
  showSuccessState.value = false
  if (successTimeoutId) clearTimeout(successTimeoutId)
})

watch(mediaStream, () => {
  if (!videoElement.value || !mediaStream.value) {
    videoPlaying.value = false
    showSuccessState.value = false
    return
  }
  videoElement.value.srcObject = mediaStream.value
  videoElement.value
    .play()
    .then(() => {
      console.log('[VideoPlayer] Stream is playing')
      videoPlaying.value = true
      showSuccessState.value = true
      if (successTimeoutId) clearTimeout(successTimeoutId)
      successTimeoutId = setTimeout(() => {
        showSuccessState.value = false
      }, 1000)
    })
    .catch((reason) => {
      const msg = `Failed to play stream. Reason: ${reason}`
      console.error(`[VideoPlayer] ${msg}`)
      videoPlaying.value = false
      showSuccessState.value = false
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

const shouldShowVerboseLoading = computed(() => {
  return widget.value.options.showVerboseLoading || showVerboseLoadingTemporary.value
})

const showLoadingOverlay = computed(() => {
  if (nameSelectedStream.value === undefined) return false
  if (!namesAvailableStreams.value.includes(nameSelectedStream.value)) return false
  if (showSuccessState.value) return true
  return !videoPlaying.value
})

const loadingMessage = computed(() => {
  const streamInfo = nameSelectedStream.value
    ? `'${nameSelectedStream.value} (${externalStreamId.value ?? 'unknown'})'`
    : ''
  if (showSuccessState.value) return 'Stream loaded'
  return (streamConnected.value ? 'Loading' : 'Connecting to') + ` stream ${streamInfo}`
})

const toggleVerboseLoading = (): void => {
  showVerboseLoadingTemporary.value = !showVerboseLoadingTemporary.value
}
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
  align-items: center;
  background-color: rgba(30, 40, 50, 0.95);
  text-align: center;
  padding: 1.5rem;
  color: white;
  overflow: hidden;
  position: relative;
  z-index: 1;
}
.loading-overlay {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: rgba(30, 40, 50, 0.7);
  text-align: center;
  padding: 1rem;
  color: white;
  overflow: hidden;
  position: relative;
  z-index: 1;
}
.loading-text {
  font-size: 1rem;
  font-weight: 500;
  margin: 0;
  opacity: 0.9;
}
.verbose-status {
  margin-top: 1rem;
  padding: 0.75rem;
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.status-line {
  font-size: 0.85rem;
  margin: 0.25rem 0;
  word-break: break-word;
  opacity: 0.85;
}
.status-label {
  font-weight: 600;
  opacity: 1;
}
.toggle-details-btn {
  opacity: 0.7;
  font-size: 0.75rem;
}
.toggle-details-btn:hover {
  opacity: 1;
}
.success-icon {
  animation: success-pop 0.3s ease-out;
}
@keyframes success-pop {
  0% {
    transform: scale(0.5);
    opacity: 0;
  }
  70% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
.loading-complete-leave-active {
  transition: all 0.3s ease-out;
}
.loading-complete-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
