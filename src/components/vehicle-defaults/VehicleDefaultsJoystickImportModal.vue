<template>
  <teleport to="body">
    <GlassModal :is-visible="isVisible" position="center" no-close-on-outside-click @outside-click="close">
      <div class="relative w-[640px] max-w-[95vw] p-4">
        <div class="mb-2 flex flex-col items-center justify-center gap-1">
          <h2 class="text-xl font-semibold">Default Joystick Mapping</h2>
        </div>
        <v-btn icon="mdi-close" size="small" variant="text" class="absolute right-1 top-1 text-lg" @click="close" />

        <p v-if="!evaluation" class="py-8 text-center opacity-70">
          Connect a vehicle so Cockpit can identify which defaults are available.
        </p>

        <template v-else>
          <p v-if="hasImportOffer" class="mt-6 mb-4 text-center text-sm opacity-80">
            Connected to a {{ evaluation.vehicleTypeName }}. Select which default bindings to import.
          </p>

          <VehicleDefaultsJoystickMappingContent variant="standalone" />

          <div class="mt-4 flex justify-space-between">
            <v-btn variant="text" @click="close">{{ $t('Cancel') }}</v-btn>
            <v-btn :disabled="!hasImportOffer || selectedJoystickRowsCount === 0" variant="text" @click="onImportClick">
              Import selected
            </v-btn>
          </div>
        </template>
      </div>
    </GlassModal>
  </teleport>
</template>

<script setup lang="ts">
import { computed, onUnmounted, provide, watch } from 'vue'

import GlassModal from '@/components/GlassModal.vue'
import VehicleDefaultsJoystickMappingContent from '@/components/vehicle-defaults/VehicleDefaultsJoystickMappingContent.vue'
import {
  useVehicleDefaultsJoystickImport,
  vehicleDefaultsJoystickImportKey,
} from '@/composables/vehicleDefaults/useVehicleDefaultsJoystickImport'
import { useAppInterfaceStore } from '@/stores/appInterface'

const interfaceStore = useAppInterfaceStore()
const joystickImport = useVehicleDefaultsJoystickImport()
provide(vehicleDefaultsJoystickImportKey, joystickImport)

const { evaluation, hasImportOffer, selectedJoystickRowsCount, applyImport, refresh } = joystickImport

const isVisible = computed({
  get: () => interfaceStore.isVehicleDefaultsJoystickImportModalVisible,
  set: (v) => {
    interfaceStore.isVehicleDefaultsJoystickImportModalVisible = v
  },
})

const close = (): void => {
  isVisible.value = false
}

const onImportClick = (): void => {
  logUserAction('Imported vehicle default joystick mapping')
  if (applyImport()) close()
}

watch(isVisible, (visible, wasVisible) => {
  if (visible && !wasVisible) refresh()
  interfaceStore.isGlassModalAlwaysOnTop = visible
})

onUnmounted(() => {
  interfaceStore.isGlassModalAlwaysOnTop = false
})
</script>
