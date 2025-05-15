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
import { useSnackbar } from '@/composables/snackbar'
import { canByPassCategory, EventCategory, slideToConfirm } from '@/libs/slide-to-confirm'
import { useMainVehicleStore } from '@/stores/mainVehicle'

const vehicleStore = useMainVehicleStore()
const { openSnackbar } = useSnackbar()

const takeoff = async (): Promise<void> => {
  try {
    await slideToConfirm({ command: 'Takeoff' }, canByPassCategory(EventCategory.TAKEOFF))
    await vehicleStore.takeoff()
  } catch (error) {
    openSnackbar({ message: `Takeoff request failed: ${(error as Error).message}`, variant: 'error', duration: 3000 })
  }
}

const land = async (): Promise<void> => {
  try {
    await slideToConfirm({ command: 'Land' }, canByPassCategory(EventCategory.LAND))
    await vehicleStore.land()
  } catch (error) {
    openSnackbar({ message: `Land request failed: ${(error as Error).message}`, variant: 'error', duration: 3000 })
  }
}
</script>
