<template>
  <div v-tooltip="'Battery information'" class="flex items-center w-[5.5rem] h-12 text-white justify-center">
    <span class="relative w-[1.5rem] mdi battery-icon" :class="[batteryIconClass]">
      <span class="absolute text-sm text-yellow-400 -bottom-[2px] -right-[7px] mdi mdi-alert-circle"></span>
    </span>
    <div class="flex flex-col w-[4rem] select-none text-sm font-semibold leading-4 text-end">
      <template v-if="showVoltageAndCurrent">
        <div class="w-full">
          <span class="font-mono">{{ voltageDisplayValue }}</span>
          <span> V</span>
        </div>
        <div class="w-full">
          <span class="font-mono">{{ currentDisplayValue }}</span>
          <span> A</span>
        </div>
      </template>
      <template v-else>
        <div class="w-full">
          <span class="font-mono">{{ instantaneousWattsDisplayValue }}</span>
          <span> W</span>
        </div>
        <div class="w-full">
          <span class="font-mono">{{ totalConsumedWattsDisplayValue }}</span>
          <span> Wh</span>
        </div>
      </template>
    </div>
  </div>
  <v-dialog v-model="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen" width="auto">
    <v-card class="pa-4 text-white" style="border-radius: 15px" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-center">Battery Indicator Config</v-card-title>
      <v-card-text class="flex flex-col gap-y-4">
        <v-checkbox
          v-model="miniWidget.options.showVoltageAndCurrent"
          label="Show Voltage and Current"
          hide-details
          @update:model-value="validateShowOptions"
        />
        <v-checkbox
          v-model="miniWidget.options.showPowerAndConsumption"
          label="Show Power and Consumption"
          hide-details
          @update:model-value="validateShowOptions"
        />
        <v-text-field
          v-if="miniWidget.options.showVoltageAndCurrent && miniWidget.options.showPowerAndConsumption"
          v-model.number="toggleInterval"
          label="Toggle Interval (ms)"
          type="number"
          :min="minInterval"
          step="100"
          density="compact"
          variant="outlined"
          :error-messages="intervalErrorMessage"
          @update:model-value="(v) => validateToggleInterval(Number(v))"
        />
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onUnmounted, ref, toRefs, watch } from 'vue'

import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { MiniWidget } from '@/types/widgets'

/**
 * Props for the BatteryIndicator component
 */
const props = defineProps<{
  /**
   * Configuration of the widget
   */
  miniWidget: MiniWidget
}>()
const miniWidget = toRefs(props).miniWidget

const defaultOptions = {
  showCurrent: true,
  showPower: true,
  toggleInterval: 1000,
}

const store = useMainVehicleStore()
const widgetStore = useWidgetManagerStore()
const interfaceStore = useAppInterfaceStore()

const showVoltageAndCurrent = ref(true)
const toggleIntervaler = ref<ReturnType<typeof setInterval> | undefined>(undefined)
const minInterval = 500
const toggleInterval = ref(miniWidget.value.options.toggleInterval ?? defaultOptions.toggleInterval)

const voltageDisplayValue = computed(() => {
  if (store?.powerSupply?.voltage === undefined) return NaN
  return Math.abs(store.powerSupply.voltage) >= 100
    ? store.powerSupply.voltage.toFixed(0)
    : store.powerSupply.voltage.toFixed(1)
})

const currentDisplayValue = computed(() => {
  if (store?.powerSupply?.current === undefined) return NaN
  return Math.abs(store.powerSupply.current) >= 100
    ? store.powerSupply.current.toFixed(0)
    : store.powerSupply.current.toFixed(1)
})

const instantaneousWattsDisplayValue = computed(() => {
  return store.instantaneousWatts ? store.instantaneousWatts.toFixed(1) : NaN
})

const totalConsumedWattsDisplayValue = computed(() => {
  return store.totalConsumedWatts.toFixed(1)
})

const batteryIconClass = computed(() => {
  return 'mdi-battery'
})

const setupToggleInterval = (): void => {
  if (toggleIntervaler.value) {
    clearInterval(toggleIntervaler.value)
  }

  toggleInterval.value = miniWidget.value.options.toggleInterval

  if (miniWidget.value.options.showVoltageAndCurrent && miniWidget.value.options.showPowerAndConsumption) {
    toggleIntervaler.value = setInterval(() => {
      showVoltageAndCurrent.value = !showVoltageAndCurrent.value
    }, miniWidget.value.options.toggleInterval)
  } else {
    showVoltageAndCurrent.value = miniWidget.value.options.showVoltageAndCurrent
  }
}

watch(() => miniWidget.value.options, setupToggleInterval, { deep: true })

const validateShowOptions = (value: boolean): void => {
  if (!miniWidget.value.options.showVoltageAndCurrent && !miniWidget.value.options.showPowerAndConsumption) {
    // If both options are unchecked, force the current one to be checked
    miniWidget.value.options[value ? 'showPowerAndConsumption' : 'showVoltageAndCurrent'] = true
  }
}

const intervalErrorMessage = ref('')

const validateToggleInterval = (value: number): void => {
  if (value < minInterval) {
    intervalErrorMessage.value = `Interval must be at least ${minInterval}ms`
  } else {
    intervalErrorMessage.value = ''
    miniWidget.value.options.toggleInterval = value
  }
}

onBeforeMount(() => {
  // If both show options are disabled, use default options
  if (!miniWidget.value.options.showVoltageAndCurrent && !miniWidget.value.options.showPowerAndConsumption) {
    miniWidget.value.options = { ...defaultOptions }
  } else {
    miniWidget.value.options = Object.assign({}, defaultOptions, miniWidget.value.options)
  }

  // Ensure toggle interval is above the minimum
  miniWidget.value.options.toggleInterval = Math.max(minInterval, miniWidget.value.options.toggleInterval)

  setupToggleInterval()

  // Register new variables for logging
  datalogger.registerUsage('Instantaneous Watts' as DatalogVariable)
  datalogger.registerUsage('Total Consumed Wh' as DatalogVariable)
})

onUnmounted(() => {
  if (toggleIntervaler.value) {
    clearInterval(toggleIntervaler.value)
  }
})
</script>

<style>
.battery-icon {
  font-size: 2.25rem;
  line-height: 2.25rem;
}
</style>
