<template>
  <div class="space-y-3 py-4 text-center text-sm opacity-80">
    <p>
      You have finished reviewing the default configuration for {{ evaluation?.vehicleTypeName }}. This dialog will not
      open automatically again for this vehicle.
    </p>
    <p>
      If you want to import default views or joystick mapping later, use <strong>Import vehicle defaults</strong> in the
      <strong>Edit menu</strong>, or the import button in <strong>Joystick configuration</strong>.
    </p>
  </div>
</template>

<script setup lang="ts">
import { useVehicleDefaultsAutoImportWizardInject } from '@/composables/vehicleDefaults/useVehicleDefaultsAutoImportWizard'

const { evaluation } = useVehicleDefaultsAutoImportWizardInject()
</script>
