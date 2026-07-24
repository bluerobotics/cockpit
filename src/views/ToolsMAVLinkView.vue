<template>
  <BaseConfigurationView>
    <template #title>{{ $t('MAVLink') }}</template>
    <template #content>
      <div
        class="max-h-[85vh] overflow-y-auto -mr-4"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[85vw]' : 'max-w-[50vw]'"
      >
        <ExpansiblePanel :is-expanded="!interfaceStore.isOnPhoneScreen" no-top-divider>
          <template #title>{{ $t('Messages dumper') }}</template>
          <template #content>
            <MAVLinkMessagesDumper />
          </template>
        </ExpansiblePanel>
        <ExpansiblePanel :is-expanded="!interfaceStore.isOnPhoneScreen" no-bottom-divider>
          <template #title>{{ $t('Message Inspector') }}</template>
          <template #content>
            <MAVLinkInspector />
          </template>
        </ExpansiblePanel>
      </div>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import MAVLinkInspector from '@/components/development/MAVLinkInspector.vue'
import MAVLinkMessagesDumper from '@/components/development/MAVLinkMessagesDumper.vue'
import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { useAppInterfaceStore } from '@/stores/appInterface'

import BaseConfigurationView from './BaseConfigurationView.vue'
const interfaceStore = useAppInterfaceStore()
</script>
