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
        :dot="isOutside || interfaceStore.videoLibraryVisibility"
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
        label="Stream"
        :items="enrichedStreamItems"
        item-value="internalName"
        density="compact"
        variant="outlined"
        no-data-text="No streams available."
        hide-details
        theme="dark"
        class="w-[90%]"
        @update:model-value="updateCurrentStream"
      >
        <template #selection="{ item }">
          <div class="flex items-center gap-2">
            <span class="text-sm">{{ item.raw.internalName }}</span>
            <v-chip
              size="x-small"
              :color="item.raw.protocolLabel === 'RTSP' ? '#e67e22' : '#3498db'"
              variant="flat"
              label
              class="text-white"
            >
              {{ item.raw.protocolLabel }}
            </v-chip>
          </div>
        </template>
        <template #item="{ item, props: itemProps }">
          <v-list-item v-bind="itemProps" :title="undefined">
            <div class="flex items-center justify-between w-full py-1">
              <div class="flex flex-col min-w-0 mr-3">
                <span class="text-sm font-medium text-white">{{ item.raw.internalName }}</span>
                <span class="text-xs text-gray-400 truncate">{{ item.raw.externalName }}</span>
                <span v-if="item.raw.resolution !== 'Unknown'" class="text-xs text-gray-500">
                  {{ item.raw.resolution }}
                  <template v-if="item.raw.fps"> @ {{ item.raw.fps }}</template>
                </span>
              </div>
              <v-chip
                size="x-small"
                :color="item.raw.protocolLabel === 'RTSP' ? '#e67e22' : '#3498db'"
                variant="flat"
                label
                class="text-white shrink-0"
              >
                {{ item.raw.protocolLabel }}
              </v-chip>
            </div>
          </v-list-item>
        </template>
      </v-select>
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
import { openSnackbar } from '@/composables/snackbar'
import { useVideoChunkManager } from '@/composables/videoChunkManager'
import { isElectron, isEqual } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useVideoStore } from '@/stores/video'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { MiniWidget } from '@/types/widgets'

const { showDialog } = useInteractionDialog()
const interfaceStore = useAppInterfaceStore()
const widgetStore = useWidgetManagerStore()
const videoStore = useVideoStore()
const { chunkGroups, fetchChunkGroups } = useVideoChunkManager()

const props = defineProps<{
  /**
   * Configuration of the widget
   */
  miniWidget: MiniWidget
}>()
const miniWidget = toRefs(props).miniWidget

const nameSelectedStream = ref<string | undefined>()
const { namessAvailableAbstractedStreams: namesAvailableStreams } = storeToRefs(videoStore)

const enrichedStreamItems = computed(() => {
  return videoStore.streamsCorrespondency.map((corr) => {
    const displayInfo = videoStore.getStreamDisplayInfo(corr.externalId)
    return {
      internalName: corr.name,
      externalName: corr.externalId,
      resolution: displayInfo.resolution,
      fps: displayInfo.fps,
      source: displayInfo.source,
      protocolLabel: displayInfo.protocolLabel,
    }
  })
})
const recorderWidget = ref()
const { isOutside } = useMouseInElement(recorderWidget)
const isLoadingStream = ref(false)
const timeNow = useTimestamp({ interval: 100 })
const mediaStream = ref<MediaStream | undefined>()
const numberOfVideosOnDB = ref(0)
const selectedExternalId = ref<string | undefined>()

const externalStreamId = computed(() => selectedExternalId.value)

// Register/unregister this widget as a consumer of the stream, so the video store can tear down streams that no
// widget points to anymore instead of leaking their WebRTC session.
watch(
  externalStreamId,
  (newId, oldId) => {
    if (oldId) videoStore.unregisterStreamConsumer(oldId, miniWidget.value.hash)
    if (newId) videoStore.registerStreamConsumer(newId, miniWidget.value.hash)
  },
  { immediate: true }
)

const openVideoLibraryModal = (): void => {
  logUserAction('Opened Video Library')
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
  () => miniWidget.value.options.internalStreamName,
  (newName) => {
    if (newName !== nameSelectedStream.value) {
      nameSelectedStream.value = newName
    }
  }
)

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

// Counts the list the video library opens on, as raw chunks kept as backup outlive their deleted processed video
const fetchNumberOfTempVideos = async (): Promise<void> => {
  if (isElectron()) {
    const processedKeys = await videoStore.videoStorage.keys()
    numberOfVideosOnDB.value = processedKeys.filter((k) => videoStore.isVideoFilename(k)).length
    return
  }
  await fetchChunkGroups()
  numberOfVideosOnDB.value = chunkGroups.value.length
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
      logUserAction(`Stopped video recording of stream '${nameSelectedStream.value}'`)
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
  logUserAction(`Started video recording of stream '${nameSelectedStream.value}'`)
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

// Generous ceiling for how long we show the connecting state before warning; well above typical WebRTC
// negotiation so merely-slow streams aren't cut off, unlike the old 3s hard timeout.
const streamLoadingTimeoutMs = 20000
let streamLoadingTimeout: ReturnType<typeof setTimeout> | undefined = undefined

const updateCurrentStream = (internalStreamName: string | undefined): void => {
  logUserAction(`Selected recording stream '${internalStreamName}'`)
  assertStreamIsSelectedAndAvailable(internalStreamName)

  mediaStream.value = undefined
  isLoadingStream.value = true
  miniWidget.value.options.internalStreamName = internalStreamName

  // streamConnectionRoutine clears isLoadingStream once media is flowing; if it never connects, stop spinning
  // and surface a non-blocking warning so the record button becomes usable again instead of staying disabled.
  clearTimeout(streamLoadingTimeout)
  streamLoadingTimeout = setTimeout(() => {
    if (!isLoadingStream.value) return
    isLoadingStream.value = false
    openSnackbar({
      message: `Could not load media stream '${internalStreamName}'. Check the stream source and try again.`,
      variant: 'error',
    })
  }, streamLoadingTimeoutMs)
}

let streamConnectionRoutine: ReturnType<typeof setInterval> | undefined = undefined

if (widgetStore.isRealMiniWidget(miniWidget.value.hash)) {
  streamConnectionRoutine = setInterval(() => {
    if (miniWidget.value.options.internalStreamName !== nameSelectedStream.value) {
      nameSelectedStream.value = miniWidget.value.options.internalStreamName
    }

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
      if (isLoadingStream.value && mediaStream.value?.active) {
        isLoadingStream.value = false
        clearTimeout(streamLoadingTimeout)
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
}
onBeforeUnmount(() => {
  clearInterval(streamConnectionRoutine)
  clearTimeout(streamLoadingTimeout)
  if (externalStreamId.value) videoStore.unregisterStreamConsumer(externalStreamId.value, miniWidget.value.hash)
})

watch(
  () => interfaceStore.videoLibraryVisibility,
  async (newValue) => {
    if (newValue === false) {
      await fetchNumberOfTempVideos()
    }
  }
)

// A recording only lands in the library once its recorder detaches, after processing and the telemetry overlay
watch(
  () => Object.values(videoStore.activeStreams).filter((stream) => stream?.mediaRecorder !== undefined).length,
  async (attachedRecorders, previouslyAttachedRecorders) => {
    if (attachedRecorders < previouslyAttachedRecorders) await fetchNumberOfTempVideos()
  }
)
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
