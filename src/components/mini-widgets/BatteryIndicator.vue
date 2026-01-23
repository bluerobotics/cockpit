<template>
  <v-tooltip :text="`Battery remaining: ${remainingDisplayValue < 0 ? 'No Data' : remainingDisplayValue + '%'}`">
    <template #activator="{ props: tooltipProps }">
      <div v-bind="tooltipProps" class="flex items-center w-[95px] h-12 text-white justify-center">
        <div v-if="remainingDisplayValue >= 0" class="relative w-[1.5rem] battery-icon">
          <i class="mdi mdi-battery-outline"></i>

          <i
            class="mdi mdi-battery absolute inset-0 bottom-0 -right-1 text-transparent bg-clip-text"
            :style="{
              backgroundImage: `linear-gradient(to top, white ${remainingDisplayValue}%, transparent ${remainingDisplayValue}%)`,
            }"
          />
          <span
            v-if="remainingDisplayValue < 0"
            class="absolute text-sm text-white -bottom-[3px] left-[4px] mdi mdi-circle"
          ></span>
          <span
            v-if="remainingDisplayValue < 0"
            class="absolute text-sm text-yellow-400 -bottom-[3px] left-[4px] mdi mdi-alert-circle"
          ></span>
        </div>

        <div v-else class="relative flex flex-col justify-center items-center h-full w-[1.5rem] battery-icon">
          <i
            class="absolute mdi mdi-battery"
            :style="{ color: miniWidget.options.useVoltageToColor ? currentBatteryColor : 'transparent' }"
          ></i>
          <i
            v-if="currentBatteryLevel === 'critical' && miniWidget.options.useVoltageToColor"
            class="absolute mdi mdi-battery animate-ping"
            :style="{ color: currentBatteryColor }"
          ></i>
          <i class="absolute mdi mdi-battery-outline text-[#CCCCCC88]"></i>

          <span
            v-if="remainingDisplayValue < 0"
            class="absolute text-sm text-white bottom-0 left-0 mdi mdi-circle"
          ></span>
          <span
            v-if="remainingDisplayValue < 0"
            class="absolute text-sm text-yellow-400 bottom-0 left-0 mdi mdi-alert-circle"
          ></span>
        </div>

        <div class="relative right-0 flex flex-col w-[4rem] select-none text-sm font-semibold leading-4 text-end -mr-2">
          <div class="w-full">
            <div class="flex justify-end gap-x-1 items-center">
              <span class="font-mono">{{ voltageDisplayValue }}</span>
              <div class="w-[15px] mr-[1px] -ml-[1px]">V</div>
            </div>
          </div>
          <div class="w-full">
            <template v-if="showCurrent">
              <div class="flex justify-end gap-x-1 items-center">
                <span class="font-mono mt-[2px]">{{ currentDisplayValue }}</span>
                <div class="w-[15px]">A</div>
              </div>
            </template>
            <template v-else>
              <div class="flex justify-end gap-x-1 items-center text-yellow-100">
                <span class="font-mono mt-[2px]">{{ instantaneousWattsDisplayValue }}</span>
                <div class="w-[15px]">W</div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </template>
  </v-tooltip>
  <v-dialog v-model="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen" width="auto">
    <v-card class="pa-4 text-white w-[400px]" style="border-radius: 15px" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-center">Battery Indicator Config</v-card-title>
      <v-card-text class="flex flex-col gap-y-4">
        <div class="absolute top-2 right-2 z-10">
          <v-btn
            icon
            size="30"
            variant="text"
            class="text-white text-[22px]"
            aria-label="Close"
            @click="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen = false"
          >
            <i class="mdi mdi-close"></i>
          </v-btn>
        </div>
        <v-checkbox v-model="miniWidget.options.showCurrent" label="Show Current" hide-details class="-mb-5" />
        <v-checkbox v-model="miniWidget.options.showPower" label="Show Power" hide-details />
        <v-text-field
          v-model.number="userSetToggleInterval"
          label="Toggle Interval (ms)"
          type="number"
          :min="minInterval"
          step="100"
          density="compact"
          variant="outlined"
          hide-details
          :disabled="!miniWidget.options.showCurrent || !miniWidget.options.showPower"
        />

        <v-divider class="mt-2" />
        <div class="flex justify-between items-center -mt-1">
          <v-checkbox
            v-model="miniWidget.options.useVoltageToColor"
            label="Use voltage to color scheme"
            hide-details
            class="mr-1"
          />
          <v-tooltip
            location="top"
            text="Configure these voltage levels according to your battery pack. Defaults are based on Blue Robotics' 4S Li-ion battery pack."
          >
            <template #activator="{ props: infoProps }">
              <v-icon
                v-bind="infoProps"
                icon="mdi-information-outline"
                class="ml-1 text-yellow-300 cursor-pointer"
                size="18"
              />
            </template>
          </v-tooltip>
        </div>

        <div class="flex items-center gap-x-2">
          <v-text-field
            v-model.number="batteryThresholds.high"
            label="High voltage (V)"
            type="number"
            density="compact"
            variant="outlined"
            hide-details
          />
         <div class="flex-1 text-sm">High battery</div>
          <v-menu :close-on-content-click="false">
            <template #activator="{ props: colorProps }">
              <div
                v-bind="colorProps"
                class="w-8 h-8 rounded border border-white/30 cursor-pointer"
                :style="{ backgroundColor: miniWidget.options.voltageToColorScheme.high }"
              />
            </template>
            <v-color-picker v-model="miniWidget.options.voltageToColorScheme.high" hide-inputs theme="dark" />
          </v-menu>
        </div>

        <div class="flex items-center gap-x-2">
          <v-text-field
            v-model.number="batteryThresholds.medium"
            label="Medium voltage (V)"
            type="number"
            density="compact"
            variant="outlined"
            hide-details
          />
          <v-menu :close-on-content-click="false">
            <template #activator="{ props: colorProps }">
              <div
                v-bind="colorProps"
                class="w-8 h-8 rounded border border-white/30 cursor-pointer"
                :style="{ backgroundColor: miniWidget.options.voltageToColorScheme.medium }"
              />
            </template>
            <v-color-picker v-model="miniWidget.options.voltageToColorScheme.medium" hide-inputs theme="dark" />
          </v-menu>
        </div>

        <div class="flex items-center gap-x-2">
          <v-text-field
            v-model.number="batteryThresholds.low"
            label="Low voltage (V)"
            type="number"
            density="compact"
            variant="outlined"
            hide-details
          />
          <v-menu :close-on-content-click="false">
            <template #activator="{ props: colorProps }">
              <div
                v-bind="colorProps"
                class="w-8 h-8 rounded border border-white/30 cursor-pointer"
                :style="{ backgroundColor: miniWidget.options.voltageToColorScheme.low }"
              />
            </template>
            <v-color-picker v-model="miniWidget.options.voltageToColorScheme.low" hide-inputs theme="dark" />
          </v-menu>
        </div>

        <div class="flex items-center gap-x-2">
          <v-text-field
            v-model.number="batteryThresholds.critical"
            label="Critical voltage (V)"
            type="number"
            density="compact"
            variant="outlined"
            hide-details
          />
          <v-menu :close-on-content-click="false">
            <template #activator="{ props: colorProps }">
              <div
                v-bind="colorProps"
                class="w-8 h-8 rounded border border-white/30 cursor-pointer"
                :style="{ backgroundColor: miniWidget.options.voltageToColorScheme.critical }"
              />
            </template>
            <v-color-picker v-model="miniWidget.options.voltageToColorScheme.critical" hide-inputs theme="dark" />
          </v-menu>
        </div>

        <p class="text-red-500 text-center text-sm w-[full]">{{ errorMessage }}</p>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useDebounce } from '@vueuse/core'
import { computed, onBeforeMount, onUnmounted, ref, toRefs, watch } from 'vue'

import { defaultBatteryLevelColorScheme, defaultBatteryLevelThresholds } from '@/assets/defaults'
import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { BatteryLevel, BatteryLevelThresholds } from '@/types/general'
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

const showCurrent = ref(true)
const toggleIntervaler = ref<ReturnType<typeof setInterval> | undefined>(undefined)
const minInterval = 500
const errorMessage = ref('')
const errorMessageTimeout = ref<ReturnType<typeof setTimeout> | undefined>(undefined)
const userSetToggleInterval = ref(miniWidget.value.options.toggleInterval ?? defaultOptions.toggleInterval)

miniWidget.value.options.useVoltageToColor ??= false
miniWidget.value.options.voltageToColorScheme ??= Object.assign({}, defaultBatteryLevelColorScheme)
miniWidget.value.options.batteryThresholds ??= Object.assign({}, defaultBatteryLevelThresholds)

const batteryThresholds = computed<BatteryLevelThresholds>(() => miniWidget.value.options.batteryThresholds)

// Round voltage to 0.1V precision for values < 100V, integer precision for >= 100V
const roundedVoltage = computed(() => {
  const voltage = store?.powerSupply?.voltage
  if (voltage === undefined || voltage === null) return null
  return Math.abs(voltage) >= 100 ? Math.round(voltage) : Math.round(voltage * 10) / 10
})

// Keeps a stable voltage reading for 4 seconds to avoid rapid battery level changes
const debouncedVoltage = useDebounce(roundedVoltage, 4000)

const currentBatteryLevel = computed<BatteryLevel>(() => {
  const voltage = debouncedVoltage.value

  if (voltage == null) return 'unknown'

  const { critical, low, medium, high } = batteryThresholds.value

  if (voltage >= high) return 'high'
  if (voltage >= medium) return 'medium'
  if (voltage >= low) return 'low'
  if (voltage >= critical) return 'critical'
  if (voltage < critical) return 'critical'
  return 'unknown'
})

const currentBatteryColor = computed(() => {
  const level = currentBatteryLevel.value
  return miniWidget.value.options.voltageToColorScheme[level] ?? 'transparent'
})

const voltageDisplayValue = computed(() => {
  const voltage = roundedVoltage.value
  if (voltage === null) return '--'
  return Math.abs(voltage) >= 100 ? voltage.toFixed(0) : voltage.toFixed(1)
})

const currentDisplayValue = computed(() => {
  if (store?.powerSupply?.current === undefined) return '--'
  return Math.abs(store.powerSupply.current) >= 100
    ? store.powerSupply.current.toFixed(0)
    : store.powerSupply.current.toFixed(1)
})

const instantaneousWattsDisplayValue = computed(() => {
  return store.instantaneousWatts !== undefined ? store.instantaneousWatts.toFixed(1) : '--'
})

const remainingDisplayValue = computed(() => {
  if (store?.powerSupply?.remaining === undefined) return -1
  return Math.abs(store.powerSupply.remaining) > 100 ? 100 : store.powerSupply.remaining
})

const setupToggleInterval = (): void => {
  if (toggleIntervaler.value || errorMessageTimeout.value) {
    clearInterval(toggleIntervaler.value)
    clearTimeout(errorMessageTimeout.value)
  }

  // Ensure toggle interval is at least minInterval
  if (userSetToggleInterval.value < minInterval) {
    miniWidget.value.options.toggleInterval = minInterval
    errorMessage.value = `Interval must be at least ${minInterval}ms.`
  } else {
    miniWidget.value.options.toggleInterval = userSetToggleInterval.value
  }

  // Ensure at least one of current or power is enabled
  if (!miniWidget.value.options.showCurrent && !miniWidget.value.options.showPower) {
    miniWidget.value.options.showCurrent = true
    miniWidget.value.options.showPower = true
    errorMessage.value = 'At least one of the options must be enabled.'
  }

  if (miniWidget.value.options.showCurrent && miniWidget.value.options.showPower) {
    toggleIntervaler.value = setInterval(() => {
      showCurrent.value = !showCurrent.value
    }, miniWidget.value.options.toggleInterval)
  } else {
    showCurrent.value = miniWidget.value.options.showCurrent
  }

  errorMessageTimeout.value = setTimeout(() => {
    errorMessage.value = ''
    if (userSetToggleInterval.value < minInterval) {
      userSetToggleInterval.value = minInterval
    }
  }, 5000)
}

watch([() => miniWidget.value.options, userSetToggleInterval], setupToggleInterval, { deep: true })

onBeforeMount(() => {
  miniWidget.value.options = Object.assign({}, defaultOptions, miniWidget.value.options)

  setupToggleInterval()

  // Register new variable for logging
  datalogger.registerUsage('Instantaneous Watts' as DatalogVariable)
})

onUnmounted(() => {
  if (toggleIntervaler.value !== undefined) return
  clearInterval(toggleIntervaler.value)
})
</script>

<style>
.battery-icon {
  font-size: 2.25rem;
  line-height: 2.25rem;
}
</style>
