<template>
  <div
    ref="recorderWidget"
    class="flex justify-around pl-1 pr-[3px] py-1 text-center text-white rounded-lg w-[70px] h-9 align-center bg-slate-800/60"
  >
    <v-menu v-model="isSnapshotMenuOpen" offset="4" transition="fade-transition">
      <template #activator="{ props: templateProps }">
        <div v-bind="templateProps" class="flex flex-col items-center justify-around pl-1 pr-2">
          <v-icon icon="mdi-menu-up" class="text-[22px] -mr-3 -ml-2 -mb-1 opacity-80 cursor-pointer" size="22" />
          <v-icon :icon="snapshotTypeIcon" class="text-[22px] -mr-3 -ml-2 mb-1 cursor-pointer opacity-60" size="14" />
        </div>
      </template>
      <v-list density="compact" class="pa-0 text-white rounded-md" :style="interfaceStore.globalGlassMenuStyles">
        <v-list-item title="Video feed" @click="handleSelectSnapshotType('video')">
          <template #append>
            <v-icon size="22" icon="mdi-video" />
          </template>
        </v-list-item>
        <v-divider />
        <v-list-item
          :disabled="!isElectronEnv"
          :class="{ 'opacity-50 pointer-events-none': !isElectronEnv }"
          @click="isElectronEnv && handleSelectSnapshotType('workspace')"
        >
          Cockpit work area
          <template #append>
            <v-icon size="19" icon="mdi-monitor" />
          </template>
        </v-list-item>
        <v-divider />
        <v-list-item title="Timed snapshot" @click="handleSelectSnapshotType('timed')">
          <template #append> <v-icon size="20" icon="mdi-timer-outline" /> </template>
        </v-list-item>
        <v-divider />
        <v-list-item
          class="bg-[#FFFFFF11] hover:bg-[#FFFFFF22] cursor-pointer text-sm"
          @click="handleOpenSnapshotLibrary"
          ><template #title>
            <span class="text-white text-[16px] font-bold">Open snapshot library</span>
          </template>
        </v-list-item>
      </v-list>
    </v-menu>
    <v-divider vertical />
    <v-icon icon="mdi-camera" class="mb-[-2px]" size="32" @click="handleTakeSnapshot" />
    <v-icon
      v-if="snapshotType === 'timed'"
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
  <v-dialog v-model="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen" width="auto">
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
      <v-select
        v-model="miniWidget.options.selectedStreams"
        :items="videoStore.namesAvailableStreams || []"
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
      <v-select
        :model-value="timedSnapshotTarget"
        label="Timed snapshot target"
        :items="[
          { value: 'Selected streams', text: 'Selected streams' },
          { value: 'Cockpit work area', text: 'Cockpit work area' },
        ]"
        item-title="text"
        item-value="value"
        density="compact"
        variant="outlined"
        no-data-text="No options available."
        hide-details
        theme="dark"
        class="w-[90%] mt-2"
        @update:model-value="(val) => (timedSnapshotTarget = val)"
      >
        <template #item="{ item, props: itemProps }">
          <v-list-item v-bind="itemProps" :disabled="item.value === 'Cockpit work area' && !isElectronEnv">
            <v-list-item-title v-text="item.text" />
          </v-list-item>
        </template>
      </v-select>
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
      <div class="flex w-full justify-end items-center mt-4">
        <v-btn
          class="w-auto text-uppercase"
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
import { onBeforeMount, ref, toRefs, watch } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { openSnackbar } from '@/composables/snackbar'
import { isElectron } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useVideoStore } from '@/stores/video'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { MiniWidget } from '@/types/widgets'

const { showDialog } = useInteractionDialog()
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
const snapshotTypeIcon = ref<'mdi-video' | 'mdi-monitor' | 'mdi-timer-outline'>('mdi-video')
const snapshotType = ref<'video' | 'workspace' | 'timed'>('video')
const isSnapshotMenuOpen = ref<boolean>(false)
const timedSnapshotInterval = ref<number>(5)
const timedSnapshotTarget = ref<'Selected streams' | 'Cockpit work area'>('Selected streams')
const isTakingTimedSnapshot = ref<boolean>(false)

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

const handleTakeSnapshot = async (): Promise<void> => {
  if (!areSelectedStreamsAreAvailable()) return
  isSnapshotMenuOpen.value = false

  try {
    if (snapshotType.value !== 'timed') {
      flashEffect()
      openSnackbar({
        message: 'Snapshot recorded successfully.',
        variant: 'success',
        duration: 2000,
      })
    }
  } catch (error) {
    showDialog({ message: `Error taking snapshot: ${error}`, variant: 'error' })
    return
  }
}

const handleOpenSnapshotLibrary = (): void => {
  isSnapshotMenuOpen.value = false
  interfaceStore.videoLibraryVisibility = true
  interfaceStore.videoLibraryMode = 'snapshot'
}

const handleSelectSnapshotType = (type: 'video' | 'workspace' | 'timed'): void => {
  snapshotType.value = type
  isSnapshotMenuOpen.value = false
  switch (type) {
    case 'video':
      snapshotTypeIcon.value = 'mdi-video'
      break
    case 'workspace':
      snapshotTypeIcon.value = 'mdi-monitor'
      break
    case 'timed':
      snapshotTypeIcon.value = 'mdi-timer-outline'
      break
  }
}

watch(isTakingTimedSnapshot, (newValue) => {
  let interval: ReturnType<typeof setInterval> | undefined = undefined

  if (newValue) {
    flashEffect()
    openSnackbar({
      message: `Timed snapshot started. This will capture the selected interfaces every ${timedSnapshotInterval.value} seconds until you press the camera button again.`,
      variant: 'info',
      duration: 4000,
    })
    interval = setInterval(() => {
      handleTakeSnapshot()
    }, timedSnapshotInterval.value * 1000)
  }
  if (!newValue) {
    openSnackbar({
      message: 'Timed snapshot stopped.',
      variant: 'info',
      duration: 2000,
    })
    clearInterval(interval)
  }
})

const areSelectedStreamsAreAvailable = (): boolean => {
  if (
    miniWidget.value.options.selectedStreams.every((stream: string) =>
      videoStore.namesAvailableStreams.includes(stream)
    )
  ) {
    miniWidget.value.options.nameSelectedStreams = miniWidget.value.options.selectedStreams
    return true
  }

  showDialog({
    message: 'Selected streams are not available anymore. Please check the currently available options.',
    variant: 'warning',
  })
  return false
}

onBeforeMount(async () => {
  // Set initial widget options if they don't exist
  if (Object.keys(miniWidget.value.options).length === 0) {
    miniWidget.value.options = {
      selectedStreams: undefined as string[] | undefined,
    }
  }
})
</script>
