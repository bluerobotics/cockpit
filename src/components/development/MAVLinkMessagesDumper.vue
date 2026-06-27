<template>
  <div class="flex flex-col gap-3 px-2 py-3">
    <p class="text-sm text-slate-100/70">
      Captures every MAVLink message exchanged with the main connection (both incoming and outgoing) into an in-memory
      buffer. Use it to inspect the raw stream when debugging issues like multi-instance messages or missing values.
    </p>
    <div class="flex flex-wrap items-center gap-3">
      <v-btn
        :color="isMavlinkDumperRecording ? 'red' : 'green'"
        variant="flat"
        size="small"
        :prepend-icon="isMavlinkDumperRecording ? 'mdi-stop' : 'mdi-record'"
        @click="toggleMavlinkDumperRecording"
      >
        {{ isMavlinkDumperRecording ? 'Stop' : 'Start' }}
      </v-btn>
      <v-btn
        variant="outlined"
        size="small"
        prepend-icon="mdi-chart-timeline-variant"
        :disabled="!mavlinkDumperHasDump"
        @click="openInMemoryDumpViewer"
      >
        {{ isMavlinkDumperRecording ? 'Live plot' : 'Plot last recording' }}
      </v-btn>
      <v-btn
        variant="outlined"
        size="small"
        prepend-icon="mdi-download"
        :disabled="!mavlinkDumperHasDump || isMavlinkDumperRecording"
        @click="downloadMavlinkDump"
      >
        Download dump
      </v-btn>
      <v-btn
        variant="outlined"
        size="small"
        prepend-icon="mdi-chart-line"
        :disabled="isMavlinkDumperRecording"
        @click="openDumpFilePicker"
      >
        Load &amp; plot dump
      </v-btn>
      <v-btn
        variant="text"
        size="small"
        prepend-icon="mdi-trash-can-outline"
        :disabled="!mavlinkDumperHasDump || isMavlinkDumperRecording"
        @click="onClearMavlinkDumperDump"
      >
        Clear
      </v-btn>
      <input
        ref="dumpFileInput"
        type="file"
        accept=".jsonl,.json,.ndjson,application/json,application/x-ndjson,text/plain"
        class="hidden"
        @change="onDumpFileSelected"
      />
    </div>
    <div class="mavlink-dumper-stats">
      <span class="mavlink-dumper-stat">
        <span class="mavlink-dumper-stat-label">Messages:</span>
        <span class="mavlink-dumper-stat-value">{{ mavlinkDumperMessageCount.toLocaleString() }}</span>
      </span>
      <span class="mavlink-dumper-stat">
        <span class="mavlink-dumper-stat-label">Size:</span>
        <span class="mavlink-dumper-stat-value">{{ formatMavlinkDumperSize(mavlinkDumperDumpSizeBytes) }}</span>
      </span>
      <span v-if="mavlinkDumperStartedAt !== null" class="mavlink-dumper-stat">
        <span class="mavlink-dumper-stat-label">{{ isMavlinkDumperRecording ? 'Recording for:' : 'Captured:' }}</span>
        <span class="mavlink-dumper-stat-value">{{ formatDumpDuration(elapsedMavlinkDumperRecordingMs) }}</span>
      </span>
    </div>
    <MavlinkDumpViewer v-model="dumpViewerOpen" :dump-content="loadedDumpContent" :file-name="loadedDumpFileName" />
  </div>
</template>

<script setup lang="ts">
import { saveAs } from 'file-saver'
import { onBeforeMount, onBeforeUnmount, ref } from 'vue'

import MavlinkDumpViewer from '@/components/MavlinkDumpViewer.vue'
import {
  clearMavlinkDumperDump,
  getMavlinkDumperDump,
  isMavlinkDumperRecording,
  mavlinkDumperDumpSizeBytes,
  mavlinkDumperHasDump,
  mavlinkDumperMessageCount,
  mavlinkDumperStartedAt,
  startMavlinkDumperRecording,
  stopMavlinkDumperRecording,
} from '@/libs/mavlink-message-dumper'

const elapsedMavlinkDumperRecordingMs = ref(0)
let mavlinkDumperTickInterval: ReturnType<typeof setInterval> | null = null

const refreshMavlinkDumperElapsed = (): void => {
  const startedAt = mavlinkDumperStartedAt.value
  elapsedMavlinkDumperRecordingMs.value = startedAt === null ? 0 : Date.now() - startedAt
}

const toggleMavlinkDumperRecording = (): void => {
  logUserAction(isMavlinkDumperRecording.value ? 'Stopped MAVLink dump recording' : 'Started MAVLink dump recording')
  if (isMavlinkDumperRecording.value) {
    stopMavlinkDumperRecording()
    refreshMavlinkDumperElapsed()
    if (mavlinkDumperTickInterval !== null) {
      clearInterval(mavlinkDumperTickInterval)
      mavlinkDumperTickInterval = null
    }
    return
  }

  startMavlinkDumperRecording()
  refreshMavlinkDumperElapsed()
  mavlinkDumperTickInterval = setInterval(refreshMavlinkDumperElapsed, 500)
}

const downloadMavlinkDump = (): void => {
  const dump = getMavlinkDumperDump()
  if (!dump) return
  logUserAction('Downloaded MAVLink dump')
  const blob = new Blob([dump], { type: 'application/x-ndjson' })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  saveAs(blob, `cockpit-mavlink-dump-${timestamp}.jsonl`)
}

const dumpFileInput = ref<HTMLInputElement | null>(null)
const dumpViewerOpen = ref(false)
const loadedDumpContent = ref('')
const loadedDumpFileName = ref('')

const openInMemoryDumpViewer = (): void => {
  if (isMavlinkDumperRecording.value) {
    loadedDumpContent.value = ''
  } else {
    loadedDumpContent.value = getMavlinkDumperDump()
  }
  if (isMavlinkDumperRecording.value || loadedDumpContent.value) {
    logUserAction('Opened in-memory MAVLink dump viewer')
    loadedDumpFileName.value = isMavlinkDumperRecording.value ? 'In-memory buffer (live)' : 'In-memory buffer'
    dumpViewerOpen.value = true
  }
}

const onClearMavlinkDumperDump = (): void => {
  logUserAction('Cleared MAVLink dump')
  clearMavlinkDumperDump()
  loadedDumpContent.value = ''
}

const openDumpFilePicker = (): void => {
  if (!dumpFileInput.value) return
  dumpFileInput.value.value = ''
  dumpFileInput.value.click()
}

const onDumpFileSelected = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    loadedDumpContent.value = await file.text()
    loadedDumpFileName.value = file.name
    logUserAction(`Loaded MAVLink dump file '${file.name}'`)
    dumpViewerOpen.value = true
  } catch (error) {
    console.error('Error loading MAVLink dump file:', error)
  } finally {
    input.value = ''
  }
}

const formatDumpDuration = (ms: number): string => {
  if (ms <= 0) return '0s'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

const formatMavlinkDumperSize = (bytes: number): string => {
  if (!bytes) return '0.0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

onBeforeMount(() => {
  // Re-sync the elapsed counter in case a recording was already running before this view mounted.
  refreshMavlinkDumperElapsed()
  if (isMavlinkDumperRecording.value && mavlinkDumperTickInterval === null) {
    mavlinkDumperTickInterval = setInterval(refreshMavlinkDumperElapsed, 500)
  }
})

onBeforeUnmount(() => {
  if (mavlinkDumperTickInterval) {
    clearInterval(mavlinkDumperTickInterval)
    mavlinkDumperTickInterval = null
  }
})
</script>

<style scoped>
.mavlink-dumper-stats {
  display: flex;
  flex-wrap: wrap;
  column-gap: 2rem;
  row-gap: 0.25rem;
  font-size: 0.875rem;
  color: rgb(241 245 249 / 0.8);
}

.mavlink-dumper-stat {
  display: inline-flex;
  align-items: baseline;
  column-gap: 0.25rem;
}

.mavlink-dumper-stat-label {
  color: rgb(241 245 249 / 0.5);
}

.mavlink-dumper-stat-value {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
}
</style>
