<template>
  <BaseConfigurationView>
    <template #title>Stats</template>
    <template #content>
      <div
        class="max-h-[85vh] overflow-y-auto mx-2"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[85vw]' : 'max-w-[60vw]'"
      >
        <ExpansiblePanel :is-expanded="!interfaceStore.isOnPhoneScreen" no-top-divider no-bottom-divider>
          <template #title>MAVLink Message Statistics</template>
          <template #info>
            <ul class="text-sm text-gray-300">
              <li>• Statistics are updated in real-time as messages are processed</li>
              <li>• Rates are calculated per second and updated every second</li>
              <li>• Data is also available in the Data Lake for use in widgets and actions</li>
              <li>• Statistics reset when Cockpit is restarted</li>
            </ul>
          </template>
          <template #content>
            <div class="flex flex-col gap-6 my-4 w-full">
              <!-- Message Totals -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-[#FFFFFF11] rounded-lg p-4 border border-[#FFFFFF22]">
                  <div class="flex items-center justify-between">
                    <div>
                      <h3 class="text-lg font-semibold text-white">Total Incoming</h3>
                      <p class="text-sm text-gray-400">Messages received</p>
                    </div>
                    <div class="text-right">
                      <p class="text-2xl font-bold text-green-400 font-mono">{{ formatNumber(totalIncoming) }}</p>
                      <v-icon class="text-green-400" size="24">mdi-download</v-icon>
                    </div>
                  </div>
                </div>

                <div class="bg-[#FFFFFF11] rounded-lg p-4 border border-[#FFFFFF22]">
                  <div class="flex items-center justify-between">
                    <div>
                      <h3 class="text-lg font-semibold text-white">Total Outgoing</h3>
                      <p class="text-sm text-gray-400">Messages sent</p>
                    </div>
                    <div class="text-right">
                      <p class="text-2xl font-bold text-blue-400 font-mono">{{ formatNumber(totalOutgoing) }}</p>
                      <v-icon class="text-blue-400" size="24">mdi-upload</v-icon>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Message Rates -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-[#FFFFFF11] rounded-lg p-4 border border-[#FFFFFF22]">
                  <div class="flex items-center justify-between">
                    <div>
                      <h3 class="text-lg font-semibold text-white">Incoming Rate</h3>
                      <p class="text-sm text-gray-400">Messages per second</p>
                    </div>
                    <div class="text-right">
                      <p class="text-2xl font-bold text-green-400 font-mono">{{ incomingRate }}</p>
                      <p class="text-xs text-gray-400">msg/s</p>
                    </div>
                  </div>
                  <div class="mt-2">
                    <div class="w-full bg-gray-700 rounded-full h-2">
                      <div
                        class="bg-green-400 h-2 rounded-full transition-all duration-300"
                        :style="{ width: `${Math.min((incomingRate / maxRate) * 100, 100)}%` }"
                      ></div>
                    </div>
                  </div>
                </div>

                <div class="bg-[#FFFFFF11] rounded-lg p-4 border border-[#FFFFFF22]">
                  <div class="flex items-center justify-between">
                    <div>
                      <h3 class="text-lg font-semibold text-white">Outgoing Rate</h3>
                      <p class="text-sm text-gray-400">Messages per second</p>
                    </div>
                    <div class="text-right">
                      <p class="text-2xl font-bold text-blue-400 font-mono">{{ outgoingRate }}</p>
                      <p class="text-xs text-gray-400">msg/s</p>
                    </div>
                  </div>
                  <div class="mt-2">
                    <div class="w-full bg-gray-700 rounded-full h-2">
                      <div
                        class="bg-blue-400 h-2 rounded-full transition-all duration-300"
                        :style="{ width: `${Math.min((outgoingRate / maxRate) * 100, 100)}%` }"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Control Buttons -->
              <div class="flex justify-center gap-4 mt-0">
                <v-btn variant="outlined" prepend-icon="mdi-refresh" @click="resetStats">Reset Statistics</v-btn>
              </div>
            </div>
          </template>
        </ExpansiblePanel>
      </div>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { getDataLakeVariableData, listenDataLakeVariable, unlistenDataLakeVariable } from '@/libs/actions/data-lake'
import { MAVLinkStatsService } from '@/libs/stats/mavlink-stats'
import { useAppInterfaceStore } from '@/stores/appInterface'

import BaseConfigurationView from './BaseConfigurationView.vue'

const interfaceStore = useAppInterfaceStore()
const statsService = MAVLinkStatsService.getInstance()

// Reactive data
const totalIncoming = ref(0)
const totalOutgoing = ref(0)
const incomingRate = ref(0)
const outgoingRate = ref(0)

// Listener IDs for cleanup
const listenerIds: string[] = []

// Maximum rate for progress bar scaling (auto-adjusts)
const maxRate = computed(() => Math.max(incomingRate.value, outgoingRate.value, 50))

/**
 * Format large numbers with commas
 * @param {number} num - The number to format
 * @returns {string} The formatted number string
 */
const formatNumber = (num: number): string => {
  return num.toLocaleString()
}

/**
 * Reset statistics
 */
const resetStats = (): void => {
  statsService.resetStats()
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

onMounted(() => {
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

<style scoped>
.custom-header {
  background-color: #333 !important;
  color: #fff;
}
</style>
