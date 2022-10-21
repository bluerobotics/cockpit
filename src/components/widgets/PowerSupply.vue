<template>
  <div>Battery:</div>
  <div>{{ voltage }}</div>
  <div>{{ current }}</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useMainVehicleStore } from '@/stores/mainVehicle'

const store = useMainVehicleStore()

const voltage = computed(() => `${store.powerSupply.voltage} V`)
const current = computed(() => `${store.powerSupply.current} A`)
</script>
