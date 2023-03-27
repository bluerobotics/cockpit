<template>
  <div ref="recorderWidget" class="flex flex-col justify-around text-center align-center min-w-max min-h-max">
    <div
      :class="{ 'blob red opacity-100': isRecording, 'opacity-30': isOutside && !isRecording }"
      class="w-20 h-20 m-2 transition-all duration-500 rounded-full bg-red-lighten-1 hover:cursor-pointer opacity-70 hover:opacity-90"
      @click="isRecording ? stopRecording() : startRecording()"
    />
    <v-select
      :model-value="selectedStream"
      label="Stream name"
      class="m-1 transition-all duration-500"
      :class="{ 'opacity-0': isOutside }"
      :items="availableStreams"
      item-title="name"
      density="compact"
      variant="outlined"
      no-data-text="No streams available."
      hide-details
      return-object
      color="white"
      @update:model-value="updateCurrentStream"
    />
  </div>
</template>

<script setup lang="ts">
import { useMouseInElement } from '@vueuse/core'
import { saveAs } from 'file-saver'
import { computed, onBeforeMount, onBeforeUnmount, ref, toRefs, watch } from 'vue'
import adapter from 'webrtc-adapter'

import { WebRTCManager } from '@/composables/webRTC'
import type { Stream } from '@/libs/webrtc/signalling_protocol'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import type { Widget } from '@/types/widgets'

const { rtcConfiguration, webRTCSignallingURI } = useMainVehicleStore()

console.debug('[WebRTC] Using webrtc-adapter for', adapter.browserDetails)

const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()

const widget = toRefs(props).widget

const selectedStream = ref<Stream | undefined>()
const webRTCManager = new WebRTCManager(webRTCSignallingURI.val, rtcConfiguration)
const { availableStreams: externalStreams, mediaStream } = webRTCManager.startStream(selectedStream)
const mediaRecorder = ref<MediaRecorder>()
const recorderWidget = ref()
const { isOutside } = useMouseInElement(recorderWidget)
const availableStreams = ref<Stream[]>([])

const isRecording = computed(() => {
  return mediaRecorder.value !== undefined && mediaRecorder.value.state === 'recording'
})

onBeforeMount(async () => {
  // Set initial widget options if they don't exist
  if (Object.keys(widget.value.options).length === 0) {
    widget.value.options = {
      streamName: undefined as string | undefined,
    }
  }
  addScreenStream()
})

const addScreenStream = (): void => {
  const screenStream = {
    id: 'screenStream',
    name: 'Entire screen',
    encode: null,
    height: null,
    width: null,
    interval: null,
    source: null,
    created: null,
  }
  availableStreams.value.push(screenStream)
}

onBeforeUnmount(() => {
  webRTCManager.close('WebRTC manager removed')
})

const startRecording = (): void => {
  if (selectedStream.value === undefined || mediaStream.value === undefined) return
  mediaRecorder.value = new MediaRecorder(mediaStream.value)
  mediaRecorder.value.start()
  let chunks: Blob[] = []
  mediaRecorder.value.ondataavailable = (e) => chunks.push(e.data)

  mediaRecorder.value.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' })
    chunks = []
    saveAs(blob, 'video')
  }
}

const stopRecording = (): void => {
  if (mediaRecorder.value === undefined || !isRecording.value) return
  mediaRecorder.value.stop()
  mediaRecorder.value = undefined
  if (mediaStream.value !== undefined) {
    mediaStream.value.getTracks().forEach((track: MediaStreamTrack) => track.stop())
  }
}

const updateCurrentStream = async (stream: Stream | undefined): Promise<void> => {
  selectedStream.value = stream
  if (selectedStream.value === undefined) {
    mediaStream.value = undefined
    return
  } else if (selectedStream.value.id === 'screenStream') {
    try {
      // @ts-ignore: preferCurrentTab option is currently available in most browsers, including chromium-based ones
      mediaStream.value = await navigator.mediaDevices.getDisplayMedia({ preferCurrentTab: true })
    } catch (err) {
      console.error(err)
    }
  }
}

watch(externalStreams, () => {
  const savedStreamName: string | undefined = widget.value.options.streamName
  availableStreams.value = externalStreams.value
  if (!availableStreams.value.find((stream) => stream.id === 'screenStream')) {
    addScreenStream()
  }
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
</script>

<style scoped>
.blob.red {
  background: rgba(255, 82, 82, 1);
  box-shadow: 0 0 0 0 rgba(255, 82, 82, 1);
  animation: pulse-red 2s infinite;
}

@keyframes pulse-red {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(255, 82, 82, 0.7);
  }

  70% {
    transform: scale(1);
    box-shadow: 0 0 0 10px rgba(255, 82, 82, 0);
  }

  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(255, 82, 82, 0);
  }
}
</style>
