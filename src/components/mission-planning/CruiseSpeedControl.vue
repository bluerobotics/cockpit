<template>
  <div class="relative flex items-center -mt-[2px]">
    <v-menu :close-on-content-click="false" location="top" offset="8">
      <template #activator="{ props: speedProps }">
        <v-tooltip
          location="top"
          open-delay="800"
          :text="`Cruise speed (${displayedCruiseSpeed.toFixed(1)} ${speedUnit})`"
        >
          <template #activator="{ props: speedTooltipProps }">
            <v-btn
              v-bind="{ ...speedProps, ...speedTooltipProps }"
              size="x-small"
              icon="mdi-speedometer"
              variant="text"
              :class="compact ? 'text-[16px]' : 'text-[18px]'"
              :disabled="!vehicleStore.isVehicleOnline"
            />
          </template>
        </v-tooltip>
      </template>
      <div class="flex flex-col p-3 rounded-lg w-[210px] text-white" :style="interfaceStore.globalGlassMenuStyles">
        <div class="flex justify-between items-center mb-1 text-xs">
          <span>Cruise speed</span>
          <span class="font-bold">{{ displayedCruiseSpeed.toFixed(1) }} {{ speedUnit }}</span>
        </div>
        <v-slider
          v-model="displayedCruiseSpeed"
          :min="displayedSpeedBound(0.1)"
          :max="displayedSpeedBound(5)"
          :step="0.1"
          color="white"
          density="compact"
          hide-details
          @update:model-value="handleCruiseSpeedInput"
        />
      </div>
    </v-menu>
    <span
      class="absolute left-1/2 top-full -translate-x-1/2 px-[3px] rounded-[2px] bg-white text-[#333333] font-bold select-none pointer-events-none"
      :class="
        compact
          ? 'text-[7.2px] leading-[10px] mt-[-11px] border-2 border-slate-800'
          : 'text-[8px] leading-[11px] mt-[-5px]'
      "
      aria-hidden="true"
    >
      {{ displayedCruiseSpeed.toFixed(1) }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

import { openSnackbar } from '@/composables/snackbar'
import { useUnitInput } from '@/composables/useUnitInput'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'

defineProps<{
  /**
   * Render the compact variant sized for the mini-widget bar (smaller icon, bordered speed tag)
   */
  compact?: boolean
}>()

const interfaceStore = useAppInterfaceStore()
const missionStore = useMissionStore()
const vehicleStore = useMainVehicleStore()

const liveCruiseSpeed = ref<number>(Number(missionStore.cruiseSpeed))
watch(
  () => missionStore.cruiseSpeed,
  (newSpeed) => (liveCruiseSpeed.value = Number(newSpeed))
)

// The speed is commanded in m/s, so only the slider and the readouts follow the unit the user reads.
const {
  displayedValue: displayedCruiseSpeed,
  toDisplayBound: speedToDisplayBound,
  toRawUnit: speedToRawUnit,
  unit: speedUnit,
} = useUnitInput(liveCruiseSpeed, 'm/s')

// A tenth is the step the slider moves in, and the slowest end is a fraction of a knot that whole numbers lose.
const displayedSpeedBound = (metersPerSecond: number): number => speedToDisplayBound(metersPerSecond, 1)

// Debounce live speed commands so dragging the slider doesn't flood the vehicle with DO_CHANGE_SPEED.
let cruiseSpeedDebounce: ReturnType<typeof setTimeout> | undefined
const handleCruiseSpeedInput = (value: number): void => {
  if (cruiseSpeedDebounce) clearTimeout(cruiseSpeedDebounce)
  cruiseSpeedDebounce = setTimeout(() => {
    logUserAction(`Set the cruise speed to ${value.toFixed(1)} ${speedUnit.value}`)
    missionStore.applyCruiseSpeed(speedToRawUnit(value)).catch((err) => {
      openSnackbar({ message: `Failed to set cruise speed: ${(err as Error).message}`, variant: 'error' })
    })
  }, 300)
}

onBeforeUnmount(() => clearTimeout(cruiseSpeedDebounce))
</script>
