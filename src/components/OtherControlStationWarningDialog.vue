<template>
  <v-dialog
    v-model="controllerStore.showOtherControlStationWarning"
    max-width="504px"
    @update:model-value="onWarningVisibilityChange"
  >
    <v-card class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-center pt-4 pb-0 px-12 whitespace-normal">
        <div class="flex items-center justify-center gap-2">
          <v-icon color="warning" size="24">mdi-alert</v-icon>
          <h2 class="text-xl font-semibold">Another GCS is in control</h2>
        </div>
      </v-card-title>
      <v-btn
        icon="mdi-close"
        size="small"
        variant="text"
        aria-label="Close"
        class="absolute top-2 right-2 text-lg"
        @click="dismissWarning"
      ></v-btn>

      <v-card-text class="px-6 pb-4">
        <p class="text-sm mb-3">
          Another ground control station is already sending joystick commands to this vehicle, and using multiple
          joysticks simultaneously can cause unpredictable behavior.
        </p>
        <p class="text-sm">
          If you still want to use this joystick, click the button below to force joystick forwarding. You can also
          disable the joystick forwarding on the other ground control station.
        </p>
      </v-card-text>

      <div class="flex justify-center w-full px-6 pb-2 mt-4">
        <v-divider class="opacity-10 border-[#fafafa]"></v-divider>
      </div>

      <v-card-actions class="px-6 pb-4 justify-space-between">
        <v-btn variant="text" @click="dismissWarning">Close</v-btn>
        <v-btn variant="flat" class="bg-[#FFFFFF33] text-white" @click="askToForceForwarding">
          Enable joystick forwarding
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog
    v-model="isConfirmingForcedForwarding"
    max-width="500px"
    @update:model-value="onConfirmationVisibilityChange"
  >
    <v-card class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-center pt-4 pb-0 px-12 whitespace-normal">
        <div class="flex items-center justify-center gap-2">
          <v-icon color="warning" size="24">mdi-alert</v-icon>
          <h2 class="text-xl font-semibold">Force joystick forwarding?</h2>
        </div>
      </v-card-title>
      <v-btn
        icon="mdi-close"
        size="small"
        variant="text"
        aria-label="Close"
        class="absolute top-2 right-2 text-lg"
        @click="cancelForcedForwarding"
      ></v-btn>

      <v-card-text class="px-6 pb-4">
        <p class="text-sm mb-3">
          Another ground control station is already controlling this vehicle. Forwarding this joystick means both will
          be sending commands at the same time, and the vehicle may not respond the way either operator expects.
        </p>
        <p class="text-sm">Only continue if you know the other station is not being used to control the vehicle.</p>
      </v-card-text>

      <div class="flex justify-center w-full px-6 pb-2 mt-4">
        <v-divider class="opacity-10 border-[#fafafa]"></v-divider>
      </div>

      <v-card-actions class="px-6 pb-4 justify-space-between">
        <v-btn variant="text" @click="cancelForcedForwarding">Cancel</v-btn>
        <v-btn variant="flat" class="bg-[#FFFFFF33] text-white" @click="forceForwarding">Force forwarding</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import { useSnackbar } from '@/composables/snackbar'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useControllerStore } from '@/stores/controller'

const controllerStore = useControllerStore()
const interfaceStore = useAppInterfaceStore()
const { openSnackbar } = useSnackbar()

const isConfirmingForcedForwarding = ref(false)
// A button writes the bound value straight from here, so the dialog never emits update:model-value for it; only Esc
// and a click outside do. Both routes call the same function, which is what keeps either from logging twice.
let forwardingWasForced = false

const dismissWarning = (): void => {
  logUserAction('Dismissed the other-station warning without enabling forwarding')
  controllerStore.showOtherControlStationWarning = false
}

const cancelForcedForwarding = (): void => {
  logUserAction('Cancelled forcing joystick forwarding')
  isConfirmingForcedForwarding.value = false
}

const onWarningVisibilityChange = (isOpen: boolean): void => {
  if (isOpen || forwardingWasForced) return
  dismissWarning()
}

const onConfirmationVisibilityChange = (isOpen: boolean): void => {
  if (isOpen || forwardingWasForced) return
  cancelForcedForwarding()
}

const askToForceForwarding = (): void => {
  logUserAction('Asked to force joystick forwarding from the other-station warning')
  isConfirmingForcedForwarding.value = true
}

const forceForwarding = (): void => {
  logUserAction('Forced joystick forwarding while another control station was detected')
  forwardingWasForced = true
  isConfirmingForcedForwarding.value = false
  controllerStore.showOtherControlStationWarning = false
  controllerStore.setForwardingByUser(true)
  openSnackbar({ message: 'Joystick forwarding enabled', variant: 'warning', duration: 3000 })
}
</script>
