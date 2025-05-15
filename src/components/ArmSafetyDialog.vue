<template>
  <InteractionDialog v-model="show" title="Be careful" variant="text-only" max-width="700px" :persistent="false">
    <template #content>
      <v-icon class="text-yellow text-[60px] absolute top-20 left-12">mdi-alert-rhombus</v-icon>
      <div class="flex items-center justify-center mb-4">
        <p class="w-96 text-center">The vehicle is currently armed and it is not recommended to open the main menu.</p>
      </div>
    </template>
    <template #actions>
      <div class="flex items-center justify-between gap-8 w-full">
        <v-btn @click="cancelOpeningMainMenu">Cancel</v-btn>
        <div class="flex flex-col items-center justify-center">
          <v-btn @click="continueAnyway">Continue anyway</v-btn>
          <v-btn @click="doNotAskAgainInThisSession">Do not ask again in this session</v-btn>
          <v-btn @click="neverAskAgain">Never ask again</v-btn>
        </div>
        <v-btn @click="disarmVehicle">Disarm vehicle and open</v-btn>
      </div>
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import InteractionDialog from '@/components/InteractionDialog.vue'
import { useSnackbar } from '@/composables/snackbar'
import { useAlertStore } from '@/stores/alert'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'

const vehicleStore = useMainVehicleStore()
const alertStore = useAlertStore()
const interfaceStore = useAppInterfaceStore()
const { openSnackbar } = useSnackbar()

const show = ref(true)

const cancelOpeningMainMenu = (): void => {
  show.value = false
}

const continueAnyway = (): void => {
  interfaceStore.isMainMenuVisible = true
  show.value = false
}

const doNotAskAgainInThisSession = (): void => {
  alertStore.skipArmedMenuWarningThisSession = true
  continueAnyway()
}

const neverAskAgain = (): void => {
  alertStore.neverShowArmedMenuWarning = true
  continueAnyway()

  openSnackbar({
    message: 'Armed menu warning disabled. You can re-enable it in the Settings > Alerts menu.',
    variant: 'info',
    duration: 10000,
    closeButton: true,
  })
}

const disarmVehicle = (): void => {
  vehicleStore.disarm()
  interfaceStore.isMainMenuVisible = true
  show.value = false
}
</script>
