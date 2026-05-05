<template>
  <div
    ref="recorderWidget"
    class="flex items-center justify-between px-1 text-white rounded-lg w-[70px] h-9 bg-slate-800/60"
    :class="{ 'pointer-events-none': widgetStore.editingMode }"
  >
    <v-btn icon variant="text" :size="28" :aria-label="t`Open voice recordings`" @click="openAudioLibrary">
      <v-tooltip activator="parent" location="top" open-delay="600">{{ t`Open voice recordings` }}</v-tooltip>
      <v-badge
        :model-value="numberOfRecordings > 0"
        color="info"
        :content="numberOfRecordings"
        :dot="isOutside || interfaceStore.videoLibraryVisibility"
      >
        <v-icon icon="mdi-playlist-music" size="18" class="opacity-80" />
      </v-badge>
    </v-btn>
    <v-divider vertical class="h-6 self-center" />
    <v-btn
      icon
      variant="text"
      :size="32"
      :aria-label="isRecording ? t`Stop voice recording` : t`Start voice recording`"
      @click="toggleRecording"
    >
      <v-tooltip activator="parent" location="top" open-delay="600">
        <template v-if="recordingStart">
          {{ t`Stop voice recording` }}<br />{{ formatDuration(timeNow - recordingStart.getTime()) }}
        </template>
        <template v-else>{{ t`Start voice recording` }}</template>
      </v-tooltip>
      <div
        class="flex items-center justify-center w-6 rounded-full aspect-square bg-red-lighten-1"
        :class="isRecording ? 'blob red' : 'opacity-70 hover:opacity-90'"
      >
        <v-icon :icon="isRecording ? 'mdi-stop' : 'mdi-microphone'" size="16" color="white" />
      </div>
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import { useMouseInElement, useTimestamp } from '@vueuse/core'
import { t } from 'ttag'
import { onMounted, ref, watch } from 'vue'

import { recoverInterruptedVoiceRecordings, useVoiceRecorder } from '@/composables/useVoiceRecorder'
import { countAudioRecordings } from '@/libs/audio-recording'
import { formatDuration } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'

const interfaceStore = useAppInterfaceStore()
const widgetStore = useWidgetManagerStore()
const { isRecording, recordingStart, toggleRecording } = useVoiceRecorder()

const recorderWidget = ref()
const { isOutside } = useMouseInElement(recorderWidget)
const timeNow = useTimestamp({ interval: 500 })
const numberOfRecordings = ref(0)

const openAudioLibrary = (): void => {
  logUserAction('Opened the voice recordings library from the voice recorder')
  interfaceStore.videoLibraryMode = 'audio'
  interfaceStore.videoLibraryVisibility = true
}

// A passive indicator, so a failed read keeps the last count.
const refreshNumberOfRecordings = async (): Promise<void> => {
  try {
    numberOfRecordings.value = await countAudioRecordings()
  } catch (error) {
    console.warn('Could not count the voice recordings.', error)
  }
}

onMounted(async () => {
  await recoverInterruptedVoiceRecordings()
  await refreshNumberOfRecordings()
})

// A recording was just saved, or the library may have deleted some.
watch(isRecording, (recording) => !recording && refreshNumberOfRecordings())
watch(
  () => interfaceStore.videoLibraryVisibility,
  (visible) => !visible && refreshNumberOfRecordings()
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
