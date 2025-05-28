<template>
  <BaseConfigurationView>
    <template #title>MAVLink configuration</template>
    <template #content>
      <div class="max-h-[85vh] w-[710px] overflow-y-auto">
        <ExpansiblePanel no-top-divider no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Message intervals</template>
          <template #info>
            <p class="max-w-[500px]">
              Configure the frequency at which each MAVLink message is requested from the vehicle. Higher frequencies
              provide more responsive data but increase the load on the network and in the vehicle's CPU. If the message
              is not already configured, you can add it to the interval configuration with the forms in the bottom.
            </p>
          </template>
          <template #content>
            <div class="flex w-full -mt-4">
              <div class="flex flex-col px-2 mb-3">
                <div class="flex flex-row justify-between items-center w-full mb-1">
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
                      >
                        mdi-close
                      </v-icon>
                    </template>
                  </v-text-field>
                  <v-btn size="small" variant="text" class="ml-4" @click="resetToCockpitDefault">
                    Reset intervals to Cockpit defaults
                  </v-btn>
                </div>
                <v-data-table
                  :items="filteredMessages"
                  items-per-page="10"
                  class="elevation-1 bg-transparent rounded-lg"
                  theme="dark"
                  :headers="headers"
                  :style="interfaceStore.globalGlassMenuStyles"
                  density="compact"
                >
                  <template #item="{ item }">
                    <tr>
                      <td class="w-[280px]">
                        <p class="whitespace-nowrap overflow-hidden mx-1 truncate text-sm">{{ item.name }}</p>
                      </td>
                      <td>
                        <div class="flex flex items-center justify-between">
                          <v-select
                            v-model="item.intervalType"
                            :items="[
                              { title: 'Vehicle default', value: 'default' },
                              { title: 'Disabled', value: 'disabled' },
                              { title: 'Custom', value: 'custom' },
                              { title: 'Don\'t touch', value: 'dontTouch' },
                            ]"
                            density="compact"
                            variant="outlined"
                            hide-details
                            class="w-[160px] scale-[80%]"
                            @update:model-value="updateMessageIntervalType(item.name, $event)"
                          />
                          <v-slider
                            v-model="item.frequency"
                            color="white"
                            class="scale-[70%] w-[110px]"
                            min="1"
                            step="1"
                            max="50"
                            hide-details
                            :disabled="item.intervalType !== 'custom'"
                            @update:model-value="updateMessageFrequency(item.name, $event)"
                          />
                          <v-text-field
                            :value="getDisplayFrequency(item)"
                            min="1"
                            step="1"
                            max="50"
                            class="bg-transparent w-[68px]"
                            type="number"
                            density="compact"
                            variant="plain"
                            hide-details
                            :disabled="item.intervalType !== 'custom'"
                            @update:model-value="updateMessageFrequency(item.name, $event)"
                          />
                          <span
                            :class="{
                              'text-transparent': item.intervalType !== 'custom' && item.intervalType !== 'disabled',
                              'text-slate-400': item.intervalType === 'disabled',
                            }"
                          >
                            Hz
                          </span>
                        </div>
                      </td>
                    </tr>
                  </template>
                </v-data-table>
              </div>
            </div>
            <div class="flex">
              <v-card
                class="flex flex-col ml-2 -mr-1 px-4 py-3 mb-3 elevation-1 bg-transparent rounded-lg"
                theme="dark"
                :style="interfaceStore.globalGlassMenuStyles"
              >
                <span class="text-sm text-gray-200 mb-3">Set the interval for a new message</span>
                <div class="flex flex-row items-center justify-between mb-2">
                  <v-select
                    v-model="newMessageType"
                    :items="availableMessageTypes"
                    label="Message Type"
                    density="compact"
                    variant="outlined"
                    hide-details
                    class="w-[284px]"
                  />
                  <v-select
                    v-model="newIntervalType"
                    :items="[
                      { title: 'Vehicle default', value: 'default' },
                      { title: 'Disabled', value: 'disabled' },
                      { title: 'Custom', value: 'custom' },
                      { title: 'Don\'t touch', value: 'dontTouch' },
                    ]"
                    label="Interval Type"
                    density="compact"
                    variant="outlined"
                    hide-details
                    class="w-[170px] pl-2"
                  />
                  <div class="flex items-center">
                    <v-slider
                      v-model="newFrequency"
                      color="white"
                      class="scale-[70%] w-[110px]"
                      min="1"
                      step="1"
                      max="50"
                      hide-details
                      :disabled="newIntervalType !== 'custom'"
                    />
                    <v-text-field
                      :value="getNewMessageDisplayFrequency()"
                      min="1"
                      step="1"
                      max="50"
                      class="bg-transparent w-[70px]"
                      type="text"
                      density="compact"
                      variant="plain"
                      hide-details
                      :disabled="newIntervalType !== 'custom'"
                      @update:model-value="updateNewFrequency($event)"
                    />
                    <span
                      :class="{
                        'text-transparent': newIntervalType !== 'custom' && newIntervalType !== 'disabled',
                        'text-slate-400': newIntervalType === 'disabled',
                      }"
                    >
                      Hz
                    </span>
                  </div>
                </div>
                <v-btn
                  variant="outlined"
                  size="small"
                  :disabled="!newMessageType || !newIntervalType"
                  @click="addNewMessageInterval"
                >
                  Add new message
                </v-btn>
              </v-card>
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
import type { MessageIntervalOptions } from '@/libs/vehicle/ardupilot/types'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'

import BaseConfigurationView from './BaseConfigurationView.vue'

const interfaceStore = useAppInterfaceStore()
const mainVehicleStore = useMainVehicleStore()
const searchTerm = ref('')

// New message interval variables
const newMessageType = ref<MAVLinkType | null>(null)
const newIntervalType = ref<'default' | 'disabled' | 'custom' | 'dontTouch'>('default')
const newFrequency = ref(1)

const headers = [
  { title: 'Message', key: 'name', align: 'start' },
  { title: 'Configuration', key: 'configuration', align: 'center' },
]

// Convert message intervals to table items
const messageItems = computed(() => {
  return Object.entries(mainVehicleStore.mavlinkMessageIntervalOptions).map(([messageType, storedValue]) => {
    // Convert stored value to MessageIntervalOptions
    let options: MessageIntervalOptions
    if (typeof storedValue === 'number') {
      if (storedValue === 0) {
        options = { intervalType: 'disabled' }
      } else {
        options = { intervalType: 'custom', frequencyHz: storedValue }
      }
    } else {
      options = storedValue
    }

    return {
      name: messageType,
      type: messageType as MAVLinkType,
      intervalType: options.intervalType,
      frequency: options.frequencyHz || null,
    }
  })
})

// Filter messages based on search term
const filteredMessages = computed(() => {
  const lowerSearch = searchTerm.value.toLowerCase()
  return messageItems.value
    .filter((item) => item.name.toLowerCase().includes(lowerSearch))
    .sort((a, b) => a.name.localeCompare(b.name))
})

/**
 * Updates the message interval type for a specific message
 * @param {string} messageType - The type of message to update
 * @param {string} intervalType - The new interval type
 */
const updateMessageIntervalType = async (messageType: string, intervalType: string): Promise<void> => {
  const options: MessageIntervalOptions = {
    intervalType: intervalType as 'default' | 'disabled' | 'custom' | 'dontTouch',
  }

  // If switching to custom, use the current frequency or default to 1
  if (intervalType === 'custom') {
    const currentItem = messageItems.value.find((item) => item.name === messageType)
    options.frequencyHz = currentItem?.frequency ?? 1
  }

  await mainVehicleStore.updateMessageInterval(messageType, options)
}

/**
 * Updates the frequency for a custom interval message
 * @param {string} messageType - The type of message to update
 * @param {number} frequency - The new frequency in Hz
 */
const updateMessageFrequency = async (messageType: string, frequency: number): Promise<void> => {
  const options: MessageIntervalOptions = {
    intervalType: 'custom',
    frequencyHz: Math.max(1, frequency), // Ensure minimum frequency of 1 Hz
  }

  await mainVehicleStore.updateMessageInterval(messageType, options)
}

/**
 * Resets all message intervals to their default values
 */
const resetToCockpitDefault = async (): Promise<void> => {
  await mainVehicleStore.resetMessageIntervalsToCockpitDefault()
}

/**
 * Returns the display frequency for a message
 * @param {any} item - The message item
 * @returns {string} - The display frequency
 */
const getDisplayFrequency = (item: any): string => {
  if (item.intervalType === 'disabled') {
    return '0'
  } else if (item.intervalType === 'custom') {
    return item.frequency === null ? '1' : item.frequency.toString()
  } else {
    return 'N/A'
  }
}

// New message interval functions
const availableMessageTypes = computed(() => {
  const allMessageTypes = Object.values(MAVLinkType)
  const configuredTypes = Object.keys(mainVehicleStore.mavlinkMessageIntervalOptions)
  return allMessageTypes
    .filter((type) => !configuredTypes.includes(type))
    .map((type) => ({ title: type, value: type }))
    .sort((a, b) => a.title.localeCompare(b.title))
})

const getNewMessageDisplayFrequency = (): string => {
  if (newIntervalType.value === 'disabled') {
    return '0'
  } else if (newIntervalType.value === 'custom') {
    return newFrequency.value.toString()
  } else {
    return 'N/A'
  }
}

const updateNewFrequency = (frequency: string | number): void => {
  const numFreq = typeof frequency === 'string' ? parseInt(frequency) || 1 : frequency
  newFrequency.value = Math.max(1, numFreq)
}

const addNewMessageInterval = async (): Promise<void> => {
  if (!newMessageType.value) return

  let options: MessageIntervalOptions

  switch (newIntervalType.value) {
    case 'custom':
      options = {
        intervalType: 'custom',
        frequencyHz: newFrequency.value,
      }
      break
    case 'disabled':
      options = {
        intervalType: 'disabled',
      }
      break
    case 'default':
      options = {
        intervalType: 'default',
      }
      break
    case 'dontTouch':
      options = {
        intervalType: 'dontTouch',
      }
      break
  }

  await mainVehicleStore.updateMessageInterval(newMessageType.value, options)

  // Reset form
  newMessageType.value = null
  newIntervalType.value = 'default'
  newFrequency.value = 1
}
</script>
