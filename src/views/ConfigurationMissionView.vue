<template>
  <BaseConfigurationView>
    <template #title>{{ $t('Mission configuration') }}</template>
    <template #content>
      <div
        class="flex flex-col justify-between items-start ml-[1vw] max-h-[85vh] overflow-y-auto"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[75vw]' : 'max-w-[50vw]'"
      >
        <div class="grid grid-cols-3 gap-x-4 mb-4">
          <v-switch
            v-model="missionStore.showChecklistBeforeArm"
            :label="$t('Enable pre-arm checklist')"
            color="white"
            hide-details
            base-color="#FFFFFF33"
            class="mt-2 -mb-2 ml-3"
          />
          <v-switch
            v-model="missionStore.slideEventsEnabled"
            :label="$t('Enable slide to confirm')"
            color="white"
            hide-details
            base-color="#FFFFFF33"
            class="mt-2 -mb-2 ml-3"
          />
          <v-switch
            v-model="missionStore.alwaysSwitchToFlightMode"
            :label="$t('Auto switch to flight mode on mission upload')"
            color="white"
            hide-details
            base-color="#FFFFFF33"
            class="mt-2 -mb-2 ml-3"
          />
          <v-switch
            v-model="missionStore.showMissionCreationTips"
            :label="$t('Show mission creation checklist')"
            color="white"
            hide-details
            base-color="#FFFFFF33"
            class="mt-2 -mb-2 ml-3"
          />
          <v-switch
            v-model="missionStore.showGridOnMissionPlanning"
            :label="$t('Show coordinate grid on maps')"
            color="white"
            hide-details
            base-color="#FFFFFF33"
            class="mt-2 -mb-2 ml-3"
          />
          <v-switch
            v-model="missionStore.showMissionEstimates"
            :label="$t('Show mission estimates panel')"
            color="white"
            hide-details
            base-color="#FFFFFF33"
            class="mt-2 -mb-2 ml-3"
          />
        </div>
        <ExpansiblePanel no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>{{ $t('Enable confirmation on specific categories:') }}</template>
          <template #info>
            {{ $t('Add an extra confirmation step for UI elements that can trigger mission critical actions.') }}
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
                  :label="translateEventCategory(category)"
                  hide-details
                ></v-checkbox>
              </div>
            </div>
          </template>
        </ExpansiblePanel>

        <ExpansiblePanel no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>{{ $t('Map options') }}</template>
          <template #info>
            <strong>{{ $t('Default map position:') }}</strong>
            {{ $t('Defines the initial center and zoom level for the map.') }} <br />
            <strong>{{ $t('Max. vehicle position update rate:') }}</strong>
            {{ $t("Limits how often the vehicle's position is updated on the map to reduce CPU usage.") }} <br />
            <strong>{{ $t('Map tile provider:') }}</strong>
            {{
              $t(
                "Sets which tile layer is used when the dashboard map and mission planning view open. Choose 'Use last selected' to keep the provider last picked from the map's layer control, or pick a specific provider to always open with it."
              )
            }}
            <strong>{{ $t('Unavailable-tile background:') }}</strong>
            {{
              $t(
                'When satellite imagery is missing (e.g. offshore at high zoom), tiles are replaced with a procedural noise pattern sampled by lat/lon so vehicle motion remains trackable. Customize the base color, texture intensity, and noise seed below.'
              )
            }}
          </template>
          <template #content>
            <div class="flex flex-wrap gap-4 px-4 pb-4">
              <p class="w-full text-md">{{ $t('Default map position') }}</p>
              <div class="flex w-[70%] justify-around items-center">
                <div class="flex flex-col max-w-[9rem]">
                  <p class="text-sm text-slate-200 mb-2">{{ $t('Latitude') }}</p>
                  <input
                    v-model.number="defaultMapCenter[0]"
                    type="number"
                    step="0.000001"
                    class="px-2 py-1 rounded-sm bg-[#FFFFFF22]"
                  />
                </div>
                <div class="flex flex-col max-w-[9rem]">
                  <p class="text-sm text-slate-200 mb-2 ml-4">
                    {{ $t('Longitude') }}
                  </p>
                  <input
                    v-model.number="defaultMapCenter[1]"
                    type="number"
                    step="0.000001"
                    class="px-2 py-1 rounded-sm bg-[#FFFFFF22] ml-4"
                  />
                </div>
                <div class="flex flex-col max-w-[9rem]">
                  <p class="text-sm text-slate-200 mb-2 ml-4">
                    {{ $t('Zoom Level (1-19)') }}
                  </p>
                  <input
                    v-model.number="defaultMapZoom"
                    type="number"
                    min="1"
                    max="19"
                    class="px-2 py-1 rounded-sm bg-[#FFFFFF22] ml-4"
                  />
                </div>
                <div class="flex-grow-1" />
                <v-btn class="mt-7 bg-[#FFFFFF22]" variant="plain" size="small" @click="saveMapPosition">{{
                  $t('Save')
                }}</v-btn>
              </div>
              <v-divider class="mb-4 mt-1 opacity-5" />
              <div class="flex w-full items-center -mt-4 gap-4">
                <div class="flex w-1/2 items-center justify-start pr-2">
                  <p class="text-md">{{ $t('Max. vehicle position update rate') }}</p>
                  <div class="flex items-center">
                    <input
                      v-model.number="vehicleStore.vehiclePositionMaxSampleRate"
                      type="number"
                      min="0"
                      class="px-2 py-1 w-[80px] rounded-sm bg-[#FFFFFF22] ml-4"
                    />
                    <p class="ml-2">{{ $t('ms') }}</p>
                  </div>
                </div>
                <div class="flex w-1/2 items-center justify-between pl-2">
                  <p class="text-md mr-4">{{ $t('Default map tile provider') }}</p>
                  <v-select
                    v-model="missionStore.defaultMapTileProvider"
                    :items="mapTileProviderOptions"
                    density="compact"
                    variant="outlined"
                    hide-details
                    class="w-[180px]"
                    theme="dark"
                  />
                </div>
              </div>
              <v-divider class="my-1 opacity-5" />
              <div class="flex flex-col w-full">
                <p class="w-full text-md mb-2">Unavailable-tile background</p>
                <div class="flex w-4/5 items-center justify-between gap-x-6">
                  <div class="flex items-center gap-x-2">
                    <p class="text-sm text-slate-200">Base color</p>
                    <!-- `.lazy` so tiles regenerate only when the picker is dismissed. -->
                    <input
                      v-model.lazy="missionStore.mapFallbackBaseColor"
                      type="color"
                      class="w-10 h-8 rounded-sm bg-transparent border border-[#FFFFFF33] cursor-pointer"
                    />
                    <input
                      v-model.lazy="missionStore.mapFallbackBaseColor"
                      type="text"
                      maxlength="7"
                      class="px-2 py-1 w-24 rounded-sm bg-[#FFFFFF22] text-white text-sm"
                    />
                  </div>
                  <div class="flex items-center flex-1 min-w-[260px] max-w-[360px]">
                    <p class="text-sm text-slate-200 mr-4 whitespace-nowrap">Noise intensity</p>
                    <input
                      :value="intensityToSliderPercent(pendingNoiseIntensity ?? missionStore.mapFallbackNoiseIntensity)"
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      class="flex-1 accent-white"
                      @input="onNoiseIntensityInput"
                      @change="onNoiseIntensityChange"
                    />
                    <p class="text-xs text-slate-200 w-10 text-right">
                      {{ intensityToSliderPercent(pendingNoiseIntensity ?? missionStore.mapFallbackNoiseIntensity) }}%
                    </p>
                  </div>
                  <v-tooltip location="top" text="Regenerate noise pattern">
                    <template #activator="{ props: tooltipProps }">
                      <v-btn
                        v-bind="tooltipProps"
                        icon="mdi-refresh"
                        size="small"
                        variant="text"
                        color="white"
                        class="opacity-80 hover:opacity-100"
                        @click="missionStore.reseedMapFallback"
                      />
                    </template>
                  </v-tooltip>
                </div>
              </div>
            </div>
          </template>
        </ExpansiblePanel>

        <ExpansiblePanel no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>{{ $t('Vehicle options') }}</template>
          <template #info>
            <strong>{{ $t('Max. path points:') }}</strong>
            {{
              $t(
                'Once the limit is reached, the last third of the mission trail will be simplified. Keep this value reasonable — larger histories use more memory and may affect performance over long missions, specially when using DVL or RTK positioning data.'
              )
            }}
          </template>
          <template #content>
            <div class="flex flex-col gap-y-3 px-4 pb-4 pt-2">
              <div class="flex items-center gap-x-16">
                <v-switch
                  v-model="missionStore.isVehiclePositionHistoryPersistent"
                  :label="$t('Make vehicle history line persistent')"
                  color="white"
                  hide-details
                  base-color="#FFFFFF33"
                  class="-my-1"
                />
                <div class="flex items-center gap-x-2 ml-4">
                  <span class="text-white text-sm whitespace-nowrap">{{ $t('Max. path points') }}</span>
                  <input
                    v-model.number="missionStore.maxPositionHistorySize"
                    type="number"
                    :min="MIN_MAX_POSITION_HISTORY_SIZE"
                    step="100"
                    class="px-2 py-1 w-24 rounded-sm bg-[#FFFFFF22] text-white text-sm"
                    @change="clampMaxPositionHistorySize"
                  />
                  <v-icon
                    v-tooltip.bottom="'Reset to default'"
                    icon="mdi-restore"
                    size="14"
                    color="white"
                    class="cursor-pointer opacity-70 hover:opacity-100"
                    @click="resetMaxPositionHistorySize"
                  />
                </div>
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
import { useI18n } from 'vue-i18n'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { EventCategory } from '@/libs/slide-to-confirm'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { DEFAULT_MAX_POSITION_HISTORY_SIZE, MIN_MAX_POSITION_HISTORY_SIZE, useMissionStore } from '@/stores/mission'
import type { MapTileProviderPreference, WaypointCoordinates } from '@/types/mission'

import BaseConfigurationView from './BaseConfigurationView.vue'

const { t } = useI18n()
const missionStore = useMissionStore()
const interfaceStore = useAppInterfaceStore()
const vehicleStore = useMainVehicleStore()

const mapTileProviderOptions: MapTileProviderPreference[] = ['Use last selected', 'OpenStreetMap', 'Esri World Imagery']

const translateEventCategory = (category: string): string => {
  const mapping: Record<string, string> = {
    'Arm': t('Arm'),
    'Disarm': t('Disarm'),
    'Takeoff': t('Takeoff'),
    'Altitude Change': t('Altitude Change'),
    'Land': t('Land'),
    'Goto': t('Goto'),
  }
  return mapping[category] || category
}

// Create local reactive copies of the map settings
const defaultMapCenter = ref<WaypointCoordinates>([...missionStore.defaultMapCenter])
const defaultMapZoom = ref(missionStore.defaultMapZoom)

// Avoids redundant visual noise above this threshold.
const MAX_USEFUL_NOISE_INTENSITY = 0.3

const intensityToSliderPercent = (intensity: number): number =>
  Math.round((intensity / MAX_USEFUL_NOISE_INTENSITY) * 100)

const sliderPercentToIntensity = (sliderPercent: number): number => (sliderPercent / 100) * MAX_USEFUL_NOISE_INTENSITY

// Drives the percentage label live during a drag; the store update waits for release.
const pendingNoiseIntensity = ref<number | null>(null)

const onNoiseIntensityInput = (event: Event): void => {
  pendingNoiseIntensity.value = sliderPercentToIntensity(Number((event.target as HTMLInputElement).value))
}

const onNoiseIntensityChange = (event: Event): void => {
  missionStore.mapFallbackNoiseIntensity = sliderPercentToIntensity(Number((event.target as HTMLInputElement).value))
  pendingNoiseIntensity.value = null
}

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

const clampMaxPositionHistorySize = (): void => {
  const value = missionStore.maxPositionHistorySize
  if (!Number.isFinite(value) || value < MIN_MAX_POSITION_HISTORY_SIZE) {
    missionStore.maxPositionHistorySize = MIN_MAX_POSITION_HISTORY_SIZE
  }
}

const resetMaxPositionHistorySize = (): void => {
  missionStore.maxPositionHistorySize = DEFAULT_MAX_POSITION_HISTORY_SIZE
}
</script>
