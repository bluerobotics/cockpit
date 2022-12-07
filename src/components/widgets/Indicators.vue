<template>
  <v-sheet rounded color="rgba(255, 255, 255, 0.9)" class="indications">
    <v-btn
      class="options-btn"
      icon="mdi-dots-vertical"
      size="x-small"
      variant="text"
      flat
      @click="showOptionsDialog = !showOptionsDialog"
    />
    <template v-if="widget.options.showDebugInfo">
      <p class="font-weight-bold text-body-1">Vehicle online?</p>
      <p class="text-body-1">{{ store.isVehicleOnline }}</p>
      <p class="font-weight-bold text-body-1">Armed?</p>
      <p class="text-body-1">{{ store.isArmed }}</p>
      <p class="font-weight-bold text-body-1">Flight mode:</p>
      <p class="text-body-1">{{ store.mode }}</p>
      <p class="font-weight-bold text-body-1">Firmware:</p>
      <p class="text-body-1">{{ store.firmwareType }}</p>
      <p class="font-weight-bold text-body-1">Vehicle:</p>
      <p class="text-body-1">{{ store.vehicleType }}</p>
      <p class="font-weight-bold text-body-1">CPU load:</p>
      <p class="text-body-1">{{ store.cpuLoad?.toFixed(2) }} %</p>
    </template>
    <template v-if="widget.options.showCoordinates">
      <p class="font-weight-bold text-body-1">Lat/Long:</p>
      <p class="text-body-1">{{ store.coordinates?.latitude }}/{{ store.coordinates?.longitude }}</p>
    </template>
    <template v-if="widget.options.showAttitude">
      <p class="font-weight-bold text-body-1">Pitch:</p>
      <p class="text-body-1">{{ degrees(store.attitude?.pitch).toFixed(2) }} deg</p>
      <p class="font-weight-bold text-body-1">Roll:</p>
      <p class="text-body-1">{{ degrees(store.attitude?.roll).toFixed(2) }} deg</p>
      <p class="font-weight-bold text-body-1">Yaw:</p>
      <p class="text-body-1">{{ degrees(store.attitude?.yaw).toFixed(2) }} deg</p>
    </template>
    <template v-if="widget.options.showPower">
      <p class="font-weight-bold text-body-1">Battery:</p>
      <p class="text-body-1">
        {{ store.powerSupply?.voltage?.toFixed(2) }} V / {{ store.powerSupply?.current?.toFixed(2) }} A
      </p>
    </template>
  </v-sheet>
  <v-dialog v-model="showOptionsDialog" width="auto">
    <v-card class="pa-2">
      <v-card-title>Indicators widget config</v-card-title>
      <v-card-text>
        <v-checkbox v-model="widget.options.showDebugInfo" label="showDebugInfo" hide-details />
        <v-checkbox v-model="widget.options.showCoordinates" label="showCoordinates" hide-details />
        <v-checkbox v-model="widget.options.showAttitude" label="showAttitude" hide-details />
        <v-checkbox v-model="widget.options.showPower" label="showPower" hide-details />
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { onBeforeMount, ref, toRefs } from 'vue'

import { degrees } from '@/libs/utils'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import type { Widget } from '@/types/widgets'

const store = useMainVehicleStore()
const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()

const widget = toRefs(props).widget
const showOptionsDialog = ref(false)

onBeforeMount(() => {
  // Set initial widget options if they don't exist
  if (Object.keys(widget.value.options).length === 0) {
    widget.value.options = {
      showCoordinates: true,
      showAttitude: true,
      showDebugInfo: true,
      showPower: true,
    }
  }
})
</script>

<style scoped>
.indications {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}
.options-btn {
  display: none;
  position: absolute;
  margin: 5px;
  top: 0;
  right: 0;
}
.indications:hover .options-btn {
  display: block;
}
</style>
