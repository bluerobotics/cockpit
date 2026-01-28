<template>
  <InteractionDialog
    v-model="showArchWarningDialog"
    :title="$t('architectureWarning.title')"
    variant="text-only"
    :actions="dialogActions"
    max-width="820"
  >
    <template #content>
      <div class="flex items-center justify-center mb-2">
        <v-icon class="text-yellow text-[60px] mx-8">mdi-alert-rhombus</v-icon>
        <div class="flex flex-col font-medium gap-y-3 w-full">
          {{ $t('architectureWarning.runningWrongVersion') }}
          <ul class="mt- ml-4">
            <li>- {{ $t('architectureWarning.slowerStartup') }}</li>
            <li>- {{ $t('architectureWarning.doubleMemory') }}</li>
            <li>- {{ $t('architectureWarning.reducedPerformance') }}</li>
          </ul>
          <p class="text-sm text-gray-600 mt-2">
            {{ $t('architectureWarning.cannotDisable') }}
          </p>
        </div>
      </div>
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import { onBeforeMount, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import InteractionDialog, { type Action } from '@/components/InteractionDialog.vue'
import { isElectron } from '@/libs/utils'
import { PlatformUtils } from '@/types/platform'

const { t } = useI18n()
const showArchWarningDialog = ref(false)

const dialogActions: Action[] = [
  {
    text: t('architectureWarning.dismiss'),
    action: () => {
      showArchWarningDialog.value = false
    },
  },
  {
    text: t('architectureWarning.downloadARM'),
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
