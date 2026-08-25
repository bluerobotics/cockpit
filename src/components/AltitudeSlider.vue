<template>
  <div v-if="showAltitudeSlider" class="slider-div">
    <slider
      v-model="displayedAltitude"
      orientation="vertical"
      width="100%"
      height="20"
      color="rgb(59 130 246)"
      track-color="rgb(59 130 246 / 0.5)"
      always-show-handle="true"
      step="0.1"
      :min="0"
      :max="maxDisplayedAltitude"
    />
    <div class="slider-value"><span>Alt (Rel)</span></div>
    <div class="slider-value">{{ formattedValue }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import slider from 'vue3-slider'

import { altitude_setpoint, showAltitudeSlider } from '@/libs/altitude-slider'
import { convertValue, convertValueToRawUnit, formatValueWithUnit } from '@/libs/units'
import { useAppInterfaceStore } from '@/stores/appInterface'

const interfaceStore = useAppInterfaceStore()

// The setpoint is what gets commanded, so it stays in the meters the vehicle takes while the slider
// works in whatever the user reads.
const highestAltitudeSetpointInMeters = 100

const displayedAltitude = computed({
  get: () => convertValue(altitude_setpoint.value, 'm', interfaceStore.displayUnitPreferences).value,
  set: (value: number) => {
    altitude_setpoint.value = convertValueToRawUnit(value, 'm', interfaceStore.displayUnitPreferences)
  },
})

const maxDisplayedAltitude = computed(() => {
  const converted = convertValue(highestAltitudeSetpointInMeters, 'm', interfaceStore.displayUnitPreferences)
  return Math.round(converted.value)
})

const formattedValue = computed(() =>
  formatValueWithUnit(altitude_setpoint.value, 'm', interfaceStore.displayUnitPreferences)
)
</script>
<style scoped>
.slider-value {
  white-space: nowrap;
  text-align: center;
  font-size: 0.8rem;
}
.slider-div {
  position: fixed;
  right: 2%;
  top: 25%;
  bottom: 0;
  width: 25px;
  height: 50%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  z-index: 100;
}
</style>
