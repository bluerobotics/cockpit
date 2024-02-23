<template>
  <BaseConfigurationView>
    <template #title>Mission configuration</template>
    <template #content>
      <v-switch
        v-model="missionStore.slideEventsEnabled"
        label="Enable slide to confirm"
        class="m-2 text-slate-800"
        color="rgb(0, 20, 80)"
      />
      <div class="flex w-[60%] flex-wrap">
        <v-checkbox
          v-for="variable in EventCategory"
          :key="variable"
          v-model="missionStore.slideEventsCategoriesRequired[variable]"
          :disabled="!missionStore.slideEventsEnabled"
          :label="variable"
        ></v-checkbox>
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
