<template>
  <BaseConfigurationView>
    <template #title>Mission configuration</template>
    <template #content>
      <div
        class="flex flex-col justify-between items-start ml-[1vw] max-h-[85vh] overflow-y-auto"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[70vw]' : 'max-w-[40vw]'"
      >
        <div class="flex justify-start items-center gap-x-4">
          <v-switch
            v-model="missionStore.slideEventsEnabled"
            label="Enable slide to confirm"
            color="white"
            class="mt-2 -mb-2 ml-3"
          />
          <v-switch
            v-model="missionStore.alwaysSwitchToFlightMode"
            label="Auto switch to flight mode on mission upload"
            color="white"
            class="mt-2 -mb-2 ml-3"
          />
          <v-switch
            v-model="missionStore.showMissionCreationTips"
            label="Show mission creation checklist"
            color="white"
            class="mt-2 -mb-2 ml-3"
          />
        </div>
        <ExpansiblePanel no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Enable confirmation on specific categories:</template>
          <template #info>
            Add an extra confirmation step for UI elements that can trigger mission critical actions.
          </template>
          <template #content>
            <div class="flex flex-wrap items-center justify-start">
              <div
                v-for="category in EventCategory"
                :key="category"
                class="min-w-[100px]"
                :class="interfaceStore.isOnPhoneScreen ? 'mx-0' : 'mx-1'"
              >
                <v-checkbox
                  v-model="missionStore.slideEventsCategoriesRequired[category]"
                  :disabled="!missionStore.slideEventsEnabled"
                  :label="category"
                  hide-details
                ></v-checkbox>
              </div>
            </div>
          </template>
        </ExpansiblePanel>

        <ExpansiblePanel no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Default Map Position</template>
          <template #info> Set the default position and zoom level for maps. </template>
          <template #content>
            <div class="flex flex-wrap gap-4 px-4 pb-4">
              <div class="flex flex-col max-w-[9rem]">
                <p class="text-sm text-slate-200 mb-2">Latitude</p>
                <input
                  v-model.number="defaultMapCenter[0]"
                  type="number"
                  step="0.000001"
                  class="px-2 py-1 rounded-sm bg-[#FFFFFF22]"
                />
              </div>
              <div class="flex flex-col max-w-[9rem]">
                <p class="text-sm text-slate-200 mb-2">Longitude</p>
                <input
                  v-model.number="defaultMapCenter[1]"
                  type="number"
                  step="0.000001"
                  class="px-2 py-1 rounded-sm bg-[#FFFFFF22]"
                />
              </div>
              <div class="flex flex-col max-w-[8rem]">
                <p class="text-sm text-slate-200 mb-2">Zoom Level (1-19)</p>
                <input
                  v-model.number="defaultMapZoom"
                  type="number"
                  min="1"
                  max="19"
                  class="px-2 py-1 rounded-sm bg-[#FFFFFF22]"
                />
              </div>
              <div class="flex-grow-1" />
              <v-btn class="mt-5" variant="plain" @click="saveMapPosition">Save</v-btn>
            </div>
          </template>
        </ExpansiblePanel>
      </div>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { EventCategory } from '@/libs/slide-to-confirm'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMissionStore } from '@/stores/mission'
import type { WaypointCoordinates } from '@/types/mission'

import BaseConfigurationView from './BaseConfigurationView.vue'

const missionStore = useMissionStore()
const interfaceStore = useAppInterfaceStore()

// Create local reactive copies of the map settings
const defaultMapCenter = ref<WaypointCoordinates>([...missionStore.defaultMapCenter])
const defaultMapZoom = ref(missionStore.defaultMapZoom)

// Watch for store changes and update local values
watch(
  () => missionStore.defaultMapCenter,
  (newCenter) => {
    defaultMapCenter.value = [...newCenter]
  }
)

watch(
  () => missionStore.defaultMapZoom,
  (newZoom) => {
    defaultMapZoom.value = newZoom
  }
)

const saveMapPosition = (): void => {
  missionStore.setDefaultMapPosition(defaultMapCenter.value, defaultMapZoom.value)
}
</script>
