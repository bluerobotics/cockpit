<template>
  <button
    :class="[
      'relative flex h-9 w-32 items-center justify-center rounded-md p-1 shadow-inner',
      vehicleStore.flying ? 'bg-slate-800/60 hover:bg-slate-400/60' : 'cursor-not-allowed bg-slate-400/60',
    ]"
    :disabled="!vehicleStore.flying"
    @click="changeAlt()"
  >
    <span class="inline-block align-middle font-extrabold text-white"> Change Alt </span>
  </button>
</template>

<script setup lang="ts">
import { showAltitudeSlider } from '@/libs/altitude-slider'
import { canByPassCategory, EventCategory, slideToConfirm } from '@/libs/slide-to-confirm'
import { useMainVehicleStore } from '@/stores/mainVehicle'

const vehicleStore = useMainVehicleStore()

const changeAlt = (): void => {
  showAltitudeSlider.value = true

  slideToConfirm(
    () => {
      showAltitudeSlider.value = false
      vehicleStore.changeAlt()
    },
    {
      command: 'Altitude Change',
    },
    canByPassCategory(EventCategory.ALT_CHANGE)
  )
}
</script>
