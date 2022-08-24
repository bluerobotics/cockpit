<template>
  <v-sheet rounded color="rgba(255, 255, 255, 0.9)" class="indications">
    <p class="font-weight-bold text-body-1">Speed:</p>
    <p class="text-body-1">{{ store.speed }} km/h</p>
    <p class="font-weight-bold text-body-1">Heading:</p>
    <p class="text-body-1">{{ store.heading }} deg</p>
    <p class="font-weight-bold text-body-1">Depth:</p>
    <p class="text-body-1">{{ store.depth }} m</p>
    <p class="font-weight-bold text-body-1">Water temp:</p>
    <p class="text-body-1">{{ store.waterTemp }} oC</p>
  </v-sheet>
</template>

<script setup lang="ts">
import { useBoatStore } from '@/stores/boat'

const store = useBoatStore()
</script>

<style scoped>
.indications {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
</style>
