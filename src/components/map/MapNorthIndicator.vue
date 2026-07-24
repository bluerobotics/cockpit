<template>
  <div class="map-north-indicator" :style="interfaceStore.globalGlassMenuStyles" role="img" :aria-label="$t('North')">
    <v-icon class="map-north-indicator__arrow">mdi-navigation</v-icon>
    <span class="map-north-indicator__label">N</span>
  </div>
</template>

<script setup lang="ts">
import { useAppInterfaceStore } from '@/stores/appInterface'

const interfaceStore = useAppInterfaceStore()
</script>

<style scoped>
.map-north-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 31px;
  height: 42px;
  border-radius: 4px;
  pointer-events: none;
  user-select: none;
}

.map-north-indicator__arrow {
  font-size: 14px;
}

.map-north-indicator__label {
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
}
</style>
