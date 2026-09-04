<template>
  <v-speed-dial
    v-if="fenceStore.isArduPilot"
    :model-value="fenceSpeedDialOpen"
    location="top center"
    transition="slide-y-reverse-transition"
    content-class="speed-dial-glow"
    @update:model-value="onFenceSpeedDialToggle"
  >
    <template #activator="{ props: activatorProps }">
      <v-tooltip location="top" :text="fenceMainButtonTooltip" :disabled="fenceSpeedDialOpen">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-bind="{ ...activatorProps, ...tooltipProps }"
            :class="[
              enforcementActive ? 'text-white' : 'bg-slate-50',
              'absolute right-[338px] m-3 text-[14px]',
              { 'opacity-60': !hasVehicleFence },
            ]"
            :style="[
              interfaceStore.globalGlassMenuStyles,
              enforcementActive ? { backgroundColor: '#FF8800', color: '#FFFFFF' } : {},
              activatorStyle ?? {},
            ]"
            elevation="2"
            size="x-small"
            style="border-radius: 0px"
            icon="mdi-shield-outline"
            :disabled="!vehicleStore.isVehicleOnline"
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
          :disabled="!vehicleStore.isVehicleOnline || !hasVehicleFence"
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
import { type StyleValue, computed, defineModel } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useGeoFenceStore } from '@/stores/geoFence'
import { useMainVehicleStore } from '@/stores/mainVehicle'

// eslint-disable-next-line jsdoc/require-jsdoc
withDefaults(
  defineProps<{
    /** Inline style positioning the activator button (e.g. its bottom offset) */
    activatorStyle?: StyleValue
  }>(),
  { activatorStyle: undefined }
)

const fenceStore = useGeoFenceStore()
const vehicleStore = useMainVehicleStore()
const interfaceStore = useAppInterfaceStore()
const { showDialog } = useInteractionDialog()

// A fence must be loaded in Cockpit before enforcement can be toggled: there is
// nothing to enforce otherwise. The button stays visible but inert so users
// still see the control and learn why it is unavailable.
const hasVehicleFence = computed<boolean>(() => Boolean(fenceStore.lastUploadedPlan))

// Only show the orange "enforcing" state when there is actually a fence to
// enforce; without one the button stays grey and dimmed to read as disabled.
const enforcementActive = computed<boolean>(() => hasVehicleFence.value && Boolean(fenceStore.fenceEnabled))

// Two-way bound open state: the dial's items are teleported out of the parent
// widget, so the parent needs this to keep the control mounted while it is up.
const fenceSpeedDialOpen = defineModel<boolean>('open', { default: false })

const onFenceSpeedDialToggle = (open: boolean): void => {
  fenceSpeedDialOpen.value = open
  logUserAction(open ? 'Opened the geofence enforcement menu' : 'Closed the geofence enforcement menu')
}

const fenceMainButtonTooltip = computed<string>(() => {
  if (!hasVehicleFence.value) return 'No geofence on the vehicle'
  return fenceStore.fenceEnabled
    ? 'Geofence enforcement on (double-click to disable)'
    : 'Geofence enforcement off (double-click to enable)'
})

const fenceToggleItemTooltip = computed<string>(() => {
  if (!hasVehicleFence.value) return 'No geofence on the vehicle'
  return fenceStore.fenceEnabled ? 'Disable fence enforcement on vehicle' : 'Enable fence enforcement on vehicle'
})

const onFenceMainDblclick = (): void => {
  fenceSpeedDialOpen.value = false
  onToggleFenceEnforcement()
}

const onToggleFenceEnforcement = (): void => {
  if (!hasVehicleFence.value) return
  const target = !fenceStore.fenceEnabled
  logUserAction(target ? 'Enabled geofence enforcement on the vehicle' : 'Disabled geofence enforcement on the vehicle')
  try {
    fenceStore.setFenceEnabled(target)
  } catch (error) {
    showDialog({
      variant: 'error',
      title: target ? 'Failed to enable geofence' : 'Failed to disable geofence',
      message: error instanceof Error ? error.message : String(error),
      timer: 4000,
    })
  }
}

const onRefreshFenceOverlay = (): void => {
  logUserAction('Refreshed the fence overlay by re-downloading from the vehicle')
  fenceStore.refreshVehicleFenceOverlay().catch((error) => {
    showDialog({
      variant: 'error',
      title: 'Geofence refresh failed',
      message: error instanceof Error ? error.message : String(error),
      timer: 5000,
    })
  })
}
</script>
