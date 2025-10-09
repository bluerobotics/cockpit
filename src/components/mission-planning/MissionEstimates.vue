<template>
  <div
    v-if="modelValue"
    class="absolute right-4 bottom-36 rounded-[10px] px-3 py-2"
    :style="[interfaceStore.globalGlassMenuStyles, { width: '250px' }]"
  >
    <p class="text-sm font-semibold mb-[6px]">Mission estimates</p>
    <v-divider class="mb-2" />
    <v-icon
      v-if="isOptionsIconVisible"
      icon="mdi-cog"
      class="absolute top-[10px] right-[10px] cursor-pointer opacity-80"
      size="14"
      @click="openSettings"
    />
    <div class="text-xs leading-6">
      <div class="flex justify-between">
        <span>Length</span><span>{{ totalMissionLength }}</span>
      </div>
      <div class="flex justify-between">
        <span>ETA</span><span>{{ missionDuration }}</span>
      </div>
      <div class="flex justify-between">
        <span>Energy</span><span>{{ missionEnergy }}</span>
      </div>
      <div v-if="totalSurveyCoverage !== '—'" class="flex justify-between">
        <span>Total survey coverage</span><span>{{ totalSurveyCoverage }}</span>
      </div>
      <div v-if="missionCoverage !== '—'" class="flex justify-between">
        <span>Mission area (≈)</span><span>{{ missionCoverage }}</span>
      </div>
    </div>
  </div>
  <v-dialog v-model="isSettingsOpen" persistent max-width="500px">
    <v-card :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-lg text-center font-semibold">Mission Statistics Settings</v-card-title>
      <v-icon icon="mdi-close" class="absolute top-3 right-3" @click="isSettingsOpen = false" />
      <v-card-text>
        <div class="mb-6">
          <label class="block text-sm font-medium mb-1">Extra payload (kg)</label>
          <v-text-field
            v-model="vehicleStore.vehiclePayloadParameters.extraPayloadKg"
            theme="dark"
            type="number"
            min="0"
            step="0.1"
            density="compact"
            hide-details
            class="w-full border"
          />
          <p class="text-[11px] opacity-70 mt-1">Mass added to the vehicle besides batteries and hull.</p>
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium mb-1">Battery type</label>
          <v-select
            v-model="vehicleStore.vehiclePayloadParameters.batteryChemistry"
            theme="dark"
            :items="batteryChemistryItems"
            item-title="title"
            item-value="value"
            density="compact"
            hide-details
            class="w-full border"
          />
          <p class="text-[11px] opacity-70 mt-1">Li-ion (≈5 g/Wh), Li-Po (≈6 g/Wh), LiFePO₄ (≈9 g/Wh).</p>
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium mb-1">Battery bank capacity (Watt-hours)</label>
          <v-text-field
            v-model="vehicleStore.vehiclePayloadParameters.batteryCapacity"
            theme="dark"
            type="number"
            min="2"
            step="0.1"
            density="compact"
            hide-details
            class="w-full border"
          />
          <p class="text-[11px] opacity-70 mt-1">
            Total capacity from the vehicle batteries. Affects mass and power estimate.
          </p>
        </div>
        <div class="mb-4">
          <v-checkbox
            v-model="vehicleStore.vehiclePayloadParameters.hasHighDragSensor"
            label="Vehicle has a submerged probe (e.g. Ping1D sonar)"
            theme="dark"
            density="compact"
            hide-details
            class="w-full"
          />
          <p class="text-[11px] opacity-70 mt-1">
            Submerged probes affect drag and consequently, the power consumption estimates.
          </p>
        </div>
      </v-card-text>
      <v-divider class="mx-8" />
      <v-card-actions>
        <div class="flex justify-between w-full pa-1">
          <v-btn color="white" @click="isAboutMessageOpen = true">about the estimates</v-btn>
          <v-btn color="white" @click="isSettingsOpen = false">Close</v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
  <v-dialog v-model="isAboutMessageOpen" persistent max-width="600px">
    <v-card :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-lg text-center font-semibold">About the estimates</v-card-title>
      <v-icon icon="mdi-close" class="absolute top-3 right-3" @click="isAboutMessageOpen = false" />
      <v-card-text class="text-sm">
        <p class="mb-4">
          The values presented in this panel are analytical estimates derived from mission geometry, vehicle
          configuration, and manufacturer-provided nominal power curves.
        </p>
        <p class="mb-4">
          Environmental variables such as wind, current, waves, payload distribution, battery aging, and control loop
          behavior are not fully modeled and may introduce significant deviations from real-world performance.
        </p>
        <p class="mb-4">
          Always ensure that your vehicle has sufficient battery capacity and is properly configured for the specific
          mission and environmental conditions.
        </p>
        <p class="mb-4">
          All energy and duration estimates assume steady-state cruise at the configured nominal speed, with optional
          penalties for heading changes.
        </p>
        <p class="mb-4">
          These metrics are intended for operational planning and comparative analysis only. Actual performance may
          vary. Always plan missions with adequate safety margins.
        </p>
      </v-card-text>
      <v-divider class="mx-8" />
      <v-card-actions>
        <div class="flex justify-end w-full pa-1">
          <v-btn color="white" @click="isAboutMessageOpen = false">Close</v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { useMissionEstimates } from '@/composables/useMissionEstimates'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'

defineProps<{
  /**
   * Whether the mission estimates panel is visible
   */
  modelValue: boolean
}>()
defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const interfaceStore = useAppInterfaceStore()
const vehicleStore = useMainVehicleStore()

const {
  totalMissionLength,
  totalSurveyCoverage,
  totalMissionDuration,
  totalMissionEnergy,
  missionCoverageAreaSquareMeters,
} = useMissionEstimates()

const isOptionsIconVisible = computed(() => vehicleStore.vehicleType === MavType.MAV_TYPE_SURFACE_BOAT)

const missionDuration = computed(() => totalMissionDuration.value)
const missionEnergy = computed(() => totalMissionEnergy.value)
const missionCoverage = computed(() => missionCoverageAreaSquareMeters.value)

const isSettingsOpen = ref(false)
const isAboutMessageOpen = ref(false)

const batteryChemistryItems = [
  { title: 'Li-ion', value: 'li-ion' },
  { title: 'Li-Po', value: 'li-po' },
  { title: 'LiFePO₄', value: 'lifepo4' },
]

const openSettings = (): void => {
  isSettingsOpen.value = true
}
</script>
