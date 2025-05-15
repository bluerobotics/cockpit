<template>
  <button
    :class="[
      'relative flex items-center justify-center w-32 p-1 rounded-md shadow-inner h-9',
      vehicleStore.flying ? 'bg-slate-800/60 hover:bg-slate-400/60' : 'bg-slate-400/60 cursor-not-allowed',
    ]"
    :disabled="!vehicleStore.flying"
    @click="changeAlt()"
  >
    <span class="inline-block font-extrabold align-middle text-white"> Change Alt </span>
  </button>
</template>

<script setup lang="ts">
import { useSnackbar } from '@/composables/snackbar'
import { showAltitudeSlider } from '@/libs/altitude-slider'
import { canByPassCategory, EventCategory, slideToConfirm } from '@/libs/slide-to-confirm'
import { useMainVehicleStore } from '@/stores/mainVehicle'

const vehicleStore = useMainVehicleStore()
const { openSnackbar } = useSnackbar()

const changeAlt = async (): Promise<void> => {
  showAltitudeSlider.value = true

  try {
    await slideToConfirm({ command: 'Altitude Change' }, canByPassCategory(EventCategory.ALT_CHANGE))
    showAltitudeSlider.value = false
    vehicleStore.changeAlt()
  } catch (error) {
    openSnackbar({ message: (error as Error).message, variant: 'error', duration: 3000 })
  }
}
</script>
