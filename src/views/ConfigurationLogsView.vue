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
      <h1 class="text-lg font-bold text-slate-600">Frequency of the telemetry log</h1>
      <span class="text-sm text-slate-400 w-[50%] text-center">
        Values between 1 and 100Hz are more common and can be set with the slider.
      </span>
      <span class="text-sm text-slate-400">
        You can go as low as 0.1 Hz and as far as 1000 Hz using the text input.
      </span>
      <div class="flex flex-col justify-center m-3 align-center">
        <fwb-range v-model="newFrequency" class="m-2" :min="1" :max="100" :steps="1" label="" />
        <fwb-input v-model="newFrequencyString" class="w-24 m-1 text-center align-middle">
          <template #suffix>
            <span class="flex justify-center h-7 align-center">Hz</span>
          </template>
        </fwb-input>
      </div>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import { FwbInput, FwbRange } from 'flowbite-vue'
import { computed, ref, watch } from 'vue'

import { datalogger, DatalogVariable } from '@/libs/sensors-logging'

import BaseConfigurationView from './BaseConfigurationView.vue'

const newFrequency = ref(1000 / datalogger.logInterval.value)

watch(newFrequency, (newVal) => {
  datalogger.setFrequency(newVal)
})

const newFrequencyString = computed({
  get: () => newFrequency.value.toString(),
  set: (value) => (newFrequency.value = parseFloat(value)),
})
</script>
