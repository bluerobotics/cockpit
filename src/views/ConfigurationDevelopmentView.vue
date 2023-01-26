<template>
  <BaseConfigurationView>
    <template #title>Development configuration</template>
    <template #content>
      <v-switch v-model="devStore.developmentMode" label="Development mode" class="ma-2" color="rgb(0, 20, 80)" />
      <v-slider
        v-model="devStore.widgetDevInfoBlurLevel"
        label="Dev info blur level"
        min="0"
        max="10"
        class="ma-2 w-25"
        color="rgb(0, 20, 80)"
        step="1"
        thumb-label="always"
      />
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import { useDevelopmentStore } from '@/stores/development'

import BaseConfigurationView from './BaseConfigurationView.vue'

const devStore = useDevelopmentStore()
</script>
