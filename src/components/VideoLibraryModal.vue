<template>
  <v-dialog v-model="isVisible" persistent class="dialog">
    <div class="video-modal">
      <div class="modal-content">
        <!-- Left Vertical Menu -->
        <div class="flex flex-col justify-between align-center py-3 px-5 h-full">
          <div class="flex flex-col justify-between align-center gap-y-8 pt-2">
            <button
              v-for="button in menuButtons"
              :key="button.name"
              :disabled="!button.enable"
              class="flex flex-col justify-center align-center"
              @click="currentTab = button.name.toLowerCase()"
            >
              <v-tooltip v-if="button.tooltip !== ''" open-delay="600" activator="parent" location="top">{{
                button.tooltip
              }}</v-tooltip>
              <div
                class="rounded-full mb-1 text-2xl"
                :class="[
                  button.enable ? 'frosted-button' : 'frosted-button-disabled',
                  currentTab === button.name.toLowerCase() ? 'w-[60px] h-[60px]' : 'w-[40px] h-[40px]',
                ]"
              >
                <v-icon
                  :size="currentTab === button.name.toLowerCase() ? 40 : 24"
                  :class="{ 'ml-1': button.name.toLowerCase() === 'videos' }"
                  >{{ button.icon }}</v-icon
                >
              </div>
              <div class="text-sm" :class="{ 'text-white/30': !button.enable }">
                {{ button.name }}
              </div>
            </button>
          </div>
          <div>
            <div class="flex flex-col justify-center py-2 mb-[10px] ml-1 align-center">
              <button
                class="frosted-button text-[#ffffffaa] flex flex-col justify-center align-center w-[28px] h-[28px] rounded-full mb-[4px]"
                @click="showHelpTooltip = !showHelpTooltip"
              >
                <v-icon class="text-[24px]">mdi-help-circle-outline</v-icon>
                <v-tooltip
                  v-model="showHelpTooltip"
                  :open-on-hover="false"
                  activator="parent"
                  location="top"
                  arrow
                  content-class="border-[#ffffff55] border-2 backdrop-blur-md"
                  @click:outside="showHelpTooltip = false"
                  ><div class="flex flex-col p-2 gap-y-2">
                    <div>
                      <strong>Computer:</strong> Command+click, Ctrl+click or Long click to select multiple videos.
                    </div>

                    <div><strong>Mobile:</strong> Long press to select multiple videos.</div>
                  </div>
                </v-tooltip>
              </button>
            </div>
            <v-divider class="opacity-[0.1]"></v-divider>
            <button class="flex flex-col justify-center py-2 mt-4 align-center" @click="closeModal">
              <div class="frosted-button flex flex-col justify-center align-center w-[28px] h-[28px] rounded-full mb-1">
                <v-icon class="text-[18px]">mdi-close</v-icon>
              </div>
              <div class="text-sm">Close</div>
            </button>
          </div>
        </div>
        <v-divider vertical class="h-[92%] mt-4 opacity-[0.1]"></v-divider>
        <!-- Right Content -->
        <template v-if="currentTab === 'videos'">
          <!-- Available Videos -->
          <div
            v-if="availableVideos.length > 0"
            class="flex flex-col justify-between align-center py-8 px-2 w-[300px] h-[500px]"
          >
            <div class="flex flex-col align-center h-full w-full overflow-auto px-4">
              <div v-for="video in availableVideos" :key="video.filename" class="video-container mb-4">
                <div class="relative video-wrapper">
                  <video
                    v-if="video.filename.endsWith('.webm')"
                    :id="`video-library-${video.filename}`"
                    class="border-4 border-white rounded-md cursor-pointer border-opacity-[0.1] hover:border-opacity-[0.4] transition duration-75 hover:ease-in"
                    :class="
                      selectedVideos.find((v) => v.filename === video.filename)
                        ? ['border-opacity-[0.4]', 'w-[220px]']
                        : ['border-opacity-[0.1]', 'w-[190px]']
                    "
                    preload="auto"
                  >
                    <source :src="video.url" type="video/webm" />
                  </video>
                  <div
                    v-if="selectedVideos.find((v) => v.filename === video.filename) && !isMultipleSelectionMode"
                    class="play-button"
                    @click="playVideo"
                  >
                    <v-icon size="40" class="text-white">mdi-play-circle-outline</v-icon>
                  </div>
                  <div
                    v-if="selectedVideos.find((v) => v.filename === video.filename) && isMultipleSelectionMode"
                    class="checkmark-button"
                  >
                    <v-icon size="15" class="text-white">mdi-check-circle-outline</v-icon>
                  </div>
                </div>
                <div v-if="video.filename.endsWith('.webm')" class="flex justify-center w-full text-xs overflow-hidden">
                  <v-tooltip open-delay="500" activator="parent" location="top">{{
                    video.filename ?? 'Cockpit webm'
                  }}</v-tooltip>
                  {{ parseDateFromTitle(video.filename) ?? 'Cockpit webm' }}
                </div>
              </div>
            </div>
          </div>
          <v-divider vertical class="h-[92%] mt-4 opacity-[0.1]"></v-divider>
          <!-- Video Player -->
          <div class="flex flex-col justify-between mt-5 align-center w-[720px]">
            <video
              v-if="availableVideos.length > 0 && selectedVideos.length === 1 && !isMultipleSelectionMode"
              id="video-player"
              ref="videoPlayerRef"
              width="660px"
              controls
              preload="auto"
              class="border-[14px] border-white border-opacity-10 rounded-lg min-h-[382px]"
            >
              <source :src="selectedVideos[0] && selectedVideos[0].url" type="video/webm" />
            </video>
            <!-- Selected Videos Card Grid (Only on multiple files selected) -->
            <div
              v-if="availableVideos.length > 0 && selectedVideos.length >= 1 && isMultipleSelectionMode"
              class="flex flex-col justify-start w-full p-2 pt-3"
            >
              <div class="card-grid">
                <v-card v-for="selectedFile in selectedVideos" :key="selectedFile.filename" class="video-card">
                  <v-card-text>
                    {{ parseDateFromTitle(selectedFile.filename) }}
                  </v-card-text>
                </v-card>
              </div>
              <v-divider class="mb-[-10px] opacity-[0.1] mx-3"></v-divider>
            </div>
            <!-- Video Action Buttons -->
            <div
              v-if="availableVideos.length > 0"
              class="flex flex-row justify-between align-center w-full h-full px-8 overflow-hidden"
            >
              <div class="flex flex-row justify-between align-center pl-2 gap-x-6">
                <div class="cursor-default flex flex-row text-md">
                  {{
                    isMultipleSelectionMode
                      ? `Files selected: ${selectedVideos.length}`
                      : parseDateFromTitle(selectedVideos[0]?.filename)
                  }}
                </div>
                <div v-if="isMultipleSelectionMode" class="flex flex-row justify-between align-center w-[80px] ml-1">
                  <div class="frosted-button w-[32px] h-[32px] button rounded-full p-2">
                    <button @click="selectAllVideos">
                      <v-tooltip open-delay="500" activator="parent" location="bottom">Select all</v-tooltip>
                      <v-icon size="20" class="mt-[-3px]">mdi-select-group</v-icon>
                    </button>
                  </div>
                  <div class="frosted-button w-[32px] h-[32px] button rounded-full p-2">
                    <button @click="deselectAllVideos">
                      <v-tooltip open-delay="500" activator="parent" location="bottom">Select none</v-tooltip>
                      <v-icon size="20" class="mt-[-3px]">mdi-select-off</v-icon>
                    </button>
                  </div>
                </div>
              </div>
              <div class="flex flex-row mt-2">
                <button
                  v-for="button in fileActionButtons"
                  :key="button.name"
                  class="flex flex-col justify-center align-center ml-6"
                  :disabled="!button.enable"
                  @click="!button.confirmAction && button.action()"
                >
                  <div
                    :class="[button.enable ? 'frosted-button' : 'frosted-button-disabled']"
                    class="frosted-button flex flex-col justify-center align-center button rounded-full mb-1 p-2"
                  >
                    <v-tooltip open-delay="500" activator="parent" location="bottom">{{ button.name }}</v-tooltip>
                    <v-menu v-if="button.confirmAction" location="top" opacity="0">
                      <template #activator="{ props: activatorProps }">
                        <v-icon v-bind="activatorProps" :size="button.size">{{ button.icon }}</v-icon> </template
                      ><v-list class="bg-transparent" elevation="0">
                        <v-list-item>
                          <template #append>
                            <v-btn
                              variant="text"
                              size="medium"
                              class="wobble-effect border-2 border-[#fafafadd] rounded-full"
                              @click="button.action"
                              ><div
                                class="bg-[#32c925] p-1 backdrop-filter backdrop-blur-lg flex flex-col justify-center align-center rounded-full"
                              >
                                <v-icon size="20px" color="white">mdi-check</v-icon>
                              </div></v-btn
                            >
                          </template>
                        </v-list-item>
                      </v-list>
                    </v-menu>
                    <div v-else>
                      <v-icon v-bind="props" :size="button.size">{{ button.icon }}</v-icon>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
          <div
            v-if="availableVideos.length === 0"
            class="flex flex-row justify-start align-center text-xl w-full h-full"
          >
            {{ loadingData ? 'Loading' : 'No videos on storage' }}
          </div>
        </template>
      </div>
    </div>
  </v-dialog>
  <Snackbar
    :open-snackbar="openSnackbar"
    :message="snackbarMessage"
    :duration="3000"
    @update:open-snackbar="openSnackbar = $event"
  />
</template>

<script setup lang="ts">
import * as Hammer from 'hammerjs'
import { nextTick, onBeforeUnmount, onMounted, onUnmounted } from 'vue'
import { ref, watch } from 'vue'

import { useVideoStore } from '@/stores/video'

import Snackbar from './Snackbar.vue'

const videoStore = useVideoStore()

const props = defineProps({
  openModal: Boolean,
})
const emits = defineEmits(['update:openModal'])

// Track the blob URLs to revoke them when the modal is closed
const blobURLs = ref<string[]>([])

// List available videos and telemetry logs to be downloaded
/* eslint-disable jsdoc/require-jsdoc  */
interface VideoStorageFile {
  filename: string
  size: number
  url: string
}

interface CustomHammerInstance {
  destroy(): void
}

interface HammerInstances {
  [key: string]: CustomHammerInstance
}

/* eslint-enable jsdoc/require-jsdoc  */
const availableVideos = ref<VideoStorageFile[]>([])
const availableLogFiles = ref<VideoStorageFile[]>([])
const isVisible = ref(props.openModal)
const selectedVideos = ref<VideoStorageFile[]>([])
const videoPlayerRef = ref<HTMLVideoElement | null>(null)
const currentTab = ref('videos')
const openSnackbar = ref(false)
const snackbarMessage = ref('')
const isMultipleSelectionMode = ref(false)
const longPressSelected = ref(false)
const recentlyLongPressed = ref(false)
const hammerInstances = ref<HammerInstances>({})
const showHelpTooltip = ref(false)
const loadingData = ref(true)

const menuButtons = [
  { name: 'Videos', icon: 'mdi-video-outline', selected: true, enable: true, tooltip: '' },
  { name: 'Pictures', icon: 'mdi-image-outline', selected: false, enable: false, tooltip: 'Coming soon' },
]

const fileActionButtons = [
  {
    name: 'Delete',
    icon: 'mdi-delete-outline',
    size: 22,
    confirmAction: true,
    enable: true,
    action: () => discardAndUpdateDB(selectedVideos.value.map((video: VideoStorageFile) => video.filename)),
  },
  {
    name: 'Download',
    icon: 'mdi-tray-arrow-down',
    size: 28,
    confirmAction: false,
    enable: true,
    action: () => downloadAndUpdateDB(selectedVideos.value.map((video: VideoStorageFile) => video.filename)),
  },
]

const closeModal = (): void => {
  isVisible.value = false
  emits('update:openModal', false)
  currentTab.value = 'videos'
  blobURLs.value.forEach((url) => URL.revokeObjectURL(url))
  blobURLs.value = []
  deselectAllVideos()
}

// Extracts a date or any string enclosed within parentheses from a given title string
const parseDateFromTitle = (title: string): string => {
  const dateRegex = /\(([^)]+)\)/
  const dateMatch = title.match(dateRegex)
  return dateMatch ? dateMatch[1] : ''
}

const handleKeyDown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    deselectAllVideos()
  }
}

const playVideo = (): void => {
  if (selectedVideos.value.length === 1 && !isMultipleSelectionMode.value) {
    const videoPlayer = document.getElementById(`video-player`) as HTMLVideoElement
    if (videoPlayer) {
      videoPlayer.play().catch((e: Error) => console.error('Error auto-playing video:', e))
    }
  }
}

const selectAllVideos = (): void => {
  selectedVideos.value = [...availableVideos.value]
  isMultipleSelectionMode.value = true
}

const deselectAllVideos = (): void => {
  isMultipleSelectionMode.value = false
  longPressSelected.value = false
  recentlyLongPressed.value = false

  if (selectedVideos.value.length > 1) {
    selectedVideos.value = [selectedVideos.value[0]]
  }
}

// Add the log files to the list of files to be downloaded/discarded
const addSubtitlesToFileList = (filenames: string[]): string[] => {
  const filesWithSubtitles = filenames.flatMap((filename) => {
    const subtitleFilename = filename.replace('.webm', '.ass')
    // Check if the .ass file exists in availableVideos
    const subtitleExists = availableLogFiles.value.some((video) => video.filename === subtitleFilename)
    return subtitleExists ? [filename, subtitleFilename] : [filename]
  })
  return filesWithSubtitles
}

const downloadAndUpdateDB = async (filenames: string[]): Promise<void> => {
  snackbarMessage.value = 'Preparing download...'

  await videoStore.downloadFilesFromVideoDB(addSubtitlesToFileList(filenames))
  openSnackbar.value = true
}

const discardAndUpdateDB = async (filenames: string[]): Promise<void> => {
  let selectedVideoArraySize = selectedVideos.value.length
  snackbarMessage.value = `${selectedVideoArraySize} video(s) discarded.`

  await videoStore.discardFilesFromVideoDB(addSubtitlesToFileList(filenames))
  openSnackbar.value = true
  await fetchVideoAndLogsData()
  availableVideos.value.length > 0 ? (selectedVideos.value = [availableVideos.value[0]]) : (selectedVideos.value = [])
}

const fetchVideoAndLogsData = async (): Promise<void> => {
  loadingData.value = true
  availableVideos.value = []
  const videoFilesOperations: Promise<VideoStorageFile>[] = []
  const logFileOperations: Promise<VideoStorageFile>[] = []

  await videoStore.videoStoringDB.iterate((value, key) => {
    if (key.endsWith('.webm')) {
      videoFilesOperations.push(
        (async () => {
          const videoBlob = await videoStore.videoStoringDB.getItem(key)
          let url = ''

          if (videoBlob instanceof Blob) {
            url = URL.createObjectURL(videoBlob)
            blobURLs.value.push(url)
          } else {
            console.error('Video data is not a Blob:', videoBlob)
          }

          const size = (await videoStore.videoStorageFileSize(key)) ?? 0
          return { filename: key, size, url }
        })()
      )
    }
    if (key.endsWith('.ass')) {
      logFileOperations.push(
        (async () => {
          const videoBlob = await videoStore.videoStoringDB.getItem(key)
          let url = ''

          if (videoBlob instanceof Blob) {
            url = URL.createObjectURL(videoBlob)
            blobURLs.value.push(url)
          } else {
            console.error('Video data is not a Blob:', videoBlob)
          }

          const size = (await videoStore.videoStorageFileSize(key)) ?? 0
          return { filename: key, size, url }
        })()
      )
    }
  })

  const videos = await Promise.all(videoFilesOperations)
  const logFiles = await Promise.all(logFileOperations)
  availableVideos.value = videos
  availableLogFiles.value = logFiles

  if (availableVideos.value.length > 0) {
    selectedVideos.value = [availableVideos.value[0]]
  }
  loadingData.value = false
}

watch(isVisible, (newValue) => {
  emits('update:openModal', newValue)
})

watch(
  () => props.openModal,
  async (newVal) => {
    isVisible.value = newVal
    if (newVal === true) {
      await fetchVideoAndLogsData()
    }
  }
)

watch(
  selectedVideos,
  (newVal) => {
    if (newVal.length === 1) {
      isMultipleSelectionMode.value = false
      const videoSrc = newVal[0].url
      const videoPlayer = videoPlayerRef.value
      if (videoPlayer) {
        videoPlayer.src = videoSrc
        videoPlayer.load()
      }
    }
  },
  { immediate: true, deep: true }
)

// Gestures library (hammer.js) for video selection
watch(
  availableVideos,
  async () => {
    await nextTick()
    availableVideos.value.forEach((video) => {
      const videoElement = document.getElementById(`video-library-${video.filename}`)
      if (videoElement) {
        hammerInstances.value[video.filename]?.destroy()

        const hammerManager = new Hammer.Manager(videoElement)
        hammerManager.add(new Hammer.Tap())
        hammerManager.add(new Hammer.Press({ time: 500 }))

        hammerManager.on('tap', (ev) => {
          const isAlreadySelected = selectedVideos.value.some((v) => v.filename === video.filename)
          const shouldToggleSelection = isMultipleSelectionMode.value || ev.srcEvent.ctrlKey || ev.srcEvent.metaKey

          if (shouldToggleSelection) {
            isMultipleSelectionMode.value = true

            const index = selectedVideos.value.findIndex((v) => v.filename === video.filename)
            if (index > -1) {
              if (selectedVideos.value.length > 1) {
                selectedVideos.value.splice(index, 1)
              }
            } else {
              selectedVideos.value.push(video)
            }
          } else if (!isAlreadySelected) {
            selectedVideos.value = [video]
          }

          if (selectedVideos.value.length === 1 && isAlreadySelected) {
            const videoPlayer = document.getElementById(`video-player`) as HTMLVideoElement
            if (videoPlayer) {
              videoPlayer.load()
              videoPlayer.play().catch((e: Error) => console.error('Error auto-playing video:', e))
            }
          }
        })

        hammerManager.on('press', () => {
          isMultipleSelectionMode.value = true
          if (!selectedVideos.value.some((v) => v.filename === video.filename)) {
            selectedVideos.value.push(video)
          }
        })

        hammerInstances.value[video.filename] = hammerManager
      }
    })
  },
  { immediate: true, deep: true }
)

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

onMounted(async () => {
  loadingData.value = true
  await fetchVideoAndLogsData()
})

onBeforeUnmount(() => {
  currentTab.value = 'videos'
  // Revoke each blob URL
  blobURLs.value.forEach((url) => URL.revokeObjectURL(url))
  blobURLs.value = []
  // Properly destroy Hammer instances
  Object.values(hammerInstances.value).forEach((instance) => {
    instance.destroy()
  })
})
</script>

<style scoped>
.dialog {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  --v-overlay-opacity: 0.1;
  z-index: 100;
}

.video-modal {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 1100px;
  height: 500px;
  border: 1px solid #cbcbcb33;
  border-radius: 12px;
  background-color: #4f4f4f33;
  backdrop-filter: blur(10px);
  box-shadow: 0px 4px 4px 0px #0000004c, 0px 8px 12px 6px #00000026;
  z-index: 100;
}

.modal-content {
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  height: 100%;
  color: #ffffff;
  z-index: 200;
}

.card-grid {
  width: 100%;
  height: 372px;
  overflow-y: auto;
  overflow-x: hidden;
  display: grid;
  justify-content: center;
  align-content: start;
  grid-template-columns: repeat(3, 200px);
  row-gap: 15px;
  column-gap: 10px;
  padding: 5px;
}

.video-card {
  border: 1px solid #cbcbcb44;
  color: white;
  background: rgba(203, 203, 203, 0.2);
  width: 190px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.frosted-button {
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(203, 203, 203, 0.3);
  box-shadow: -1px -1px 1px rgba(255, 255, 255, 0.3), 1px 1px 2px rgba(0, 0, 0, 0.15);
  transition: background-color 0.2s ease;
}

.frosted-button-disabled {
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(203, 203, 203, 0.1);
  color: rgba(203, 203, 203, 0.5);
  box-shadow: -1px -1px 1px rgba(255, 255, 255, 0.3), 1px 1px 2px rgba(0, 0, 0, 0.15);
}

.frosted-button:hover {
  background: rgba(203, 203, 203, 0.5);
}

.frosted-button-disabled:hover {
  background: rgba(203, 203, 203, 0.1);
}

.play-button {
  position: absolute;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.1;
}

.play-button:hover {
  opacity: 0.8;
  transition: all;
  transition-duration: 0.4s;
}

.checkmark-button {
  position: absolute;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 10px;
  width: 15px;
  height: 15px;
  top: 15px;
  left: 15px;
  transform: translate(-50%, -50%);
  background: green;
  border: none;
  cursor: pointer;
  opacity: 1;
}

@keyframes flash {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes wobble {
  0% {
    transform: scale(0);
  }
  10% {
    transform: scale(0.4);
  }
  20% {
    transform: scale(0.8);
  }
  30% {
    transform: scale(1.2);
  }
  40% {
    transform: scale(0.95);
  }
  50% {
    transform: scale(1.2);
  }
  60% {
    transform: scale(0.98);
  }
  70% {
    transform: scale(1.1);
  }
  80% {
    transform: scale(0.99);
  }
  90% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}

.wobble-effect {
  animation: wobble 1s 1;
}

@media (max-width: 640px) {
  .modal {
    width: 90%;
    height: 500px;
  }
}

@media (min-width: 768px) {
  .modal {
    width: 95%;
    height: 500px;
  }
}

@media (min-width: 1024px) {
  .modal {
    width: 1200px;
    height: 500px;
  }
}
</style>
