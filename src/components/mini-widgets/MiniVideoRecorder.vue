<template>
  <div
    ref="recorderWidget"
    class="flex justify-around px-2 py-1 text-center rounded-lg h-9 align-center bg-slate-800/60"
    :class="{ 'w-48': numberOfVideosOnDB > 0, 'w-32': numberOfVideosOnDB <= 0 }"
  >
    <div
      v-if="!isProcessingVideo"
      :class="{
        'blob red w-5 opacity-100 rounded-sm': isRecording,
        'opacity-30 bg-red-400': isOutside && !isRecording,
      }"
      class="w-6 transition-all duration-500 rounded-full aspect-square bg-red-lighten-1 hover:cursor-pointer opacity-70 hover:opacity-90"
      @click="toggleRecording()"
    />
    <div v-else>
      <v-icon class="w-6 h-6 animate-spin" color="white">mdi-loading</v-icon>
    </div>
    <template v-if="!isRecording && !isProcessingVideo">
      <div
        v-if="nameSelectedStream"
        class="flex flex-col max-w-[50%] scroll-container transition-all border-blur cursor-pointer"
        @click="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen = true"
      >
        <div class="text-xs text-white select-none scroll-text">{{ nameSelectedStream }}</div>
      </div>
      <FontAwesomeIcon v-else icon="fa-solid fa-video" class="h-6 text-slate-100" />
    </template>
    <div v-if="isRecording && !isProcessingVideo" class="w-16 text-justify text-slate-100">
      {{ timePassedString }}
    </div>
    <div v-else-if="isProcessingVideo" class="w-16 text-justify text-slate-100">
      <div class="text-xs text-center text-white select-none flex-nowrap">Processing video...</div>
    </div>
    <div v-if="numberOfVideosOnDB > 0" class="flex justify-center w-8">
      <v-divider vertical class="h-6" />
      <v-badge
        color="info"
        :content="numberOfVideosOnDB"
        :dot="isOutside || isVideoLibraryDialogOpen"
        class="cursor-pointer"
        @click="isVideoLibraryDialogOpen = true"
      >
        <v-icon class="w-6 h-6 ml-3 text-slate-100" @click="isVideoLibraryDialogOpen = true">
          mdi-video-box
        </v-icon></v-badge
      >
    </div>
  </div>
  <v-dialog v-model="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen" width="auto">
    <div
      class="flex flex-col items-center p-2 pt-1 m-5 rounded-md gap-y-4"
      :style="interfaceStore.globalGlassMenuStyles"
    >
      <p class="text-xl font-semibold m-4">Choose a stream to record</p>
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
        theme="dark"
        class="w-[90%]"
        @update:model-value="updateCurrentStream"
      />
      <div class="flex w-full justify-between items-center mt-4">
        <v-btn
          class="w-auto text-uppercase"
          variant="text"
          @click="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen = false"
        >
          Cancel
        </v-btn>
        <v-btn
          class="bg-[#FFFFFF11] hover:bg-[#FFFFFF33]"
          size="large"
          :class="{ 'opacity-30 pointer-events-none': isLoadingStream }"
          @click="startRecording"
        >
          <span>Record</span>
          <v-icon v-if="isLoadingStream" class="m-2 animate-spin">mdi-loading</v-icon>
          <div v-else class="w-5 h-5 ml-2 rounded-full bg-red" />
        </v-btn>
      </div>
    </div>
  </v-dialog>
  <VideoLibrary :open-modal="isVideoLibraryDialogOpen" @update:open-modal="handleModalUpdate" />
</template>

<script setup lang="ts">
import { useMouseInElement, useTimestamp } from '@vueuse/core'
import { intervalToDuration } from 'date-fns'
import { storeToRefs } from 'pinia'
import { computed, onBeforeMount, onBeforeUnmount, onMounted, ref, toRefs, watch } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { isEqual, sleep } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useVideoStore } from '@/stores/video'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { MiniWidget } from '@/types/widgets'

import VideoLibrary from '../VideoLibraryModal.vue'

const { showDialog, closeDialog } = useInteractionDialog()
const interfaceStore = useAppInterfaceStore()
const widgetStore = useWidgetManagerStore()
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
const isVideoLibraryDialogOpen = ref(false)
const isLoadingStream = ref(false)
const timeNow = useTimestamp({ interval: 100 })
const mediaStream = ref<MediaStream | undefined>()
const isProcessingVideo = ref(false)
const numberOfVideosOnDB = ref(0)

onMounted(async () => {
  await fetchNumebrOfTempVideos()
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

const handleModalUpdate = (newVal: boolean): void => {
  isVideoLibraryDialogOpen.value = newVal
}

// Fetch number of temporary videos on storage
const fetchNumebrOfTempVideos = async (): Promise<void> => {
  const nProcessedVideos = (await videoStore.videoStoringDB.keys()).filter((k) => videoStore.isVideoFilename(k)).length
  const nFailedUnprocessedVideos = Object.keys(videoStore.keysFailedUnprocessedVideos).length
  numberOfVideosOnDB.value = nProcessedVideos + nFailedUnprocessedVideos
}

// eslint-disable-next-line jsdoc/require-jsdoc
function assertStreamIsSelectedAndAvailable(
  selectedStream: undefined | string
): asserts selectedStream is NonNullable<undefined | string> {
  nameSelectedStream.value = selectedStream

  if (nameSelectedStream.value === undefined) {
    showDialog({ message: 'No stream selected.', variant: 'error' })
    return
  }

  if (namesAvailableStreams.value.includes(nameSelectedStream.value)) return

  const errorMsg = `The selected stream is not available. Please check its source or select another stream.`
  showDialog({ message: errorMsg, variant: 'error' })
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
    widgetStore.miniWidgetManagerVars(miniWidget.value.hash).configMenuOpen = true
    return
  }

  // If there's a stream selected already, try to use it without requiring further user interaction
  startRecording()
}

const startRecording = (): void => {
  if (nameSelectedStream.value && !videoStore.getStreamData(nameSelectedStream.value)?.connected) {
    showDialog({ title: 'Cannot start recording.', message: 'Stream is not connected.', variant: 'error' })
    return
  }
  assertStreamIsSelectedAndAvailable(nameSelectedStream.value)
  videoStore.startRecording(nameSelectedStream.value)
  widgetStore.miniWidgetManagerVars(miniWidget.value.hash).configMenuOpen = false
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
    await sleep(timeStep)
    millisPassed += timeStep
  }

  if (isLoadingStream.value) {
    showDialog({ message: 'Could not load media stream.', variant: 'error' })
    return
  }

  miniWidget.value.options.streamName = streamName
}

let streamConnectionRoutine: ReturnType<typeof setInterval> | undefined = undefined

if (widgetStore.isRealMiniWidget(miniWidget.value)) {
  streamConnectionRoutine = setInterval(() => {
    // If the video recording widget is cold booted, assign the first stream to it
    if (miniWidget.value.options.streamName === undefined && !namesAvailableStreams.value.isEmpty()) {
      miniWidget.value.options.streamName = namesAvailableStreams.value[0]
      nameSelectedStream.value = miniWidget.value.options.streamName

      // If there are multiple streams available, warn user that we chose one automatically and they should change if wanted
      if (namesAvailableStreams.value.length > 1) {
        const text = `You have multiple streams available, so we chose one randomly to start with.
          If you want to change it, please open the widget configuration.`
        showDialog({
          maxWidth: 600,
          title: 'Multiple streams detected',
          message: text,
          variant: 'info',
          actions: [
            {
              text: 'Ok',
              action: () => {
                closeDialog()
              },
            },
          ],
        })
      }
    }

    const updatedMediaStream = videoStore.getMediaStream(miniWidget.value.options.streamName)
    // If the widget is not connected to the MediaStream, try to connect it
    if (!isEqual(updatedMediaStream, mediaStream.value)) {
      mediaStream.value = updatedMediaStream
    }
  }, 1000)
}
onBeforeUnmount(() => clearInterval(streamConnectionRoutine))

// Check if there are videos being processed
watch(
  () => videoStore.areThereVideosProcessing,
  (newValue) => {
    isProcessingVideo.value = newValue
    fetchNumebrOfTempVideos()
  }
)

watch(
  () => videoStore.keysFailedUnprocessedVideos,
  () => fetchNumebrOfTempVideos()
)

watch(
  () => isVideoLibraryDialogOpen.value,
  async (newValue) => {
    if (newValue === false) {
      await fetchNumebrOfTempVideos()
    }
  }
)

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
    showDialog({ message: alertMsg, variant: 'warning' })
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

.close-icon {
  position: absolute;
  top: 5px;
  right: 5px;
  cursor: pointer;
  font-size: 20px;
  color: #999;
}
</style>
