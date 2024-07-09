<template>
  <button
    class="relative flex h-9 w-32 items-center justify-center rounded-md bg-slate-800/60 p-1 shadow-inner hover:bg-slate-400/60"
    @click="vehicleStore.flying ? land() : takeoff()"
  >
    <span class="inline-block align-middle font-extrabold text-white">
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
