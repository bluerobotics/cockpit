<template>
  <button
    class="relative flex h-9 w-32 items-center justify-center rounded-md bg-slate-800/60 p-1 shadow-inner"
    @click="vehicleStore.isArmed ? disarm() : arm()"
  >
    <div
      class="absolute top-auto flex h-[80%] w-[70%] items-center rounded-[4px] px-1 shadow transition-all"
      :class="dynamicClasses"
    >
      <span class="inline-block align-middle font-extrabold">
        {{ vehicleStore.isArmed === undefined ? '...' : vehicleStore.isArmed ? 'Armed' : 'Disarmed' }}
      </span>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { canByPassCategory, EventCategory, slideToConfirm } from '@/libs/slide-to-confirm'
import { tryOrAlert } from '@/libs/utils'
import { useMainVehicleStore } from '@/stores/mainVehicle'

const vehicleStore = useMainVehicleStore()

const arm = (): void => {
  const tryToArm = async (): Promise<void> => tryOrAlert(vehicleStore.arm)
  slideToConfirm(tryToArm, { command: 'Arm' }, canByPassCategory(EventCategory.ARM))
}

const disarm = (): void => {
  const tryToDisarm = async (): Promise<void> => tryOrAlert(vehicleStore.disarm)
  slideToConfirm(tryToDisarm, { command: 'Disarm' }, canByPassCategory(EventCategory.DISARM))
}

const dynamicClasses = computed(() => {
  return vehicleStore.isArmed === undefined
    ? 'justify-start bg-slate-800/60 text-slate-400 left-[4%]'
    : vehicleStore.isArmed
    ? 'bg-red-700 hover:bg-red-800 text-slate-50 justify-end left-[26%]'
    : 'bg-green-700 hover:bg-green-800 text-slate-400 justify-start left-[4%]'
})
</script>
