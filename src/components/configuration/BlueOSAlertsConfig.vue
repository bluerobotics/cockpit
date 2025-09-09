<template>
  <ExpansiblePanel :is-expanded="true" no-top-divider>
    <template #title>BlueOS monitoring alerts:</template>
    <template #info>
      Configure alerts for BlueOS system monitoring including CPU temperature and usage thresholds. <br />
      Set custom thresholds and minimum intervals between alerts to prevent spam.
    </template>
    <template #content>
      <div class="ml-4 mb-4 mr-4">
        <table class="w-full">
          <thead>
            <tr>
              <th class="text-center text-sm font-medium text-slate-200 pb-3 w-12"></th>
              <th class="text-center text-sm font-medium text-slate-200 pb-3 w-40">Alert Type</th>
              <th class="text-center text-sm font-medium text-slate-200 pb-3 w-32">Threshold</th>
              <th class="text-center text-sm font-medium text-slate-200 pb-3 w-32">Min Interval (s)</th>
              <th class="text-center text-sm font-medium text-slate-200 pb-3 w-24">Level</th>
            </tr>
          </thead>
          <tbody>
            <!-- CPU Temperature Configuration -->
            <tr class="border-b border-slate-600">
              <td class="py-3 text-center">
                <input
                  v-model="vehicleAlerterStore.blueOsAlertsConfig['cpu-temperature'].enabled"
                  type="checkbox"
                  class="w-4 h-4"
                />
              </td>
              <td class="py-3 text-center">
                <span class="text-sm font-medium">CPU Temperature</span>
              </td>
              <td class="py-3 text-center">
                <div class="flex items-center justify-center gap-2">
                  <input
                    v-model.number="vehicleAlerterStore.blueOsAlertsConfig['cpu-temperature'].threshold"
                    type="number"
                    class="px-2 py-1 rounded-sm bg-[#FFFFFF22] w-16 text-sm text-center"
                    :disabled="!vehicleAlerterStore.blueOsAlertsConfig['cpu-temperature'].enabled"
                  />
                  <span class="text-xs text-slate-300">°C</span>
                </div>
              </td>
              <td class="py-3 text-center">
                <input
                  v-model.number="cpuTemperatureIntervalSeconds"
                  type="number"
                  class="px-2 py-1 rounded-sm bg-[#FFFFFF22] w-16 text-sm text-center"
                  :disabled="!vehicleAlerterStore.blueOsAlertsConfig['cpu-temperature'].enabled"
                />
              </td>
              <td class="py-3 text-center">
                <select
                  v-model="vehicleAlerterStore.blueOsAlertsConfig['cpu-temperature'].level"
                  class="px-2 py-1 rounded-sm bg-[#FFFFFF22] text-sm w-24"
                  :disabled="!vehicleAlerterStore.blueOsAlertsConfig['cpu-temperature'].enabled"
                >
                  <option value="success">Success</option>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                  <option value="critical">Critical</option>
                </select>
              </td>
            </tr>
            <!-- CPU Usage Configuration -->
            <tr>
              <td class="py-3 text-center">
                <input
                  v-model="vehicleAlerterStore.blueOsAlertsConfig['cpu-usage'].enabled"
                  type="checkbox"
                  class="w-4 h-4"
                />
              </td>
              <td class="py-3 text-center">
                <span class="text-sm font-medium">CPU Usage</span>
              </td>
              <td class="py-3 text-center">
                <div class="flex items-center justify-center gap-2">
                  <input
                    v-model.number="vehicleAlerterStore.blueOsAlertsConfig['cpu-usage'].threshold"
                    type="number"
                    class="px-2 py-1 rounded-sm bg-[#FFFFFF22] w-16 text-sm text-center"
                    :disabled="!vehicleAlerterStore.blueOsAlertsConfig['cpu-usage'].enabled"
                  />
                  <span class="text-xs text-slate-300">%</span>
                </div>
              </td>
              <td class="py-3 text-center">
                <input
                  v-model.number="cpuUsageIntervalSeconds"
                  type="number"
                  class="px-2 py-1 rounded-sm bg-[#FFFFFF22] w-16 text-sm text-center"
                  :disabled="!vehicleAlerterStore.blueOsAlertsConfig['cpu-usage'].enabled"
                />
              </td>
              <td class="py-3 text-center">
                <select
                  v-model="vehicleAlerterStore.blueOsAlertsConfig['cpu-usage'].level"
                  class="px-2 py-1 rounded-sm bg-[#FFFFFF22] text-sm w-24"
                  :disabled="!vehicleAlerterStore.blueOsAlertsConfig['cpu-usage'].enabled"
                >
                  <option value="success">Success</option>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                  <option value="critical">Critical</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </ExpansiblePanel>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { useVehicleAlerterStore } from '@/stores/vehicleAlerter'

const vehicleAlerterStore = useVehicleAlerterStore()

// Convert between seconds (UI) and milliseconds (store)
const cpuTemperatureIntervalSeconds = computed({
  get: () => vehicleAlerterStore.blueOsAlertsConfig['cpu-temperature'].minInterval / 1000,
  set: (value: number) => {
    vehicleAlerterStore.blueOsAlertsConfig['cpu-temperature'].minInterval = value * 1000
  },
})

const cpuUsageIntervalSeconds = computed({
  get: () => vehicleAlerterStore.blueOsAlertsConfig['cpu-usage'].minInterval / 1000,
  set: (value: number) => {
    vehicleAlerterStore.blueOsAlertsConfig['cpu-usage'].minInterval = value * 1000
  },
})
</script>
