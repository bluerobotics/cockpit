<template>
  <div class="min-w-[290px] min-h-[115px] flex items-end">
    <div
      class="w-full rounded-lg overflow-hidden -mt-2"
      :class="[isWrapped ? 'h-[42px]' : 'h-full']"
      :style="interfaceStore.globalGlassMenuStyles"
    >
      <div class="flex flex-col justify-start items-center h-full pt-2 cursor-pointer">
        <div class="flex justify-between w-full px-2 pb-[2px] border-b-[1px] border-[#FFFFFF15]">
          <v-icon class="cursor-grab opacity-40" @mousedown="enableMovingOnDrag" @mouseup="disableMovingOnDrag">
            mdi-drag
          </v-icon>
          <div class="select-none text-[14px] font-bold mt-[1px]">Mission control panel</div>
          <v-btn
            :icon="isWrapped ? 'mdi-chevron-up' : 'mdi-chevron-down'"
            variant="text"
            size="36"
            class="mt-[-6px] opacity-60 -mr-1"
            @click="toggleWrapContainer"
          />
        </div>
        <v-divider v-if="!isWrapped" />
        <div
          v-show="!isWrapped"
          class="flex justify-center items-center w-full h-full bg-[#00000022] shadow-[inset_0_2px_3px_-1px_rgba(0,0,0,0.45)]"
        >
          <div
            class="flex w-full h-full justify-start items-center overflow-hidden px-1"
            :class="!vehicleStore.isVehicleOnline ? 'active-events-on-disabled' : ''"
            style="border-radius: 3px"
          >
            <div class="flex justify-around items-center w-full">
              <v-tooltip location="top" open-delay="800" text="Skip to previous waypoint">
                <template #activator="{ props: skipPrevProps }">
                  <v-btn
                    v-bind="skipPrevProps"
                    size="x-small"
                    icon="mdi-skip-previous"
                    variant="text"
                    class="text-[20px]"
                    :disabled="!missionStore.canSkipToPrevWp || !vehicleStore.isVehicleOnline"
                    @click.stop="missionStore.skipToWaypoint(-1)"
                  />
                </template>
              </v-tooltip>
              <v-tooltip
                location="top"
                open-delay="800"
                :text="missionStore.isMissionRunning ? 'Pause mission' : 'Start / resume mission'"
              >
                <template #activator="{ props: playPauseProps }">
                  <v-btn
                    v-bind="playPauseProps"
                    size="x-small"
                    :icon="missionStore.isMissionRunning ? 'mdi-pause' : 'mdi-play'"
                    variant="text"
                    class="text-[20px]"
                    :disabled="!vehicleStore.isVehicleOnline"
                    @click.stop="handlePlayAndPause"
                  />
                </template>
              </v-tooltip>
              <v-tooltip location="top" open-delay="800" text="Skip to next waypoint">
                <template #activator="{ props: skipNextProps }">
                  <v-btn
                    v-bind="skipNextProps"
                    size="x-small"
                    icon="mdi-skip-next"
                    variant="text"
                    class="text-[20px]"
                    :disabled="!missionStore.canSkipToNextWp || !vehicleStore.isVehicleOnline"
                    @click.stop="missionStore.skipToWaypoint(1)"
                  />
                </template>
              </v-tooltip>
              <v-divider vertical class="h-[25px] mt-[3px] mx-1 opacity-10" />
              <v-menu :close-on-content-click="false" location="top" offset="8">
                <template #activator="{ props: speedProps }">
                  <v-tooltip location="top" open-delay="800" text="Cruise speed">
                    <template #activator="{ props: speedTooltipProps }">
                      <v-btn
                        v-bind="{ ...speedProps, ...speedTooltipProps }"
                        size="x-small"
                        icon="mdi-speedometer"
                        variant="text"
                        class="text-[18px]"
                        :disabled="!vehicleStore.isVehicleOnline"
                      />
                    </template>
                  </v-tooltip>
                </template>
                <div
                  class="flex flex-col p-3 rounded-lg w-[210px] text-white"
                  :style="interfaceStore.globalGlassMenuStyles"
                >
                  <div class="flex justify-between items-center mb-1 text-xs">
                    <span>Cruise speed</span>
                    <span class="font-bold">{{ liveCruiseSpeed.toFixed(1) }} m/s</span>
                  </div>
                  <v-slider
                    v-model="liveCruiseSpeed"
                    :min="0.1"
                    :max="5"
                    :step="0.1"
                    color="white"
                    density="compact"
                    hide-details
                    @update:model-value="handleCruiseSpeedInput"
                  />
                </div>
              </v-menu>
              <v-tooltip location="top" open-delay="800" text="Return to home">
                <template #activator="{ props: homeProps }">
                  <v-btn
                    v-bind="homeProps"
                    size="x-small"
                    icon="mdi-home-circle"
                    variant="text"
                    class="text-[18px] mr-1"
                    :disabled="!vehicleStore.isVehicleOnline"
                    @click.stop="handleReturnHome"
                  />
                </template>
              </v-tooltip>
            </div>
            <div class="flex justify-end items-center">
              <div
                class="flex flex-col justify-center items-center w-[54px] h-[35px] mx-1 text-[10px] border-[1px] border-[#ffffff33] rounded-[4px] elevation-1 bg-[#EFFFFF22] select-none"
              >
                <div class="w-full text-nowrap text-center font-bold text-shadow-md">Curr. WP</div>
                <div class="text-[12px] -mt-[2px] font-bold">{{ currentWaypointOnMission }}</div>
              </div>
              <v-menu offset-y theme="dark">
                <template #activator="{ props: menuProps }">
                  <v-btn
                    variant="text"
                    v-bind="menuProps"
                    icon="mdi-dots-vertical"
                    size="22"
                    class="cursor-pointer text-[14px]"
                  />
                </template>

                <v-list class="py-0">
                  <v-list-item
                    :disabled="!vehicleStore.isVehicleOnline"
                    class="cursor-pointer"
                    @click="handleDownloadMissionOnMap"
                  >
                    <v-list-item-title class="text-[14px]">Download mission from vehicle</v-list-item-title>
                  </v-list-item>
                  <v-divider class="opacity-10" />
                  <v-list-item
                    :disabled="!vehicleStore.isVehicleOnline"
                    class="cursor-pointer py-0"
                    @click="handleClearMissionOnMap"
                  >
                    <v-list-item-title class="text-[14px]">Clear mission on map</v-list-item-title>
                  </v-list-item>
                  <v-divider class="opacity-10" />
                  <v-list-item class="cursor-pointer" @click="missionStore.resetMissionDistance()">
                    <v-list-item-title class="text-[14px]">Reset mission distance</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </div>
          </div>
        </div>
        <v-divider v-if="!isWrapped" class="w-full opacity-10" />
        <div
          v-if="!isWrapped"
          class="flex justify-around items-center w-full px-2 py-[2px] text-[11px] tabular-nums select-none"
        >
          <v-icon size="14" class="position fixed left-4 opacity-80 text-[#ffb85b]">mdi-map-marker-distance</v-icon>
          <v-tooltip location="bottom" open-delay="800" text="Total distance the vehicle has traveled">
            <template #activator="{ props: totalProps }">
              <div v-bind="totalProps" class="flex items-center gap-1 text-[#ffb85b] pl-6">
                <span class="opacity-80">Total:</span>
                <span class="font-bold">{{ formattedTotalDistance }}</span>
              </div>
            </template>
          </v-tooltip>
          <v-tooltip
            location="bottom"
            open-delay="800"
            text="Distance traveled during the current mission, since waypoint 1"
          >
            <template #activator="{ props: missionProps }">
              <div v-bind="missionProps" class="flex items-center gap-1 text-[#ffb85b] pr-4">
                <span class="opacity-80">Mission:</span>
                <span class="font-bold">{{ formattedMissionDistance }}</span>
              </div>
            </template>
          </v-tooltip>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, toRefs, watch } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { openSnackbar } from '@/composables/snackbar'
import { useTraveledDistances } from '@/composables/useTraveledDistances'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Widget } from '@/types/widgets'

const { showDialog, closeDialog } = useInteractionDialog()
const interfaceStore = useAppInterfaceStore()

const widgetStore = useWidgetManagerStore()
const vehicleStore = useMainVehicleStore()
const missionStore = useMissionStore()

const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()
const widget = toRefs(props).widget
const isWrapped = ref(false)

const currentWaypointOnMission = computed<string>((): string => {
  const wpIndex = missionStore.currentWaypointOnMission
  return wpIndex > 0 ? wpIndex.toString() : '--'
})

const liveCruiseSpeed = ref<number>(Number(missionStore.cruiseSpeed))
watch(
  () => missionStore.cruiseSpeed,
  (newSpeed) => (liveCruiseSpeed.value = Number(newSpeed))
)

// Debounce live speed commands so dragging the slider doesn't flood the vehicle with DO_CHANGE_SPEED.
let cruiseSpeedDebounce: ReturnType<typeof setTimeout> | undefined
const handleCruiseSpeedInput = (value: number): void => {
  if (cruiseSpeedDebounce) clearTimeout(cruiseSpeedDebounce)
  cruiseSpeedDebounce = setTimeout(() => {
    missionStore.applyCruiseSpeed(value).catch((err) => {
      openSnackbar({ message: `Failed to set cruise speed: ${(err as Error).message}`, variant: 'error' })
    })
  }, 300)
}

const toggleWrapContainer = (): void => {
  isWrapped.value = !isWrapped.value
}

const enableMovingOnDrag = (): void => {
  widgetStore.allowMovingAndResizing(widget.value.hash, true)
  window.addEventListener('mouseup', disableMovingOnDrag)
  window.addEventListener('dragend', disableMovingOnDrag)
}

const disableMovingOnDrag = (): void => {
  widgetStore.allowMovingAndResizing(widget.value.hash, widgetStore.editingMode)
  window.removeEventListener('mouseup', disableMovingOnDrag)
  window.removeEventListener('dragend', disableMovingOnDrag)
}

const widgetSize = {
  width: 0.152,
  height: 0.11,
}

const { formattedTotalDistance, formattedMissionDistance } = useTraveledDistances()

const handleDownloadMissionOnMap = async (): Promise<void> => {
  missionStore.requestMapMissionDownload()
}

const handleClearMissionOnMap = (): void => {
  missionStore.requestMapClear()
}

onBeforeMount(() => {
  widgetStore.widgetManagerVars(widget.value.hash).allowResizing = false
  widget.value.size = widgetSize
})

const handleReturnHome = (): void => {
  showDialog({
    title: 'Return to home',
    message: 'Are you sure you want to send the vehicle home?',
    variant: 'warning',
    actions: [
      {
        text: 'Cancel',
        size: 'small',
        action: closeDialog,
      },
      {
        text: 'Confirm',
        size: 'small',
        action: () => {
          closeDialog()
          vehicleStore.returnHome().catch((err) => {
            openSnackbar({
              message: `Failed to return home: ${(err as Error).message}`,
              variant: 'error',
            })
          })
        },
      },
    ],
  })
}

const handlePlayAndPause = async (): Promise<void> => {
  try {
    if (!missionStore.isMissionRunning) {
      missionStore.executeMissionOnVehicle()
    } else {
      await vehicleStore.pauseMission()
    }
  } catch (err) {
    openSnackbar({
      message: `Failed to ${missionStore.isMissionRunning ? 'pause' : 'start'} mission: ${(err as Error).message}`,
      variant: 'error',
    })
  }
}
</script>
