<template>
  <div>
    <h1>Speed: {{ store.speed }} km/h</h1>
    <h1>Heading: {{ store.heading }} deg</h1>
    <h1>Depth: {{ store.depth }} m</h1>
    <h1>Water temp: {{ store.waterTemp }} oC</h1>
  </div>
</template>

<script setup lang="ts">
import { useBoatStore } from '@/stores/boat'

const store = useBoatStore()
</script>
