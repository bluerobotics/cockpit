<template>
  <v-dialog v-model="isVisible" class="dialog">
    <div class="dialog-frame" :style="dialogStyle">
      <div class="video-modal" :style="interfaceStore.globalGlassMenuStyles">
        <div class="modal-content">
          <!-- Left Vertical Menu -->
          <div class="flex flex-col justify-between h-full px-5 py-3 align-center">
            <div class="flex flex-col justify-between pt-2 align-center gap-y-8">
              <button
                v-for="button in menuButtons"
                :key="button.name"
                :disabled="button.disabled"
                class="flex flex-col justify-center align-center"
                @click="currentTab = button.name.toLowerCase()"
              >
                <v-tooltip v-if="button.tooltip !== ''" open-delay="600" activator="parent" location="top">
                  {{ button.tooltip }}
                </v-tooltip>
                <div
                  class="mb-1 text-2xl rounded-full"
                  :class="[
                    button.disabled ? 'frosted-button-disabled' : 'frosted-button',
                    currentTab === button.name.toLowerCase() ? 'w-[58px] h-[58px]' : 'w-[40px] h-[40px]',
                  ]"
                >
                  <v-icon
                    :size="currentTab === button.name.toLowerCase() ? 40 : 24"
                    :class="{ 'ml-1': button.name.toLowerCase() === 'videos' }"
                  >
                    {{ button.icon }}
                  </v-icon>
                </div>
                <div class="text-sm" :class="{ 'text-white/30': !button.disabled }">
                  {{ button.name }}
                </div>
              </button>
            </div>
            <div>
              <div class="flex flex-col justify-center py-2 mb-[10px] align-center">
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
                    content-class="border-[#ffffff55] border-2"
                    @click:outside="showHelpTooltip = false"
                  >
                    <div class="flex flex-col p-2 gap-y-2">
                      <div>
                        <strong>Computer:</strong> Command+click, Ctrl+click or Long click to select multiple videos.
                      </div>

                      <div><strong>Mobile:</strong> Long press to select multiple videos.</div>
                      <div class="flex flex-row mt-4 gap-x-10">
                        <div class="ml-[-8px]">
                          <v-icon size="10" class="text-green-500 ml-2 mb-[2px] mr-1">mdi-circle</v-icon> Processed
                          video
                        </div>
                        <div>
                          <v-icon size="10" class="text-red-500 mb-[2px] mr-1">mdi-circle</v-icon> Unprocessed video
                        </div>
                      </div>
                    </div>
                  </v-tooltip>
                </button>
              </div>
              <v-divider class="opacity-[0.1] ml-[-5px] w-[120%]"></v-divider>
              <button class="flex flex-col justify-center py-2 mt-4 align-center" @click="closeModal">
                <div
                  class="frosted-button flex flex-col justify-center align-center w-[28px] h-[28px] rounded-full mb-1"
                >
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
              class="flex flex-col justify-between align-center pt-8 px-2 w-[300px] h-[480px]"
            >
              <div class="flex flex-col w-full h-full px-4 overflow-auto align-center">
                <div v-for="video in availableVideos" :key="video.fileName" class="mb-4 video-container">
                  <div class="relative video-wrapper">
                    <video
                      :id="`video-library-${video.fileName}`"
                      class="border-4 border-white rounded-md cursor-pointer border-opacity-[0.1] hover:border-opacity-[0.4] transition duration-75 hover:ease-in"
                      :class="
                        selectedVideos.find((v) => v.fileName === video.fileName)
                          ? ['border-opacity-[0.4]', 'w-[220px]']
                          : ['border-opacity-[0.1]', 'w-[190px]']
                      "
                      preload="auto"
                      :poster="!video.isProcessed ? video.thumbnail : undefined"
                    >
                      <source :src="video.url" />
                    </video>
                    <div
                      v-if="selectedVideos.find((v) => v.fileName === video.fileName) && !isMultipleSelectionMode"
                      class="play-button"
                      @click="video.isProcessed ? playVideo() : processSingleVideo()"
                    >
                      <v-icon size="40" class="text-white">
                        {{ video.isProcessed ? 'mdi-play-circle-outline' : 'mdi-progress-alert' }}
                      </v-icon>
                    </div>
                    <div
                      v-if="isMultipleSelectionMode"
                      class="checkmark-button"
                      :class="selectedVideos.find((v) => v.fileName === video.fileName) ? 'bg-green' : 'bg-white'"
                      @click.stop="toggleVideoIntoSelectionArray(video)"
                    >
                      <v-icon size="15" class="text-white">
                        {{
                          selectedVideos.find((v) => v.fileName === video.fileName)
                            ? 'mdi-check-circle-outline'
                            : 'mdi-radiobox-blank'
                        }}
                      </v-icon>
                    </div>
                  </div>
                  <div class="flex flex-row justify-center w-full ml-1 overflow-hidden text-xs">
                    <v-tooltip open-delay="500" activator="parent" location="top">{{
                      video.isProcessed ? 'Processed video' : 'Unprocessed video'
                    }}</v-tooltip>
                    {{ parseDateFromTitle(video.fileName) ?? 'Cockpit video' }}
                    <v-icon
                      size="10"
                      class="ml-1 mt-[3px]"
                      :class="video.isProcessed ? 'text-green-500' : 'text-red-500'"
                    >
                      mdi-circle
                    </v-icon>
                  </div>
                </div>
              </div>
              <div
                v-if="availableVideos.length > 1"
                class="flex flex-row align-center h-[45px] w-full mb-[-15px]"
                :class="
                  availableVideos.filter((video) => !video.isProcessed).length > 0 ? 'justify-between' : 'justify-start'
                "
              >
                <div>
                  <v-btn variant="text" size="small" class="mt-[5px]" @click="toggleSelectionMode">
                    <v-tooltip open-delay="500" activator="parent" location="bottom">
                      Select {{ isMultipleSelectionMode ? 'single' : 'multiple' }} files
                    </v-tooltip>
                    {{ isMultipleSelectionMode ? 'Single' : 'Multi' }}
                  </v-btn>
                </div>
                <div>
                  <v-btn
                    variant="text"
                    size="small"
                    class="mt-[5px]"
                    @click="selectedVideos.length === availableVideos.length ? deselectAllVideos() : selectAllVideos()"
                  >
                    <v-tooltip open-delay="500" activator="parent" location="bottom">
                      Select {{ selectedVideos.length === availableVideos.length ? 'none' : 'all files' }}
                    </v-tooltip>
                    {{ selectedVideos.length === availableVideos.length ? 'None' : 'All' }}
                  </v-btn>
                </div>
                <div>
                  <v-btn
                    v-if="availableVideos.filter((video) => !video.isProcessed).length > 0"
                    variant="text"
                    size="small"
                    class="mt-[5px]"
                    @click="
                      selectedVideos.every((el) => !el.isProcessed)
                        ? selectProcessedVideos()
                        : selectUnprocessedVideos()
                    "
                  >
                    <v-tooltip open-delay="500" activator="parent" location="bottom">
                      {{
                        selectedVideos.every((el) => !el.isProcessed)
                          ? 'Select all processed videos'
                          : 'Select all unprocessed videos'
                      }}
                    </v-tooltip>
                    {{ selectedVideos.every((el) => !el.isProcessed) ? 'Select Process.' : 'select Unproc.' }}
                  </v-btn>
                </div>
              </div>
            </div>

            <v-divider vertical class="h-[92%] mt-4 opacity-[0.1]"></v-divider>
            <!-- Video Player -->
            <div v-if="availableVideos.length > 0" class="flex flex-col justify-between mt-5 align-center w-[720px]">
              <div>
                <video
                  v-if="
                    !isMultipleSelectionMode && selectedVideos.length === 1 && !isMultipleSelectionMode && !loadingData
                  "
                  id="video-player"
                  ref="videoPlayerRef"
                  width="660px"
                  :controls="selectedVideos[0].isProcessed ? true : false"
                  :preload="selectedVideos[0].isProcessed ? 'auto' : 'none'"
                  :poster="selectedVideos[0]?.thumbnail || undefined"
                  class="border-[14px] border-white border-opacity-10 rounded-lg min-h-[382px] aspect-video"
                >
                  <source :src="selectedVideos[0]?.url || undefined" />
                </video>
                <v-btn
                  v-if="
                    !loadingData &&
                    selectedVideos.length === 1 &&
                    !selectedVideos[0].isProcessed &&
                    !isMultipleSelectionMode &&
                    !errorProcessingVideos
                  "
                  :variant="showOnScreenProgress ? 'text' : 'outlined'"
                  color="white"
                  size="large"
                  :disabled="showOnScreenProgress"
                  class="process-button"
                  @click="processSingleVideo"
                >
                  {{ showOnScreenProgress ? 'Processing...' : 'Process video' }}
                </v-btn>
                <div class="processing-bar">
                  <v-progress-linear
                    v-if="showOnScreenProgress && !showProgressInteractionDialog"
                    :model-value="errorProcessingVideos ? 100 : overallProcessingProgress"
                    :color="errorProcessingVideos ? 'red' : 'green'"
                    height="8"
                    striped
                  />
                  <div class="w-0">
                    <button
                      v-if="
                        !loadingData && selectedVideos.length === 1 && showOnScreenProgress && errorProcessingVideos
                      "
                      class="bg-red text-[#ffffffaa] flex flex-col justify-center align-center w-[20px] h-[20px] rounded-full mt-[40px] ml-[-25px]"
                      @click="showErrorTooltip = !showErrorTooltip"
                    >
                      <v-icon class="text-[18px]">mdi-alert-circle-outline</v-icon>
                      <v-tooltip
                        v-model="showErrorTooltip"
                        :open-on-hover="false"
                        activator="parent"
                        location="bottom"
                        arrow
                        content-class="border-[#ffffff55] border-2"
                        @click:outside="showErrorTooltip = false"
                      >
                        <div class="flex flex-col p-2 gap-y-2">
                          <div>{{ snackbarMessage }}</div>
                        </div>
                      </v-tooltip>
                    </button>
                  </div>
                </div>
              </div>
              <!-- Selected Videos Card Grid (Only on multiple files selected) -->
              <div
                v-if="availableVideos.length > 0 && selectedVideos.length >= 1 && isMultipleSelectionMode"
                class="flex flex-col justify-start w-full p-2 pt-3"
              >
                <div class="card-grid">
                  <v-card v-for="selectedFile in selectedVideos" :key="selectedFile.fileName" class="video-card">
                    <div>
                      <v-card-text>
                        <div class="text-sm">{{ parseDateFromTitle(selectedFile.fileName) }}</div>
                      </v-card-text>
                      <div class="video-card-dot">
                        <v-icon size="10" :class="selectedFile.isProcessed ? 'text-green-500' : 'text-red-500'">
                          mdi-circle
                        </v-icon>
                      </div>
                    </div>
                  </v-card>
                </div>
                <v-divider class="mb-[-10px] opacity-[0.1] mx-3"></v-divider>
              </div>
              <!-- Video Action Buttons -->
              <div
                v-if="availableVideos.length > 0"
                class="flex flex-row justify-between w-full h-full px-8 overflow-hidden align-center"
              >
                <div class="flex flex-row justify-between pl-2 align-center gap-x-6">
                  <div class="flex flex-row cursor-default text-md">
                    {{
                      isMultipleSelectionMode
                        ? `Files selected: ${selectedVideos.length}`
                        : parseMissionAndDateFromTitle(selectedVideos[0]?.fileName)
                    }}
                  </div>
                  <div
                    v-if="isMultipleSelectionMode"
                    class="flex flex-row w-[320px] justify-center gap-x-4 align-center ml-1"
                  >
                    <div
                      v-if="selectedVideos.every((video) => !video.isProcessed)"
                      class="text-sm text-white border-2 rounded-md mt-[3px] border-[#ffffff44] bg-[#fafafa33] ml-4 px-1"
                    >
                      <button @click="showProcessVideosWarningDialog">Process selected videos</button>
                    </div>
                  </div>
                </div>
                <div class="flex flex-row mt-2">
                  <button
                    v-for="button in fileActionButtons"
                    :key="button.name"
                    class="flex flex-col justify-center ml-6 align-center"
                    :disabled="button.disabled"
                    @click="!button.confirmAction && button.action()"
                  >
                    <div
                      :class="[
                        button.disabled ? 'frosted-button-disabled' : 'frosted-button',
                        !button.confirmAction && 'p-2',
                      ]"
                      class="flex flex-col justify-center mb-1 rounded-full frosted-button align-center button"
                    >
                      <v-tooltip v-if="button.tooltip" open-delay="500" activator="parent" location="bottom">
                        {{ button.tooltip }}
                      </v-tooltip>
                      <v-menu
                        v-if="button.confirmAction"
                        location="left center"
                        opacity="0"
                        transition="slide-x-reverse-transition"
                        :disabled="button.disabled"
                      >
                        <template #activator="{ props: buttonProps, isActive }">
                          <div class="flex items-center justify-center w-full h-full" v-bind="buttonProps">
                            <v-icon
                              :size="button.size"
                              :class="{
                                'rotate-[-45deg]': isActive,
                                'outline outline-6 outline-[#ffffff55]': isActive,
                              }"
                              class="rounded-full border-[transparent]"
                              :style="{ borderWidth: `${button.size - 4}px` }"
                            >
                              {{ isActive ? 'mdi-arrow-up' : button.icon }}
                            </v-icon>
                          </div>
                        </template>
                        <v-list class="bg-transparent" elevation="0">
                          <v-list-item>
                            <template #append>
                              <div class="mb-10 slide-right-to-left">
                                <v-btn
                                  fab
                                  small
                                  width="28"
                                  height="28"
                                  color="red"
                                  icon="mdi-close"
                                  class="text-sm outline outline-3 outline-[#ffffff44] hover:outline-[#ffffff77]"
                                  ><v-tooltip open-delay="600" activator="parent" location="bottom"> Cancel </v-tooltip
                                  ><v-icon>mdi-close</v-icon></v-btn
                                >
                                <v-btn
                                  fab
                                  small
                                  width="28"
                                  height="28"
                                  color="green"
                                  icon="mdi-check"
                                  class="ml-4 text-sm outline outline-3 outline-[#ffffff44] hover:outline-[#ffffff77]"
                                  :loading="deleteButtonLoading"
                                  @click="button.action()"
                                  ><v-tooltip open-delay="600" activator="parent" location="bottom"> Confirm </v-tooltip
                                  ><v-icon>mdi-check</v-icon></v-btn
                                >
                              </div>
                            </template>
                          </v-list-item>
                        </v-list>
                      </v-menu>
                      <div v-else>
                        <v-icon :size="button.size">{{ button.icon }}</v-icon>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
            <div
              v-if="availableVideos.length === 0"
              class="flex flex-row justify-center w-full h-full text-xl text-center align-center"
            >
              {{ loadingData ? 'Loading' : 'No videos on storage' }}
            </div>
          </template>
        </div>
      </div>
    </div>
  </v-dialog>
  <InteractionDialog
    :show-dialog="showProcessingInteractionDialog"
    :title="interactionDialogTitle"
    :actions="interactionDialogActions"
    :max-width="600"
  >
    <template #content>
      <div class="flex flex-col mb-2 text-center align-end">
        Processing multiple videos may take a while, depending on the number of videos and their sizes. Cockpit will be
        usable during the process, but the performance may be affected and recording of new videos is disabled.
      </div>
    </template>
  </InteractionDialog>
  <InteractionDialog
    :show-dialog="showProgressInteractionDialog"
    :title="progressInteractionDialogTitle"
    :actions="progressInteractionDialogActions"
    :max-width="600"
  >
    <template #content>
      <div v-if="!errorProcessingVideos" class="flex flex-col -mt-2 text-center align-center">
        <div class="flex flex-col justify-between h-[140px] w-full pb-3">
          <div v-if="currentVideoProcessingProgress.length > 0" class="flex flex-col justify-start">
            <div class="mb-3 text-sm text-center">
              File {{ currentVideoProcessingProgress.length }} of {{ numberOfFilesToProcess }}:
              {{ currentVideoProcessingProgress[currentVideoProcessingProgress.length - 1].message }}
            </div>
            <div class="flex flex-row justify-between w-full mb-2 align-center">
              <div class="text-sm font-bold w-[450px] text-nowrap text-start text-ellipsis overflow-x-hidden">
                {{ currentVideoProcessingProgress[currentVideoProcessingProgress.length - 1].fileName }}
              </div>
              <div class="text-sm text-end">
                <v-progress-circular width="1" size="10" indeterminate class="mr-1 mb-[2px]"></v-progress-circular>
                {{ `${currentVideoProcessingProgress[currentVideoProcessingProgress.length - 1].progress}%` }}
              </div>
            </div>
            <v-progress-linear
              :model-value="currentVideoProcessingProgress[currentVideoProcessingProgress.length - 1].progress"
              color="white"
              height="6"
              rounded
              striped
            ></v-progress-linear>
          </div>
          <div>
            <div class="flex flex-row justify-between w-full mb-2">
              <div class="text-sm font-bold text-start">Overall Progress</div>
              <div class="text-sm font-bold text-end">{{ `${Math.ceil(overallProcessingProgress)}%` }}</div>
            </div>
            <v-progress-linear
              :model-value="Math.ceil(overallProcessingProgress)"
              color="blue"
              height="6"
              rounded
              striped
            ></v-progress-linear>
          </div>
        </div>
      </div>
      <div v-if="errorProcessingVideos">
        <div class="flex flex-col justify-center w-full pb-3 text-center text-md">
          {{
            `Error processing video file: ${
              currentVideoProcessingProgress[currentVideoProcessingProgress.length - 1].fileName
            }`
          }}
        </div>
      </div>
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import * as Hammer from 'hammerjs'
import { computed, nextTick, onBeforeUnmount, onMounted } from 'vue'
import { ref, watch } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { useSnackbar } from '@/composables/snackbar'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useVideoStore } from '@/stores/video'
import { DialogActions } from '@/types/general'
import { VideoLibraryFile, VideoLibraryLogFile } from '@/types/video'

import InteractionDialog from './InteractionDialog.vue'

const videoStore = useVideoStore()
const interfaceStore = useAppInterfaceStore()
const { showSnackbar } = useSnackbar()

const props = defineProps({
  openModal: Boolean,
})
const emits = defineEmits(['update:openModal'])

const { showDialog, closeDialog } = useInteractionDialog()
const { width: windowWidth } = useWindowSize()

// Track the blob URLs to revoke them when the modal is closed
const blobURLs = ref<string[]>([])

/* eslint-disable jsdoc/require-jsdoc  */
interface CustomHammerInstance {
  destroy(): void
}

interface HammerInstances {
  [key: string]: CustomHammerInstance
}

/* eslint-enable jsdoc/require-jsdoc  */
const availableVideos = ref<VideoLibraryFile[]>([])
const availableLogFiles = ref<VideoLibraryLogFile[]>([])
const isVisible = ref(props.openModal)
const selectedVideos = ref<VideoLibraryFile[]>([])
const videoPlayerRef = ref<HTMLVideoElement | null>(null)
const currentTab = ref('videos')
const snackbarMessage = ref('')
const isMultipleSelectionMode = ref(false)
const longPressSelected = ref(false)
const recentlyLongPressed = ref(false)
const hammerInstances = ref<HammerInstances>({})
const showHelpTooltip = ref(false)
const showErrorTooltip = ref(false)
const loadingData = ref(true)
const showProcessingInteractionDialog = ref(false)
const interactionDialogTitle = ref('')
const interactionDialogActions = ref<DialogActions[]>([])
const showProgressInteractionDialog = ref(false)
const progressInteractionDialogTitle = ref('')
const progressInteractionDialogActions = ref<DialogActions[]>([])
const isProcessingVideos = ref(false)
const isPreparingDownload = ref(false)
const overallProcessingProgress = ref(0)
const currentVideoProcessingProgress = ref([{ fileName: '', progress: 0, message: '' }])
const numberOfFilesToProcess = ref(0)
const showOnScreenProgress = ref(false)
const lastSelectedVideo = ref<VideoLibraryFile | null>(null)
const errorProcessingVideos = ref(false)
const deleteButtonLoading = ref(false)

const dialogStyle = computed(() => {
  const scale = interfaceStore.isOnSmallScreen ? windowWidth.value / 1100 : 1
  return {
    transform: `scale(${scale * 0.98}) translate(0, 0)`,
    transformOrigin: 'center',
  }
})

const menuButtons = [
  { name: 'Videos', icon: 'mdi-video-outline', selected: true, disabled: false, tooltip: '' },
  { name: 'Pictures', icon: 'mdi-image-outline', selected: false, disabled: true, tooltip: 'Coming soon' },
]

const fileActionButtons = computed(() => [
  {
    name: 'Delete',
    icon: 'mdi-delete-outline',
    size: 22,
    tooltip: '',
    confirmAction: true,
    show: true,
    disabled: showOnScreenProgress.value === true || isPreparingDownload.value === true,
    action: () => discardVideosAndUpdateDB(),
  },
  {
    name: 'Download',
    icon: 'mdi-tray-arrow-down',
    size: 28,
    tooltip: 'Download selected videos with logs',
    confirmAction: false,
    show: true,
    disabled: showOnScreenProgress.value === true || isPreparingDownload.value === true,
    action: () => downloadVideoAndTelemetryFiles(),
  },
])

const closeModal = (): void => {
  isVisible.value = false
  emits('update:openModal', false)
  currentTab.value = 'videos'
  blobURLs.value.forEach((url) => URL.revokeObjectURL(url))
  blobURLs.value = []
  deselectAllVideos()
  lastSelectedVideo.value = null
  isMultipleSelectionMode.value = false
}

// Extracts a date or any string enclosed within parentheses from a given title string
const parseDateFromTitle = (title: string): string => {
  const dateRegex = /\(([^)]+)\)/
  const dateMatch = title.match(dateRegex)
  return dateMatch ? dateMatch[1] : ''
}

// Extracts a date or any string enclosed within parentheses from a given title string
const parseMissionAndDateFromTitle = (title: string): string => {
  const titleAndDateRegex = /.*\(([^)]+)\)/
  const titleAndDateMatch = title.match(titleAndDateRegex)
  return titleAndDateMatch ? titleAndDateMatch[0] : ''
}

const playVideo = (): void => {
  if (selectedVideos.value.length === 1 && !isMultipleSelectionMode.value) {
    const videoPlayer = document.getElementById(`video-player`) as HTMLVideoElement
    if (videoPlayer) {
      videoPlayer.play().catch((e: Error) => console.error('Error auto-playing video:', e))
    }
  }
}

// Switches between single and multiple file selection modes
const toggleSelectionMode = (): void => {
  isMultipleSelectionMode.value = !isMultipleSelectionMode.value
  if (!isMultipleSelectionMode.value) {
    deselectAllVideos()
  }
}

const toggleVideoIntoSelectionArray = (video: VideoLibraryFile): void => {
  const index = selectedVideos.value.findIndex((v) => v.fileName === video.fileName)
  if (index !== -1) {
    if (selectedVideos.value.length > 1) {
      selectedVideos.value.splice(index, 1)
    }
  } else {
    selectedVideos.value.push(video)
    isMultipleSelectionMode.value = true
  }
}

const resetProgressBars = (): void => {
  errorProcessingVideos.value = false
  overallProcessingProgress.value = 0
  currentVideoProcessingProgress.value = [{ fileName: '', progress: 0, message: '' }]
  showOnScreenProgress.value = false
}

const processVideos = async (): Promise<void> => {
  try {
    await videoStore.processVideoChunksAndTelemetry(selectedVideos.value.map((video) => video.hash!))
    isMultipleSelectionMode.value = false
    await fetchVideosAndLogData()
  } catch (error) {
    const errorMsg = `Video processing failed: ${(error as Error).message ?? error!.toString()}`
    console.error(errorMsg)
    snackbarMessage.value = errorMsg
    showSnackbar({
      message: errorMsg,
      duration: 3000,
      variant: 'error',
      closeButton: true,
    })
    errorProcessingVideos.value = true
  }
}

const closeProcessingDialog = (): void => {
  if (errorProcessingVideos.value) {
    fetchVideosAndLogData()
  }
  showProgressInteractionDialog.value = false
  resetProgressBars()
}

const processSingleVideo = async (): Promise<void> => {
  if (selectedVideos.value.length === 1 && !selectedVideos.value[0].isProcessed) {
    showOnScreenProgress.value = true
  }
  processVideos()
}

// Process multiple videos with progress bars dialog
const processMultipleVideosDialog = (): void => {
  numberOfFilesToProcess.value = selectedVideos.value.length
  progressInteractionDialogTitle.value = 'Processing Videos'
  progressInteractionDialogActions.value = [
    {
      text: overallProcessingProgress.value === 100 ? 'Close' : 'Hide',
      size: 'small',
      class: 'font-light',
      action: closeProcessingDialog,
    },
  ]
  showProcessingInteractionDialog.value = false
  showProgressInteractionDialog.value = true
  processVideos()
}

const showProcessVideosWarningDialog = (): void => {
  interactionDialogTitle.value = 'Process Multiple Videos'
  interactionDialogActions.value = [
    {
      text: 'Cancel',
      size: 'small',
      class: 'font-light',
      action: () => {
        showProcessingInteractionDialog.value = false
      },
    },
    {
      text: 'Process videos',
      size: 'small',
      class: 'font-bold',
      action: async () => {
        showProcessingInteractionDialog.value = false
        processMultipleVideosDialog()
      },
    },
  ]
  showProcessingInteractionDialog.value = true
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

const selectUnprocessedVideos = (): void => {
  if (availableVideos.value.some((video) => !video.isProcessed)) {
    selectedVideos.value = availableVideos.value.filter((video) => !video.isProcessed)
    isMultipleSelectionMode.value = true
  } else {
    snackbarMessage.value = 'No unprocessed videos found'
    showSnackbar({
      message: snackbarMessage.value,
      duration: 3000,
      variant: 'info',
      closeButton: true,
    })
  }
}

const selectProcessedVideos = (): void => {
  if (availableVideos.value.some((video) => video.isProcessed)) {
    selectedVideos.value = availableVideos.value.filter((video) => video.isProcessed)
    isMultipleSelectionMode.value = true
  } else {
    snackbarMessage.value = 'No processed videos found'
    showSnackbar({
      message: snackbarMessage.value,
      duration: 3000,
      variant: 'info',
      closeButton: true,
    })
  }
}

// Add the log files to the list of files to be downloaded/discarded
const addLogDataToFileList = (fileNames: string[]): string[] => {
  const filesWithLogData = fileNames.flatMap((fileName) => {
    const filenameWithoutExtension = fileName.split('.').slice(0, -1).join('.')
    const subtitlefileName = `${filenameWithoutExtension}.ass`
    const subtitleExists = availableLogFiles.value.some((video) => video.fileName === subtitlefileName)
    return subtitleExists ? [fileName, subtitlefileName] : [fileName]
  })
  return filesWithLogData
}

const downloadVideoAndTelemetryFiles = async (): Promise<void> => {
  let initialMessageShown = false

  const fillProgressData = async (progress: number, total: number): Promise<void> => {
    const progressPercentage = ((100 * progress) / total).toFixed(1)
    if (!initialMessageShown) return
    snackbarMessage.value = `Preparing download: ${progressPercentage}%.`
    showSnackbar({
      message: snackbarMessage.value,
      duration: 15000,
      variant: 'info',
      closeButton: true,
    })
  }

  snackbarMessage.value = 'Getting your download ready...'
  setTimeout(() => (initialMessageShown = true), 1500)

  let tempProcessedVideos: string[] = []
  let tempUnprocessedVideos: string[] = []

  selectedVideos.value.forEach((video) => {
    if (video.isProcessed) tempProcessedVideos.push(video.fileName)
    if (!video.isProcessed && video.hash) tempUnprocessedVideos.push(video.hash)
  })
  showSnackbar({
    message: snackbarMessage.value,
    duration: 3000,
    variant: 'info',
    closeButton: true,
  })

  if (tempUnprocessedVideos.length > 0) {
    const confirm = await confirmDownloadOfUnprocessedVideos()
    if (!confirm) return
  }

  isPreparingDownload.value = true
  if (tempProcessedVideos.length > 0) {
    const dataLogFilesAdded = addLogDataToFileList(tempProcessedVideos)

    await videoStore.downloadFilesFromVideoDB(dataLogFilesAdded, fillProgressData)
  }
  if (tempUnprocessedVideos.length > 0) {
    await videoStore.downloadTempVideo(tempUnprocessedVideos, fillProgressData)
  }
  isPreparingDownload.value = false
}

const confirmDownloadOfUnprocessedVideos = async (): Promise<boolean> => {
  let confirmDownload = false
  const goBack = (): void => {
    confirmDownload = false
  }
  const downloadAnyway = (): void => {
    confirmDownload = true
  }
  await showDialog({
    maxWidth: 600,
    title: 'You are downloading unprocessed videos',
    message: `One or more videos that you are downloading contains unprocessed chunks, which are not playable. To be
      able to play the downloaded videos, you need to go back and process those videos first.`,
    variant: 'info',
    actions: [
      { text: 'Go back', action: goBack },
      { text: 'Download anyway', action: downloadAnyway },
    ],
  })

  closeDialog()
  return confirmDownload
}

const discardVideosAndUpdateDB = async (): Promise<void> => {
  deleteButtonLoading.value = true
  let selectedVideoArraySize = selectedVideos.value.length
  let processedVideosToDiscard: string[] = []
  let unprocessedVideosToDiscard: string[] = []

  await selectedVideos.value.forEach((video: VideoLibraryFile) => {
    if (video.isProcessed) processedVideosToDiscard.push(video.fileName)
    if (!video.isProcessed && video.hash) unprocessedVideosToDiscard.push(video.hash)
  })

  if (processedVideosToDiscard.length > 0) {
    const dataLogFilesAdded = addLogDataToFileList(processedVideosToDiscard)

    await videoStore.discardProcessedFilesFromVideoDB(dataLogFilesAdded)
  }

  if (unprocessedVideosToDiscard.length > 0) {
    await videoStore.discardUnprocessedFilesFromVideoDB(unprocessedVideosToDiscard)
  }

  snackbarMessage.value = `${selectedVideoArraySize} video(s) discarded.`
  showSnackbar({
    message: snackbarMessage.value,
    duration: 3000,
    variant: 'info',
    closeButton: true,
  })
  await fetchVideosAndLogData()
  selectedVideos.value = availableVideos.value.length > 0 ? [availableVideos.value[0]] : []
  if (availableVideos.value.length === 1) isMultipleSelectionMode.value = false
  deleteButtonLoading.value = false
}

const fetchVideosAndLogData = async (): Promise<void> => {
  loadingData.value = true
  availableVideos.value = []
  const videoFilesOperations: Promise<VideoLibraryFile>[] = []
  const logFileOperations: Promise<VideoLibraryLogFile>[] = []

  // Fetch processed videos and logs
  await videoStore.videoStoringDB.iterate((value, key) => {
    if (videoStore.isVideoFilename(key)) {
      videoFilesOperations.push(
        (async () => {
          const videoBlob = await videoStore.videoStoringDB.getItem<Blob>(key)
          let url = ''
          let isProcessed = true
          if (videoBlob instanceof Blob) {
            url = URL.createObjectURL(videoBlob)
            blobURLs.value.push(url)
          } else {
            console.error('Video data is not a Blob:', videoBlob)
          }
          const size = (await videoStore.videoStorageFileSize(key)) ?? 0
          return { fileName: key, size, url, isProcessed }
        })()
      )
    }
    if (key.endsWith('.ass')) {
      logFileOperations.push(
        (async () => {
          const videoBlob = await videoStore.videoStoringDB.getItem<Blob>(key)
          let url = ''
          if (videoBlob instanceof Blob) {
            url = URL.createObjectURL(videoBlob)
            blobURLs.value.push(url)
          } else {
            console.error('Video data is not a Blob:', videoBlob)
          }
          const size = (await videoStore.videoStorageFileSize(key)) ?? 0
          return { fileName: key, url, size }
        })()
      )
    }
  })

  // Fetch unprocessed videos
  const unprocessedVideos = await videoStore.unprocessedVideos
  const unprocessedVideoOperations = Object.entries(unprocessedVideos).map(async ([hash, videoInfo]) => {
    return { ...videoInfo, ...{ hash: hash, url: '', isProcessed: false } }
  })

  const videos = await Promise.all(videoFilesOperations)
  const logFiles = await Promise.all(logFileOperations)
  const unprocessedVideosData = await Promise.all(unprocessedVideoOperations)

  // Filter out videos that are currently being recorded
  const validUnprocessedVideos = unprocessedVideosData.filter((video) => {
    return video.dateFinish || videoStore.keysFailedUnprocessedVideos.includes(video.hash)
  })

  availableVideos.value = [...videos, ...validUnprocessedVideos]
  availableLogFiles.value = logFiles

  loadingData.value = false
}

watch(
  () => videoStore.currentFileProgress,
  (newCurrentProgress) => {
    currentVideoProcessingProgress.value = newCurrentProgress
  },
  { deep: true }
)

watch(
  () => videoStore.overallProgress,
  (newOverallProgress) => {
    overallProcessingProgress.value = newOverallProgress
    if (newOverallProgress > 0 && newOverallProgress < 100) {
      isProcessingVideos.value = true
      showOnScreenProgress.value = true
    }
    if (newOverallProgress === 100) {
      isProcessingVideos.value = false
      showOnScreenProgress.value = false
      setTimeout(() => {
        showProgressInteractionDialog.value = false
      }, 1000)
    }
  }
)

watch(isVisible, (newValue) => {
  emits('update:openModal', newValue)
  if (!newValue) {
    resetProgressBars()
    isMultipleSelectionMode.value = false
    lastSelectedVideo.value = null
    showOnScreenProgress.value = false
  }
})

watch(
  () => props.openModal,
  async (newVal) => {
    isVisible.value = newVal
    if (newVal === true) {
      await fetchVideosAndLogData()
      showOnScreenProgress.value = false
    }
  }
)

watch(
  selectedVideos,
  (newVal) => {
    if (newVal.length === 1) {
      if (errorProcessingVideos.value) {
        resetProgressBars()
      }
      lastSelectedVideo.value = newVal[0]
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

// Keep last processed video selected after refresh
watch(
  availableVideos,
  () => {
    if (lastSelectedVideo.value) {
      const matchedVideo = availableVideos.value.find(
        (v) => parseDateFromTitle(v.fileName) === parseDateFromTitle(lastSelectedVideo.value!.fileName)
      )
      if (matchedVideo) {
        selectedVideos.value = [matchedVideo]
      }
    } else {
      selectedVideos.value = availableVideos.value.length > 0 ? [availableVideos.value[0]] : []
    }
  },
  { deep: true }
)

watch(isVisible, () => {
  if (isVisible.value) return
  lastSelectedVideo.value = null
})

// Gestures library (hammer.js) for video selection
watch(
  availableVideos,
  async () => {
    await nextTick()
    availableVideos.value.forEach((video) => {
      const videoElement = document.getElementById(`video-library-${video.fileName}`)
      if (videoElement) {
        hammerInstances.value[video.fileName]?.destroy()

        const hammerManager = new Hammer.Manager(videoElement)
        hammerManager.add(new Hammer.Tap())
        hammerManager.add(new Hammer.Press({ time: 500 }))

        hammerManager.on('tap', (ev) => {
          const isAlreadySelected = selectedVideos.value.some((v) => v.fileName === video.fileName)
          const shouldToggleSelection = isMultipleSelectionMode.value || ev.srcEvent.ctrlKey || ev.srcEvent.metaKey

          if (shouldToggleSelection) {
            isMultipleSelectionMode.value = true

            const index = selectedVideos.value.findIndex((v) => v.fileName === video.fileName)
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
          if (!selectedVideos.value.some((v) => v.fileName === video.fileName)) {
            selectedVideos.value.push(video)
          }
        })

        hammerInstances.value[video.fileName] = hammerManager
      }
    })
  },
  { immediate: true, deep: true }
)

onMounted(async () => {
  loadingData.value = true
  await fetchVideosAndLogData()
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

.dialog-frame {
  display: flex;
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
  background-color: #80808085;
  width: 190px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-card-dot {
  position: absolute;
  bottom: 0;
  right: 5px;
}

.frosted-button {
  display: flex;
  justify-content: center;
  align-items: center;
  /* background-color: #4f4f4f88; */
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

.process-button {
  position: absolute;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #4f4f4fee;
  top: 40%;
  left: 60%;
  cursor: pointer;
  opacity: 0.9;
}

.processing-bar {
  position: relative;
  height: 0px;
  width: 632px;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  bottom: 365px;
  left: 50%;
  transform: translate(-50%, -50%);
  opacity: 0.9;
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
  border: 1px solid black;
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
