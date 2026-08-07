<template>
  <div
    ref="miniMissionControlPanel"
    class="flex justify-around px-2 py-1 text-center rounded-lg w-[252px] h-9 align-center text-white bg-slate-800/60"
  >
    <div
      class="flex gap-1 items-center overflow-hidden"
      :class="!vehicleStore.isVehicleOnline ? 'active-events-on-disabled' : ''"
    >
      <v-tooltip location="top" open-delay="800" text="Skip to previous waypoint">
        <template #activator="{ props: skipPrevProps }">
          <v-btn
            v-bind="skipPrevProps"
            size="x-small"
            icon="mdi-skip-previous"
            variant="text"
            class="text-[16px]"
            :disabled="!missionStore.canSkipToPrevWp"
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
            class="text-[16px]"
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
            class="text-[16px]"
            :disabled="!missionStore.canSkipToNextWp || !vehicleStore.isVehicleOnline"
            @click.stop="skipToNextWaypoint"
          />
        </template>
      </v-tooltip>
      <CruiseSpeedControl icon-class="text-[16px]" :show-speed-value="false" />
      <v-tooltip location="top" open-delay="800" text="Return to home">
        <template #activator="{ props: homeProps }">
          <v-btn
            v-bind="homeProps"
            size="x-small"
            icon="mdi-home-circle"
            variant="text"
            class="text-[14px]"
            :disabled="!vehicleStore.isVehicleOnline"
            @click.stop="handleReturnHome"
          />
        </template>
      </v-tooltip>
      <v-divider vertical class="h-[25px] mt-[5px]" />
      <v-menu
        :open-on-hover="true"
        :open-on-click="true"
        :close-on-content-click="false"
        location="top"
        offset="6"
        theme="dark"
      >
        <template #activator="{ props: wpProps }">
          <div
            v-bind="wpProps"
            class="flex flex-col justify-between w-[46px] h-[33px] text-[8px] ml-1 mt-[4px] cursor-pointer"
          >
            <div class="w-full text-nowrap text-center">Current WP</div>
            <div class="mb-1 text-[12px] font-bold">{{ currentWaypointOnMission }}</div>
          </div>
        </template>
        <div
          class="flex flex-col gap-1 px-3 py-2 rounded-md text-[11px] tabular-nums select-none"
          :style="interfaceStore.globalGlassMenuStyles"
        >
          <div class="flex items-center justify-between gap-3 text-[#ffb85b]">
            <div class="flex items-center gap-1">
              <v-icon size="14" class="opacity-80">mdi-counter</v-icon>
              <span class="opacity-80">Total:</span>
            </div>
            <span class="font-bold">{{ formattedTotalDistance }}</span>
          </div>
          <div class="flex items-center justify-between gap-3 text-[#ffb85b]">
            <span class="opacity-80">Mission:</span>
            <div class="flex items-center gap-[3px]">
              <v-tooltip location="top" open-delay="600" text="Reset mission distance">
                <template #activator="{ props: resetProps }">
                  <v-icon
                    v-bind="resetProps"
                    size="11"
                    class="cursor-pointer opacity-70 hover:opacity-100"
                    @click.stop="missionStore.resetMissionDistance()"
                  >
                    mdi-restore
                  </v-icon>
                </template>
              </v-tooltip>
              <span class="font-bold">{{ formattedMissionDistance }}</span>
            </div>
          </div>
        </div>
      </v-menu>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import CruiseSpeedControl from '@/components/mission-planning/CruiseSpeedControl.vue'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { openSnackbar } from '@/composables/snackbar'
import { useTraveledDistances } from '@/composables/useTraveledDistances'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'

const { showDialog, closeDialog } = useInteractionDialog()
const interfaceStore = useAppInterfaceStore()
const missionStore = useMissionStore()
const vehicleStore = useMainVehicleStore()

const currentWaypointOnMission = computed<string>((): string => {
  const wpIndex = missionStore.currentWaypointOnMission
  return wpIndex > 0 ? wpIndex.toString() : '--'
})

const skipToPreviousWaypoint = (): void => {
  logUserAction('Skipped to previous mission waypoint')
  missionStore.skipToWaypoint(-1)
}

const skipToNextWaypoint = (): void => {
  logUserAction('Skipped to next mission waypoint')
  missionStore.skipToWaypoint(1)
}

const { formattedTotalDistance, formattedMissionDistance } = useTraveledDistances()

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
          logUserAction('Confirmed return to home')
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
      logUserAction('Started/resumed mission')
      missionStore.executeMissionOnVehicle()
    } else {
      logUserAction('Paused mission')
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
