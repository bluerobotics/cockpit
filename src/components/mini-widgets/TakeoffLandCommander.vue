<template>
  <button
    class="relative flex items-center justify-center w-32 p-1 rounded-md shadow-inner h-9 bg-slate-800/60 hover:bg-slate-400/60"
    @click="vehicleStore.flying ? land() : takeoff()"
  >
    <span class="inline-block font-extrabold text-white align-middle">
      {{ vehicleStore.flying === undefined ? '...' : vehicleStore.flying ? 'Land' : 'Takeoff' }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { showAltitudeSlider } from '@/libs/altitude-slider'
import { canByPassCategory, EventCategory, slideToConfirm } from '@/libs/slide-to-confirm'
import { tryOrAlert } from '@/libs/utils'
import { useMainVehicleStore } from '@/stores/mainVehicle'

const vehicleStore = useMainVehicleStore()

const takeoff = async (): Promise<void> => {
  showAltitudeSlider.value = true
  const tryToTakeOff = async (): Promise<void> => tryOrAlert(vehicleStore.takeoff)
  await slideToConfirm(tryToTakeOff, { command: 'Takeoff' }, canByPassCategory(EventCategory.TAKEOFF))
  showAltitudeSlider.value = false
}

const land = (): void => {
  const tryToLand = async (): Promise<void> => tryOrAlert(vehicleStore.land)
  slideToConfirm(tryToLand, { command: 'Land' }, canByPassCategory(EventCategory.LAND))
  showAltitudeSlider.value = false
}
</script>
