<template>
  <div id="snackbar-container" class="snackbar-container z-notification">
    <Snackbar v-for="snack in snackbars" :key="snack.id" v-bind="snack" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Snackbar from '@/components/Snackbar.vue'
import { useSnackbar } from '@/composables/snackbar'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'

const interfaceStore = useAppInterfaceStore()
const widgetStore = useWidgetManagerStore()

const { snackbars } = useSnackbar()

const leftMargin = computed(() =>
  interfaceStore.isMainMenuVisible ? `${interfaceStore.mainMenuRenderedWidth + 20}px` : '10px'
)
const bottomMargin = computed(() => `${widgetStore.currentBottomBarHeightPixelsScaled + 5}px`)
</script>

<style scoped>
.snackbar-container {
  position: fixed;
  bottom: v-bind(bottomMargin);
  left: v-bind(leftMargin);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  pointer-events: none;
  /* Matches the main menu's own 300ms slide, so a message never trails the panel it is stepping aside from. */
  transition: left 300ms ease;
}
</style>
