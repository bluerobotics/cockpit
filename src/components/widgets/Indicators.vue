<template>
  <v-sheet rounded color="rgba(255, 255, 255, 0.9)" class="indications">
    <p class="font-weight-bold text-body-1">Vehicle online?</p>
    <p class="text-body-1">{{ store.isVehicleOnline() }}</p>
    <p class="font-weight-bold text-body-1">Firmware:</p>
    <p class="text-body-1">{{ store.firmwareType }}</p>
    <p class="font-weight-bold text-body-1">Vehicle:</p>
    <p class="text-body-1">{{ store.vehicleType }}</p>
    <p class="font-weight-bold text-body-1">Lat/Long:</p>
    <p class="text-body-1">
      {{ store.coordinates?.latitude }}/{{ store.coordinates?.longitude }}
    </p>
    <p class="font-weight-bold text-body-1">Pitch:</p>
    <p class="text-body-1">{{ degrees(store.attitude?.pitch) }} deg</p>
    <p class="font-weight-bold text-body-1">Roll:</p>
    <p class="text-body-1">{{ degrees(store.attitude?.roll) }} deg</p>
    <p class="font-weight-bold text-body-1">Yaw:</p>
    <p class="text-body-1">{{ degrees(store.attitude?.yaw) }} deg</p>
  </v-sheet>
</template>

<script setup lang="ts">
import { degrees } from '@/libs/utils'
import { useMainVehicleStore } from '@/stores/mainVehicle'
const store = useMainVehicleStore()
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
