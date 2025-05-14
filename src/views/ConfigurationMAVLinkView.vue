<template>
  <BaseConfigurationView>
    <template #title>MAVLink configuration</template>
    <template #content>
      <div class="max-h-[85vh] overflow-y-auto">
        <ExpansiblePanel no-top-divider no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Message intervals</template>
          <template #info>
            <p class="max-w-[400px]">
              Configure the frequency at which each MAVLink message is requested from the vehicle. Higher frequencies
              provide more responsive data but increase the load on the network and in the vehicle's CPU.
            </p>
          </template>
          <template #content>
            <div class="flex w-full">
              <div class="flex flex-col w-full px-4 pt-5 mb-6">
                <div class="flex flex-row justify-between items-center w-full mb-4">
                  <v-text-field
                    v-model="searchTerm"
                    placeholder="Search messages"
                    variant="plain"
                    density="compact"
                    hide-details
                    class="mt-1"
                  >
                    <template #prepend>
                      <v-icon class="ml-2 mt-[2px]">mdi-magnify</v-icon>
                    </template>
                    <template #append-inner>
                      <v-icon
                        v-if="searchTerm !== ''"
                        class="mx-2 mt-[2px] cursor-pointer opacity-65"
                        @click="searchTerm = ''"
                        >mdi-close</v-icon
                      >
                    </template>
                  </v-text-field>
                  <v-btn size="small" variant="text" class="ml-4" @click="resetToDefaults">
                    Reset intervals to defaults
                  </v-btn>
                </div>
                <v-data-table
                  :items="filteredMessages"
                  items-per-page="10"
                  class="elevation-1 bg-transparent rounded-lg"
                  theme="dark"
                  :headers="headers"
                  :style="interfaceStore.globalGlassMenuStyles"
                >
                  <template #item="{ item }">
                    <tr>
                      <td>
                        <div class="flex items-center justify-left rounded-xl mx-1 w-[260px]">
                          <p class="whitespace-nowrap overflow-hidden truncate">{{ item.name }}</p>
                        </div>
                      </td>
                      <td>
                        <div class="flex items-center justify-center rounded-xl mx-1 w-[220px]">
                          <v-slider
                            v-model="item.frequency"
                            color="white"
                            class="mt-1 scale-90 w-[100px]"
                            min="0"
                            step="1"
                            max="50"
                            hide-details
                            @update:model-value="updateMessageInterval(item.name, item.frequency)"
                          />
                          <v-text-field
                            v-model="item.frequency"
                            min="0"
                            step="1"
                            max="50"
                            class="bg-transparent w-[40px] -mr-2"
                            type="number"
                            density="compact"
                            variant="plain"
                            hide-details
                            @update:model-value="updateMessageInterval(item.name, item.frequency)"
                          />
                          <span class="ml-2">Hz</span>
                        </div>
                      </td>
                    </tr>
                  </template>
                </v-data-table>
              </div>
            </div>
          </template>
        </ExpansiblePanel>
      </div>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { MAVLinkType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'

import BaseConfigurationView from './BaseConfigurationView.vue'

const interfaceStore = useAppInterfaceStore()
const mainVehicleStore = useMainVehicleStore()
const searchTerm = ref('')

const headers = [
  { title: 'Message', key: 'name', align: 'start' },
  { title: 'Frequency (Hz)', key: 'frequency', align: 'center' },
]

// Convert message intervals to table items
const messageItems = computed(() => {
  return Object.entries(mainVehicleStore.customMessageIntervals.data).map(([messageType, frequency]) => ({
    name: messageType,
    type: messageType as MAVLinkType,
    frequency,
  }))
})

// Filter messages based on search term
const filteredMessages = computed(() => {
  const lowerSearch = searchTerm.value.toLowerCase()
  return messageItems.value
    .filter((item) => item.name.toLowerCase().includes(lowerSearch))
    .sort((a, b) => a.name.localeCompare(b.name))
})
/**
 * Updates the message interval for a specific message type
 * @param {string} messageType - The type of message to update
 * @param {number} interval - The new interval in milliseconds
 */
const updateMessageInterval = async (messageType: string, interval: number): Promise<void> => {
  await mainVehicleStore.updateMessageInterval(messageType, interval)
}

/**
 * Resets all message intervals to their default values
 */
const resetToDefaults = async (): Promise<void> => {
  await mainVehicleStore.resetMessageIntervals()
}
</script>
