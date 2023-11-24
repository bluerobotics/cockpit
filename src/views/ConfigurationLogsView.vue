<template>
  <BaseConfigurationView>
    <template #title>Logs configuration</template>
    <template #content>
      <h1 class="text-lg font-bold text-slate-600">Variables to be show in the overlay subtitles log:</h1>
      <div class="flex w-[60%] flex-wrap">
        <v-checkbox
          v-for="variable in DatalogVariable"
          :key="variable"
          v-model="datalogger.selectedVariablesToShow.value"
          :label="variable"
          :value="variable"
        ></v-checkbox>
      </div>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import { datalogger, DatalogVariable } from '@/libs/logging'

import BaseConfigurationView from './BaseConfigurationView.vue'
</script>
