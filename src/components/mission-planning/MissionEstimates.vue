<template>
  <DrawerPanel
    v-if="modelValue"
    v-model:open="isOpen"
    :label="t`mission estimates panel`"
    :title="t`Mission estimates`"
    width="280px"
    @update:open="onToggleOpen"
  >
    <div class="px-3 py-2">
      <div class="text-xs leading-6">
        <div class="flex justify-between">
          <span>{{ t`Length` }}</span
          ><span>{{ totalMissionLength }}</span>
        </div>
        <div v-if="maxDistance !== '—'" class="flex justify-between">
          <span>{{ t`Max distance from ${maxDistanceReferenceLabel}` }}</span
          ><span>{{ maxDistance }}</span>
        </div>
        <div class="flex justify-between">
          <span>{{ t`ETA` }}</span
          ><span>{{ missionDuration }}</span>
        </div>
        <div class="flex justify-between">
          <span>{{ t`Energy` }}</span
          ><span>{{ missionEnergy }}</span>
        </div>
        <div v-if="totalSurveyCoverage !== '—'" class="flex justify-between">
          <span>{{ t`Total survey coverage` }}</span
          ><span>{{ totalSurveyCoverage }}</span>
        </div>
        <div v-if="missionCoverage !== '—'" class="flex justify-between">
          <span>{{ t`Mission area (≈)` }}</span
          ><span>{{ missionCoverage }}</span>
        </div>
        <template v-if="isPathSignalAvailable">
          <v-divider class="opacity-10 my-1" />
          <div
            v-tooltip:top="t`Tint the mission path by expected radio or mobile-data coverage at each segment.`"
            class="flex justify-between items-center -mb-1 pr-1"
          >
            <span>{{ t`Show comms coverage on path` }}</span>
            <v-checkbox
              :model-value="missionStore.showMissionPathSignalStrength"
              theme="dark"
              density="compact"
              hide-details
              class="path-signal-checkbox"
              @update:model-value="(value) => missionStore.setShowMissionPathSignalStrength(!!value)"
            />
          </div>
        </template>
      </div>
    </div>
    <template #strip>
      <v-btn
        v-if="isOptionsIconVisible"
        icon
        variant="text"
        size="x-small"
        :aria-label="t`Mission estimates settings`"
        @click="openSettings"
      >
        <v-icon icon="mdi-cog" size="14" />
        <v-tooltip activator="parent" location="left" :text="t`Mission estimates settings`" />
      </v-btn>
    </template>
  </DrawerPanel>
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
import { t } from 'ttag'
import { computed, ref } from 'vue'

import DrawerPanel from '@/components/DrawerPanel.vue'
import { useMissionPathSignal } from '@/composables/baseStation/useMissionPathSignal'
import { useMissionEstimates } from '@/composables/useMissionEstimates'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'

defineProps<{
  /**
   * Whether the mission estimates panel is visible
   */
  modelValue: boolean
}>()

const interfaceStore = useAppInterfaceStore()
const vehicleStore = useMainVehicleStore()
const missionStore = useMissionStore()

const {
  totalMissionLength,
  totalMaxDistance,
  maxDistanceReferenceLabel,
  totalSurveyCoverage,
  totalMissionDuration,
  totalMissionEnergy,
  missionCoverageAreaSquareMeters,
} = useMissionEstimates()

const isOptionsIconVisible = computed(
  () => vehicleStore.isVehicleOnline && missionStore.effectiveVehicleType === MavType.MAV_TYPE_SURFACE_BOAT
)

const maxDistance = computed(() => totalMaxDistance.value)
const { isPathSignalAvailable } = useMissionPathSignal()

const missionDuration = computed(() => totalMissionDuration.value)
const missionEnergy = computed(() => totalMissionEnergy.value)
const missionCoverage = computed(() => missionCoverageAreaSquareMeters.value)

const isOpen = ref(false)
const onToggleOpen = (open: boolean): void => logUserAction(`${open ? 'Opened' : 'Closed'} the mission estimates panel`)
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

<style scoped>
.path-signal-checkbox {
  transform: scale(0.75);
  transform-origin: right center;
  flex: 0 0 auto;
  margin-right: -8px;
}

.path-signal-checkbox :deep(.v-selection-control) {
  min-height: 0;
}
</style>
