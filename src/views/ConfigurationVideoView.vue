<template>
  <BaseConfigurationView>
    <template #title>{{ isVideoLibraryOnly ? 'Video Storage' : 'Video configuration' }}</template>
    <template #content>
      <div
        v-if="!isVideoLibraryOnly"
        class="flex flex-col items-center px-5 py-3 m-5 font-medium text-center border rounded-md text-grey-darken-1 bg-grey-lighten-5 w-[40%]"
      >
        <p class="font-bold">
          This is the video configuration page. Here you can configure the behavior of your video streams, clear local
          storage and download or discard unprocesses video chunks.
        </p>
        <br />
        <p>
          First of all, it's important that you select the IP (or IPs) that should be allowed to route video streams.
          Those will usually be the ones for your wired connections. This configuration allows Cockpit to block other
          available IPs, like those from WiFi and Hotspot connections, preventing lag and stuttering in your video
          streams.
        </p>
      </div>

      <div v-if="!isVideoLibraryOnly" class="flex w-[30rem] flex-wrap">
        <v-combobox
          v-model="allowedIceIps"
          multiple
          :items="availableIceIps"
          label="Allowed WebRTC remote IP Addresses"
          class="w-full my-3 uri-input"
          variant="outlined"
          chips
          clearable
          hint="IP Addresses of the Vehicle allowed to be used for the WebRTC ICE Routing. Usually, the IP of the tether/cabled interface. Blank means any route. E.g: 192.168.2.2"
        />
      </div>

      <div
        v-if="nUnprocVideos > 0"
        class="flex flex-col items-center px-5 py-3 m-5 font-medium text-center border rounded-md text-grey-darken-1 bg-grey-lighten-5 w-[40%]"
      >
        <span class="m-2 text-lg font-bold">Unprocessed videos detected</span>
        <span class="text-sm text-slate-500/90">
          You have {{ nUnprocVideos }} {{ nUnprocVideos === 1 ? 'video that was' : 'videos that were' }} not processed.
        </span>
        <div class="flex justify-center m-6 align-center">
          <Button class="mx-2 w-fit" size="large" :disabled="nUnprocVideos === 0" @click="processUnprocessedVideos()">
            Process
          </Button>
          <Button class="mx-2 w-fit" :disabled="nUnprocVideos === 0" @click="discardFailedUnprocessedVideos()">
            Discard
          </Button>
        </div>
      </div>

      <div v-if="areThereVideosProcessing" class="max-w-[50%] bg-slate-100 rounded-md p-6 border mb-8">
        <div class="flex justify-center w-full mb-4 text-2xl font-semibold text-center align-center text-slate-500">
          <span>Processing videos</span>
          <span class="ml-2 mdi mdi-loading animate-spin" />
        </div>
        <p class="text-center text-slate-400">
          There are videos being processed in background. Please wait until they are finished to download or discard.
        </p>
      </div>
      <div class="flex flex-row">
        <div
          v-if="temporaryDbSize > 0"
          v-tooltip.bottom="'Remove video files used during the recording. This will not affect already saved videos.'"
          class="flex flex-col items-center justify-center px-4 py-2 mx-4 mb-6 mt-8 transition-all rounded-md cursor-pointer bg-slate-600 text-slate-50 hover:bg-slate-500/80"
          @click="clearTemporaryVideoFiles()"
        >
          <span class="text-md font-medium">Clear temporary video storage</span>
          <span class="text-sm text-slate-300/90">Current size: {{ formatBytes(temporaryDbSize) }}</span>
        </div>
        <div
          v-if="temporaryDbSize > 0"
          class="flex flex-col items-center justify-center px-4 py-2 mx-4 mb-6 mt-8 transition-all rounded-md cursor-pointer bg-slate-600 text-slate-50 hover:bg-slate-500/80"
          @click="videoStore.downloadTempVideoDB()"
        >
          <span class="text-md font-medium">Download temporary video chunks</span>
        </div>
      </div>
    </template>
  </BaseConfigurationView>
  <VideoPlayer :video-url="videoFile" :open-video-player-dialog="openVideoPlayerDialog" />
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import Swal from 'sweetalert2'
import { computed, onMounted, ref, watch, watchEffect } from 'vue'

import Button from '@/components/Button.vue'
import VideoPlayer from '@/components/VideoPlayer.vue'
import { formatBytes } from '@/libs/utils'
import { useVideoStore } from '@/stores/video'

import BaseConfigurationView from './BaseConfigurationView.vue'

const videoStore = useVideoStore()
const { allowedIceIps, availableIceIps } = storeToRefs(videoStore)

// Define dialog as video library only
const props = defineProps<{
  /**
   *
   */
  asVideoLibrary?: boolean
}>()

/* eslint-enable jsdoc/require-jsdoc  */
const availableVideosAndLogs = ref<VideoStorageFile[] | undefined>()
const isVideoLibraryOnly = ref(props.asVideoLibrary)
const videoFile = ref()
const openVideoPlayerDialog = ref<boolean>(false)
const temporaryDbSize = ref(0)
const selectedFilesNames = ref<string[]>([])

watchEffect(() => {
  isVideoLibraryOnly.value = props.asVideoLibrary ?? false
})

// List available videos and telemetry logs to be downloaded
/* eslint-disable jsdoc/require-jsdoc  */
interface VideoStorageFile {
  filename: string
  size: number
}

onMounted(async () => {
  await fetchVideoAndLogsData()
  await fetchTemporaryDbSize()
})

// Fetch available videos and telemetry logs from the storage
const fetchVideoAndLogsData = async (): Promise<void> => {
  availableVideosAndLogs.value = undefined
  const availableData: VideoStorageFile[] = []
  await videoStore.videoStoringDB.iterate((_, fileName) => {
    availableData.push({
      filename: fileName,
      size: 0,
    })
  })
  for (const file of availableData) {
    file.size = (await videoStore.videoStorageFileSize(file.filename)) ?? 0
  }
  availableVideosAndLogs.value = availableData
}

// Fetch temporary video data from the storage
const fetchTemporaryDbSize = async (): Promise<void> => {
  const size = await videoStore.temporaryVideoDBSize()
  temporaryDbSize.value = size
}

const clearTemporaryVideoFiles = async (): Promise<void> => {
  const videosBeingRecorded = videoStore.keysAllUnprocessedVideos.length > videoStore.keysFailedUnprocessedVideos.length

  if (videosBeingRecorded) {
    Swal.fire({
      icon: 'error',
      title: 'Video(s) being recorded',
      text: 'You must stop all ongoing video recordings before clearing the temporary storage.',
    })
    return
  }

  if (videoStore.keysAllUnprocessedVideos.length > 0) {
    Swal.fire({
      icon: 'error',
      title: 'Unprocessed videos detected',
      text: 'You must process or discard all unprocessed videos before clearing the temporary storage.',
    })
    return
  }

  await videoStore.clearTemporaryVideoDB()
  await fetchTemporaryDbSize()
}

const processUnprocessedVideos = async (): Promise<void> => {
  try {
    await videoStore.processAllUnprocessedVideos()
    Swal.fire({
      icon: 'success',
      title: 'Videos processed',
      text: 'All unprocessed videos were successfully processed and are now available for download.',
      showConfirmButton: false,
      timer: 5000,
    })
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error processing videos',
      text: `Some of the videos could not be processed. ${error}`,
    })
  } finally {
    await fetchVideoAndLogsData()
    selectedFilesNames.value = []
  }
}

const discardFailedUnprocessedVideos = async (): Promise<void> => {
  await videoStore.discardUnprocessedVideos()
  await fetchVideoAndLogsData()
  selectedFilesNames.value = []
  Swal.fire({
    icon: 'success',
    title: 'Videos discarded',
    text: 'All unprocessed videos were successfully discarded.',
    showConfirmButton: false,
    timer: 5000,
  })
}

// After the videos are processed, fetch the data again to update the video table
const { areThereVideosProcessing } = storeToRefs(videoStore)
watch(areThereVideosProcessing, async () => {
  // Sleep for a second before fetching to allow for the sensors logging update
  await new Promise((resolve) => setTimeout(resolve, 1000))
  await fetchVideoAndLogsData()
})

const nUnprocVideos = computed(() => videoStore.keysFailedUnprocessedVideos.length)
</script>
