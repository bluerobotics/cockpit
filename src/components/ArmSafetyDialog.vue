<template>
  <InteractionDialog v-model="show" title="Be careful" variant="text-only" max-width="780px" :persistent="false">
    <template #content>
      <div class="flex gap-x-2 absolute top-0 right-0 py-2 pr-3">
        <slot name="help-icon"></slot>
        <v-btn icon :width="34" :height="34" variant="text" class="bg-transparent" @click="cancelOpeningMainMenu">
          <v-icon :size="22">mdi-close</v-icon>
        </v-btn>
      </div>

      <div class="flex items-center justify-center mb-6">
        <v-icon class="text-yellow text-[60px] mx-8">mdi-alert-rhombus</v-icon>
        <p class="w-[560px] text-balance">
          The vehicle is currently armed, and the main-menu contains configurations and tools that can cause unsafe
          situations.
        </p>
        <p class="w-[560px] text-balance">Come back later, or proceed carefully with one of the following options:</p>
      </div>
    </template>
    <template #actions>
      <div class="flex items-center justify-between gap-8 w-full text-md">
        <button class="option-button" @click="neverAskAgain">Continue and never warn again</button>
        <button class="option-button" @click="doNotAskAgainInThisSession">
          Continue and don't warn again during this session
        </button>
        <button class="option-button" @click="continueAnyway">Continue anyway</button>
        <button class="option-button" @click="disarmVehicle">Disarm vehicle and continue</button>
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

<style scoped>
.option-button {
  font-weight: 500;
  margin: 0.25rem;
  padding: 0.5rem;
  max-width: 13rem;
  border-radius: 0.35rem;
  text-wrap: balance;
}

.option-button:hover {
  background-color: rgba(88, 94, 103, 0.2);
}
</style>
