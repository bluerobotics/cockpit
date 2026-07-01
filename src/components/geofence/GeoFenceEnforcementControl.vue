<template>
  <v-speed-dial
    v-if="fenceStore.lastUploadedPlan && fenceStore.isArduPilot"
    v-model="fenceSpeedDialOpen"
    location="top center"
    transition="slide-y-reverse-transition"
    content-class="speed-dial-glow"
  >
    <template #activator="{ props: activatorProps }">
      <v-tooltip location="top" :text="fenceMainButtonTooltip" :disabled="fenceSpeedDialOpen">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-bind="{ ...activatorProps, ...tooltipProps }"
            :class="[fenceStore.fenceEnabled ? 'text-white' : 'bg-slate-50', 'text-[14px]']"
            :style="[
              interfaceStore.globalGlassMenuStyles,
              fenceStore.fenceEnabled ? { backgroundColor: '#FF8800', color: '#FFFFFF' } : {},
            ]"
            elevation="2"
            size="x-small"
            style="border-radius: 0px"
            icon="mdi-shield-outline"
            :loading="fenceEnableBusy"
            :disabled="!vehicleStore.isVehicleOnline || fenceEnableBusy"
            @dblclick.stop.prevent="onFenceMainDblclick"
          />
        </template>
      </v-tooltip>
    </template>
    <v-tooltip location="left" :text="fenceToggleItemTooltip">
      <template #activator="{ props: tooltipProps }">
        <v-btn
          key="toggle"
          v-bind="tooltipProps"
          class="bg-slate-50 text-[14px]"
          :style="interfaceStore.globalGlassMenuStyles"
          elevation="2"
          style="border-radius: 0px"
          size="x-small"
          :icon="fenceStore.fenceEnabled ? 'mdi-toggle-switch' : 'mdi-toggle-switch-off'"
          :loading="fenceEnableBusy"
          :disabled="!vehicleStore.isVehicleOnline || fenceEnableBusy"
          @click.stop="onToggleFenceEnforcement"
        />
      </template>
    </v-tooltip>
    <v-tooltip location="left" text="Refresh fence from vehicle">
      <template #activator="{ props: tooltipProps }">
        <v-btn
          key="reload"
          v-bind="tooltipProps"
          class="bg-slate-50 text-[14px]"
          :style="interfaceStore.globalGlassMenuStyles"
          elevation="2"
          style="border-radius: 0px"
          size="x-small"
          icon="mdi-reload"
          :loading="fenceStore.syncInProgress"
          :disabled="!vehicleStore.isVehicleOnline || fenceStore.syncInProgress"
          @click.stop="onRefreshFenceOverlay"
        />
      </template>
    </v-tooltip>
  </v-speed-dial>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useGeoFenceStore } from '@/stores/geoFence'
import { useMainVehicleStore } from '@/stores/mainVehicle'

const fenceStore = useGeoFenceStore()
const vehicleStore = useMainVehicleStore()
const interfaceStore = useAppInterfaceStore()
const { showDialog } = useInteractionDialog()

// Speed-dial container state kept locally: the main button toggles
// enforcement on double-click, so the dial only opens when the user
// wants the toggle / reload items.
const fenceSpeedDialOpen = ref(false)
const fenceEnableBusy = ref(false)

const fenceMainButtonTooltip = computed<string>(() => {
  if (fenceEnableBusy.value) return 'Updating fence enforcement...'
  return fenceStore.fenceEnabled
    ? 'Geofence enforcement on (double-click to disable)'
    : 'Geofence enforcement off (double-click to enable)'
})

const fenceToggleItemTooltip = computed<string>(() => {
  if (fenceEnableBusy.value) return 'Updating fence enforcement...'
  return fenceStore.fenceEnabled ? 'Disable fence enforcement on vehicle' : 'Enable fence enforcement on vehicle'
})

const onFenceMainDblclick = (): void => {
  fenceSpeedDialOpen.value = false
  onToggleFenceEnforcement()
}

const onToggleFenceEnforcement = async (): Promise<void> => {
  if (fenceEnableBusy.value) return
  const target = !fenceStore.fenceEnabled
  logUserAction(target ? 'Enabled geofence enforcement on the vehicle' : 'Disabled geofence enforcement on the vehicle')
  fenceEnableBusy.value = true
  try {
    await fenceStore.setFenceEnabled(target)
  } catch (error) {
    showDialog({
      variant: 'error',
      title: target ? 'Failed to enable geofence' : 'Failed to disable geofence',
      message: error instanceof Error ? error.message : String(error),
      timer: 4000,
    })
  } finally {
    fenceEnableBusy.value = false
  }
}

const onRefreshFenceOverlay = (): void => {
  logUserAction('Refreshed the fence overlay by re-downloading from the vehicle')
  fenceStore.downloadFromVehicle().catch((error) => {
    showDialog({
      variant: 'error',
      title: 'Geofence refresh failed',
      message: error instanceof Error ? error.message : String(error),
      timer: 5000,
    })
  })
}
</script>
