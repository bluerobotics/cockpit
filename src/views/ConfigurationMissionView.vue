<template>
  <BaseConfigurationView>
    <template #title>{{ $t('configuration.mission.title') }}</template>
    <template #content>
      <div
        class="flex flex-col justify-between items-start ml-[1vw] max-h-[85vh] overflow-y-auto"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[70vw]' : 'max-w-[40vw]'"
      >
        <div class="grid grid-cols-3 gap-x-4 mb-4">
          <v-switch
            v-model="missionStore.showChecklistBeforeArm"
            :label="$t('configuration.mission.enablePreArmChecklist')"
            color="white"
            hide-details
            base-color="#FFFFFF33"
            class="mt-2 -mb-2 ml-3"
          />
          <v-switch
            v-model="missionStore.slideEventsEnabled"
            :label="$t('configuration.mission.enableSlideToConfirm')"
            color="white"
            hide-details
            base-color="#FFFFFF33"
            class="mt-2 -mb-2 ml-3"
          />
          <v-switch
            v-model="missionStore.alwaysSwitchToFlightMode"
            :label="$t('configuration.mission.autoSwitchToFlightMode')"
            color="white"
            hide-details
            base-color="#FFFFFF33"
            class="mt-2 -mb-2 ml-3"
          />
          <v-switch
            v-model="missionStore.showMissionCreationTips"
            :label="$t('configuration.mission.showMissionCreationChecklist')"
            color="white"
            hide-details
            base-color="#FFFFFF33"
            class="mt-2 -mb-2 ml-3"
          />
          <v-switch
            v-model="missionStore.showGridOnMissionPlanning"
            :label="$t('configuration.mission.showCoordinateGrid')"
            color="white"
            hide-details
            base-color="#FFFFFF33"
            class="mt-2 -mb-2 ml-3"
          />
        </div>
        <ExpansiblePanel no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>{{ $t('configuration.mission.enableConfirmationCategories') }}</template>
          <template #info>
            {{ $t('configuration.mission.enableConfirmationCategoriesInfo') }}
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
                  :label="$t(`configuration.mission.${category.toLowerCase()}`)"
                  hide-details
                ></v-checkbox>
              </div>
            </div>
          </template>
        </ExpansiblePanel>

        <ExpansiblePanel no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>{{ $t('configuration.mission.mapOptions') }}</template>
          <template #info>
            {{ $t('configuration.mission.mapOptionsInfo') }}
          </template>
          <template #content>
            <div class="flex flex-wrap gap-4 px-4 pb-4">
              <p class="w-full text-md">{{ $t('configuration.mission.defaultMapPosition') }}</p>
              <div class="flex w-[70%] justify-around items-center">
                <div class="flex flex-col max-w-[9rem]">
                  <p class="text-sm text-slate-200 mb-2">{{ $t('configuration.mission.latitude') }}</p>
                  <input
                    v-model.number="defaultMapCenter[0]"
                    type="number"
                    step="0.000001"
                    class="px-2 py-1 rounded-sm bg-[#FFFFFF22]"
                  />
                </div>
                <div class="flex flex-col max-w-[9rem]">
                  <p class="text-sm text-slate-200 mb-2 ml-4">{{ $t('configuration.mission.longitude') }}</p>
                  <input
                    v-model.number="defaultMapCenter[1]"
                    type="number"
                    step="0.000001"
                    class="px-2 py-1 rounded-sm bg-[#FFFFFF22] ml-4"
                  />
                </div>
                <div class="flex flex-col max-w-[9rem]">
                  <p class="text-sm text-slate-200 mb-2 ml-4">{{ $t('configuration.mission.zoomLevel') }}</p>
                  <input
                    v-model.number="defaultMapZoom"
                    type="number"
                    min="1"
                    max="19"
                    class="px-2 py-1 rounded-sm bg-[#FFFFFF22] ml-4"
                  />
                </div>
                <div class="flex-grow-1" />
                <v-btn class="mt-7 bg-[#FFFFFF22]" variant="plain" size="small" @click="saveMapPosition">{{ $t('configuration.mission.save') }}</v-btn>
              </div>
              <div class="flex w-[63%] justify-between items-center mt-4">
                <p class="w-full text-md">{{ $t('configuration.mission.maxVehiclePositionUpdateRate') }}</p>
                <div class="flex flex-col max-w-[118px]">
                  <input
                    v-model.number="vehicleStore.vehiclePositionMaxSampleRate"
                    type="number"
                    min="0"
                    class="px-2 py-1 rounded-sm bg-[#FFFFFF22]"
                  />
                </div>
                <p class="ml-2">{{ $t('configuration.mission.milliseconds') }}</p>
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
