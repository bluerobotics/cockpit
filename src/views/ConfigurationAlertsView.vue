<template>
  <BaseConfigurationView>
    <template #title>{{ $t('configuration.alerts.title') }}</template>
    <template #content>
      <div
        class="flex flex-col justify-around align-start ml-5 max-h-[85vh] overflow-y-auto"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[70vw]' : 'max-w-[40vw]'"
      >
        <ExpansiblePanel :is-expanded="!interfaceStore.isOnPhoneScreen" no-top-divider>
          <template #title>{{ $t('configuration.alerts.voiceAlerts') }}</template>
          <template #info>
            {{ $t('configuration.alerts.voiceAlertsInfo') }}
          </template>
          <template #content>
            <div class="flex justify-between">
              <v-switch v-model="alertStore.enableVoiceAlerts" :label="$t('configuration.alerts.enableVoiceAlerts')" color="white" class="ml-3" />
              <v-slider
                v-model="alertStore.alertVolume"
                min="0"
                max="1"
                step="0.05"
                hide-details
                :label="$t('configuration.alerts.alertsVolume')"
                color="white"
                class="max-w-[300px]"
                :disabled="!alertStore.enableVoiceAlerts"
              />
            </div>
            <span class="text-sm font-medium mt-4">{{ $t('configuration.alerts.alertLevels') }}</span>
            <div class="flex flex-wrap items-center justify-start">
              <div
                v-for="enabledLevel in alertStore.enabledAlertLevels"
                :key="enabledLevel.level"
                class="mx-2 min-w-[100px]"
              >
                <v-checkbox
                  v-model="enabledLevel.enabled"
                  :label="$t(`configuration.alerts.${enabledLevel.level.toLowerCase()}`)"
                  hide-details
                  color="white"
                />
              </div>
            </div>
            <span class="text-sm font-medium mt-4">{{ $t('configuration.alerts.alertVoice') }}</span>
            <Dropdown
              v-model="alertStore.selectedAlertSpeechVoiceName"
              :options="alertStore.availableAlertSpeechVoiceNames"
              name-key="name"
              value-key="value"
              class="max-w-[350px] mt-2 mb-4 ml-2"
            />
          </template>
        </ExpansiblePanel>
        <!-- Armed Menu Warning Toggle -->
        <v-switch
          :model-value="!alertStore.neverShowArmedMenuWarning"
          :label="$t('configuration.alerts.showArmedMenuWarning')"
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
import Dropdown from '@/components/Dropdown.vue'
import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { useAlertStore } from '@/stores/alert'
import { useAppInterfaceStore } from '@/stores/appInterface'

import BaseConfigurationView from './BaseConfigurationView.vue'

const interfaceStore = useAppInterfaceStore()
const alertStore = useAlertStore()
</script>
