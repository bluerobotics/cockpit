<template>
  <div class="space-y-3 py-4 text-center text-sm opacity-80">
    <p>
      {{
        t`You have finished reviewing the default configuration for ${vehicleTypeName}. This dialog will not open automatically again for this vehicle.`
      }}
    </p>
    <p>
      {{ t`If you want to import default views or joystick mapping later, use` }}
      <strong>{{ t`Import vehicle defaults` }}</strong> {{ t`in the` }} <strong>{{ t`Edit menu` }}</strong
      >{{ t`, or the import button in` }} <strong>{{ t`Joystick configuration` }}</strong
      >.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useVehicleDefaultsAutoImportWizardInject } from '@/composables/vehicleDefaults/useVehicleDefaultsAutoImportWizard'

const { evaluation } = useVehicleDefaultsAutoImportWizardInject()
const vehicleTypeName = computed(() => evaluation.value?.vehicleTypeName)
</script>
