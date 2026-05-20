<template>
  <teleport to="body">
    <GlassModal :is-visible="isVisible" position="center" no-close-on-outside-click @outside-click="requestCloseModal">
      <div class="relative w-[740px] max-w-[95vw] p-4">
        <div class="mb-2 flex flex-col items-center justify-center gap-1">
          <h2 class="text-xl font-semibold">{{ modalTitle }}</h2>
          <p v-if="evaluation" class="text-xs opacity-60">Step {{ autoWizardStepNumber }} of 4</p>
        </div>
        <v-btn
          icon="mdi-close"
          size="small"
          variant="text"
          class="absolute right-1 top-1 text-lg"
          @click="requestCloseModal"
        />

        <p v-if="!evaluation" class="py-8 text-center opacity-70">
          Connect a vehicle so Cockpit can identify which defaults are available.
        </p>

        <template v-else>
          <div class="mt-6">
            <VehicleDefaultsAutoWizardIntroPanel v-if="autoWizardStep === 'intro'" />
            <VehicleDefaultsJoystickMappingContent v-else-if="autoWizardStep === 'joystick'" variant="wizard" />
            <VehicleDefaultsViewsGroupContent v-else-if="autoWizardStep === 'views'" variant="wizard" />
            <VehicleDefaultsAutoWizardDonePanel v-else-if="autoWizardStep === 'done'" />
          </div>

          <div v-if="autoWizardStep !== 'done'" class="mt-4 flex justify-space-between">
            <v-btn v-if="wizardShowSecondaryButton" variant="text" @click="onWizardSecondaryAction">
              {{ wizardSecondaryLabel }}
            </v-btn>
            <div v-else />
            <v-btn variant="text" :disabled="wizardPrimaryDisabled" @click="onWizardPrimaryAction">
              {{ wizardPrimaryLabel }}
            </v-btn>
          </div>
          <div v-else class="mt-4 flex justify-end">
            <v-btn variant="text" @click="onWizardPrimaryAction">{{ wizardPrimaryLabel }}</v-btn>
          </div>
        </template>
      </div>
    </GlassModal>
  </teleport>

  <VehicleDefaultsReplaceConfirmationDialog
    :model-value="replaceConfirmationVisible"
    :views-count="currentViewsCount"
    :vehicle-type-name="evaluation?.vehicleTypeName"
    @confirm="confirmViewsReplace"
    @cancel="cancelReplace"
  />

  <v-dialog v-if="isVisible" v-model="ignoreConfirmationVisible" max-width="500px" persistent>
    <v-card class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="pb-0 pt-4 text-center">
        <h2 class="text-xl font-semibold">Ignore all defaults?</h2>
      </v-card-title>

      <v-card-text class="px-6 pb-2">
        <p class="mb-3 text-center text-sm">
          You will keep your current views group and joystick mapping for {{ evaluation?.vehicleTypeName }}. This
          walkthrough will not open automatically again for this vehicle.
        </p>
        <p class="mb-3 text-center text-sm opacity-80">You can still import defaults later:</p>
        <ul class="space-y-2 text-sm">
          <li>
            <strong>Default views</strong> — open the <strong>Edit menu</strong> and choose
            <strong>Import vehicle defaults</strong>
          </li>
          <li>
            <strong>Default joystick mapping</strong> — open <strong>Joystick configuration</strong> and use the import
            button on the mapping toolbar
          </li>
        </ul>
      </v-card-text>

      <v-card-actions class="justify-space-between px-6 pb-4">
        <v-btn variant="text" @click="cancelIgnoreAll">Keep reviewing</v-btn>
        <v-btn variant="text" @click="confirmIgnoreAll">Ignore</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-if="isVisible" v-model="closeConfirmationVisible" max-width="500px" persistent>
    <v-card class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="pb-0 pt-4 text-center">
        <div class="flex items-center justify-center gap-2">
          <v-icon color="warning" size="24">mdi-alert</v-icon>
          <h2 class="text-xl font-semibold">Finish the walkthrough first</h2>
        </div>
      </v-card-title>

      <v-card-text class="px-6 pb-2">
        <p class="mb-3 text-center text-sm">Please complete or ignore all steps before closing.</p>
        <p class="text-center text-xs opacity-80">
          Having a correct joystick mapping for your vehicle type is important: a mismatched mapping can cause motors to
          spin unexpectedly the moment the vehicle is armed.
        </p>
      </v-card-text>

      <v-card-actions class="justify-center px-6 pb-4">
        <v-btn @click="closeConfirmationVisible = false">Keep reviewing</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { onUnmounted, provide, watch } from 'vue'

import GlassModal from '@/components/GlassModal.vue'
import VehicleDefaultsAutoWizardDonePanel from '@/components/vehicle-defaults/VehicleDefaultsAutoWizardDonePanel.vue'
import VehicleDefaultsAutoWizardIntroPanel from '@/components/vehicle-defaults/VehicleDefaultsAutoWizardIntroPanel.vue'
import VehicleDefaultsJoystickMappingContent from '@/components/vehicle-defaults/VehicleDefaultsJoystickMappingContent.vue'
import VehicleDefaultsReplaceConfirmationDialog from '@/components/vehicle-defaults/VehicleDefaultsReplaceConfirmationDialog.vue'
import VehicleDefaultsViewsGroupContent from '@/components/vehicle-defaults/VehicleDefaultsViewsGroupContent.vue'
import {
  useVehicleDefaultsAutoImportWizard,
  vehicleDefaultsAutoImportWizardKey,
} from '@/composables/vehicleDefaults/useVehicleDefaultsAutoImportWizard'
import { vehicleDefaultsJoystickImportKey } from '@/composables/vehicleDefaults/useVehicleDefaultsJoystickImport'
import { vehicleDefaultsViewsImportKey } from '@/composables/vehicleDefaults/useVehicleDefaultsViewsImport'

const wizard = useVehicleDefaultsAutoImportWizard()
provide(vehicleDefaultsAutoImportWizardKey, wizard)
provide(vehicleDefaultsViewsImportKey, wizard.viewsImport)
provide(vehicleDefaultsJoystickImportKey, wizard.joystickImport)

const {
  interfaceStore,
  isVisible,
  evaluation,
  autoWizardStep,
  autoWizardStepNumber,
  modalTitle,
  closeConfirmationVisible,
  ignoreConfirmationVisible,
  wizardSecondaryLabel,
  wizardPrimaryLabel,
  wizardShowSecondaryButton,
  wizardPrimaryDisabled,
  onWizardPrimaryAction,
  onWizardSecondaryAction,
  confirmIgnoreAll,
  cancelIgnoreAll,
  confirmViewsReplace,
  requestCloseModal,
  viewsImport,
} = wizard

const { replaceConfirmationVisible, currentViewsCount, cancelReplace } = viewsImport

watch(
  [isVisible, replaceConfirmationVisible],
  ([modalVisible, replaceOpen]) => {
    interfaceStore.isGlassModalAlwaysOnTop = modalVisible && !replaceOpen
  },
  { immediate: true }
)

onUnmounted(() => {
  interfaceStore.isGlassModalAlwaysOnTop = false
})
</script>
