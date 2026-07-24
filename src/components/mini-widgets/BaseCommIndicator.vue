<template>
  <v-tooltip :text="store.isVehicleOnline ? $t('Vehicle connected') : $t('Vehicle disconnected')" location="top">
    <template #activator="{ props: tooltipProps }">
      <div
        class="relative"
        :class="
          store.isVehicleOnline
            ? 'text-slate-50'
            : store.isVehicleConnectionLost
            ? 'text-red-500 disconnected-pulse'
            : 'text-slate-500'
        "
        v-bind="tooltipProps"
      >
        <FontAwesomeIcon icon="fa-solid fa-arrow-right-arrow-left" size="xl" />
        <FontAwesomeIcon v-if="store.isVehicleConnectionLost" icon="fa-slash" size="xl" class="absolute -left-1" />
      </div>
    </template>
  </v-tooltip>
</template>

<script setup lang="ts">
import { useMainVehicleStore } from '@/stores/mainVehicle'

const store = useMainVehicleStore()
</script>

<style scoped>
.disconnected-pulse {
  animation: comm-indicator-pulse 1.6s ease-in-out infinite;
  filter: drop-shadow(0 0 4px rgba(239, 68, 68, 0.8));
}

@keyframes comm-indicator-pulse {
  0%,
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 1;
  }
}
</style>
