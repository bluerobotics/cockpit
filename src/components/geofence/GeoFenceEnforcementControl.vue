<template>
  <v-speed-dial
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
            @dblclick.stop.prevent="onFenceMainDblclick"
          />
        </template>
      </v-tooltip>
    </template>
    <v-tooltip location="left" :text="fenceToggleItemTooltip">
      <template #activator="{ props: tooltipProps }">
        <div key="toggle" v-bind="tooltipProps">
          <v-btn
            class="bg-slate-50 text-[14px]"
            :style="interfaceStore.globalGlassMenuStyles"
            elevation="2"
            style="border-radius: 0px"
            size="x-small"
            :icon="fenceStore.fenceEnabled ? 'mdi-toggle-switch' : 'mdi-toggle-switch-off'"
            :disabled="!canToggleEnforcement"
            @click.stop="onToggleFenceEnforcement"
          />
        </div>
      </template>
    </v-tooltip>
    <v-menu
      key="layers"
      :model-value="layersMenuOpen"
      location="start"
      :offset="18"
      :close-on-content-click="false"
      transition="slide-x-reverse-transition"
      content-class="speed-dial-glow"
      @update:model-value="onLayersMenuToggle"
    >
      <template #activator="{ props: menuProps }">
        <v-tooltip location="left" text="Hazard layers" :disabled="layersMenuOpen">
          <template #activator="{ props: tooltipProps }">
            <v-btn
              v-bind="{ ...menuProps, ...tooltipProps }"
              class="bg-slate-50 text-[14px]"
              :style="interfaceStore.globalGlassMenuStyles"
              elevation="2"
              style="border-radius: 0px"
              size="x-small"
              :icon="layersMenuOpen ? 'mdi-chevron-right' : 'mdi-chevron-left'"
            />
          </template>
        </v-tooltip>
      </template>
      <div class="flex flex-row-reverse gap-2">
        <v-tooltip
          v-for="sourceId in HAZARD_SOURCE_IDS"
          :key="sourceId"
          location="top"
          :text="hazardToggleTooltip(sourceId)"
        >
          <template #activator="{ props: tooltipProps }">
            <v-btn
              v-bind="tooltipProps"
              class="text-[14px]"
              :class="shownHazardSources.includes(sourceId) ? 'text-white' : 'bg-slate-50'"
              :style="[
                interfaceStore.globalGlassMenuStyles,
                shownHazardSources.includes(sourceId) ? { backgroundColor: HAZARD_SOURCES[sourceId].color } : {},
              ]"
              elevation="2"
              style="border-radius: 0px"
              size="x-small"
              :icon="HAZARD_SOURCES[sourceId].icon"
              :loading="hazardStore.fetchingSources.includes(sourceId)"
              @click.stop="emit('toggleHazardSource', sourceId)"
            />
          </template>
        </v-tooltip>
      </div>
    </v-menu>
    <v-tooltip v-if="fenceStore.isArduPilot" location="left" text="Refresh fence from vehicle">
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
import { type StyleValue, computed, defineModel, ref, watch } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { planHasShapes } from '@/libs/geo-fence'
import { HAZARD_SOURCE_IDS, HAZARD_SOURCES } from '@/libs/hazards/sources'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useGeoFenceStore } from '@/stores/geoFence'
import { useHazardStore } from '@/stores/hazards'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import type { HazardSourceId } from '@/types/hazards'

// eslint-disable-next-line jsdoc/require-jsdoc
const props = withDefaults(
  defineProps<{
    /** Inline style positioning the activator button (e.g. its bottom offset) */
    activatorStyle?: StyleValue
    /** Hazard sources the map currently draws */
    shownHazardSources?: HazardSourceId[]
  }>(),
  { activatorStyle: undefined, shownHazardSources: () => [] }
)

const emit = defineEmits<{
  (event: 'toggleHazardSource', sourceId: HazardSourceId): void
}>()

const fenceStore = useGeoFenceStore()
const vehicleStore = useMainVehicleStore()
const hazardStore = useHazardStore()
const interfaceStore = useAppInterfaceStore()
const { showDialog } = useInteractionDialog()

// A fence must be loaded in Cockpit before enforcement can be toggled: there is
// nothing to enforce otherwise. The button stays visible but inert so users
// still see the control and learn why it is unavailable.
const hasVehicleFence = computed<boolean>(() => planHasShapes(fenceStore.lastUploadedPlan))

// Only show the orange "enforcing" state when there is actually a fence to
// enforce; without one the button stays grey and dimmed to read as disabled.
const enforcementActive = computed<boolean>(() => hasVehicleFence.value && Boolean(fenceStore.fenceEnabled))

// Two-way bound open state: the dial's items are teleported out of the parent
// widget, so the parent needs this to keep the control mounted while it is up.
const fenceSpeedDialOpen = defineModel<boolean>('open', { default: false })

const layersMenuOpen = ref(false)

const onFenceSpeedDialToggle = (open: boolean): void => {
  fenceSpeedDialOpen.value = open
  logUserAction(open ? 'Opened the geofence enforcement menu' : 'Closed the geofence enforcement menu')
}

const onLayersMenuToggle = (open: boolean): void => {
  layersMenuOpen.value = open
  logUserAction(open ? 'Opened the hazard layers submenu' : 'Closed the hazard layers submenu')
}

watch(fenceSpeedDialOpen, (open) => {
  if (!open) layersMenuOpen.value = false
})

const canToggleEnforcement = computed<boolean>(
  () => fenceStore.isArduPilot && vehicleStore.isVehicleOnline && hasVehicleFence.value
)

const fenceMainButtonTooltip = computed<string>(() => {
  if (!vehicleStore.isVehicleOnline || !fenceStore.isArduPilot) return 'Geofence and hazard layers'
  if (!hasVehicleFence.value) return 'No geofence on the vehicle'
  return fenceStore.fenceEnabled
    ? 'Geofence enforcement on (double-click to disable)'
    : 'Geofence enforcement off (double-click to enable)'
})

const fenceToggleItemTooltip = computed<string>(() => {
  if (!vehicleStore.isVehicleOnline) return 'Connect to the vehicle to toggle fence enforcement'
  if (!fenceStore.isArduPilot) return 'Fence enforcement can only be toggled on ArduPilot vehicles'
  if (!hasVehicleFence.value) return 'No geofence on the vehicle'
  return fenceStore.fenceEnabled ? 'Disable fence enforcement on vehicle' : 'Enable fence enforcement on vehicle'
})

const hazardToggleTooltip = (sourceId: HazardSourceId): string => {
  const action = props.shownHazardSources.includes(sourceId) ? 'Hide' : 'Show'
  return `${action} ${HAZARD_SOURCES[sourceId].label.toLowerCase()}`
}

const onFenceMainDblclick = (): void => {
  fenceSpeedDialOpen.value = false
  onToggleFenceEnforcement()
}

const onToggleFenceEnforcement = (): void => {
  if (!canToggleEnforcement.value) return
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
