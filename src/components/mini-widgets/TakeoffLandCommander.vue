<template>
  <button
    class="relative flex items-center justify-center w-32 p-1 rounded-md shadow-inner h-9 bg-slate-800/60 hover:bg-slate-400/60"
    @click="vehicleStore.flying ? land() : takeoff()"
  >
    <span class="inline-block font-extrabold align-middle text-white">
      {{ vehicleStore.flying === undefined ? '...' : vehicleStore.flying ? 'Land' : 'Takeoff' }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { showAltitudeSlider } from '@/libs/altitude-slider'
import { canByPassCategory, EventCategory, slideToConfirm } from '@/libs/slide-to-confirm'
import { useMainVehicleStore } from '@/stores/mainVehicle'

const vehicleStore = useMainVehicleStore()

const takeoff = (): void => {
  showAltitudeSlider.value = true

  slideToConfirm(
    () => {
      showAltitudeSlider.value = false
      vehicleStore.takeoff()
    },
    {
      command: 'Takeoff',
    },
    canByPassCategory(EventCategory.TAKEOFF)
  )
}

const land = (): void => {
  slideToConfirm(
    vehicleStore.land,
    {
      command: 'Land',
    },
    canByPassCategory(EventCategory.LAND)
  )
}
</script>
