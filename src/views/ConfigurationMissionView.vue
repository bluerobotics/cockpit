<template>
  <BaseConfigurationView>
    <template #title>Mission configuration</template>
    <template #content>
      <div
        class="flex flex-col justify-between items-start ml-[1vw] max-h-[85vh] overflow-y-auto"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[70vw]' : 'max-w-[40vw]'"
      >
        <div class="grid grid-cols-3 gap-x-4 mb-4">
          <v-switch
            v-model="missionStore.showChecklistBeforeArm"
            label="Enable pre-arm checklist"
            color="white"
            hide-details
            base-color="#FFFFFF33"
            class="mt-2 -mb-2 ml-3"
          />
          <v-switch
            v-model="missionStore.slideEventsEnabled"
            label="Enable slide to confirm"
            color="white"
            hide-details
            base-color="#FFFFFF33"
            class="mt-2 -mb-2 ml-3"
          />
          <v-switch
            v-model="missionStore.alwaysSwitchToFlightMode"
            label="Auto switch to flight mode on mission upload"
            color="white"
            hide-details
            base-color="#FFFFFF33"
            class="mt-2 -mb-2 ml-3"
          />
          <v-switch
            v-model="missionStore.showMissionCreationTips"
            label="Show mission creation checklist"
            color="white"
            hide-details
            base-color="#FFFFFF33"
            class="mt-2 -mb-2 ml-3"
          />
          <v-switch
            v-model="missionStore.showGridOnMissionPlanning"
            label="Show coordinate grid on maps"
            color="white"
            hide-details
            base-color="#FFFFFF33"
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
          <template #title>Map options</template>
          <template #info>
            <strong>Default map position:</strong> Defines the initial center and zoom level for the map. <br />
            <strong>Max. vehicle position update rate:</strong> Limits how often the vehicle's position is updated on
            the map to reduce CPU usage.
          </template>
          <template #content>
            <div class="flex flex-wrap gap-4 px-4 pb-4">
              <p class="w-full text-md">Default map position</p>
              <div class="flex w-[70%] justify-around items-center">
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
                  <p class="text-sm text-slate-200 mb-2 ml-4">Longitude</p>
                  <input
                    v-model.number="defaultMapCenter[1]"
                    type="number"
                    step="0.000001"
                    class="px-2 py-1 rounded-sm bg-[#FFFFFF22] ml-4"
                  />
                </div>
                <div class="flex flex-col max-w-[9rem]">
                  <p class="text-sm text-slate-200 mb-2 ml-4">Zoom Level (1-19)</p>
                  <input
                    v-model.number="defaultMapZoom"
                    type="number"
                    min="1"
                    max="19"
                    class="px-2 py-1 rounded-sm bg-[#FFFFFF22] ml-4"
                  />
                </div>
                <div class="flex-grow-1" />
                <v-btn class="mt-7 bg-[#FFFFFF22]" variant="plain" size="small" @click="saveMapPosition">Save</v-btn>
              </div>
              <div class="flex w-[63%] justify-between items-center mt-4">
                <p class="w-full text-md">Max. vehicle position update rate</p>
                <div class="flex flex-col max-w-[118px]">
                  <input
                    v-model.number="vehicleStore.vehiclePositionMaxSampleRate"
                    type="number"
                    min="0"
                    class="px-2 py-1 rounded-sm bg-[#FFFFFF22]"
                  />
                </div>
                <p class="ml-2">ms</p>
              </div>
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
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import type { WaypointCoordinates } from '@/types/mission'

import BaseConfigurationView from './BaseConfigurationView.vue'

const missionStore = useMissionStore()
const interfaceStore = useAppInterfaceStore()
const vehicleStore = useMainVehicleStore()

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
