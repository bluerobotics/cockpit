<template>
  <div class="min-w-[290px] min-h-[115px] flex items-end">
    <div
      class="w-full rounded-lg overflow-hidden -mt-2"
      :class="[isWrapped ? 'h-[38px]' : 'h-full']"
      :style="interfaceStore.globalGlassMenuStyles"
    >
      <div class="flex flex-col justify-start items-center h-full pt-1 cursor-pointer">
        <div class="flex items-center justify-between w-full px-2 pb-[2px] border-b-[1px] border-[#FFFFFF15]">
          <v-icon class="cursor-grab opacity-40" @mousedown="enableMovingOnDrag" @mouseup="disableMovingOnDrag">
            mdi-drag
          </v-icon>
          <div class="select-none text-[14px] font-bold mb-[2px]">Mission control panel</div>
          <v-btn
            :icon="isWrapped ? 'mdi-chevron-up' : 'mdi-chevron-down'"
            variant="text"
            size="30"
            class="opacity-60 -mr-1"
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
                    @click.stop="skipToPreviousWaypoint"
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
                    @click.stop="skipToNextWaypoint"
                  />
                </template>
              </v-tooltip>
              <v-divider vertical class="h-[25px] mt-[3px] mx-1 opacity-10" />
              <CruiseSpeedControl />
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
                  <v-list-item class="cursor-pointer py-0" @click="handleClearMissionOnMap">
                    <v-list-item-title class="text-[14px]">Clear mission on map</v-list-item-title>
                  </v-list-item>
                  <v-divider class="opacity-10" />
                  <v-list-item class="cursor-pointer" @click="missionStore.resetMissionDistance()">
                    <v-list-item-title class="text-[14px]">Reset mission distance</v-list-item-title>
                  </v-list-item>
                  <v-divider class="opacity-10" />
                  <v-list-item class="cursor-pointer" @click="handleResetTotalDistance">
                    <v-list-item-title class="text-[14px]">Reset total distance</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </div>
          </div>
        </div>
        <v-divider v-if="!isWrapped" class="w-full opacity-10" />
        <div
          v-if="!isWrapped"
          class="flex justify-center items-center gap-4 w-full px-2 py-[2px] text-[11px] tabular-nums select-none"
        >
          <v-icon size="14" class="opacity-80 text-odometer">mdi-map-marker-distance</v-icon>
          <v-tooltip location="bottom" open-delay="800" text="Total distance the vehicle has traveled">
            <template #activator="{ props: totalProps }">
              <div v-bind="totalProps" class="flex items-center gap-1 text-odometer">
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
              <div v-bind="missionProps" class="flex items-center gap-1 text-odometer">
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
import { computed, onBeforeMount, ref, toRefs } from 'vue'

import CruiseSpeedControl from '@/components/mission-planning/CruiseSpeedControl.vue'
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

const skipToPreviousWaypoint = (): void => {
  logUserAction('Skipped to previous mission waypoint')
  missionStore.skipToWaypoint(-1)
}

const skipToNextWaypoint = (): void => {
  logUserAction('Skipped to next mission waypoint')
  missionStore.skipToWaypoint(1)
}

const { formattedTotalDistance, formattedMissionDistance } = useTraveledDistances()

const handleDownloadMissionOnMap = async (): Promise<void> => {
  logUserAction('Requested mission download from vehicle to map')
  missionStore.requestMapMissionDownload()
}

const handleClearMissionOnMap = (): void => {
  logUserAction('Cleared mission drawn on map')
  missionStore.requestMapClear()
}

const handleResetTotalDistance = (): void => {
  showDialog({
    title: 'Reset total distance',
    message: `The total distance traveled by this vehicle (${formattedTotalDistance.value}) will be discarded and start counting from zero. This cannot be undone.`,
    variant: 'warning',
    actions: [
      { text: 'Cancel', size: 'small', action: closeDialog },
      {
        text: 'Reset',
        size: 'small',
        action: () => {
          closeDialog()
          missionStore.resetTotalDistance()
          openSnackbar({ message: 'Total traveled distance reset', variant: 'success' })
        },
      },
    ],
  })
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
          logUserAction('Confirmed return to home from mission control panel')
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
      logUserAction('Started/resumed mission from mission control panel')
      missionStore.executeMissionOnVehicle()
    } else {
      logUserAction('Paused mission from mission control panel')
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
