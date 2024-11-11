<template>
  <BaseConfigurationView>
    <template #title>Cockpit actions configuration</template>
    <template #content>
      <div
        class="flex-col h-full overflow-y-auto ml-[10px] pr-3 -mr-[10px] -mb-[10px]"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[80vw] max-h-[90vh]' : 'max-w-[680px] max-h-[85vh]'"
      >
        <HttpRequestActionConfig />
        <MavlinkMessageActionConfig />
        <JavascriptActionConfig />
      </div>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import HttpRequestActionConfig from '@/components/configuration/HttpRequestActionConfig.vue'
import JavascriptActionConfig from '@/components/configuration/JavascriptActionConfig.vue'
import MavlinkMessageActionConfig from '@/components/configuration/MavlinkMessageActionConfig.vue'
import { useAppInterfaceStore } from '@/stores/appInterface'

import BaseConfigurationView from './BaseConfigurationView.vue'

const interfaceStore = useAppInterfaceStore()
</script>
