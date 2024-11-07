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
        {{ vehicleStore.isArmed === undefined ? '...' : vehicleStore.isArmed ? 'Armed' : 'Disarmed' }}
      </span>
    </div>
  </button>
</template>

<script setup lang="ts">
import { canByPassCategory, EventCategory, slideToConfirm } from '@/libs/slide-to-confirm'
import { tryOrAlert } from '@/libs/utils'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useWidgetManagerStore } from '@/stores/widgetManager'

const vehicleStore = useMainVehicleStore()
const widgetStore = useWidgetManagerStore()

const arm = (): void => {
  const tryToArm = async (): Promise<void> => tryOrAlert(vehicleStore.arm)
  slideToConfirm(tryToArm, { command: 'Arm' }, canByPassCategory(EventCategory.ARM))
}

const disarm = (): void => {
  const tryToDisarm = async (): Promise<void> => tryOrAlert(vehicleStore.disarm)
  slideToConfirm(tryToDisarm, { command: 'Disarm' }, canByPassCategory(EventCategory.DISARM))
}
</script>
