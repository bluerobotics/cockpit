<template>
  <BaseConfigurationView>
    <template #title>Alerts configuration</template>
    <template #content>
      <v-switch
        v-model="alertStore.enableVoiceAlerts"
        label="Enable voice alerts"
        class="m-2 text-slate-800"
        color="rgb(0, 20, 80)"
      />
      <span class="text-sm font-medium text-slate-500">Enable voice on specific alert levels:</span>
      <div class="flex items-center justify-start">
        <div v-for="enabledLevel in alertStore.enabledAlertLevels" :key="enabledLevel.level" class="mx-2">
          <v-switch
            v-model="enabledLevel.enabled"
            :label="capitalize(enabledLevel.level)"
            class="text-slate-800"
            color="rgb(0, 20, 80)"
          />
        </div>
      </div>
      <span class="text-sm font-medium text-slate-500">Alert voice:</span>
      <Dropdown
        v-model="alertStore.selectedAlertSpeechVoiceName"
        :options="alertStore.availableAlertSpeechVoiceNames"
        name-key="name"
        value-key="value"
        class="max-w-[200px] my-2"
      />
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import { capitalize } from 'vue'

import Dropdown from '@/components/Dropdown.vue'
import { useAlertStore } from '@/stores/alert'

import BaseConfigurationView from './BaseConfigurationView.vue'

const alertStore = useAlertStore()
</script>
