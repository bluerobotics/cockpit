<template>
  <v-tooltip :text="store.isVehicleOnline ? 'Vehicle connected' : 'Vehicle disconnected'" location="top">
    <template #activator="{ props: tooltipProps }">
      <div class="relative" :class="store.isVehicleOnline ? 'text-slate-50' : 'text-gray-700'" v-bind="tooltipProps">
        <FontAwesomeIcon icon="fa-solid fa-arrow-right-arrow-left" size="xl" />
        <FontAwesomeIcon v-if="!store.isVehicleOnline" icon="fa-slash" size="xl" class="absolute -left-1" />
      </div>
    </template>
  </v-tooltip>
</template>

<script setup lang="ts">
import { useMainVehicleStore } from '@/stores/mainVehicle'

const store = useMainVehicleStore()
</script>
