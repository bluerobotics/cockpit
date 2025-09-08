<template>
  <InteractionDialog
    v-model="showArchWarningDialog"
    title="Performance Warning"
    variant="text-only"
    :actions="dialogActions"
    max-width="820"
  >
    <template #content>
      <div class="flex items-center justify-center mb-2">
        <v-icon class="text-yellow text-[60px] mx-8">mdi-alert-rhombus</v-icon>
        <div class="flex flex-col font-medium gap-y-3 w-full">
          You are running the x64 version of Cockpit on an Apple Silicon Mac (M series), which causes severely degraded
          performance, including:
          <ul class="mt- ml-4">
            <li>- 3-4x slower application startup times</li>
            <li>- 2x the memory usage</li>
            <li>- Reduced overall performance</li>
          </ul>
          <p class="text-sm text-gray-600 mt-2">
            This warning cannot be disabled - we strongly recommend that you download and install the intended version
            for your system.
          </p>
        </div>
      </div>
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import { onBeforeMount, ref } from 'vue'

import InteractionDialog, { type Action } from '@/components/InteractionDialog.vue'
import { isElectron } from '@/libs/utils'
import { PlatformUtils } from '@/types/platform'

const showArchWarningDialog = ref(false)

const dialogActions = [
  {
    text: 'Dismiss',
    action: () => {
      showArchWarningDialog.value = false
    },
  },
  {
    text: 'Download ARM64 Version',
    action: () => {
      window.open('https://github.com/bluerobotics/cockpit/releases/', '_blank')
      showArchWarningDialog.value = false
    },
  },
] as Action[]

/**
 * Check if we're running x64 version on ARM64 Mac and show warning
 */
const checkArchitectureAndWarn = async (): Promise<void> => {
  if (!window.electronAPI?.getSystemInfo) {
    console.warn('getSystemInfo not available in electronAPI')
    return
  }

  try {
    const systemInfo = await window.electronAPI.getSystemInfo()

    // Only show warning if we detect x64 on ARM64 Mac
    showArchWarningDialog.value = PlatformUtils.isX64OnArm64Mac(
      systemInfo.platform,
      systemInfo.arch,
      systemInfo.processArch
    )
  } catch (error) {
    console.error('Failed to get system info for architecture check:', error)
  }
}

onBeforeMount(() => {
  if (!isElectron()) {
    console.info('Not in Electron environment. ArchitectureWarning will not be initialized.')
    return
  }

  if (!window.electronAPI) {
    console.error('window.electronAPI is not defined. ArchitectureWarning will not be initialized.')
    return
  }

  // Wait a bit before showing the warning to not interfere with app startup
  setTimeout(() => {
    checkArchitectureAndWarn()
  }, 3000)
})
</script>
