<template>
  <BaseConfigurationView>
    <template #title>Mission configuration</template>
    <template #content>
      <div
        class="flex flex-col justify-between items-start ml-[1vw] max-h-[85vh] overflow-y-auto"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[70vw]' : 'max-w-[40vw]'"
      >
        <v-switch
          v-model="missionStore.slideEventsEnabled"
          label="Enable slide to confirm"
          color="white"
          class="mt-2 -mb-2 ml-3"
        />

        <ExpansiblePanel no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Enable confirmation on specific categories:</template>
          <template #info>
            Add an extra confirmation step for UI elements that can trigger mission critical actions.
          </template>
          <template #content>
            <div class="flex flex-wrap items-center justify-start">
              <div
                v-for="category in EventCategory"
                :key="category"
                class="min-w-[100px]"
                :class="interfaceStore.isOnPhoneScreen ? 'mx-0' : 'mx-1'"
              >
                <v-checkbox
                  v-model="missionStore.slideEventsCategoriesRequired[category]"
                  :disabled="!missionStore.slideEventsEnabled"
                  :label="category"
                  hide-details
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
