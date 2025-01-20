<template>
  <BaseConfigurationView>
    <template #title>MAVLink</template>
    <template #content>
      <div
        class="max-h-[85vh] overflow-y-auto -mr-4"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[85vw]' : 'max-w-[60vw]'"
      >
        <ExpansiblePanel :is-expanded="!interfaceStore.isOnPhoneScreen" no-top-divider no-bottom-divider>
          <template #title>Message Inspector</template>
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
import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { useAppInterfaceStore } from '@/stores/appInterface'

import BaseConfigurationView from './BaseConfigurationView.vue'
const interfaceStore = useAppInterfaceStore()
</script>
<style scoped>
.custom-header {
  background-color: #333 !important;
  color: #fff;
}
</style>
