<template>
  <div id="snackbar-container" class="snackbar-container">
    <Snackbar v-for="snack in snackbars" :key="snack.id" v-bind="snack" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Snackbar from '@/components/Snackbar.vue'
import { useSnackbar } from '@/composables/snackbar'
import { useAppInterfaceStore } from '@/stores/appInterface'

const interfaceStore = useAppInterfaceStore()

const { snackbars } = useSnackbar()

const leftMargin = computed(() =>
  interfaceStore.isMainMenuVisible ? `${interfaceStore.mainMenuRenderedWidth + 20}px` : '10px'
)
</script>

<style scoped>
.snackbar-container {
  position: fixed;
  bottom: 97px;
  left: v-bind(leftMargin);
  display: flex;
  flex-direction: column;
  gap: 35px;
  pointer-events: none;
  /* Matches the main menu's own 300ms slide, so a message never trails the panel it is stepping aside from. */
  transition: left 300ms ease;
  /* Stays above the tallest surface in the app, the tutorial overlay at 1000000. */
  z-index: 1000001;
}
</style>
