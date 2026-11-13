<template>
  <div
    ref="recorderWidget"
    class="flex justify-around px-2 py-1 text-center rounded-lg w-40 h-9 align-center bg-slate-800/60"
  >
    <v-btn
      icon
      variant="text"
      size="x-small"
      :aria-label="isRecording ? t`Stop voice recording` : t`Start voice recording`"
      @click="toggleRecording"
    >
      <v-tooltip activator="parent" location="top" open-delay="600">
        {{ isRecording ? t`Stop voice recording` : t`Start voice recording` }}
      </v-tooltip>
      <div
        :class="{
          'blob red w-5 opacity-100 rounded-sm': isRecording,
          'opacity-30 bg-red-400': isOutside && !isRecording,
        }"
        class="w-6 transition-all duration-500 rounded-full aspect-square bg-red-lighten-1 opacity-70 hover:opacity-90"
      />
    </v-btn>
    <div class="w-16 text-slate-100">
      <template v-if="recordingStart">{{ formatDuration(timeNow - recordingStart.getTime()) }}</template>
      <ScrollingText v-else :text="t`Record a voice note`" max-width="4rem" align="left" />
    </div>
    <div class="flex justify-center w-6">
      <v-divider vertical class="h-6 ml-1" />
      <v-btn icon variant="text" size="x-small" :aria-label="t`Open voice recordings`" @click="openAudioLibrary">
        <v-tooltip activator="parent" location="top" open-delay="600">{{ t`Open voice recordings` }}</v-tooltip>
        <v-badge
          :model-value="numberOfRecordings > 0"
          color="info"
          :content="numberOfRecordings"
          :dot="isOutside || interfaceStore.videoLibraryVisibility"
        >
          <v-icon class="text-slate-100">mdi-microphone</v-icon>
        </v-badge>
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMouseInElement, useTimestamp } from '@vueuse/core'
import { t } from 'ttag'
import { onMounted, ref, watch } from 'vue'

import ScrollingText from '@/components/ScrollingText.vue'
import { useVoiceRecorder } from '@/composables/useVoiceRecorder'
import { countAudioRecordings } from '@/libs/audio-recording'
import { formatDuration } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'

const interfaceStore = useAppInterfaceStore()
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

onMounted(refreshNumberOfRecordings)

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
