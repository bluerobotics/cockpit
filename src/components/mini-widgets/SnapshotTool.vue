<template>
  <div
    ref="recorderWidget"
    class="flex justify-around pl-1 pr-[3px] py-1 text-center text-white rounded-lg w-[70px] h-9 align-center bg-slate-800/60"
    :class="{ 'pointer-events-none': widgetStore.editingMode }"
  >
    <v-menu v-model="isSnapshotMenuOpen" offset="4" transition="fade-transition">
      <template #activator="{ props: templateProps }">
        <div v-bind="templateProps" class="flex flex-col items-center justify-around pl-1 pr-2">
          <v-icon icon="mdi-menu-up" class="text-[22px] -mr-3 -ml-2 -mb-1 opacity-80 cursor-pointer" size="22" />
          <v-icon :icon="snapshotTypeIcon" class="text-[22px] -mr-3 -ml-2 mb-1 cursor-pointer opacity-60" size="14" />
        </div>
      </template>
      <v-list density="compact" class="pa-0 text-white rounded-md" :style="interfaceStore.globalGlassMenuStyles">
        <v-list-item
          class="bg-[#FFFFFF11] hover:bg-[#FFFFFF22] cursor-pointer text-sm"
          @click="handleOpenSnapshotLibrary"
          ><template #title>
            <span class="text-white text-[16px] font-bold">Open snapshot library</span>
          </template>
        </v-list-item>
        <v-divider />
        <v-list-item title="Single capture" @click="handleSelectSnapshotTriggerType('single')">
          <template #append>
            <v-icon size="22" icon="mdi-video-image" />
          </template>
        </v-list-item>
        <v-divider />
        <v-divider />
        <v-list-item title="Timed multi-capture" @click="handleSelectSnapshotTriggerType('timed')">
          <template #append> <v-icon size="20" icon="mdi-timer-outline" /> </template>
        </v-list-item>
      </v-list>
    </v-menu>
    <v-divider v-if="!isTakingTimedSnapshot" vertical />
    <div
      v-else
      class="bottom-0 left-0 w-[2px] bg-red-500 opacity-40"
      :style="{ height: `${timerProgress}%` }"
      color="green"
      value="90"
    />
    <v-icon icon="mdi-camera" class="mb-[-2px]" size="32" @click="handleTakeSnapshot" />
    <v-icon
      v-if="snapshotTriggerType === 'timed'"
      :icon="isTakingTimedSnapshot ? 'mdi-stop' : 'mdi-play'"
      class="mb-[-2px] cursor-pointer mr-1 bg-[#FFFFFFff] rounded-full"
      :class="{
        'text-red-500 -ml-[32px]': isTakingTimedSnapshot,
        'text-green-500 -ml-[33px]': !isTakingTimedSnapshot,
      }"
      size="22"
      @click="toggleTimedSnapshot"
    />
  </div>
  <v-dialog v-model="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen" width="500">
    <div
      class="flex flex-col items-center p-2 px-4 pt-1 m-5 rounded-md gap-y-4"
      :style="interfaceStore.globalGlassMenuStyles"
    >
      <p class="text-xl font-semibold mt-2 mb-4">Snapshot settings</p>
      <div class="absolute top-0 right-0">
        <v-tooltip
          location="bottom"
          open-on-click
          :persistent="false"
          :open-on-hover="false"
          :open-on-focus="false"
          close-on-content-click
        >
          <template #activator="{ props: iconProps }">
            <v-icon
              v-bind="iconProps"
              icon="mdi-information-outline"
              class="absolute top-2 right-2 cursor-pointer text-white"
              size="18"
            />
          </template>

          <span> Some features like “Capturing Cockpit work area” are only available in the Electron version. </span>
        </v-tooltip>
      </div>
      <div class="flex items-center justify-start w-[90%] -mb-2">
        <v-checkbox
          v-model="miniWidget.options.snapshotAllAvailableSources"
          density="compact"
          hide-details
          theme="dark"
        />
        <p class="ml-[4px] -mb-[2px] text-sm">Snapshot all available sources</p>
      </div>
      <v-select
        v-model="miniWidget.options.selectedStreams"
        :items="enrichedStreamItems"
        item-value="internalName"
        :disabled="miniWidget.options.snapshotAllAvailableSources"
        density="compact"
        multiple
        clearable
        label="Streams to capture"
        variant="outlined"
        no-data-text="No streams available."
        hide-details
        theme="dark"
        class="w-[90%]"
      >
        <template #selection="{ item }">
          <v-chip size="small" class="mr-1 pa-3">
            <span class="text-xs">{{ item.raw.internalName }}</span>
            <v-chip
              size="x-small"
              :color="item.raw.protocolLabel === 'RTSP' ? '#e67e22' : '#3498db'"
              variant="flat"
              label
              class="text-white ml-1 pa-1"
            >
              {{ item.raw.protocolLabel }}
            </v-chip>
          </v-chip>
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
      <div class="flex items-center justify-start w-[90%] -mt-3 mb-2">
        <v-checkbox
          v-model="miniWidget.options.captureWorkspace"
          :disabled="!isElectronEnv"
          :class="{ 'opacity-20 pointer-events-none': !isElectronEnv }"
          density="compact"
          variant="outlined"
          hide-details
          theme="dark"
          @update:model-value="(val) => (miniWidget.options.captureWorkspace = val)"
        />
        <p class="ml-[4px] -mb-[2px] text-sm" :class="{ 'opacity-20 pointer-events-none': !isElectronEnv }">
          Capture Cockpit work area (Desktop-only feature)
        </p>
      </div>
      <v-text-field
        v-model.number="timedSnapshotInterval"
        label="Timed snapshot interval (seconds)"
        type="number"
        density="compact"
        variant="outlined"
        hide-details="auto"
        theme="dark"
        class="w-[90%] mt-2"
        :min="MIN_TIMED_SNAPSHOT_INTERVAL_SEC"
        :step="MIN_TIMED_SNAPSHOT_INTERVAL_SEC"
        :rules="timedSnapshotIntervalRules"
        @blur="normalizeTimedSnapshotInterval"
      />
      <div class="flex w-[90%] justify-end items-center mt-4 border-t-[1px] border-t-[#FFFFFF11]">
        <v-btn
          class="w-auto text-uppercase mt-2 -mr-6"
          variant="text"
          @click="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen = false"
        >
          Close
        </v-btn>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, ref, toRefs, watch } from 'vue'

import { openSnackbar } from '@/composables/snackbar'
import { isElectron } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useSnapshotStore } from '@/stores/snapshot'
import { useVideoStore } from '@/stores/video'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { SnapshotResult } from '@/types/snapshot'
import type { MiniWidget } from '@/types/widgets'

const snapshotStore = useSnapshotStore()
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
const isElectronEnv = isElectron()

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
const snapshotTriggerType = ref<'single' | 'timed'>(miniWidget.value.options.snapshotTriggerType ?? 'single')
const snapshotTypeIcon = ref<'mdi-video-image' | 'mdi-timer-outline'>(
  snapshotTriggerType.value === 'timed' ? 'mdi-timer-outline' : 'mdi-video-image'
)
const isSnapshotMenuOpen = ref<boolean>(false)
const timedSnapshotInterval = computed({
  get: () => miniWidget.value.options.timedSnapshotInterval ?? 5,
  set: (val: number) => {
    miniWidget.value.options.timedSnapshotInterval = val
  },
})
const isTakingTimedSnapshot = ref<boolean>(false)
const timerProgress = ref<number>(50)
const SNAPSHOT_ERROR_SNACKBAR_DURATION = 8000
const isSnapshotErrorSnackbarOpen = ref(false)

const flashEffect = async (): Promise<void> => {
  const flashOverlay = document.createElement('div')
  flashOverlay.style.position = 'fixed'
  flashOverlay.style.top = '0'
  flashOverlay.style.left = '0'
  flashOverlay.style.width = '100%'
  flashOverlay.style.height = '100%'
  flashOverlay.style.backgroundColor = 'black'
  flashOverlay.style.opacity = '0'
  flashOverlay.style.transition = 'opacity 0.1s ease'
  flashOverlay.style.zIndex = '9999'

  document.body.appendChild(flashOverlay)

  void flashOverlay.offsetWidth

  flashOverlay.style.opacity = '0.4'
  await new Promise((resolve) => setTimeout(resolve, 50))

  flashOverlay.style.opacity = '0'
  await new Promise((resolve) => setTimeout(resolve, 100))

  document.body.removeChild(flashOverlay)
}

const captureSnapshot = async (): Promise<SnapshotResult> => {
  const allExternalIds = miniWidget.value.options.snapshotAllAvailableSources
    ? videoStore.namesAvailableStreams
    : ((miniWidget.value.options.selectedStreams as string[]) ?? [])
        .map((name: string) => videoStore.externalStreamId(name))
        .filter((id): id is string => !!id)
  const streamNames = allExternalIds.filter((id) => !videoStore.ignoredStreamExternalIds.includes(id))
  return snapshotStore.takeSnapshot(streamNames, miniWidget.value.options.captureWorkspace)
}

const toInternalName = (externalId: string): string => {
  return videoStore.internalStreamNameFromExternal(externalId) ?? externalId
}

const handleSnapshotResult = (result: SnapshotResult, isTimed = false): void => {
  const { succeeded, failed } = result

  if (succeeded.length > 0 && failed.length === 0) {
    flashEffect()
    // Timed captures only surface errors/warnings to avoid spamming a success snackbar per shot.
    if (!isTimed) {
      openSnackbar({ message: 'Snapshot recorded successfully.', variant: 'success', duration: 2000 })
    }
    return
  }

  const failedNames = failed.map(toInternalName).join(', ')

  if (succeeded.length > 0 && failed.length > 0) {
    flashEffect()
    openSnackbar({
      message: `Snapshot captured, but failed for: ${failedNames}.`,
      variant: 'warning',
      duration: 4000,
    })
    return
  }

  if (isSnapshotErrorSnackbarOpen.value) return

  isSnapshotErrorSnackbarOpen.value = true
  openSnackbar({
    message:
      failed.length > 0
        ? `Failed to take snapshot for: ${failedNames}. Make sure the streams have finished loading.`
        : 'No sources available for capture. Make sure streams are connected or select specific ones in the widget settings.',
    variant: 'error',
    duration: SNAPSHOT_ERROR_SNACKBAR_DURATION,
    closeButton: true,
  })
  setTimeout(() => (isSnapshotErrorSnackbarOpen.value = false), SNAPSHOT_ERROR_SNACKBAR_DURATION)
}

const handleTakeSnapshot = async (): Promise<void> => {
  isSnapshotMenuOpen.value = false
  if (snapshotTriggerType.value === 'timed') return
  const result = await captureSnapshot()
  handleSnapshotResult(result)
}

const handleOpenSnapshotLibrary = (): void => {
  isSnapshotMenuOpen.value = false
  interfaceStore.videoLibraryMode = 'snapshots'
  interfaceStore.videoLibraryVisibility = true
}

const handleSelectSnapshotTriggerType = (type: 'single' | 'timed'): void => {
  snapshotTriggerType.value = type
  snapshotTypeIcon.value = type === 'timed' ? 'mdi-timer-outline' : 'mdi-video-image'
  miniWidget.value.options.snapshotTriggerType = type
  isSnapshotMenuOpen.value = false
}

const MIN_TIMED_SNAPSHOT_INTERVAL_SEC = 0.1

const isValidTimedSnapshotInterval = (v: unknown): boolean =>
  typeof v === 'number' && Number.isFinite(v) && v >= MIN_TIMED_SNAPSHOT_INTERVAL_SEC

const timedSnapshotIntervalRules = [
  (v: unknown): boolean | string =>
    isValidTimedSnapshotInterval(v) || `Must be at least ${MIN_TIMED_SNAPSHOT_INTERVAL_SEC} seconds.`,
]

const normalizeTimedSnapshotInterval = (): void => {
  if (!isValidTimedSnapshotInterval(timedSnapshotInterval.value)) {
    timedSnapshotInterval.value = MIN_TIMED_SNAPSHOT_INTERVAL_SEC
  }
}

const toggleTimedSnapshot = (): void => {
  if (isTakingTimedSnapshot.value) {
    isTakingTimedSnapshot.value = false
    return
  }
  if (!isValidTimedSnapshotInterval(timedSnapshotInterval.value)) {
    openSnackbar({
      message: `Timed snapshot interval must be at least ${MIN_TIMED_SNAPSHOT_INTERVAL_SEC} seconds.`,
      variant: 'error',
      duration: 3000,
    })
    return
  }
  isTakingTimedSnapshot.value = true
}

let progressInterval: ReturnType<typeof setInterval> | null = null
let shotInterval: ReturnType<typeof setInterval> | null = null

const fireTimedSnapshot = async (): Promise<void> => {
  const result = await captureSnapshot()
  handleSnapshotResult(result, true)
}

watch(isTakingTimedSnapshot, (newValue) => {
  if (newValue) {
    fireTimedSnapshot().catch((err) => console.error('Timed snapshot capture failed:', err))
    openSnackbar({
      message: `Timed snapshot started. This will capture the selected interfaces every ${timedSnapshotInterval.value} seconds until you press the camera button again.`,
      variant: 'info',
      duration: 4000,
    })

    // Capture subsequent timed snapshots
    shotInterval = setInterval(() => {
      fireTimedSnapshot().catch((err) => console.error('Timed snapshot capture failed:', err))
      timerProgress.value = 0
    }, timedSnapshotInterval.value * 1000)

    // Update the progress bar
    const PROGRESS_TICK = 50
    const step = (100 * PROGRESS_TICK) / (timedSnapshotInterval.value * 1000)
    timerProgress.value = 0
    progressInterval = setInterval(() => {
      timerProgress.value = Math.min(timerProgress.value + step, 100)
    }, PROGRESS_TICK)
    return
  }
  openSnackbar({ message: 'Timed snapshot stopped.', variant: 'info', duration: 2000 })
  if (shotInterval) {
    clearInterval(shotInterval)
    shotInterval = null
  }
  if (progressInterval) {
    clearInterval(progressInterval)
    progressInterval = null
  }
  timerProgress.value = 0
})

const migrateSelectedStreamsToInternalNames = (): void => {
  const streams = miniWidget.value.options.selectedStreams as string[] | undefined
  if (!streams || streams.length === 0) return
  miniWidget.value.options.selectedStreams = streams.map((name: string) => {
    return videoStore.internalStreamNameFromExternal(name) ?? name
  })
}

onBeforeMount(() => {
  const defaultOptions = {
    snapshotAllAvailableSources: true,
    selectedStreams: [] as string[],
    captureWorkspace: true,
    snapshotTriggerType: 'single' as 'single' | 'timed',
    timedSnapshotInterval: 5,
  }
  miniWidget.value.options = { ...defaultOptions, ...miniWidget.value.options }
  migrateSelectedStreamsToInternalNames()
})

onMounted(() => {
  if (!isElectronEnv) {
    miniWidget.value.options.captureWorkspace = false
  }
})
</script>
