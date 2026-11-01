<template>
  <div class="flex flex-col flex-1 min-h-0 min-w-0 h-full">
    <audio ref="player" class="hidden" />
    <div v-if="recordings.length > 0" class="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
      <div
        v-for="recording in recordings"
        :key="recording.fileName"
        class="flex items-center gap-3 p-3 rounded-lg border transition-colors"
        :class="selected.has(recording.fileName) ? 'border-white/40 bg-white/15' : 'border-white/20 bg-white/5'"
      >
        <v-checkbox
          :model-value="selected.has(recording.fileName)"
          density="compact"
          hide-details
          class="flex-none"
          :aria-label="`Select ${recording.fileName}`"
          @update:model-value="toggleSelection(recording.fileName)"
        />
        <v-btn
          icon
          variant="text"
          size="small"
          :aria-label="isPlaying(recording.fileName) ? 'Pause' : 'Play'"
          @click="togglePlay(recording.fileName)"
        >
          <v-tooltip open-delay="500" activator="parent" location="bottom">
            {{ isPlaying(recording.fileName) ? 'Pause' : 'Play' }}
          </v-tooltip>
          <v-icon>{{ isPlaying(recording.fileName) ? 'mdi-pause' : 'mdi-play' }}</v-icon>
        </v-btn>
        <div class="shrink-0">
          <div class="font-medium whitespace-nowrap">
            {{ recording.dateStart ? formatDate(recording.dateStart) : recording.fileName }}
          </div>
          <div v-if="recording.durationMs !== undefined" class="text-xs text-white/60">
            {{ formatDuration(recording.durationMs) }}
          </div>
        </div>
        <div class="flex flex-1 min-w-0 items-center gap-3">
          <template v-if="loadedFileName === recording.fileName">
            <v-slider
              v-model="currentTime"
              :max="loadedDuration(recording)"
              step="0.1"
              color="white"
              track-color="#FFFFFF33"
              thumb-size="12"
              track-size="3"
              hide-details
              aria-label="Playback position"
              @end="onSeek(recording.fileName, $event)"
            />
            <span class="text-xs text-white/70 tabular-nums whitespace-nowrap">
              {{ formatDuration(currentTime * 1000) }} / {{ formatDuration(loadedDuration(recording) * 1000) }}
            </span>
          </template>
        </div>
        <v-btn icon variant="text" size="small" aria-label="Delete" @click="confirmDelete([recording.fileName])">
          <v-tooltip open-delay="500" activator="parent" location="bottom">Delete</v-tooltip>
          <v-icon>mdi-delete</v-icon>
        </v-btn>
      </div>
    </div>
    <div v-else class="flex flex-col flex-1 min-h-0 items-center justify-center text-center px-6">
      <template v-if="loading">Loading</template>
      <template v-else>
        <v-icon size="60" class="text-white/30 mb-4">mdi-microphone-off</v-icon>
        <p class="text-lg">No voice recordings yet</p>
        <p class="text-sm text-white/70">Add the voice recorder mini-widget to a view and press its red dot.</p>
      </template>
    </div>
    <div class="shrink-0 h-14 flex justify-between items-center px-4 border-t border-white/10">
      <v-btn v-if="recordings.length > 1" variant="text" size="small" @click="toggleSelectAll">
        {{ selected.size === recordings.length ? 'None' : 'All' }}
      </v-btn>
      <div class="flex items-center gap-2 ml-auto">
        <template v-if="selected.size > 0">
          <v-btn variant="text" size="small" @click="download([...selected])">Download</v-btn>
          <v-btn variant="text" size="small" @click="confirmDelete([...selected])">Delete</v-btn>
        </template>
        <v-btn v-if="isElectron()" icon variant="text" aria-label="Open voice recordings folder" @click="openFolder">
          <v-tooltip open-delay="500" activator="parent" location="bottom">Open voice recordings folder</v-tooltip>
          <v-icon>mdi-folder-open-outline</v-icon>
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMediaControls } from '@vueuse/core'
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { openSnackbar } from '@/composables/snackbar'
import { deleteAudioRecordings, downloadAudioRecordings, listAudioRecordings } from '@/libs/audio-recording'
import { formatDate, formatDuration, isElectron, messageFromError } from '@/libs/utils'
import { audioStorage } from '@/libs/videoStorage'
import { AudioLibraryFile } from '@/types/audio'

const { showDialog, closeDialog } = useInteractionDialog()

const recordings = shallowRef<AudioLibraryFile[]>([])
const selected = shallowRef<Set<string>>(new Set())
const loading = ref(true)
const player = ref<HTMLAudioElement>()
const loadedFileName = ref<string | null>(null)
const loadedURL = ref('')
const { playing, currentTime, duration } = useMediaControls(player, { src: loadedURL })

const unloadPlayer = (): void => {
  playing.value = false
  if (loadedURL.value) URL.revokeObjectURL(loadedURL.value)
  loadedURL.value = ''
  loadedFileName.value = null
}

const isPlaying = (fileName: string): boolean => playing.value && loadedFileName.value === fileName

// MediaRecorder WebM files carry no duration header, so the element reports Infinity until fully read.
const loadedDuration = (recording: AudioLibraryFile): number => {
  return Number.isFinite(duration.value) && duration.value > 0 ? duration.value : (recording.durationMs ?? 0) / 1000
}

const fetchRecordings = async (): Promise<void> => {
  loading.value = true
  try {
    recordings.value = await listAudioRecordings()
  } catch (error) {
    openSnackbar({ message: `Could not list the voice recordings. ${messageFromError(error)}`, variant: 'error' })
  } finally {
    loading.value = false
  }
}

// Loaded on demand, since reading every recording up front can take hundreds of megabytes.
const togglePlay = async (fileName: string): Promise<void> => {
  if (loadedFileName.value === fileName) {
    logUserAction(`${playing.value ? 'Paused' : 'Resumed'} voice recording "${fileName}"`)
    playing.value = !playing.value
    return
  }
  logUserAction(`Played voice recording "${fileName}"`)
  let blob: Blob | null | undefined
  try {
    blob = await audioStorage.getItem(fileName)
  } catch (error) {
    openSnackbar({ message: `Could not read the voice recording. ${messageFromError(error)}`, variant: 'error' })
    return
  }
  if (!blob) {
    openSnackbar({ message: `Could not find the voice recording "${fileName}".`, variant: 'error' })
    return
  }
  unloadPlayer()
  loadedURL.value = URL.createObjectURL(blob)
  loadedFileName.value = fileName
  await nextTick()
  playing.value = true
}

const onSeek = (fileName: string, seconds: number): void => {
  logUserAction(`Seeked voice recording "${fileName}" to ${formatDuration(seconds * 1000)}`)
}

const toggleSelection = (fileName: string): void => {
  const next = new Set(selected.value)
  const wasSelected = next.delete(fileName)
  if (!wasSelected) next.add(fileName)
  logUserAction(`${wasSelected ? 'Deselected' : 'Selected'} voice recording "${fileName}"`)
  selected.value = next
}

const toggleSelectAll = (): void => {
  const selectAll = selected.value.size !== recordings.value.length
  logUserAction(`${selectAll ? 'Selected' : 'Deselected'} all voice recordings`)
  selected.value = new Set(selectAll ? recordings.value.map((r) => r.fileName) : [])
}

const download = async (fileNames: string[]): Promise<void> => {
  logUserAction(`Downloaded ${fileNames.length} voice recording(s)`)
  try {
    const downloadedCount = await downloadAudioRecordings(fileNames)
    if (downloadedCount === 0) {
      openSnackbar({ message: 'Could not find the selected voice recordings.', variant: 'error' })
      return
    }
    openSnackbar({ message: 'Voice recordings downloaded.', variant: 'success', duration: 3000 })
  } catch (error) {
    openSnackbar({ message: `Could not download the voice recordings. ${messageFromError(error)}`, variant: 'error' })
  }
}

const deleteRecordings = async (fileNames: string[]): Promise<void> => {
  logUserAction(`Deleted ${fileNames.length} voice recording(s)`)
  if (loadedFileName.value && fileNames.includes(loadedFileName.value)) unloadPlayer()
  try {
    await deleteAudioRecordings(fileNames)
    openSnackbar({ message: 'Voice recordings deleted.', variant: 'success', duration: 3000 })
  } catch (error) {
    openSnackbar({ message: `Could not delete the voice recordings. ${messageFromError(error)}`, variant: 'error' })
  }
  selected.value = new Set()
  await fetchRecordings()
}

const confirmDelete = (fileNames: string[]): void => {
  logUserAction(`Opened the confirmation to delete ${fileNames.length} voice recording(s)`)
  showDialog({
    variant: 'warning',
    message: `Delete ${fileNames.length} voice recording(s)?`,
    actions: [
      {
        text: 'Cancel',
        size: 'small',
        action: () => {
          logUserAction(`Cancelled deleting ${fileNames.length} voice recording(s)`)
          closeDialog()
        },
      },
      {
        text: 'Delete',
        size: 'small',
        color: 'error',
        action: () => {
          closeDialog()
          deleteRecordings(fileNames)
        },
      },
    ],
  })
}

const openFolder = (): void => {
  logUserAction('Opened the voice recordings folder')
  window.electronAPI?.openAudioFolder()
}

onMounted(fetchRecordings)
onBeforeUnmount(unloadPlayer)
</script>
