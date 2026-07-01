<template>
  <button
    class="relative flex items-center justify-center w-32 p-1 rounded-md shadow-inner h-9 bg-slate-800/60"
    :class="{ 'cursor-not-allowed': !vehicleStore.isVehicleOnline }"
    :title="!vehicleStore.isVehicleOnline ? t('Vehicle disconnected') : undefined"
    @click="handleClick"
  >
    <div
      class="absolute top-auto flex items-center px-1 rounded-[4px] shadow transition-all w-[70%] h-[80%]"
      :class="stateClasses"
    >
      <span class="inline-block font-extrabold align-middle unselectable">
        {{ stateLabel }}
      </span>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSnackbar } from '@/composables/snackbar'
import { canByPassCategory, EventCategory, slideToConfirm } from '@/libs/slide-to-confirm'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useWidgetManagerStore } from '@/stores/widgetManager'

const vehicleStore = useMainVehicleStore()
const widgetStore = useWidgetManagerStore()
const { openSnackbar } = useSnackbar()
const { t } = useI18n()

const stateLabel = computed(() => {
  if (!vehicleStore.isVehicleOnline) return t('Offline')
  if (vehicleStore.isArmed === undefined) return '...'
  return vehicleStore.isArmed ? t('Armed') : t('Disarmed')
})

const stateClasses = computed(() => {
  if (!vehicleStore.isVehicleOnline) return 'justify-center bg-slate-600/60 text-slate-300 left-[15%]'
  if (vehicleStore.isArmed === undefined) return 'justify-start bg-slate-800/60 text-slate-400 left-[4%]'
  if (vehicleStore.isArmed) return 'bg-red-700 hover:bg-red-800 text-slate-50 justify-end left-[26%]'
  return 'bg-green-700 hover:bg-green-800 text-slate-400 justify-start left-[4%]'
})

const handleClick = (): void => {
  if (widgetStore.editingMode) return
  if (!vehicleStore.isVehicleOnline) {
    openSnackbar({ message: t('Vehicle is disconnected.'), variant: 'error', duration: 3000 })
    return
  }
  if (vehicleStore.isArmed) {
    disarm()
  } else {
    arm()
  }
}

const arm = async (): Promise<void> => {
  try {
    await slideToConfirm({ command: 'Arm' }, canByPassCategory(EventCategory.ARM))
    await vehicleStore.arm()
  } catch (error) {
    openSnackbar({
      message: `${t('Arm request failed')}: ${(error as Error).message}`,
      variant: 'error',
      duration: 3000,
    })
  }
}

const disarm = async (): Promise<void> => {
  try {
    await slideToConfirm({ command: 'Disarm' }, canByPassCategory(EventCategory.DISARM))
    await vehicleStore.disarm()
  } catch (error) {
    openSnackbar({
      message: `${t('Disarm request failed')}: ${(error as Error).message}`,
      variant: 'error',
      duration: 3000,
    })
  }
}
</script>
