<template>
  <BaseConfigurationView>
    <template #title>Alerts configuration</template>
    <template #content>
      <div class="align-start ml-5 flex flex-col justify-around">
        <v-switch
          v-model="alertStore.enableVoiceAlerts"
          label="Enable voice alerts"
          color="white"
          class="-mb-2 ml-3 mt-2"
        />
        <ExpansiblePanel :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title> Enable voice on specific alert levels:</template>
          <template #info>
            Enable voice alerts to receive audible notifications about system and vehicle activities. <br />
            Select specific alert levels to customize which types of notifications you receive.
          </template>
          <template #content>
            <div class="flex items-center justify-start">
              <div v-for="enabledLevel in alertStore.enabledAlertLevels" :key="enabledLevel.level" class="mx-2">
                <v-checkbox v-model="enabledLevel.enabled" :label="capitalize(enabledLevel.level)" color="white" />
              </div>
            </div>
          </template>
        </ExpansiblePanel>
        <span class="mt-4 text-sm font-medium">Alert voice:</span>
        <Dropdown
          v-model="alertStore.selectedAlertSpeechVoiceName"
          :options="alertStore.availableAlertSpeechVoiceNames"
          name-key="name"
          value-key="value"
          class="my-2 ml-2 max-w-[350px]"
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
