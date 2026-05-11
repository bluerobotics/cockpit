<template>
  <div
    ref="miniMissionControlPanel"
    class="flex justify-around px-2 py-1 text-center rounded-lg w-[252px] h-9 align-center text-white bg-slate-800/60"
  >
    <div
      class="flex gap-1 items-center overflow-hidden"
      :class="!vehicleStore.isVehicleOnline ? 'active-events-on-disabled' : ''"
    >
      <v-tooltip location="top" open-delay="800" :text="t`Skip to previous waypoint`">
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
        :text="missionStore.isMissionRunning ? t`Pause mission` : t`Start / resume mission`"
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
      <v-tooltip location="top" open-delay="800" :text="t`Skip to next waypoint`">
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
      <CruiseSpeedControl compact />
      <v-tooltip location="top" open-delay="800" :text="t`Return to home`">
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
        :model-value="areDistancesVisible"
        :open-on-hover="true"
        :open-on-click="true"
        :close-on-content-click="false"
        location="top"
        offset="6"
        theme="dark"
        @update:model-value="setDistancesVisible"
      >
        <template #activator="{ props: wpProps }">
          <div
            v-bind="wpProps"
            role="button"
            tabindex="0"
            aria-haspopup="true"
            :aria-expanded="areDistancesVisible"
            class="flex flex-col justify-between w-[46px] h-[33px] text-[8px] ml-1 mt-[4px] cursor-pointer"
            @keydown.enter.prevent="setDistancesVisible(!areDistancesVisible)"
            @keydown.space.prevent="setDistancesVisible(!areDistancesVisible)"
          >
            <div class="w-full text-nowrap text-center">{{ t`Current WP` }}</div>
            <div class="mb-1 text-[12px] font-bold">{{ currentWaypointOnMission }}</div>
          </div>
        </template>
        <div
          class="flex flex-col gap-1 px-3 py-2 rounded-md text-[11px] tabular-nums select-none"
          :style="interfaceStore.globalGlassMenuStyles"
        >
          <div class="flex items-center justify-between gap-3 text-odometer">
            <div class="flex items-center gap-1">
              <v-icon size="14" class="opacity-80">mdi-counter</v-icon>
              <span class="opacity-80">{{ t`Total:` }}</span>
            </div>
            <span class="font-bold">{{ formattedTotalDistance }}</span>
          </div>
          <div class="flex items-center justify-between gap-3 text-odometer">
            <span class="opacity-80">{{ t`Mission:` }}</span>
            <div class="flex items-center gap-[3px]">
              <v-tooltip
                v-if="missionStore.areOdometersAvailable"
                location="top"
                open-delay="600"
                :text="t`Reset mission distance`"
              >
                <template #activator="{ props: resetProps }">
                  <v-btn
                    v-bind="resetProps"
                    variant="text"
                    density="compact"
                    :aria-label="t`Reset mission distance`"
                    class="w-[16px] h-[16px] min-w-0 opacity-70 hover:opacity-100"
                    @click.stop="missionStore.resetMissionDistance()"
                  >
                    <v-icon size="11">mdi-restore</v-icon>
                  </v-btn>
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
import { t } from 'ttag'
import { computed, ref } from 'vue'

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

const areDistancesVisible = ref(false)

const setDistancesVisible = (visible: boolean): void => {
  if (visible && !areDistancesVisible.value) {
    logUserAction('Opened the traveled distances popover on the mini mission control panel')
  }
  areDistancesVisible.value = visible
}

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
    title: t`Return to home`,
    message: t`Are you sure you want to send the vehicle home?`,
    variant: 'warning',
    actions: [
      {
        text: t`Cancel`,
        size: 'small',
        action: closeDialog,
      },
      {
        text: t`Confirm`,
        size: 'small',
        action: () => {
          logUserAction('Confirmed return to home')
          closeDialog()
          vehicleStore.returnHome().catch((err) => {
            const errorMessage = (err as Error).message
            openSnackbar({
              message: t`Failed to return home: ${errorMessage}`,
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
      await missionStore.executeMissionOnVehicle()
    } else {
      logUserAction('Paused mission')
      await vehicleStore.pauseMission()
    }
  } catch (err) {
    const errorMessage = (err as Error).message
    openSnackbar({
      message: missionStore.isMissionRunning
        ? t`Failed to pause mission: ${errorMessage}`
        : t`Failed to start mission: ${errorMessage}`,
      variant: 'error',
    })
  }
}
</script>
