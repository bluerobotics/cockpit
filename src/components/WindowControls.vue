<template>
  <div class="window-controls flex items-center h-full" :class="{ 'order-first': isMacOS, 'order-last': !isMacOS }">
    <button
      v-for="control in controls"
      :key="control.action"
      class="window-control-btn flex items-center justify-center h-full hover:bg-[#ffffff22]"
      :class="{ 'hover:bg-red-500': control.action === 'close' }"
      @click="control.handler"
    >
      <v-icon size="14" class="text-lg text-slate-300" :class="[{ 'hover:text-white': control.action !== 'close' }]">
        {{ control.icon }}
      </v-icon>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { isElectron } from '@/libs/utils'

const isMacOS = ref(false)
const isMaximized = ref(false)

onMounted(async () => {
  if (!isElectron() || !window.electronAPI) return

  isMacOS.value = (await window.electronAPI.getPlatform()) === 'darwin'
  isMaximized.value = await window.electronAPI.isMaximized()

  // Listen for window state changes
  window.addEventListener('resize', async () => {
    if (window.electronAPI) {
      isMaximized.value = await window.electronAPI.isMaximized()
    }
  })
})

const closeControl = {
  action: 'close',
  icon: 'mdi-window-close',
  handler: () => window.electronAPI?.closeWindow(),
}

const minimizeControl = {
  action: 'minimize',
  icon: 'mdi-window-minimize',
  handler: () => window.electronAPI?.minimizeWindow(),
}

const maximizeControl = {
  action: 'maximize',
  icon: isMaximized.value ? 'mdi-window-restore' : 'mdi-window-maximize',
  handler: () => window.electronAPI?.maximizeWindow(),
}

const controls = computed(() => {
  if (isMacOS.value) {
    return [closeControl, minimizeControl, maximizeControl]
  }
  return [minimizeControl, maximizeControl, closeControl]
})
</script>

<style scoped>
.window-control-btn {
  -webkit-app-region: no-drag;
  width: 32px;
}
</style>
