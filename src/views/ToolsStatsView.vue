<template>
  <BaseConfigurationView>
    <template #title>Stats</template>
    <template #content>
      <div
        class="max-h-[85vh] overflow-y-auto mx-2"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[85vw]' : 'max-w-[60vw]'"
      >
        <ExpansiblePanel :is-expanded="!interfaceStore.isOnPhoneScreen" no-top-divider>
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

        <ExpansiblePanel :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>External Component Health</template>
          <template #info>
            <ul class="text-sm text-gray-300">
              <li>• Health status of external MAVLink components is checked every second</li>
              <li>• Shows service availability and message freshness</li>
              <li>• Values of -1 indicate unknown or unavailable data</li>
              <li>• Red indicators show potential issues in the MAVLink pipeline</li>
            </ul>
          </template>
          <template #content>
            <div class="flex flex-col gap-6 my-4 w-full">
              <!-- MAVLink2Rest Status -->
              <div class="bg-[#FFFFFF08] rounded-lg p-4 border border-[#FFFFFF15]">
                <div class="flex items-center gap-2 mb-4">
                  <v-icon :color="mavlink2restOnline ? 'green' : 'red'" size="20">
                    {{ mavlink2restOnline ? 'mdi-check-circle' : 'mdi-alert-circle' }}
                  </v-icon>
                  <h3 class="text-lg font-semibold text-white">MAVLink2Rest (Port 6040)</h3>
                  <v-chip :color="mavlink2restCorrectService ? 'green' : 'orange'" size="small" variant="flat">
                    {{ mavlink2restCorrectService ? 'Verified' : 'Unverified' }}
                  </v-chip>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div class="bg-[#FFFFFF11] rounded-lg p-3 border border-[#FFFFFF22]">
                    <div class="flex items-center justify-between">
                      <div>
                        <h4 class="text-sm font-semibold text-white">Heartbeat Age</h4>
                        <p class="text-xs text-gray-400">Seconds since last heartbeat</p>
                      </div>
                      <div class="text-right">
                        <p class="text-lg font-bold font-mono" :class="getAgeColor(mavlink2restHeartbeatAge)">
                          {{ formatAge(mavlink2restHeartbeatAge) }}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div class="bg-[#FFFFFF11] rounded-lg p-3 border border-[#FFFFFF22]">
                    <div class="flex items-center justify-between">
                      <div>
                        <h4 class="text-sm font-semibold text-white">System Time Age</h4>
                        <p class="text-xs text-gray-400">Seconds since last system time</p>
                      </div>
                      <div class="text-right">
                        <p class="text-lg font-bold font-mono" :class="getAgeColor(mavlink2restSystemTimeAge)">
                          {{ formatAge(mavlink2restSystemTimeAge) }}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div class="bg-[#FFFFFF11] rounded-lg p-3 border border-[#FFFFFF22]">
                    <div class="flex items-center justify-between">
                      <div>
                        <h4 class="text-sm font-semibold text-white">Attitude Age</h4>
                        <p class="text-xs text-gray-400">Seconds since last attitude</p>
                      </div>
                      <div class="text-right">
                        <p class="text-lg font-bold font-mono" :class="getAgeColor(mavlink2restAttitudeAge)">
                          {{ formatAge(mavlink2restAttitudeAge) }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- MAVLink Server Status -->
              <div class="bg-[#FFFFFF08] rounded-lg p-4 border border-[#FFFFFF15]">
                <div class="flex items-center gap-2 mb-4">
                  <v-icon :color="mavlinkServerOnline ? 'green' : 'red'" size="20">
                    {{ mavlinkServerOnline ? 'mdi-check-circle' : 'mdi-alert-circle' }}
                  </v-icon>
                  <h3 class="text-lg font-semibold text-white">MAVLink Server (Port 8080)</h3>
                  <v-chip :color="mavlinkServerCorrectService ? 'green' : 'orange'" size="small" variant="flat">
                    {{ mavlinkServerCorrectService ? 'Verified' : 'Unverified' }}
                  </v-chip>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div class="bg-[#FFFFFF11] rounded-lg p-3 border border-[#FFFFFF22]">
                    <div class="flex items-center justify-between">
                      <div>
                        <h4 class="text-sm font-semibold text-white">Endpoints</h4>
                        <p class="text-xs text-gray-400">Active endpoint count</p>
                      </div>
                      <div class="text-right">
                        <p class="text-lg font-bold font-mono text-blue-400">
                          {{ mavlinkServerStatsCount }}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div class="bg-[#FFFFFF11] rounded-lg p-3 border border-[#FFFFFF22]">
                    <div class="flex items-center justify-between">
                      <div>
                        <h4 class="text-sm font-semibold text-white">Soonest Input Age</h4>
                        <p class="text-xs text-gray-400">Seconds since last input message</p>
                      </div>
                      <div class="text-right">
                        <p class="text-lg font-bold font-mono" :class="getAgeColor(mavlinkServerSoonestInputAge)">
                          {{ formatAge(mavlinkServerSoonestInputAge) }}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div class="bg-[#FFFFFF11] rounded-lg p-3 border border-[#FFFFFF22]">
                    <div class="flex items-center justify-between">
                      <div>
                        <h4 class="text-sm font-semibold text-white">Soonest Output Age</h4>
                        <p class="text-xs text-gray-400">Seconds since last output message</p>
                      </div>
                      <div class="text-right">
                        <p class="text-lg font-bold font-mono" :class="getAgeColor(mavlinkServerSoonestOutputAge)">
                          {{ formatAge(mavlinkServerSoonestOutputAge) }}
                        </p>
                      </div>
                    </div>
                  </div>
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

// External component health data
const mavlink2restOnline = ref(false)
const mavlink2restCorrectService = ref(false)
const mavlink2restHeartbeatAge = ref(-1)
const mavlink2restSystemTimeAge = ref(-1)
const mavlink2restAttitudeAge = ref(-1)

const mavlinkServerOnline = ref(false)
const mavlinkServerCorrectService = ref(false)
const mavlinkServerStatsCount = ref(0)
const mavlinkServerSoonestInputAge = ref(-1)
const mavlinkServerSoonestOutputAge = ref(-1)

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
 * Format age value for display with millisecond precision
 * @param {number} age - Age in seconds (can be decimal)
 * @returns {string} Formatted age string
 */
const formatAge = (age: number): string => {
  if (age === -1) return 'N/A'

  const absAge = Math.abs(age)
  const sign = age < 0 ? '-' : ''

  if (absAge < 1) {
    // Show milliseconds for sub-second values
    return `${sign}${(absAge * 1000).toFixed(0)}ms`
  } else if (absAge < 60) {
    // Show seconds with 3 decimal places for precision
    return `${sign}${absAge.toFixed(3)}s`
  } else if (absAge < 3600) {
    // Show minutes and seconds
    const minutes = Math.floor(absAge / 60)
    const seconds = (absAge % 60).toFixed(1)
    return `${sign}${minutes}m ${seconds}s`
  } else {
    // Show hours, minutes, and seconds
    const hours = Math.floor(absAge / 3600)
    const minutes = Math.floor((absAge % 3600) / 60)
    const seconds = (absAge % 60).toFixed(1)
    return `${sign}${hours}h ${minutes}m ${seconds}s`
  }
}

/**
 * Get color class based on age value
 * @param {number} age - Age in seconds (can be decimal)
 * @returns {string} CSS color class
 */
const getAgeColor = (age: number): string => {
  if (age === -1) return 'text-gray-400'

  const absAge = Math.abs(age)
  if (absAge <= 1) return 'text-green-400' // Very fresh
  if (absAge <= 5) return 'text-green-300' // Fresh
  if (absAge <= 30) return 'text-yellow-400' // Warning
  return 'text-red-400' // Critical
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
  const incomingTotalListener = listenDataLakeVariable('mavlink-total-incoming', (value) => {
    totalIncoming.value = typeof value === 'number' ? value : 0
  })
  listenerIds.push(incomingTotalListener)

  const outgoingTotalListener = listenDataLakeVariable('mavlink-total-outgoing', (value) => {
    totalOutgoing.value = typeof value === 'number' ? value : 0
  })
  listenerIds.push(outgoingTotalListener)

  const incomingRateListener = listenDataLakeVariable('mavlink-incoming-rate', (value) => {
    incomingRate.value = typeof value === 'number' ? value : 0
  })
  listenerIds.push(incomingRateListener)

  const outgoingRateListener = listenDataLakeVariable('mavlink-outgoing-rate', (value) => {
    outgoingRate.value = typeof value === 'number' ? value : 0
  })
  listenerIds.push(outgoingRateListener)

  // External component health listeners
  const mavlink2restOnlineListener = listenDataLakeVariable('mavlink2rest-online', (value) => {
    mavlink2restOnline.value = typeof value === 'boolean' ? value : false
  })
  listenerIds.push(mavlink2restOnlineListener)

  const mavlink2restCorrectServiceListener = listenDataLakeVariable('mavlink2rest-correct-service', (value) => {
    mavlink2restCorrectService.value = typeof value === 'boolean' ? value : false
  })
  listenerIds.push(mavlink2restCorrectServiceListener)

  const mavlink2restHeartbeatAgeListener = listenDataLakeVariable('mavlink2rest-heartbeat-age', (value) => {
    mavlink2restHeartbeatAge.value = typeof value === 'number' ? value : -1
  })
  listenerIds.push(mavlink2restHeartbeatAgeListener)

  const mavlink2restSystemTimeAgeListener = listenDataLakeVariable('mavlink2rest-system-time-age', (value) => {
    mavlink2restSystemTimeAge.value = typeof value === 'number' ? value : -1
  })
  listenerIds.push(mavlink2restSystemTimeAgeListener)

  const mavlink2restAttitudeAgeListener = listenDataLakeVariable('mavlink2rest-attitude-age', (value) => {
    mavlink2restAttitudeAge.value = typeof value === 'number' ? value : -1
  })
  listenerIds.push(mavlink2restAttitudeAgeListener)

  const mavlinkServerOnlineListener = listenDataLakeVariable('mavlink-server-online', (value) => {
    mavlinkServerOnline.value = typeof value === 'boolean' ? value : false
  })
  listenerIds.push(mavlinkServerOnlineListener)

  const mavlinkServerCorrectServiceListener = listenDataLakeVariable('mavlink-server-correct-service', (value) => {
    mavlinkServerCorrectService.value = typeof value === 'boolean' ? value : false
  })
  listenerIds.push(mavlinkServerCorrectServiceListener)

  const mavlinkServerStatsCountListener = listenDataLakeVariable('mavlink-server-stats-count', (value) => {
    mavlinkServerStatsCount.value = typeof value === 'number' ? value : 0
  })
  listenerIds.push(mavlinkServerStatsCountListener)

  const mavlinkServerSoonestInputAgeListener = listenDataLakeVariable('mavlink-server-soonest-input-age', (value) => {
    mavlinkServerSoonestInputAge.value = typeof value === 'number' ? value : -1
  })
  listenerIds.push(mavlinkServerSoonestInputAgeListener)

  const mavlinkServerSoonestOutputAgeListener = listenDataLakeVariable('mavlink-server-soonest-output-age', (value) => {
    mavlinkServerSoonestOutputAge.value = typeof value === 'number' ? value : -1
  })
  listenerIds.push(mavlinkServerSoonestOutputAgeListener)
}

/**
 * Initialize current values from data lake
 */
const initializeValues = (): void => {
  totalIncoming.value = (getDataLakeVariableData('mavlink-total-incoming') as number) || 0
  totalOutgoing.value = (getDataLakeVariableData('mavlink-total-outgoing') as number) || 0
  incomingRate.value = (getDataLakeVariableData('mavlink-incoming-rate') as number) || 0
  outgoingRate.value = (getDataLakeVariableData('mavlink-outgoing-rate') as number) || 0

  mavlink2restOnline.value = (getDataLakeVariableData('mavlink2rest-online') as boolean) || false
  mavlink2restCorrectService.value = (getDataLakeVariableData('mavlink2rest-correct-service') as boolean) || false
  mavlink2restHeartbeatAge.value = (getDataLakeVariableData('mavlink2rest-heartbeat-age') as number) || -1
  mavlink2restSystemTimeAge.value = (getDataLakeVariableData('mavlink2rest-system-time-age') as number) || -1
  mavlink2restAttitudeAge.value = (getDataLakeVariableData('mavlink2rest-attitude-age') as number) || -1

  mavlinkServerOnline.value = (getDataLakeVariableData('mavlink-server-online') as boolean) || false
  mavlinkServerCorrectService.value = (getDataLakeVariableData('mavlink-server-correct-service') as boolean) || false
  mavlinkServerStatsCount.value = (getDataLakeVariableData('mavlink-server-stats-count') as number) || 0
  mavlinkServerSoonestInputAge.value = (getDataLakeVariableData('mavlink-server-soonest-input-age') as number) || -1
  mavlinkServerSoonestOutputAge.value = (getDataLakeVariableData('mavlink-server-soonest-output-age') as number) || -1
}

onMounted(() => {
  initializeValues()
  setupListeners()
})

onBeforeUnmount(() => {
  // Clean up listeners
  const variableIds = [
    'mavlink-total-incoming',
    'mavlink-total-outgoing',
    'mavlink-incoming-rate',
    'mavlink-outgoing-rate',
    'mavlink2rest-online',
    'mavlink2rest-correct-service',
    'mavlink2rest-heartbeat-age',
    'mavlink2rest-system-time-age',
    'mavlink2rest-attitude-age',
    'mavlink-server-online',
    'mavlink-server-correct-service',
    'mavlink-server-stats-count',
    'mavlink-server-soonest-input-age',
    'mavlink-server-soonest-output-age',
  ]

  listenerIds.forEach((id, index) => {
    if (index < variableIds.length) {
      unlistenDataLakeVariable(variableIds[index], id)
    }
  })
})
</script>

<style scoped>
.custom-header {
  background-color: #333 !important;
  color: #fff;
}
</style>
