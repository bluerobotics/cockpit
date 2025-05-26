<template>
  <div
    class="flex items-center justify-center h-12 text-white"
    :class="miniWidget.options.displayMode === 'both' ? 'w-[200px]' : 'w-[120px]'"
  >
    <div class="flex items-center gap-2">
      <!-- Icon -->
      <FontAwesomeIcon icon="fa-solid fa-arrow-right-arrow-left" size="lg" class="text-blue-400" />

      <!-- Stats Display -->
      <div
        class="flex text-xs font-mono leading-tight"
        :class="miniWidget.options.displayMode === 'both' ? 'gap-4' : 'flex-col'"
      >
        <!-- Rates Display -->
        <template v-if="miniWidget.options.displayMode === 'rates' || miniWidget.options.displayMode === 'both'">
          <div class="flex flex-col">
            <div class="flex items-center gap-1">
              <span class="text-green-400">↓</span>
              <span>{{ displayValue(incomingRate) }}/s</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="text-orange-400">↑</span>
              <span>{{ displayValue(outgoingRate) }}/s</span>
            </div>
          </div>
        </template>

        <!-- Totals Display -->
        <template v-if="miniWidget.options.displayMode === 'totals' || miniWidget.options.displayMode === 'both'">
          <div class="flex flex-col">
            <div class="flex items-center gap-1">
              <span class="text-green-400">↓</span>
              <span>{{ displayValue(totalIncoming) }}</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="text-orange-400">↑</span>
              <span>{{ displayValue(totalOutgoing) }}</span>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>

  <!-- Configuration Dialog -->
  <v-dialog v-model="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen" width="auto">
    <v-card class="pa-4 text-white w-[25rem]" style="border-radius: 15px" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-center">MAVLink Stats Config</v-card-title>
      <v-card-text class="flex flex-col gap-y-4">
        <v-select
          v-model="miniWidget.options.displayMode"
          :items="displayModeOptions"
          label="Display Mode"
          density="compact"
          variant="outlined"
        />
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { onBeforeMount, onBeforeUnmount, ref, toRefs } from 'vue'

import { getDataLakeVariableData, listenDataLakeVariable, unlistenDataLakeVariable } from '@/libs/actions/data-lake'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { MiniWidget } from '@/types/widgets'

/**
 * Props for the MAVLinkStats component
 */
const props = defineProps<{
  /**
   * Configuration of the widget
   */
  miniWidget: MiniWidget
}>()
const miniWidget = toRefs(props).miniWidget

const defaultOptions = {
  displayMode: 'rates',
}

const displayModeOptions = [
  { title: 'Rates Only', value: 'rates' },
  { title: 'Totals Only', value: 'totals' },
  { title: 'Both', value: 'both' },
]

const widgetStore = useWidgetManagerStore()
const interfaceStore = useAppInterfaceStore()

// Reactive data from DataLake
const totalIncoming = ref(0)
const totalOutgoing = ref(0)
const incomingRate = ref(0)
const outgoingRate = ref(0)

// Listener IDs for cleanup
const listenerIds: string[] = []

/**
 * Format numbers for display
 * @param {number} value - The value to format
 * @returns {string} Formatted value
 */
const displayValue = (value: number): string => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`
  }
  return value.toFixed(0)
}

/**
 * Setup data lake listeners
 */
const setupListeners = (): void => {
  // Listen to total incoming messages
  const incomingTotalListener = listenDataLakeVariable('mavlink-total-incoming', (value) => {
    totalIncoming.value = typeof value === 'number' ? value : 0
  })
  listenerIds.push(incomingTotalListener)

  // Listen to total outgoing messages
  const outgoingTotalListener = listenDataLakeVariable('mavlink-total-outgoing', (value) => {
    totalOutgoing.value = typeof value === 'number' ? value : 0
  })
  listenerIds.push(outgoingTotalListener)

  // Listen to incoming rate
  const incomingRateListener = listenDataLakeVariable('mavlink-incoming-rate', (value) => {
    incomingRate.value = typeof value === 'number' ? value : 0
  })
  listenerIds.push(incomingRateListener)

  // Listen to outgoing rate
  const outgoingRateListener = listenDataLakeVariable('mavlink-outgoing-rate', (value) => {
    outgoingRate.value = typeof value === 'number' ? value : 0
  })
  listenerIds.push(outgoingRateListener)
}

/**
 * Initialize current values from data lake
 */
const initializeValues = (): void => {
  totalIncoming.value = (getDataLakeVariableData('mavlink-total-incoming') as number) || 0
  totalOutgoing.value = (getDataLakeVariableData('mavlink-total-outgoing') as number) || 0
  incomingRate.value = (getDataLakeVariableData('mavlink-incoming-rate') as number) || 0
  outgoingRate.value = (getDataLakeVariableData('mavlink-outgoing-rate') as number) || 0
}

onBeforeMount(() => {
  // Set default options
  miniWidget.value.options = Object.assign({}, defaultOptions, miniWidget.value.options)

  // Initialize values and setup listeners
  initializeValues()
  setupListeners()
})

onBeforeUnmount(() => {
  // Clean up listeners
  listenerIds.forEach((id, index) => {
    const variableIds = [
      'mavlink-total-incoming',
      'mavlink-total-outgoing',
      'mavlink-incoming-rate',
      'mavlink-outgoing-rate',
    ]
    unlistenDataLakeVariable(variableIds[index], id)
  })
})
</script>
