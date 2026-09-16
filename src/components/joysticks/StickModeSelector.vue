<template>
  <teleport to="body">
    <GlassModal
      :is-visible="isVisible"
      position="center"
      no-close-on-outside-click
      frosted-backdrop
      @outside-click="close"
    >
      <div class="relative w-[578px] max-w-[95vw] p-4">
        <div class="mb-2 flex flex-col items-center justify-center gap-1">
          <h2 class="text-xl font-semibold">Stick mode</h2>
        </div>
        <v-btn
          icon="mdi-close"
          size="small"
          variant="text"
          aria-label="Close"
          class="absolute right-1 top-1 text-lg"
          @click="close"
        />

        <div class="mt-4 flex items-center px-4 text-caption">
          <span class="w-[110px]">Mode</span>
          <span class="flex-1 text-center">Left stick</span>
          <span class="flex-1 text-center">Right stick</span>
        </div>

        <div v-if="currentMode === null" class="my-1 flex items-center rounded-lg bg-[#FFFFFF11] px-4">
          <div class="flex w-[110px] flex-col">
            <span class="text-body-2 font-weight-bold">Custom</span>
            <span class="text-caption">Current</span>
          </div>
          <StickDiagram
            v-for="stick in stickAxes"
            :key="stick.name"
            class="flex-1"
            :horizontal="currentAxes[stick.horizontal]"
            :vertical="currentAxes[stick.vertical]"
            :horizontal-value="0"
            :vertical-value="0"
            :vehicle-type="labelledVehicleType"
          />
        </div>

        <v-list class="bg-transparent py-0" theme="dark">
          <v-list-item
            v-for="option in modeOptions"
            :key="option.mode"
            link
            :active="option.mode === selectedMode"
            class="my-1 rounded-lg bg-[#FFFFFF11] px-4"
            :class="{ 'shadow-[0_2px_5px_rgba(0,0,0,0.25)]': option.mode === selectedMode }"
            @click="select(option.mode)"
          >
            <div class="flex items-center">
              <div class="flex w-[110px] flex-col">
                <span class="text-body-2 font-weight-bold">Mode {{ option.mode }}</span>
                <span class="text-caption">{{ option.mode === currentMode ? 'Current' : '' }}</span>
              </div>
              <StickDiagram
                v-for="stick in stickAxes"
                :key="stick.name"
                class="flex-1"
                :horizontal="option.axes[stick.horizontal]"
                :vertical="option.axes[stick.vertical]"
                :horizontal-value="liveDeflection(option.mode, stick.horizontal)"
                :vertical-value="liveDeflection(option.mode, stick.vertical)"
                :vehicle-type="labelledVehicleType"
              />
            </div>
          </v-list-item>
        </v-list>

        <p class="my-4 text-center text-caption">
          The sticks are laid out as <span class="font-weight-bold">{{ currentModeLabel }}</span
          >. Choosing a mode moves the four stick functions and their ranges onto the sticks, clearing them from any
          other axis that held one and replacing whatever else was assigned to the four stick axes. Buttons and
          calibration are left as they are.
        </p>

        <v-divider class="mx-10" />

        <div class="mt-4 flex items-center justify-between">
          <v-switch
            v-model="showVehicleMotions"
            color="white"
            density="compact"
            hide-details
            class="ml-[15px] origin-left scale-90"
            :label="vehicleMotionsLabel"
            :disabled="!canShowVehicleMotions"
            @update:model-value="onToggleVehicleMotions"
          />
          <v-btn variant="flat" size="small" class="bg-[#FFFFFF22]" :disabled="selectedMode === null" @click="apply">
            {{ selectedMode === null ? 'Apply' : `Apply mode ${selectedMode}` }}
          </v-btn>
        </div>
      </div>
    </GlassModal>
  </teleport>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'

import GlassModal from '@/components/GlassModal.vue'
import StickDiagram from '@/components/joysticks/StickDiagram.vue'
import { openSnackbar } from '@/composables/snackbar'
import {
  type StickMode,
  detectStickMode,
  hasVehicleMotionNames,
  remapToStickMode,
  stickAxes,
  stickModes,
} from '@/libs/joystick/stick-modes'
import { cloneMapping } from '@/migration/default-profile-importer'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useControllerStore } from '@/stores/controller'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { JoystickAxis } from '@/types/joystick'

const interfaceStore = useAppInterfaceStore()
const controllerStore = useControllerStore()
const vehicleStore = useMainVehicleStore()

const selectedMode = ref<StickMode | null>(null)
const showVehicleMotions = ref(false)

const vehicleType = computed(() => vehicleStore.ardupilotVehicleType)
const canShowVehicleMotions = computed(() => hasVehicleMotionNames(vehicleType.value))
const vehicleMotionsLabel = computed(() => {
  if (canShowVehicleMotions.value) return 'View as vehicle axis functions'
  const reason = vehicleType.value === undefined ? 'vehicle offline' : 'not available for this vehicle'
  return `View as vehicle axis functions (${reason})`
})
const labelledVehicleType = computed(() => (showVehicleMotions.value ? vehicleType.value : undefined))

const isVisible = computed({
  get: () => interfaceStore.isJoystickStickModeModalVisible,
  set: (v: boolean) => {
    interfaceStore.isJoystickStickModeModalVisible = v
  },
})

const currentAxes = computed(() => controllerStore.protocolMapping.axesCorrespondencies)
const currentMode = computed(() => detectStickMode(currentAxes.value))
const currentModeLabel = computed(() => (currentMode.value === null ? 'a custom layout' : `Mode ${currentMode.value}`))

const modeOptions = computed(() =>
  stickModes.map((mode) => ({ mode, axes: remapToStickMode(currentAxes.value, mode, vehicleType.value) }))
)

// The strongest deflection across the enabled controllers, so the knobs follow whichever one the operator moves.
const axisDeflections = computed(() => {
  const readings = [...controllerStore.joysticks.values()]
    .filter((joystick) => !controllerStore.disabledJoysticks.includes(joystick.model))
    .map((joystick) => joystick.state.axes)

  const deflection = (axis: JoystickAxis): number =>
    readings.reduce((strongest, axes) => {
      const value = axes[axis] ?? 0
      return Math.abs(value) > Math.abs(strongest) ? value : strongest
    }, 0)

  const values: Record<number, number> = {}
  for (const stick of stickAxes) {
    values[stick.horizontal] = deflection(stick.horizontal)
    values[stick.vertical] = deflection(stick.vertical)
  }
  return values
})

// Only the picked layout reads live, so the operator watches one diagram answer the sticks instead of five at once.
const liveDeflection = (mode: StickMode, axis: JoystickAxis): number =>
  mode === selectedMode.value ? axisDeflections.value[axis] : 0

const onToggleVehicleMotions = (enabled: boolean | null): void => {
  logUserAction(`Turned the vehicle axis functions view ${enabled ? 'on' : 'off'} in the joystick stick mode selector`)
}

const select = (mode: StickMode): void => {
  logUserAction(`Selected joystick stick layout Mode ${mode}`)
  selectedMode.value = mode
}

const close = (): void => {
  if (!isVisible.value) return
  logUserAction('Closed the joystick stick mode selector')
  isVisible.value = false
}

const apply = (): void => {
  const mode = selectedMode.value
  if (mode === null) return
  logUserAction(`Applied joystick stick layout Mode ${mode}`)

  const mapping = cloneMapping(controllerStore.protocolMapping)
  mapping.axesCorrespondencies = remapToStickMode(mapping.axesCorrespondencies, mode, vehicleType.value)
  controllerStore.protocolMapping = mapping

  openSnackbar({ message: `Sticks laid out as Mode ${mode}.`, variant: 'success', duration: 3000 })
  close()
}

watch(isVisible, (visible) => {
  interfaceStore.isGlassModalAlwaysOnTop = visible
  if (visible) selectedMode.value = currentMode.value
})

// Joystick connection, the window becoming visible and enableJoystickForwardingIfSafe can all turn forwarding back on,
// so without this the sticks would reach the vehicle while the operator compares layouts.
watch([isVisible, () => controllerStore.enableForwarding], () => {
  if (isVisible.value && controllerStore.enableForwarding) controllerStore.enableForwarding = false
})

onUnmounted(() => {
  interfaceStore.isGlassModalAlwaysOnTop = false
})
</script>
