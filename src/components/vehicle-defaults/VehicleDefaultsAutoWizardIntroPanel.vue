<template>
  <div class="space-y-3">
    <div class="space-y-2 text-center text-sm opacity-80">
      <p v-for="(paragraph, index) in introParagraphs" :key="index">
        {{ paragraph }}
      </p>
    </div>

    <div class="mt-6 grid grid-cols-2 gap-6 px-2">
      <div class="flex flex-col items-start text-left">
        <p class="max-w-[220px] text-xs leading-snug opacity-80">
          Click <strong>Ignore</strong> if you are happy with your current views group and joystick mapping.
        </p>
        <v-icon size="42" color="white" class="mt-3 -rotate-[25deg]">mdi-arrow-down-left-bold</v-icon>
      </div>
      <div class="flex flex-col items-end text-right">
        <p class="max-w-[220px] text-xs leading-snug opacity-80">
          Click <strong>Next</strong> to review the defaults and decide whether to import them.
        </p>
        <v-icon size="48" color="white" class="mt-4 rotate-[25deg]">mdi-arrow-down-right-bold</v-icon>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useVehicleDefaultsAutoImportWizardInject } from '@/composables/vehicleDefaults/useVehicleDefaultsAutoImportWizard'

const { introParagraphs } = useVehicleDefaultsAutoImportWizardInject()
</script>
