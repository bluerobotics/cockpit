<template>
  <BaseConfigurationView>
    <template #title>Alerts configuration</template>
    <template #content>
      <div
        class="flex flex-col justify-around align-start ml-5 max-h-[85vh] overflow-y-auto"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[80vw]' : 'max-w-[50vw]'"
      >
        <ExpansiblePanel :is-expanded="!interfaceStore.isOnPhoneScreen" no-top-divider>
          <template #title>Text to speech:</template>
          <template #info>
            Enable text to speech to receive audible notifications of the system alerts. <br />
            Select specific alert levels to customize which ones will be spoken.
          </template>
          <template #content>
            <div class="flex flex-row items-center mb-4 ml-2 gap-x-12">
              <v-switch
                v-model="alertStore.enableVoiceAlerts"
                label="Enable"
                color="white"
                hide-details
                class="min-w-[100px]"
              />
              <div class="flex flex-row items-center">
                <span class="text-sm font-medium">Voice:</span>
                <Dropdown
                  v-model="alertStore.selectedAlertSpeechVoiceName"
                  :options="alertStore.availableAlertSpeechVoiceNames"
                  name-key="name"
                  value-key="value"
                  class="min-w-[250px] ml-3"
                />
              </div>
              <v-slider
                v-model="alertStore.alertVolume"
                min="0"
                max="1"
                step="0.05"
                hide-details
                label="Alerts volume"
                color="white"
                class="min-w-[200px]"
                :disabled="!alertStore.enableVoiceAlerts"
              />
            </div>
            <span class="text-sm font-medium mt-4">Levels to speak:</span>
            <div class="flex flex-wrap items-center justify-start">
              <div
                v-for="enabledLevel in alertStore.enabledAlertLevels"
                :key="enabledLevel.level"
                class="mx-2 min-w-[100px]"
              >
                <v-checkbox
                  v-model="enabledLevel.enabled"
                  :label="capitalize(enabledLevel.level)"
                  hide-details
                  color="white"
                />
              </div>
            </div>
          </template>
        </ExpansiblePanel>
        <!-- Armed Menu Warning Toggle -->
        <v-switch
          :model-value="!alertStore.neverShowArmedMenuWarning"
          label="Show warning when opening menu with armed vehicle"
          color="white"
          class="mt-3 mb-2 ml-3"
          hide-details
          @update:model-value="alertStore.neverShowArmedMenuWarning = !$event"
        />
      </div>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import { capitalize } from 'vue'

import Dropdown from '@/components/Dropdown.vue'
import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { useAlertStore } from '@/stores/alert'
import { useAppInterfaceStore } from '@/stores/appInterface'

import BaseConfigurationView from './BaseConfigurationView.vue'

const interfaceStore = useAppInterfaceStore()
const alertStore = useAlertStore()
</script>
