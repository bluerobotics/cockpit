<template>
  <teleport to="body">
    <GlassModal :is-visible="isVisible" position="center" no-close-on-outside-click @outside-click="close">
      <div class="relative w-[640px] max-w-[95vw] p-4">
        <div class="mb-2 flex flex-col items-center justify-center gap-1">
          <h2 class="text-xl font-semibold">Default Views</h2>
        </div>
        <v-btn icon="mdi-close" size="small" variant="text" class="absolute right-1 top-1 text-lg" @click="close" />

        <p v-if="!evaluation" class="py-8 text-center opacity-70">
          Connect a vehicle so Cockpit can identify which defaults are available.
        </p>

        <template v-else>
          <p v-if="hasDefaultProfile" class="mt-6 mb-4 text-center text-sm opacity-80">
            Connected to a {{ evaluation.vehicleTypeName }}. Choose which default views to import.
          </p>

          <VehicleDefaultsViewsGroupContent variant="standalone" />

          <div class="mt-4 flex justify-space-between">
            <v-btn variant="text" @click="close">Cancel</v-btn>
            <v-btn
              :disabled="!hasDefaultProfile || selectedDefaultViewNames.length === 0"
              variant="text"
              @click="onImportClick"
            >
              Import
            </v-btn>
          </div>
        </template>
      </div>
    </GlassModal>
  </teleport>

  <VehicleDefaultsReplaceConfirmationDialog
    :model-value="replaceConfirmationVisible"
    :views-count="currentViewsCount"
    :vehicle-type-name="evaluation?.vehicleTypeName"
    @confirm="onConfirmReplace"
    @cancel="cancelReplace"
  />
</template>

<script setup lang="ts">
import { computed, onUnmounted, provide, watch } from 'vue'

import GlassModal from '@/components/GlassModal.vue'
import VehicleDefaultsReplaceConfirmationDialog from '@/components/vehicle-defaults/VehicleDefaultsReplaceConfirmationDialog.vue'
import VehicleDefaultsViewsGroupContent from '@/components/vehicle-defaults/VehicleDefaultsViewsGroupContent.vue'
import {
  useVehicleDefaultsViewsImport,
  vehicleDefaultsViewsImportKey,
} from '@/composables/vehicleDefaults/useVehicleDefaultsViewsImport'
import { useAppInterfaceStore } from '@/stores/appInterface'

const interfaceStore = useAppInterfaceStore()
const viewsImport = useVehicleDefaultsViewsImport()
provide(vehicleDefaultsViewsImportKey, viewsImport)

const {
  evaluation,
  hasDefaultProfile,
  selectedDefaultViewNames,
  currentViewsCount,
  replaceConfirmationVisible,
  viewsMode,
  isCurrentViewsGroupBlank,
  onClickImport,
  applyImport,
  confirmReplace,
  cancelReplace,
  refresh,
} = viewsImport

const isVisible = computed({
  get: () => interfaceStore.isVehicleDefaultsViewsImportModalVisible,
  set: (v) => {
    interfaceStore.isVehicleDefaultsViewsImportModalVisible = v
  },
})

const close = (): void => {
  isVisible.value = false
}

const onImportClick = (): void => {
  logUserAction(`Imported vehicle default views (mode: ${viewsMode.value})`)
  if (viewsMode.value === 'replace' && !isCurrentViewsGroupBlank.value) {
    onClickImport()
    return
  }
  if (applyImport()) close()
}

const onConfirmReplace = (): void => {
  logUserAction('Confirmed replacing current views with vehicle defaults')
  if (confirmReplace()) close()
}

watch(isVisible, (visible, wasVisible) => {
  if (visible && !wasVisible) refresh()
})

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
