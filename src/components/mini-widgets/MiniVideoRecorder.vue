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
        :model-value="nameSelectedStream"
        label="Stream name"
        :items="namesAvailableStreams"
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
import { storeToRefs } from 'pinia'
import Swal, { type SweetAlertResult } from 'sweetalert2'
import { computed, onBeforeMount, onBeforeUnmount, ref, toRefs, watch } from 'vue'

import { datalogger } from '@/libs/sensors-logging'
import { isEqual } from '@/libs/utils'
import { useMissionStore } from '@/stores/mission'
import { useVideoStore } from '@/stores/video'
import type { MiniWidget } from '@/types/miniWidgets'

const videoStore = useVideoStore()
const { missionName } = useMissionStore()

const props = defineProps<{
  /**
   * Configuration of the widget
   */
  miniWidget: MiniWidget
}>()
const miniWidget = toRefs(props).miniWidget

const nameSelectedStream = ref<string | undefined>()
const { namesAvailableStreams } = storeToRefs(videoStore)
const mediaRecorder = ref<MediaRecorder>()
const recorderWidget = ref()
const { isOutside } = useMouseInElement(recorderWidget)
const isStreamSelectDialogOpen = ref(false)
const isLoadingStream = ref(false)
const timeRecordingStart = ref(new Date())
const timeNow = useTimestamp({ interval: 100 })
const mediaStream = ref<MediaStream | undefined>()

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
  nameSelectedStream.value = miniWidget.value.options.streamName
})

watch(nameSelectedStream, () => {
  miniWidget.value.options.streamName = nameSelectedStream.value
  mediaStream.value = undefined
})

const toggleRecording = async (): Promise<void> => {
  if (isRecording.value) {
    stopRecording()
    return
  }
  // Open dialog so user can choose the stream which will be recorded
  isStreamSelectDialogOpen.value = true
}

const startRecording = async (): Promise<SweetAlertResult | void> => {
  if (namesAvailableStreams.value.isEmpty()) {
    return Swal.fire({ text: 'No streams available.', icon: 'error' })
  }
  if (nameSelectedStream.value === undefined) {
    if (namesAvailableStreams.value.length === 1) {
      await updateCurrentStream(namesAvailableStreams.value[0])
    } else {
      return Swal.fire({ text: 'No stream selected. Please choose one before continuing.', icon: 'error' })
    }
  }
  if (mediaStream.value === undefined) {
    return Swal.fire({ text: 'Media stream not defined.', icon: 'error' })
  }
  if (!mediaStream.value.active) {
    return Swal.fire({ text: 'Media stream not yet active. Wait a second and try again.', icon: 'error' })
  }

  timeRecordingStart.value = new Date()
  const fileName = `${missionName || 'Cockpit'} (${format(timeRecordingStart.value, 'LLL dd, yyyy - HH꞉mm꞉ss O')})`
  mediaRecorder.value = new MediaRecorder(mediaStream.value)
  if (!datalogger.logging()) {
    datalogger.startLogging()
  }
  const videoTrack = mediaStream.value.getVideoTracks()[0]
  const vWidth = videoTrack.getSettings().width || 1920
  const vHeight = videoTrack.getSettings().height || 1080
  mediaRecorder.value.start(1000)
  let chunks: Blob[] = []
  mediaRecorder.value.ondataavailable = async (e) => {
    chunks.push(e.data)
    await videoStore.videoRecoveryDB.setItem(fileName, chunks)
  }

  mediaRecorder.value.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' })
    const videoTelemetryLog = datalogger.getSlice(datalogger.currentCockpitLog, timeRecordingStart.value, new Date())
    const assLog = datalogger.toAssOverlay(videoTelemetryLog, vWidth, vHeight, timeRecordingStart.value.getTime())
    var logBlob = new Blob([assLog], { type: 'text/plain' })
    fixWebmDuration(blob, Date.now() - timeRecordingStart.value.getTime()).then((fixedBlob) => {
      saveAs(fixedBlob, `${fileName}.webm`)
      saveAs(logBlob, `${fileName}.ass`)
      videoStore.videoRecoveryDB.removeItem(fileName)
    })
    chunks = []
    mediaRecorder.value = undefined
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

const updateCurrentStream = async (streamName: string | undefined): Promise<SweetAlertResult | void> => {
  nameSelectedStream.value = streamName
  mediaStream.value = undefined
  if (nameSelectedStream.value !== undefined) {
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
  miniWidget.value.options.streamName = nameSelectedStream.value
}

const streamConnectionRoutine = setInterval(() => {
  // If the video player widget is cold booted, assign the first stream to it
  if (miniWidget.value.options.streamName === undefined && !namesAvailableStreams.value.isEmpty()) {
    miniWidget.value.options.streamName = namesAvailableStreams.value[0]
    nameSelectedStream.value = miniWidget.value.options.streamName
  }

  const updatedMediaStream = videoStore.getMediaStream(miniWidget.value.options.streamName)
  // If the widget is not connected to the MediaStream, try to connect it
  if (!isEqual(updatedMediaStream, mediaStream.value)) {
    mediaStream.value = updatedMediaStream
  }
}, 1000)
onBeforeUnmount(() => clearInterval(streamConnectionRoutine))

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
