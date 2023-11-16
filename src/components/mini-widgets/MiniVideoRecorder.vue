<template>
  <div
    ref="recorderWidget"
    class="flex justify-around px-2 py-1 text-center rounded-lg h-9 w-28 align-center bg-slate-800/60"
  >
    <div
      :class="{ 'blob red w-5 opacity-100 rounded-sm': isRecording, 'opacity-30': isOutside && !isRecording }"
      class="w-6 transition-all duration-500 rounded-full aspect-square bg-red-lighten-1 hover:cursor-pointer opacity-70 hover:opacity-90"
      @click="toggleRecording()"
    />
    <template v-if="!isRecording">
      <FontAwesomeIcon icon="fa-solid fa-video" class="h-6 text-slate-100" />
    </template>
    <div v-else class="w-16 text-justify text-slate-100">
      {{ timePassedString }}
    </div>
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
          class="w-auto p-3 m-2 font-medium transition-all rounded-md shadow-md text-uppercase hover:bg-slate-100"
          @click="isStreamSelectDialogOpen = false"
        >
          Cancel
        </button>
        <button
          class="flex items-center p-3 mx-2 font-medium transition-all rounded-md shadow-md w-fit text-uppercase hover:bg-slate-100"
          :class="{ 'bg-slate-200 opacity-30 pointer-events-none': isLoadingStream }"
          @click=";[startRecording(), (isStreamSelectDialogOpen = false)]"
        >
          <span>Record</span>
          <v-icon v-if="isLoadingStream" class="m-2 animate-spin">mdi-loading</v-icon>
          <div v-else class="w-5 h-5 ml-2 rounded-full bg-red" />
        </button>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { useMouseInElement, useTimestamp } from '@vueuse/core'
import { format, intervalToDuration } from 'date-fns'
import { saveAs } from 'file-saver'
import fixWebmDuration from 'fix-webm-duration'
import Swal, { type SweetAlertResult } from 'sweetalert2'
import { computed, onBeforeMount, onBeforeUnmount, ref, toRefs, watch } from 'vue'
import adapter from 'webrtc-adapter'

import { WebRTCManager } from '@/composables/webRTC'
import type { Stream } from '@/libs/webrtc/signalling_protocol'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import type { MiniWidget } from '@/types/miniWidgets'

const { rtcConfiguration, webRTCSignallingURI } = useMainVehicleStore()
const { missionName } = useMissionStore()

console.debug('[WebRTC] Using webrtc-adapter for', adapter.browserDetails)

const props = defineProps<{
  /**
   * Configuration of the widget
   */
  miniWidget: MiniWidget
}>()
const miniWidget = toRefs(props).miniWidget

const selectedStream = ref<Stream | undefined>()
const webRTCManager = new WebRTCManager(webRTCSignallingURI.val, rtcConfiguration)
const { availableStreams: externalStreams, mediaStream } = webRTCManager.startStream(selectedStream, ref(undefined))
const mediaRecorder = ref<MediaRecorder>()
const recorderWidget = ref()
const { isOutside } = useMouseInElement(recorderWidget)
const availableStreams = ref<Stream[]>([])
const isStreamSelectDialogOpen = ref(false)
const isLoadingStream = ref(false)
const timeRecordingStart = ref(new Date())
const timeNow = useTimestamp({ interval: 100 })

const isRecording = computed(() => {
  return mediaRecorder.value !== undefined && mediaRecorder.value.state === 'recording'
})

onBeforeMount(async () => {
  // Set initial widget options if they don't exist
  if (Object.keys(miniWidget.value.options).length === 0) {
    miniWidget.value.options = {
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
      // @ts-ignore: camera permission check is currently available in most browsers, including chromium-based ones
      const displayPermission = await navigator.permissions.query({ name: 'display-capture' })
      if (displayPermission.state === 'denied') {
        const noPermissionHtml = `
          <p>Your browser is currently blocking screen recording.</p>
          <p>We are working to solve this automatically for you.</p>
          <p>By the meantime, please follow the instructions.</p>
          <br />
          <l>
            <li>Copy Cockpit's URL (usually "http://blueos.local:49153").</li>
            <li>Open the following URL: "chrome://flags/#unsafely-treat-insecure-origin-as-secure".</li>
            <li>Add Cockpit's URL to the "Insecure origins treated as secure" list.</li>
            <li>Select "Enabled" on the side menu.</li>
            <li>Restart your browser.</li>
          </l>
          `
        return Swal.fire({ html: noPermissionHtml, icon: 'error' })
      }
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

  timeRecordingStart.value = new Date()
  mediaRecorder.value = new MediaRecorder(mediaStream.value)
  mediaRecorder.value.start()
  let chunks: Blob[] = []
  mediaRecorder.value.ondataavailable = (e) => chunks.push(e.data)

  mediaRecorder.value.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' })
    fixWebmDuration(blob, Date.now() - timeRecordingStart.value.getTime()).then((fixedBlob) => {
      const fileName = `${missionName || 'Cockpit'} (${format(timeRecordingStart.value, 'LLL dd, yyyy - HH꞉mm꞉ss O')})`
      saveAs(fixedBlob, fileName)
    })
    chunks = []
    mediaRecorder.value = undefined
    if (selectedStream.value?.id === 'screenStream' && mediaStream.value !== undefined) {
      // If recording the screen stream, stop the tracks also, so the browser removes the recording warning.
      mediaStream.value.getTracks().forEach((track: MediaStreamTrack) => track.stop())
    }
  }
}

const stopRecording = (): void => {
  mediaRecorder.value?.stop()
}

const timePassedString = computed(() => {
  const duration = intervalToDuration({ start: timeRecordingStart.value, end: timeNow.value })
  const durationHours = duration.hours?.toFixed(0).length === 1 ? `0${duration.hours}` : duration.hours
  const durationMinutes = duration.minutes?.toFixed(0).length === 1 ? `0${duration.minutes}` : duration.minutes
  const durationSeconds = duration.seconds?.toFixed(0).length === 1 ? `0${duration.seconds}` : duration.seconds
  return `${durationHours}:${durationMinutes}:${durationSeconds}`
})

const updateCurrentStream = async (stream: Stream | undefined): Promise<SweetAlertResult | void> => {
  selectedStream.value = stream
  mediaStream.value = undefined
  if (selectedStream.value !== undefined && selectedStream.value.id !== 'screenStream') {
    isLoadingStream.value = true
    let millisPassed = 0
    const timeStep = 100
    const waitingTime = 3000
    while (isLoadingStream.value && millisPassed < waitingTime) {
      // @ts-ignore: The media stream can (and probably will) get defined as we selected a stream
      isLoadingStream.value = mediaStream.value === undefined || !mediaStream.value.active
      await new Promise((r) => setTimeout(r, timeStep))
      millisPassed += timeStep
    }
    if (isLoadingStream.value) {
      return Swal.fire({ text: 'Could not load media stream.', icon: 'error' })
    }
  }
  miniWidget.value.options.streamName = selectedStream.value?.name
}

watch(externalStreams, () => {
  const savedStreamName: string | undefined = miniWidget.value.options.streamName as string
  availableStreams.value = externalStreams.value
  if (!availableStreams.value.find((stream) => stream.id === 'screenStream')) {
    addScreenStream()
  }
  if (availableStreams.value.isEmpty()) {
    return
  }

  // Retrieve stream from the saved stream name, otherwise choose the first available stream as a fallback
  const savedStream = savedStreamName ? availableStreams.value.find((s) => s.name === savedStreamName) : undefined

  if (savedStream !== undefined && savedStream.id !== selectedStream.value?.id && selectedStream.value === undefined) {
    console.debug!('[WebRTC] trying to set stream...')
    updateCurrentStream(savedStream)
  }
})

// Try to prevent user from closing Cockpit when a stream is being recorded
watch(isRecording, () => {
  if (!isRecording.value) {
    window.onbeforeunload = null
    return
  }
  window.onbeforeunload = () => {
    const alertMsg = `
      You have a video recording ongoing.
      Remember to stop it before closing Cockpit, or the record will be lost.
    `
    Swal.fire({ text: alertMsg, icon: 'warning' })
    return 'I hope the user does not click on the leave button.'
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
