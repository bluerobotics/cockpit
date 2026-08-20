<template>
  <div>
    <Dropdown
      :model-value="currentMode"
      :options="modeOptions"
      name-key="name"
      value-key="value"
      class="min-w-[128px]"
      @update:model-value="onModeSelected"
    />
  </div>
  <v-dialog v-model="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen" width="700">
    <v-card class="pa-4 text-white" style="border-radius: 15px" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-center">Mode names</v-card-title>
      <v-card-text class="max-h-[60vh] overflow-y-auto">
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
        <FlightModeNamesConfig />
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRefs } from 'vue'

import FlightModeNamesConfig from '@/components/configuration/FlightModeNamesConfig.vue'
import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { MiniWidget } from '@/types/widgets'

import Dropdown from '../Dropdown.vue'

const props = defineProps<{
  /**
   * Configuration of the widget
   */
  miniWidget: MiniWidget
}>()
const miniWidget = toRefs(props).miniWidget

datalogger.registerUsage(DatalogVariable.mode)
const vehicleStore = useMainVehicleStore()
const interfaceStore = useAppInterfaceStore()
const widgetStore = useWidgetManagerStore()
const currentMode = ref()

const modeOptions = computed(() =>
  vehicleStore.modesAvailable().map((mode) => ({ value: mode, name: vehicleStore.flightModeDisplayName(mode) }))
)

// Bound to the dropdown's user-selection event (not a watch on currentMode) so that automated mode changes
// reflected by the polling below don't get logged or re-issued as if the user changed the mode.
const onModeSelected = (newMode: unknown): void => {
  currentMode.value = newMode
  if (newMode === undefined || newMode === vehicleStore.mode) return
  logUserAction(`Changed flight mode to '${newMode}'`)
  vehicleStore.setFlightMode(newMode as string)
}

// eslint-disable-next-line no-undef
let modeUpdateInterval: NodeJS.Timer | undefined = undefined
onMounted(() => (modeUpdateInterval = setInterval(() => (currentMode.value = vehicleStore.mode), 500)))
onUnmounted(() => clearInterval(modeUpdateInterval))
</script>
