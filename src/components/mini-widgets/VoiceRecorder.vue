<template>
  <div
    ref="recorderWidget"
    class="flex justify-around px-2 py-1 text-center rounded-lg w-32 h-9 align-center bg-slate-800/60"
  >
    <div
      :class="{
        'blob red w-5 opacity-100 rounded-sm': audioStore.isRecording,
        'opacity-30 bg-red-400': isOutside && !audioStore.isRecording,
      }"
      class="w-6 transition-all duration-500 rounded-full aspect-square bg-red-lighten-1 hover:cursor-pointer opacity-70 hover:opacity-90"
      @click="toggleRecording"
    >
      <v-tooltip activator="parent" location="top" open-delay="600">
        {{ audioStore.isRecording ? 'Stop voice recording' : 'Start voice recording' }}
      </v-tooltip>
    </div>
    <template v-if="!audioStore.isRecording">
      <FontAwesomeIcon icon="fa-solid fa-microphone" class="h-6 text-slate-100" />
    </template>
    <div v-else class="w-16 text-justify text-slate-100">
      {{ timePassedString }}
    </div>
    <div class="flex justify-center w-6">
      <v-divider vertical class="h-6 ml-1" />
      <v-badge
        v-if="numberOfRecordingsOnDB > 0"
        color="info"
        :content="numberOfRecordingsOnDB"
        :dot="isOutside || isAudioLibraryDialogOpen"
        class="cursor-pointer"
        @click="openAudioLibrary"
      >
        <v-icon class="w-6 h-6 ml-1 text-slate-100" @click="openAudioLibrary"> mdi-microphone-message </v-icon>
      </v-badge>
      <v-icon v-else class="w-6 h-6 ml-1 text-slate-100 cursor-pointer" @click="openAudioLibrary">
        mdi-microphone-message
      </v-icon>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMouseInElement, useTimestamp } from '@vueuse/core'
import { intervalToDuration } from 'date-fns'
import { computed, onBeforeMount, onMounted, ref, toRefs, watch } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useAudioStore } from '@/stores/audio'
import type { MiniWidget } from '@/types/widgets'

const { showDialog } = useInteractionDialog()
const interfaceStore = useAppInterfaceStore()
const audioStore = useAudioStore()

const props = defineProps<{
  /**
   * Configuration of the widget
   */
  miniWidget: MiniWidget
}>()
const miniWidget = toRefs(props).miniWidget

const recorderWidget = ref()
const { isOutside } = useMouseInElement(recorderWidget)
const isAudioLibraryDialogOpen = ref(false)
const timeNow = useTimestamp({ interval: 100 })
const numberOfRecordingsOnDB = ref(0)

const openAudioLibrary = (): void => {
  interfaceStore.videoLibraryMode = 'audio'
  interfaceStore.videoLibraryVisibility = true
}

const refreshNumberOfRecordings = async (): Promise<void> => {
  try {
    const recordings = await audioStore.listAudioRecordings()
    numberOfRecordingsOnDB.value = recordings.length
  } catch (error) {
    console.warn('Failed to refresh number of audio recordings:', error)
  }
}

const toggleRecording = async (): Promise<void> => {
  if (audioStore.isRecording) {
    await audioStore.stopRecording()
    await refreshNumberOfRecordings()
    return
  }

  if (!audioStore.isAudioRecordingSupported()) {
    showDialog({
      title: 'Cannot start voice recording.',
      message: 'Microphone capture is not supported in this environment.',
      variant: 'error',
    })
    return
  }

  await audioStore.startRecording()
}

const timePassedString = computed(() => {
  const dateStart = audioStore.activeRecording?.dateStart
  if (!dateStart) return '00:00:00'

  const duration = intervalToDuration({ start: dateStart, end: timeNow.value })
  const durationHours = duration.hours?.toFixed(0).length === 1 ? `0${duration.hours}` : duration.hours
  const durationMinutes = duration.minutes?.toFixed(0).length === 1 ? `0${duration.minutes}` : duration.minutes
  const durationSeconds = duration.seconds?.toFixed(0).length === 1 ? `0${duration.seconds}` : duration.seconds
  return `${durationHours ?? '00'}:${durationMinutes ?? '00'}:${durationSeconds ?? '00'}`
})

onBeforeMount(() => {
  // Reserved for future user-facing options (input device selection, format, etc.).
  if (Object.keys(miniWidget.value.options).length === 0) {
    miniWidget.value.options = {}
  }
})

onMounted(async () => {
  await refreshNumberOfRecordings()
})

watch(
  () => interfaceStore.videoLibraryVisibility,
  async (newValue) => {
    isAudioLibraryDialogOpen.value = newValue && interfaceStore.videoLibraryMode === 'audio'
    if (!newValue) {
      await refreshNumberOfRecordings()
    }
  }
)

watch(
  () => audioStore.isRecording,
  () => {
    if (!audioStore.isRecording) {
      window.onbeforeunload = null
      refreshNumberOfRecordings()
      return
    }
    window.onbeforeunload = () => {
      const alertMsg = `
        You have a voice recording ongoing.
        Remember to stop it before closing Cockpit, or the recording will be lost.
      `
      showDialog({ message: alertMsg, variant: 'warning' })
      return 'I hope the user does not click on the leave button.'
    }
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
</style>
