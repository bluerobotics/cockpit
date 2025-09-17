<template>
  <div
    v-tooltip="`Battery remaining: ${remainingDisplayValue < 0 ? 'No Data' : remainingDisplayValue + '%'}`"
    class="flex items-center w-[95px] h-12 text-white justify-center"
  >
    <div class="relative w-[1.5rem] battery-icon">
      <i class="mdi mdi-battery-outline"></i>

      <i
        class="mdi mdi-battery absolute inset-0 bottom-0 -right-1 text-transparent bg-clip-text"
        :style="{
          backgroundImage: `linear-gradient(to top, white ${remainingDisplayValue}%, transparent ${remainingDisplayValue}%)`,
        }"
      />
      <span
        v-if="remainingDisplayValue < 0"
        class="absolute text-sm text-yellow-400 -bottom-[3px] left-[4px] mdi mdi-alert-circle"
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
  <v-dialog v-model="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen" width="auto">
    <v-card class="pa-4 text-white w-[20rem]" style="border-radius: 15px" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-center">Battery Indicator Config</v-card-title>
      <v-card-text class="flex flex-col gap-y-4">
        <v-checkbox v-model="miniWidget.options.showCurrent" label="Show Current" hide-details />
        <v-checkbox v-model="miniWidget.options.showPower" label="Show Power" hide-details />
        <v-text-field
          v-model.number="userSetToggleInterval"
          label="Toggle Interval (ms)"
          type="number"
          :min="minInterval"
          step="100"
          density="compact"
          variant="outlined"
          :disabled="!miniWidget.options.showCurrent || !miniWidget.options.showPower"
        />
        <p class="text-red-500 text-center text-sm w-[full]">{{ errorMessage }}</p>
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

const showCurrent = ref(true)
const toggleIntervaler = ref<ReturnType<typeof setInterval> | undefined>(undefined)
const minInterval = 500
const errorMessage = ref('')
const errorMessageTimeout = ref<ReturnType<typeof setTimeout> | undefined>(undefined)
const userSetToggleInterval = ref(miniWidget.value.options.toggleInterval ?? defaultOptions.toggleInterval)

const voltageDisplayValue = computed(() => {
  if (store?.powerSupply?.voltage === undefined) return '--'
  return Math.abs(store.powerSupply.voltage) >= 100
    ? store.powerSupply.voltage.toFixed(0)
    : store.powerSupply.voltage.toFixed(1)
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
