<template>
  <div ref="recorderWidget" class="flex flex-col justify-around w-full h-full p-2 text-center align-center">
    <div
      :class="{ 'blob red opacity-100': isRecording, 'opacity-30': isOutside && !isRecording }"
      class="w-full transition-all duration-500 rounded-full aspect-square bg-red-lighten-1 hover:cursor-pointer opacity-70 hover:opacity-90"
      @click="toggleRecording()"
    />
  </div>
  <v-dialog v-model="isStreamSelectDialogOpen" width="auto">
    <div class="p-6 m-5 bg-white rounded-md">
      <p class="text-xl font-semibold">Choose a stream to record</p>
      <div class="w-auto h-px my-2 bg-grey-lighten-3" />
      <v-select
        :model-value="selectedStream"
        label="Stream name"
        :items="availableStreams"
        item-title="name"
        density="compact"
        variant="outlined"
        no-data-text="No streams available."
        hide-details
        return-object
        @update:model-value="updateCurrentStream"
      />
      <div class="flex items-center">
        <button
          class="w-auto p-3 mx-2 font-medium transition-all rounded-md shadow-md text-uppercase hover:bg-slate-100"
          @click="isStreamSelectDialogOpen = false"
        >
          Cancel
        </button>
        <button
          class="flex items-center p-3 mx-2 font-medium transition-all rounded-md shadow-md w-fit text-uppercase hover:bg-slate-100"
          @click=";[startRecording(), (isStreamSelectDialogOpen = false)]"
        >
          <span>Record</span>
          <div class="w-5 h-5 ml-2 rounded-full bg-red" />
        </button>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { useMouseInElement } from '@vueuse/core'
import { saveAs } from 'file-saver'
import Swal, { type SweetAlertResult } from 'sweetalert2'
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
const isStreamSelectDialogOpen = ref(false)

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

const toggleRecording = async (): Promise<void> => {
  if (isRecording.value) {
    stopRecording()
    return
  }
  // Open dialog so user can choose the stream which will be recorded
  isStreamSelectDialogOpen.value = true
}

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

const startRecording = async (): Promise<SweetAlertResult | void> => {
  if (availableStreams.value.isEmpty()) {
    return Swal.fire({ text: 'No streams available.', icon: 'error' })
  }
  if (selectedStream.value === undefined) {
    if (availableStreams.value.length === 1) {
      await updateCurrentStream(availableStreams.value[0])
    } else {
      return Swal.fire({ text: 'No stream selected. Please choose one before continuing.', icon: 'error' })
    }
  }
  if (selectedStream.value?.id === 'screenStream') {
    try {
      // @ts-ignore: preferCurrentTab option is currently available in most browsers, including chromium-based ones
      mediaStream.value = await navigator.mediaDevices.getDisplayMedia({ preferCurrentTab: true })
    } catch (err) {
      return Swal.fire({ text: 'Could not get stream from user screen.', icon: 'error' })
    }
  }
  if (mediaStream.value === undefined) {
    return Swal.fire({ text: 'Media stream not defined.', icon: 'error' })
  }
  if (!mediaStream.value.active) {
    return Swal.fire({ text: 'Media stream not yet active. Wait a second and try again.', icon: 'error' })
  }

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
  // If recording the screen stream, stop the tracks also, so the browser removes the recording warning.
  if (selectedStream.value?.id === 'screenStream' && mediaStream.value !== undefined) {
    mediaStream.value.getTracks().forEach((track: MediaStreamTrack) => track.stop())
  }
}

const updateCurrentStream = async (stream: Stream | undefined): Promise<void> => {
  selectedStream.value = stream
  if (selectedStream.value === undefined) {
    mediaStream.value = undefined
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
