<template>
  <div
    ref="recorderWidget"
    class="flex justify-around px-2 py-1 text-center rounded-lg w-40 h-9 align-center bg-slate-800/60"
  >
    <div
      :class="{
        'blob red w-5 opacity-100 rounded-sm': isRecording,
        'opacity-30 bg-red-400': isOutside && !isRecording,
      }"
      class="w-6 transition-all duration-500 rounded-full aspect-square bg-red-lighten-1 hover:cursor-pointer opacity-70 hover:opacity-90"
      @click="toggleRecording()"
    />
    <template v-if="!isRecording">
      <div
        v-if="nameSelectedStream"
        class="flex flex-col max-w-[50%] scroll-container transition-all border-blur cursor-pointer"
        @click="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen = true"
      >
        <div class="text-xs text-white select-none scroll-text">{{ nameSelectedStream }}</div>
      </div>
      <FontAwesomeIcon v-else icon="fa-solid fa-video" class="h-6 text-slate-100" />
    </template>
    <div v-if="isRecording" class="w-16 text-justify text-slate-100">
      {{ timePassedString }}
    </div>
    <div class="flex justify-center w-6">
      <v-divider vertical class="h-6 ml-1" />
      <v-badge
        v-if="numberOfVideosOnDB > 0"
        color="info"
        :content="numberOfVideosOnDB"
        :dot="isOutside || isVideoLibraryDialogOpen"
        class="cursor-pointer"
        @click="openVideoLibraryModal"
      >
        <v-icon class="w-6 h-6 ml-1 text-slate-100" @click="openVideoLibraryModal"> mdi-video-box </v-icon>
      </v-badge>
      <v-icon v-else class="w-6 h-6 ml-1 text-slate-100 cursor-pointer" @click="openVideoLibraryModal">
        mdi-video-box
      </v-icon>
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
          Close
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

const { showDialog } = useInteractionDialog()
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
const { namessAvailableAbstractedStreams: namesAvailableStreams } = storeToRefs(videoStore)
const recorderWidget = ref()
const { isOutside } = useMouseInElement(recorderWidget)
const isVideoLibraryDialogOpen = ref(false)
const isLoadingStream = ref(false)
const timeNow = useTimestamp({ interval: 100 })
const mediaStream = ref<MediaStream | undefined>()
const numberOfVideosOnDB = ref(0)
const selectedExternalId = ref<string | undefined>()

const externalStreamId = computed(() => selectedExternalId.value)

const openVideoLibraryModal = (): void => {
  interfaceStore.videoLibraryMode = 'videos'
  interfaceStore.videoLibraryVisibility = true
}

watch(
  () => videoStore.streamsCorrespondency,
  () => (mediaStream.value = undefined),
  { deep: true }
)

onMounted(async () => {
  await fetchNumberOfTempVideos()
})

onBeforeMount(async () => {
  // Set initial widget options if they don't exist
  if (Object.keys(miniWidget.value.options).length === 0) {
    miniWidget.value.options = {
      internalStreamName: undefined as string | undefined,
    }
  }
  nameSelectedStream.value = miniWidget.value.options.internalStreamName

  if (nameSelectedStream.value) {
    selectedExternalId.value = videoStore.externalStreamId(nameSelectedStream.value)
  }
})

watch(nameSelectedStream, () => {
  miniWidget.value.options.internalStreamName = nameSelectedStream.value
  mediaStream.value = undefined
})

watch(
  () => videoStore.streamsCorrespondency,
  (newStreamsCorrespondency) => {
    if (!selectedExternalId.value) return

    const matchingStream = newStreamsCorrespondency.find((stream) => stream.externalId === selectedExternalId.value)

    if (matchingStream) {
      if (nameSelectedStream.value !== matchingStream.name) {
        nameSelectedStream.value = matchingStream.name
      }
    } else {
      // The externalId no longer exists; handle accordingly
      nameSelectedStream.value = undefined
      selectedExternalId.value = undefined
    }
  },
  { deep: true }
)

watch(nameSelectedStream, (newName) => {
  selectedExternalId.value = newName ? videoStore.externalStreamId(newName) : undefined
  miniWidget.value.options.internalStreamName = newName
  mediaStream.value = undefined
})

// Fetch number of videos on storage (chunk groups + processed videos without overlap)
const fetchNumberOfTempVideos = async (): Promise<void> => {
  // Get processed videos from videoStorage
  const processedKeys = await videoStore.videoStorage.keys()
  const processedVideos = processedKeys.filter((k) => videoStore.isVideoFilename(k))

  // Get chunk groups from tempVideoStorage
  const tempKeys = await videoStore.tempVideoStorage.keys()
  const chunkGroups: Set<string> = new Set()

  for (const key of tempKeys) {
    if (key.includes('thumbnail_')) continue

    const parts = key.split('_')
    if (parts.length < 2) continue

    const hash = parts[0]
    const chunkNumber = parseInt(parts[parts.length - 1], 10)
    if (isNaN(chunkNumber)) continue

    // Check if this chunk actually exists and has content
    try {
      const blob = (await videoStore.tempVideoStorage.getItem(key)) as Blob
      if (blob && blob.size > 0) {
        chunkGroups.add(hash)
      }
    } catch (error) {
      console.warn(`Failed to check chunk ${key}:`, error)
    }
  }

  // Count processed videos that don't have corresponding chunk groups
  const processedVideoHashes = new Set<string>()
  for (const videoKey of processedVideos) {
    // Extract hash from processed video filename
    // Processed videos have format like "MissionName (Date) #hash.webm"
    // We need to extract the hash after the # symbol
    const hashMatch = videoKey.match(/#([a-f0-9]+)\./)
    if (hashMatch && hashMatch[1]) {
      processedVideoHashes.add(hashMatch[1])
    }
  }

  // Count unique videos: chunk groups + processed videos that don't have chunk groups
  const uniqueVideos = new Set<string>()

  // Add all chunk groups
  chunkGroups.forEach((hash) => uniqueVideos.add(hash))

  // Add processed videos that don't have corresponding chunk groups
  processedVideoHashes.forEach((hash) => {
    if (!chunkGroups.has(hash)) {
      uniqueVideos.add(hash)
    }
  })

  numberOfVideosOnDB.value = uniqueVideos.size
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
    if (selectedExternalId.value) {
      videoStore.stopRecording(selectedExternalId.value)
    }
    return
  }

  if (!nameSelectedStream.value) {
    widgetStore.miniWidgetManagerVars(miniWidget.value.hash).configMenuOpen = true
    return
  }

  startRecording()
}

const startRecording = (): void => {
  if (!selectedExternalId.value) {
    showDialog({ title: 'Cannot start recording.', message: 'No stream selected.', variant: 'error' })
    return
  }

  if (!videoStore.getStreamData(selectedExternalId.value)?.connected) {
    showDialog({ title: 'Cannot start recording.', message: 'Stream is not connected.', variant: 'error' })
    return
  }

  assertStreamIsSelectedAndAvailable(nameSelectedStream.value)
  videoStore.startRecording(selectedExternalId.value)
  widgetStore.miniWidgetManagerVars(miniWidget.value.hash).configMenuOpen = false
}

const isRecording = computed(() => {
  if (!selectedExternalId.value) return false
  return videoStore.isRecording(selectedExternalId.value)
})

const timePassedString = computed(() => {
  if (externalStreamId.value === undefined) return '00:00:00'
  const timeRecordingStart = videoStore.getStreamData(externalStreamId.value)?.timeRecordingStart
  if (timeRecordingStart === undefined) return '00:00:00'

  const duration = intervalToDuration({ start: timeRecordingStart, end: timeNow.value })
  const durationHours = duration.hours?.toFixed(0).length === 1 ? `0${duration.hours}` : duration.hours
  const durationMinutes = duration.minutes?.toFixed(0).length === 1 ? `0${duration.minutes}` : duration.minutes
  const durationSeconds = duration.seconds?.toFixed(0).length === 1 ? `0${duration.seconds}` : duration.seconds
  return `${durationHours}:${durationMinutes}:${durationSeconds}`
})

const updateCurrentStream = async (internalStreamName: string | undefined): Promise<void> => {
  assertStreamIsSelectedAndAvailable(internalStreamName)

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

  miniWidget.value.options.internalStreamName = internalStreamName
}

let streamConnectionRoutine: ReturnType<typeof setInterval> | undefined = undefined

if (widgetStore.isRealMiniWidget(miniWidget.value.hash)) {
  streamConnectionRoutine = setInterval(() => {
    // If the video recording widget is cold booted, assign the first stream to it
    if (miniWidget.value.options.internalStreamName === undefined && !namesAvailableStreams.value.isEmpty()) {
      miniWidget.value.options.internalStreamName = namesAvailableStreams.value[0]
      nameSelectedStream.value = miniWidget.value.options.internalStreamName
    }

    // If the stream name is defined, try to connect the widget to the MediaStream
    if (externalStreamId.value !== undefined) {
      const updatedMediaStream = videoStore.getMediaStream(externalStreamId.value)
      // If the widget is not connected to the MediaStream, try to connect it
      if (!isEqual(updatedMediaStream, mediaStream.value)) {
        mediaStream.value = updatedMediaStream
      }
    }
  }, 1000)
}
onBeforeUnmount(() => clearInterval(streamConnectionRoutine))

watch(
  () => isVideoLibraryDialogOpen.value,
  async (newValue) => {
    if (newValue === false) {
      await fetchNumberOfTempVideos()
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
