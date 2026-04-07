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
      @click="isTakingTimedSnapshot = !isTakingTimedSnapshot"
    />
  </div>
  <v-dialog v-model="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen" width="450">
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
        :items="videoStore.namesAvailableStreams || []"
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
      />
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
          Capture Cockpit work area (Electron only)
        </p>
      </div>
      <v-text-field
        v-model.number="timedSnapshotInterval"
        label="Timed snapshot interval (seconds)"
        type="number"
        density="compact"
        variant="outlined"
        hide-details
        theme="dark"
        class="w-[90%] mt-2"
        :min="1"
        step="1"
        @update:model-value="(val) => (timedSnapshotInterval = parseInt(val))"
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

import { useInteractionDialog } from '@/composables/interactionDialog'
import { openSnackbar } from '@/composables/snackbar'
import { isElectron } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useSnapshotStore } from '@/stores/snapshot'
import { useVideoStore } from '@/stores/video'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { SnapshotResult } from '@/types/snapshot'
import type { MiniWidget } from '@/types/widgets'

const { showDialog } = useInteractionDialog()
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
const isFailureDialogOpen = ref(false)
const timerProgress = ref<number>(50)

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
  const streamNames = miniWidget.value.options.snapshotAllAvailableSources
    ? videoStore.namesAvailableStreams
    : miniWidget.value.options.selectedStreams ?? []
  return snapshotStore.takeSnapshot(streamNames, miniWidget.value.options.captureWorkspace)
}

const handleSnapshotResult = (result: SnapshotResult): void => {
  const { succeeded, failed } = result

  if (succeeded.length > 0 && failed.length === 0) {
    flashEffect()
    openSnackbar({ message: 'Snapshot recorded successfully.', variant: 'success', duration: 2000 })
    return
  }

  if (succeeded.length > 0 && failed.length > 0) {
    flashEffect()
    openSnackbar({
      message: `Snapshot captured, but failed for: ${failed.join(', ')}.`,
      variant: 'warning',
      duration: 4000,
    })
    return
  }

  if (isFailureDialogOpen.value) return

  isFailureDialogOpen.value = true
  showDialog({
    title: 'Error taking snapshot',
    message:
      failed.length > 0
        ? `Failed to capture: ${failed.join(', ')}. Make sure the streams have finished loading.`
        : 'No sources available for capture. Make sure streams are connected or select specific ones in the widget settings.',
    variant: 'error',
    persistent: false,
    maxWidth: '550px',
  }).finally(() => {
    isFailureDialogOpen.value = false
  })
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

let progressInterval: ReturnType<typeof setInterval> | null = null
let shotInterval: ReturnType<typeof setInterval> | null = null

const fireTimedSnapshot = async (): Promise<void> => {
  const result = await captureSnapshot()
  handleSnapshotResult(result)
}

watch(isTakingTimedSnapshot, (newValue) => {
  if (newValue) {
    fireTimedSnapshot()
    openSnackbar({
      message: `Timed snapshot started. This will capture the selected interfaces every ${timedSnapshotInterval.value} seconds until you press the camera button again.`,
      variant: 'info',
      duration: 4000,
    })

    // Capture subsequent timed snapshots
    shotInterval = setInterval(() => {
      fireTimedSnapshot()
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

onBeforeMount(() => {
  const defaultOptions = {
    snapshotAllAvailableSources: true,
    selectedStreams: [] as string[],
    captureWorkspace: false,
    snapshotTriggerType: 'single' as 'single' | 'timed',
    timedSnapshotInterval: 5,
  }
  miniWidget.value.options = { ...defaultOptions, ...miniWidget.value.options }
})

onMounted(() => {
  if (!isElectronEnv) {
    miniWidget.value.options.captureWorkspace = false
  }
})
</script>
