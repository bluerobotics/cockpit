<template>
  <BaseConfigurationView>
    <template #title>MAVLink</template>
    <template #content>
      <div
        class="max-h-[85vh] overflow-y-auto -mr-4"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[85vw]' : 'max-w-[60vw]'"
      >
        <ExpansiblePanel :is-expanded="!interfaceStore.isOnPhoneScreen" no-top-divider no-bottom-divider>
          <template #title>
            <div class="flex justify-between items-center w-full">
              <span>Message Inspector</span>
              <div class="flex items-center">
                <span v-if="isInspectorDetached" class="text-xs text-gray-400 mr-2">
                  <v-icon small class="mr-1">mdi-window-restore</v-icon>
                  Detached
                </span>
                <v-btn
                  variant="text"
                  class="text-xs"
                  size="small"
                  title="Open in floating window"
                  @click.stop="isInspectorDetached ? reattachInspector() : detachInspector()"
                >
                  <v-icon class="mr-1">{{ isInspectorDetached ? 'mdi-dock-window' : 'mdi-open-in-new' }}</v-icon>
                  {{ isInspectorDetached ? 'Reattach' : 'Detach' }}
                </v-btn>
              </div>
            </div>
          </template>
          <template #content>
            <div v-if="!isInspectorDetached">
              <MAVLinkInspector />
            </div>
            <div v-else class="py-4 text-center text-gray-400">
              <p>Inspector is currently detached in a floating window.</p>
            </div>
          </template>
        </ExpansiblePanel>
      </div>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import MAVLinkInspector from '@/components/development/MAVLinkInspector.vue'
import {
  closeFloatingMAVLinkInspector,
  isFloatingMAVLinkInspectorOpen,
  openFloatingMAVLinkInspector
} from '@/composables/useFloatingMAVLinkInspector'
import { useAppInterfaceStore } from '@/stores/appInterface'

import BaseConfigurationView from './BaseConfigurationView.vue'

const interfaceStore = useAppInterfaceStore()

// Track whether the inspector is currently detached
const isInspectorDetached = ref(false)

// Check if the inspector is already detached when the component is mounted
onMounted(() => {
  isInspectorDetached.value = isFloatingMAVLinkInspectorOpen()
})

/**
 * Opens the MAVLink inspector in a detached floating window
 */
const detachInspector = (): void => {
  console.log('Detaching MAVLink inspector...')
  try {
    // Pass a callback to handle when the floating window is closed directly
    const closeFunction = openFloatingMAVLinkInspector(() => {
      // This will be called when the window is closed using the X button
      isInspectorDetached.value = false
      console.log('MAVLink inspector was closed, reattached to tools menu')
    })
    isInspectorDetached.value = true
    console.log('MAVLink inspector detached successfully')
  } catch (error) {
    console.error('Failed to detach MAVLink inspector:', error)
  }
}

/**
 * Reattaches the floating MAVLink inspector
 */
const reattachInspector = (): void => {
  closeFloatingMAVLinkInspector()
  isInspectorDetached.value = false
}
</script>
<style scoped>
.custom-header {
  background-color: #333 !important;
  color: #fff;
}
</style>
