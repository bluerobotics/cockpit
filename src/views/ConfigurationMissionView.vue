<template>
  <BaseConfigurationView>
    <template #title>Mission configuration</template>
    <template #content>
      <div class="ml-[1vw] flex max-w-[700px] flex-col items-start justify-between">
        <v-switch
          v-model="missionStore.slideEventsEnabled"
          label="Enable slide to confirm"
          color="white"
          class="-mb-2 ml-3 mt-2"
        />

        <ExpansiblePanel no-bottom-divider is-expanded>
          <template #title>Enable confirmation on specific categories:</template>
          <template #info>
            Add an extra confirmation step for UI elements that can trigger mission critical actions.
          </template>
          <template #content>
            <div class="flex items-center justify-start">
              <div
                v-for="category in EventCategory"
                :key="category"
                :class="interfaceStore.isOnPhoneScreen ? 'mx-0' : 'mx-1'"
              >
                <v-checkbox
                  v-model="missionStore.slideEventsCategoriesRequired[category]"
                  :disabled="!missionStore.slideEventsEnabled"
                  :label="category"
                ></v-checkbox>
              </div>
            </div>
          </template>
        </ExpansiblePanel>
      </div>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { EventCategory } from '@/libs/slide-to-confirm'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMissionStore } from '@/stores/mission'

import BaseConfigurationView from './BaseConfigurationView.vue'

const missionStore = useMissionStore()
const interfaceStore = useAppInterfaceStore()
</script>
