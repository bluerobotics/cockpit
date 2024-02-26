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
      <div
        v-if="nameSelectedStream"
        class="flex flex-col max-w-[50%] scroll-container transition-all border-blur cursor-pointer"
        @click="isStreamSelectDialogOpen = true"
      >
        <div class="text-xs text-white select-none scroll-text">{{ nameSelectedStream }}</div>
      </div>
      <FontAwesomeIcon v-else icon="fa-solid fa-video" class="h-6 text-slate-100" />
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
          @click="startRecording"
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
import { intervalToDuration } from 'date-fns'
import { storeToRefs } from 'pinia'
import Swal from 'sweetalert2'
import { computed, onBeforeMount, onBeforeUnmount, ref, toRefs, watch } from 'vue'

import { isEqual } from '@/libs/utils'
import { useVideoStore } from '@/stores/video'
import type { MiniWidget } from '@/types/miniWidgets'

const videoStore = useVideoStore()

const props = defineProps<{
  /**
   * Configuration of the widget
   */
  miniWidget: MiniWidget
}>()
const miniWidget = toRefs(props).miniWidget

const nameSelectedStream = ref<string | undefined>()
const { namesAvailableStreams } = storeToRefs(videoStore)
const recorderWidget = ref()
const { isOutside } = useMouseInElement(recorderWidget)
const isStreamSelectDialogOpen = ref(false)
const isLoadingStream = ref(false)
const timeNow = useTimestamp({ interval: 100 })
const mediaStream = ref<MediaStream | undefined>()

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

// eslint-disable-next-line jsdoc/require-jsdoc
function assertStreamIsSelectedAndAvailable(
  selectedStream: undefined | string
): asserts selectedStream is NonNullable<undefined | string> {
  nameSelectedStream.value = selectedStream

  if (nameSelectedStream.value === undefined) {
    Swal.fire({ text: 'No stream selected.', icon: 'error' })
    return
  }

  if (namesAvailableStreams.value.includes(nameSelectedStream.value)) return

  const errorMsg = `The selected stream is not available. Please check its source or select another stream.`
  Swal.fire({ text: errorMsg, icon: 'error' })
  throw new Error(errorMsg)
}

const toggleRecording = async (): Promise<void> => {
  if (isRecording.value) {
    if (nameSelectedStream.value !== undefined) {
      videoStore.stopRecording(nameSelectedStream.value)
    }
    return
  }

  // If there's no stream selected, open the configuration dialog so user can choose the stream which will be recorded
  if (nameSelectedStream.value === undefined) {
    isStreamSelectDialogOpen.value = true
    return
  }

  // If there's a stream selected already, try to use it without requiring further user interaction
  await updateCurrentStream(nameSelectedStream.value)
  startRecording()
}

const startRecording = (): void => {
  assertStreamIsSelectedAndAvailable(nameSelectedStream.value)
  videoStore.startRecording(nameSelectedStream.value)
  isStreamSelectDialogOpen.value = false
}

const isRecording = computed(() => {
  if (nameSelectedStream.value === undefined) return false
  return videoStore.isRecording(nameSelectedStream.value)
})

const timePassedString = computed(() => {
  if (nameSelectedStream.value === undefined) return '00:00:00'
  const timeRecordingStart = videoStore.getStreamData(nameSelectedStream.value)?.timeRecordingStart
  if (timeRecordingStart === undefined) return '00:00:00'

  const duration = intervalToDuration({ start: timeRecordingStart, end: timeNow.value })
  const durationHours = duration.hours?.toFixed(0).length === 1 ? `0${duration.hours}` : duration.hours
  const durationMinutes = duration.minutes?.toFixed(0).length === 1 ? `0${duration.minutes}` : duration.minutes
  const durationSeconds = duration.seconds?.toFixed(0).length === 1 ? `0${duration.seconds}` : duration.seconds
  return `${durationHours}:${durationMinutes}:${durationSeconds}`
})

const updateCurrentStream = async (streamName: string | undefined): Promise<void> => {
  assertStreamIsSelectedAndAvailable(streamName)

  mediaStream.value = undefined
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
    Swal.fire({ text: 'Could not load media stream.', icon: 'error' })
    return
  }

  miniWidget.value.options.streamName = streamName
}

const streamConnectionRoutine = setInterval(() => {
  // If the video recording widget is cold booted, assign the first stream to it
  if (miniWidget.value.options.streamName === undefined && !namesAvailableStreams.value.isEmpty()) {
    miniWidget.value.options.streamName = namesAvailableStreams.value[0]
    nameSelectedStream.value = miniWidget.value.options.streamName

    // If there are multiple streams available, warn user that we chose one automatically and they should change if wanted
    if (namesAvailableStreams.value.length > 1) {
      const text = `You have multiple streams available, so we chose one randomly to start with.
        If you want to change it, please open the widget configuration.`
      Swal.fire({ title: 'Multiple streams detected', text: text, icon: 'info', confirmButtonText: 'OK' })
    }
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

.scroll-container {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scroll-text {
  transform: translateX(0%);
  transition: transform 1s linear;
}

.scroll-text:hover {
  transform: translateX(-100%);
}

.border-blur:hover {
  background-color: #475569;
  box-shadow: 0px 0px 3px 3px #475569;
}
</style>
