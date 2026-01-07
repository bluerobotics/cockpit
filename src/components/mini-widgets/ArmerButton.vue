<template>
  <button
    class="relative flex items-center justify-center w-32 p-1 rounded-md shadow-inner h-9 bg-slate-800/60"
    @click="!widgetStore.editingMode && (vehicleStore.isArmed ? disarm() : arm())"
  >
    <div
      class="absolute top-auto flex items-center px-1 rounded-[4px] shadow transition-all w-[70%] h-[80%]"
      :class="
        vehicleStore.isArmed === undefined
          ? 'justify-start bg-slate-800/60 text-slate-400 left-[4%]'
          : vehicleStore.isArmed
          ? 'bg-red-700 hover:bg-red-800 text-slate-50 justify-end left-[26%]'
          : 'bg-green-700 hover:bg-green-800 text-slate-400 justify-start left-[4%]'
      "
    >
      <span class="inline-block font-extrabold align-middle unselectable">
        {{ vehicleStore.isArmed === undefined ? '...' : vehicleStore.isArmed ? $t('vehicle.armed') : $t('vehicle.disarmed') }}
      </span>
    </div>
  </button>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { useSnackbar } from '@/composables/snackbar'
import { canByPassCategory, EventCategory, slideToConfirm } from '@/libs/slide-to-confirm'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useWidgetManagerStore } from '@/stores/widgetManager'

const vehicleStore = useMainVehicleStore()
const widgetStore = useWidgetManagerStore()
const { openSnackbar } = useSnackbar()
const { t } = useI18n()

const arm = async (): Promise<void> => {
  try {
    await slideToConfirm(
      { 
        command: t('vehicle.arm'),
        text: t('vehicle.confirmArm'),
        confirmedText: t('vehicle.armConfirmed')
      }, 
      canByPassCategory(EventCategory.ARM)
    )
    await vehicleStore.arm()
  } catch (error) {
    const message = (error as Error).message
    if (message.includes('No vehicle available')) {
      openSnackbar({ message: `${t('vehicle.armRequestFailed')}: ${t('vehicle.noVehicleAvailableToArm')}`, variant: 'error', duration: 3000 })
    } else {
      openSnackbar({ message: `${t('vehicle.armRequestFailed')}: ${message}`, variant: 'error', duration: 3000 })
    }
  }
}

const disarm = async (): Promise<void> => {
  try {
    await slideToConfirm(
      { 
        command: t('vehicle.disarm'),
        text: t('vehicle.confirmDisarm'),
        confirmedText: t('vehicle.disarmConfirmed')
      }, 
      canByPassCategory(EventCategory.DISARM)
    )
    await vehicleStore.disarm()
  } catch (error) {
    openSnackbar({ message: `${t('vehicle.disarmRequestFailed')}: ${(error as Error).message}`, variant: 'error', duration: 3000 })
  }
}
</script>
