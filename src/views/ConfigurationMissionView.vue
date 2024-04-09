<template>
  <BaseConfigurationView>
    <template #title>Mission configuration</template>
    <template #content>
      <v-tooltip location="bottom" color="transparent">
        <template #activator="{ props }">
          <div class="flex justify-center items-center">
            <v-switch
              v-model="missionStore.slideEventsEnabled"
              class="m-2 text-slate-800"
              style="height: 56px"
              color="rgb(0, 20, 80)"
              v-bind="props"
            />
            <v-label style="height: 56px"> Enable slide to confirm </v-label>
          </div>
        </template>
        <span>
          Enabling this setting requires a confirmation step for UI elements that can trigger actions linked to
          specified event categories bellow.
        </span>
      </v-tooltip>
      <span class="text-sm font-medium text-slate-500">Enable confirmation on specific categories:</span>
      <div class="flex items-center justify-start">
        <div v-for="category in EventCategory" :key="category" class="mx-2">
          <v-checkbox
            v-model="missionStore.slideEventsCategoriesRequired[category]"
            :disabled="!missionStore.slideEventsEnabled"
            :label="category"
          ></v-checkbox>
        </div>
      </div>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import { EventCategory } from '@/libs/slide-to-confirm'
import { useMissionStore } from '@/stores/mission'

import BaseConfigurationView from './BaseConfigurationView.vue'

const missionStore = useMissionStore()
</script>
