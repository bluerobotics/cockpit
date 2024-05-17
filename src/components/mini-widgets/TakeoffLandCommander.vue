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
import Swal from 'sweetalert2'

import { showAltitudeSlider } from '@/libs/altitude-slider'
import { canByPassCategory, EventCategory, slideToConfirm } from '@/libs/slide-to-confirm'
import { useMainVehicleStore } from '@/stores/mainVehicle'

const vehicleStore = useMainVehicleStore()

const takeoff = (): void => {
  showAltitudeSlider.value = true

  const tryToTakeOff = async (): Promise<void> => {
    showAltitudeSlider.value = false
    try {
      await vehicleStore.takeoff()
    } catch (error) {
      Swal.fire({ text: error as string, icon: 'error' })
    }
  }

  slideToConfirm(tryToTakeOff, { command: 'Takeoff' }, canByPassCategory(EventCategory.TAKEOFF))
}

const land = (): void => {
  const tryToLand = async (): Promise<void> => {
    showAltitudeSlider.value = false
    try {
      await vehicleStore.takeoff()
    } catch (error) {
      Swal.fire({ text: error as string, icon: 'error' })
    }
  }
  slideToConfirm(tryToLand, { command: 'Land' }, canByPassCategory(EventCategory.LAND))
}
</script>
