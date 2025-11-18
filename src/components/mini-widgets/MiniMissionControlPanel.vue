<template>
  <div
    ref="miniMissionControlPanel"
    class="flex justify-around px-2 py-1 text-center rounded-lg w-[220px] h-9 align-center text-white bg-slate-800/60"
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
            class="text-[16px] border-x"
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
            @click.stop="missionStore.skipToWaypoint(1)"
          />
        </template>
      </v-tooltip>
      <v-tooltip location="top" open-delay="800" text="Stop mission and return to first waypoint">
        <template #activator="{ props: skipNextProps }">
          <v-btn
            v-bind="skipNextProps"
            size="x-small"
            icon="mdi-stop"
            variant="text"
            class="text-[16px]"
            :disabled="!missionStore.isMissionRunning"
            @click.stop="missionStore.stopMission"
          />
        </template>
      </v-tooltip>
      <v-divider vertical class="h-[25px] mt-[5px]" />
      <div class="flex flex-col justify-between w-[46px] h-[33px] text-[8px] ml-1 mt-[4px]">
        <div>Current WP:</div>
        <div class="mb-1 text-[12px] font-bold">{{ vehicleStore.currentMissionSeq! - 1 || '0' }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { openSnackbar } from '@/composables/snackbar'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'

const missionStore = useMissionStore()
const vehicleStore = useMainVehicleStore()

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
