<template>
  <div class="w-full h-full flex items-end">
    <div
      class="w-full rounded-lg overflow-hidden -mt-2"
      :class="[isWrapped ? 'h-[42px]' : 'h-full']"
      :style="interfaceStore.globalGlassMenuStyles"
    >
      <div class="flex flex-col justify-start items-center h-auto pt-2 cursor-pointer">
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
        <div v-show="!isWrapped" class="flex justify-centerw-full px-4 mt-1">
          <div
            class="flex w-[280px] px-2 justify justify-around gap-4 items-center mt-2 mb-1 shadow-sm overflow-hidden"
            :class="!vehicleStore.isVehicleOnline ? 'active-events-on-disabled' : ''"
            style="border-radius: 3px"
          >
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
                  class="text-[20px] border-x"
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
            <v-tooltip location="top" open-delay="800" text="Stop mission and return to first waypoint">
              <template #activator="{ props: skipNextProps }">
                <v-btn
                  v-bind="skipNextProps"
                  size="x-small"
                  icon="mdi-stop"
                  variant="text"
                  class="text-[20px]"
                  :disabled="!missionStore.isMissionRunning"
                  @click.stop="missionStore.stopMission"
                />
              </template>
            </v-tooltip>
            <div class="flex items-center">
              <v-divider vertical class="h-8 mr-3" />
              <v-menu offset-y theme="dark">
                <template #activator="{ props: menuProps }">
                  <v-btn
                    variant="text"
                    v-bind="menuProps"
                    icon="mdi-dots-vertical"
                    size="22"
                    class="cursor-pointer -mr-1"
                  />
                </template>

                <v-list>
                  <v-list-item
                    :disabled="!vehicleStore.isVehicleOnline"
                    class="cursor-pointer"
                    @click="handleDownloadMissionOnMap"
                  >
                    <v-list-item-title>Download mission from vehicle</v-list-item-title>
                  </v-list-item>

                  <v-list-item
                    :disabled="!vehicleStore.isVehicleOnline"
                    class="cursor-pointer"
                    @click="handleClearMissionOnMap"
                  >
                    <v-list-item-title>Clear mission on map</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, onBeforeMount, ref, toRefs } from 'vue'

import { openSnackbar } from '@/composables/snackbar'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Widget } from '@/types/widgets'

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

const toggleWrapContainer = (): void => {
  isWrapped.value = !isWrapped.value
}

const enableMovingOnDrag = (): void => {
  widgetStore.allowMovingAndResizing(widget.value.hash, true)
  window.addEventListener('mouseup', disableMovingOnDrag)
  window.addEventListener('dragend', disableMovingOnDrag)
}

const disableMovingOnDrag = (): void => {
  widgetStore.allowMovingAndResizing(widget.value.hash, false)
  window.removeEventListener('mouseup', disableMovingOnDrag)
  window.removeEventListener('dragend', disableMovingOnDrag)
}

const widgetSize = {
  width: 0.14638572402097255,
  height: 0.09641222207770606,
}

const handleDownloadMissionOnMap = async (): Promise<void> => {
  await missionStore.callMapDownloadMissionFromVehicle()
}

const handleClearMissionOnMap = (): void => {
  missionStore.callMapClearMapDrawing()
}

onBeforeMount(() => {
  widgetStore.widgetManagerVars(widget.value.hash).allowResizing = false
  widget.value.size = widgetSize
})

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
