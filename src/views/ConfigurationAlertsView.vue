<template>
  <BaseConfigurationView>
    <template #title>Alerts configuration</template>
    <template #content>
      <div
        class="flex flex-col justify-around align-start ml-5 max-h-[85vh] overflow-y-auto"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[70vw]' : 'max-w-[40vw]'"
      >
        <ExpansiblePanel :is-expanded="!interfaceStore.isOnPhoneScreen" no-top-divider>
          <template #title>Voice alerts:</template>
          <template #info>
            Enable voice alerts to receive audible notifications about system and vehicle activities. <br />
            Select specific alert levels to customize which types of notifications you receive.
          </template>
          <template #content>
            <div class="flex justify-between">
              <v-switch
                :model-value="alertStore.enableVoiceAlerts"
                label="Enable voice alerts"
                color="white"
                class="ml-3"
                @update:model-value="setVoiceAlertsEnabled"
              />
              <v-slider
                v-model="alertStore.alertVolume"
                min="0"
                max="1"
                step="0.05"
                hide-details
                label="Alerts volume"
                color="white"
                class="max-w-[300px]"
                :disabled="!alertStore.enableVoiceAlerts"
              />
            </div>
            <span class="text-sm font-medium mt-4">Alert levels:</span>
            <div class="flex flex-wrap items-center justify-start">
              <div
                v-for="enabledLevel in alertStore.enabledAlertLevels"
                :key="enabledLevel.level"
                class="mx-2 min-w-[100px]"
              >
                <v-checkbox
                  :model-value="enabledLevel.enabled"
                  :label="capitalize(enabledLevel.level)"
                  hide-details
                  color="white"
                  @update:model-value="(value) => setAlertLevelEnabled(enabledLevel.level, value)"
                />
              </div>
            </div>
            <span class="text-sm font-medium mt-4">Alert voice:</span>
            <Dropdown
              :model-value="alertStore.selectedAlertSpeechVoiceName"
              :options="alertStore.availableAlertSpeechVoiceNames"
              name-key="name"
              value-key="value"
              class="max-w-[350px] mt-2 mb-4 ml-2"
              @update:model-value="setAlertVoice"
            />
          </template>
        </ExpansiblePanel>
        <!-- Armed Menu Warning Toggle -->
        <v-switch
          :model-value="!alertStore.neverShowArmedMenuWarning"
          label="Show warning when opening menu with armed vehicle"
          color="white"
          class="mt-3 mb-2 ml-3"
          hide-details
          @update:model-value="setShowArmedMenuWarning"
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

const setVoiceAlertsEnabled = (value: boolean | null): void => {
  const enabled = value ?? false
  logUserAction(`${enabled ? 'Enabled' : 'Disabled'} voice alerts`)
  alertStore.enableVoiceAlerts = enabled
}

const setAlertLevelEnabled = (level: string, value: boolean | null): void => {
  const enabledLevel = alertStore.enabledAlertLevels.find((item) => item.level === level)
  if (!enabledLevel) return
  const enabled = value ?? false
  logUserAction(`${enabled ? 'Enabled' : 'Disabled'} '${level}' alert level`)
  enabledLevel.enabled = enabled
}

const setAlertVoice = (value: unknown): void => {
  logUserAction(`Set alert voice to '${value}'`)
  alertStore.selectedAlertSpeechVoiceName = value as string
}

const setShowArmedMenuWarning = (value: boolean | null): void => {
  const show = value ?? false
  logUserAction(`${show ? 'Enabled' : 'Disabled'} armed-vehicle menu warning`)
  alertStore.neverShowArmedMenuWarning = !show
}
</script>
