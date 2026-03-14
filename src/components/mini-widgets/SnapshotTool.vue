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
            <span class="text-white text-[16px] font-bold">{{
              $t('components.mini-widgets.SnapshotTool.openLibrary')
            }}</span>
          </template>
        </v-list-item>
        <v-divider />
        <v-list-item
          :title="$t('components.mini-widgets.SnapshotTool.singleCapture')"
          @click="handleSelectSnapshotTriggerType('single')"
        >
          <template #append>
            <v-icon size="22" icon="mdi-video-image" />
          </template>
        </v-list-item>
        <v-divider />
        <v-divider />
        <v-list-item
          :title="$t('components.mini-widgets.SnapshotTool.timedMultiCapture')"
          @click="handleSelectSnapshotTriggerType('timed')"
        >
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
      <p class="text-xl font-semibold mt-2 mb-4">{{ $t('components.mini-widgets.snapshotTool.settings') }}</p>
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

          <span>{{ $t('components.mini-widgets.snapshotTool.electronOnlyFeatures') }}</span>
        </v-tooltip>
      </div>
      <v-select
        v-model="miniWidget.options.selectedStreams"
        :items="videoStore.namesAvailableStreams || []"
        density="compact"
        multiple
        clearable
        :label="$t('components.mini-widgets.snapshotTool.streamsToCapture')"
        variant="outlined"
        :no-data-text="$t('components.mini-widgets.snapshotTool.noStreamsAvailable')"
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
          {{ $t('components.mini-widgets.snapshotTool.captureWorkspace') }}
        </p>
      </div>
      <v-text-field
        v-model.number="timedSnapshotInterval"
        :label="$t('components.mini-widgets.snapshotTool.timedSnapshotInterval')"
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
import { useI18n } from 'vue-i18n'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { openSnackbar } from '@/composables/snackbar'
import { isElectron } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useSnapshotStore } from '@/stores/snapshot'
import { useVideoStore } from '@/stores/video'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { MiniWidget } from '@/types/widgets'

const { showDialog } = useInteractionDialog()
const { t } = useI18n()
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

const captureSnapshot = async (): Promise<void> => {
  await snapshotStore.takeSnapshot(
    miniWidget.value.options.selectedStreams ?? [],
    miniWidget.value.options.captureWorkspace
  )
}

const handleTakeSnapshot = async (): Promise<void> => {
  isSnapshotMenuOpen.value = false

  try {
    if (snapshotTriggerType.value !== 'timed') {
      await captureSnapshot()
      flashEffect()
      openSnackbar({ message: 'Snapshot recorded successfully.', variant: 'success', duration: 2000 })
    }
  } catch (error) {
    showDialog({
      title: 'Error taking snapshot',
      message: 'Make sure the streams have finished loading.',
      variant: 'error',
      persistent: false,
      maxWidth: '550px',
    })
  }
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
  try {
    await captureSnapshot()
  } catch (error) {
    openSnackbar({ message: `Timed snapshot failed: ${error}`, variant: 'error', duration: 3000 })
  }
}

watch(isTakingTimedSnapshot, (newValue) => {
  if (newValue) {
    fireTimedSnapshot()
    flashEffect()
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
  openSnackbar({ message: t('info.timedSnapshotStopped'), variant: 'info', duration: 2000 })
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
