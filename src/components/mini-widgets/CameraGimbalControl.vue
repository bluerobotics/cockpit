<template>
  <div ref="widgetRoot" class="flex items-center" :class="{ 'pointer-events-none': widgetStore.editingMode }">
    <div v-if="miniWidget.options.displayMode === 'full'" class="flex items-center pl-2 rounded-lg bg-slate-800/60">
      <div class="relative flex text-white" :aria-label="`Camera and gimbal ${miniWidget.options.deviceId}`">
        <v-icon icon="mdi-camera-wireless" size="24" />
        <span :class="idBadgeClass">{{ miniWidget.options.deviceId }}</span>
      </div>
      <CameraGimbalControlButtons
        :device-id="miniWidget.options.deviceId"
        :send-without-detection="miniWidget.options.sendWithoutDetection"
      />
    </div>
    <v-menu
      v-else
      v-model="isMenuOpen"
      :location="`${menuLocation} center`"
      :close-on-content-click="false"
      offset="6"
      @update:model-value="onMenuToggle"
    >
      <template #activator="{ props: menuProps }">
        <v-btn
          v-bind="menuProps"
          variant="text"
          class="h-9 px-2 rounded-lg bg-slate-800/60 text-white"
          :aria-label="`Camera and gimbal ${miniWidget.options.deviceId} controls`"
        >
          <div class="relative flex">
            <v-icon icon="mdi-camera-wireless" size="24" />
            <span :class="idBadgeClass">{{ miniWidget.options.deviceId }}</span>
          </div>
          <v-icon :icon="menuLocation === 'top' ? 'mdi-menu-up' : 'mdi-menu-down'" size="20" class="-mr-1" />
        </v-btn>
      </template>
      <div class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
        <CameraGimbalControlButtons
          :device-id="miniWidget.options.deviceId"
          :send-without-detection="miniWidget.options.sendWithoutDetection"
        />
      </div>
    </v-menu>
  </div>
  <v-dialog v-model="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen" width="auto">
    <v-card class="pa-4 text-white w-[380px]" style="border-radius: 15px" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-center">Camera and gimbal controls</v-card-title>
      <div class="absolute top-4 right-4">
        <v-btn
          icon
          size="30"
          variant="text"
          class="text-white text-[22px]"
          aria-label="Close"
          @click="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen = false"
        >
          <v-icon icon="mdi-close" />
        </v-btn>
      </div>
      <v-card-text class="flex flex-col gap-y-3">
        <v-text-field
          :model-value="miniWidget.options.deviceId"
          label="Gimbal/camera ID"
          type="number"
          min="1"
          step="1"
          density="compact"
          variant="outlined"
          :hint="detectedGimbalsHint"
          persistent-hint
          @update:model-value="setDeviceId"
        />
        <v-checkbox
          :model-value="miniWidget.options.sendWithoutDetection"
          label="Send without detection"
          hint="Send commands even to a gimbal or camera the vehicle has not reported"
          persistent-hint
          density="compact"
          @update:model-value="setSendWithoutDetection"
        />
        <v-radio-group
          :model-value="miniWidget.options.displayMode"
          label="Display"
          hide-details
          @update:model-value="setDisplayMode"
        >
          <v-radio label="Collapsed, with the controls in a popup" value="collapsed" />
          <v-radio label="Full, with every control on the bar" value="full" />
        </v-radio-group>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useElementBounding, useWindowSize } from '@vueuse/core'
import { computed, onBeforeMount, ref, toRefs } from 'vue'

import CameraGimbalControlButtons from '@/components/CameraGimbalControlButtons.vue'
import { useDataLakeVariable } from '@/composables/useDataLakeVariable'
import { detectedGimbalIds } from '@/libs/vehicle/mavlink/camera-gimbal-actions'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { MiniWidget } from '@/types/widgets'

const props = defineProps<{
  /**
   * Configuration of the widget
   */
  miniWidget: MiniWidget
}>()
const miniWidget = toRefs(props).miniWidget

const widgetStore = useWidgetManagerStore()
const interfaceStore = useAppInterfaceStore()

onBeforeMount(() => {
  const defaultOptions = {
    displayMode: 'collapsed' as 'collapsed' | 'full',
    deviceId: 1,
    sendWithoutDetection: false,
  }
  miniWidget.value.options = { ...defaultOptions, ...miniWidget.value.options }
})

const idBadgeClass =
  'absolute -top-1 -left-1 text-[10px] font-bold leading-none px-[3px] py-[1px] rounded bg-white text-slate-900'

const widgetRoot = ref<HTMLElement>()
const { top, height } = useElementBounding(widgetRoot)
const { height: windowHeight } = useWindowSize()
// Open towards the side with room: up from the bottom half of the screen, down from the top half
const menuLocation = computed(() => (top.value + height.value / 2 > windowHeight.value / 2 ? 'top' : 'bottom'))

const isMenuOpen = ref(false)

const { value: systemId } = useDataLakeVariable('autopilotSystemId')
const detectedGimbalsHint = computed(() => {
  // Re-read whenever the dialog opens, as gimbals are found by their attitude reports
  if (!widgetStore.miniWidgetManagerVars(miniWidget.value.hash).configMenuOpen) return ''
  const ids = detectedGimbalIds(Number(systemId.value ?? 1))
  return ids.length ? `Detected gimbals: ${ids.join(', ')}` : 'No gimbal detected on the vehicle'
})

const onMenuToggle = (open: boolean): void => {
  logUserAction(
    `${open ? 'Opened' : 'Closed'} the camera and gimbal ${miniWidget.value.options.deviceId} controls popup`
  )
}

const setDeviceId = (value: string): void => {
  const id = Math.round(Number(value))
  if (!Number.isFinite(id) || id < 1) return
  logUserAction(`Set the camera and gimbal controls to gimbal and camera ${id}`)
  miniWidget.value.options.deviceId = id
}

const setSendWithoutDetection = (value: boolean | null): void => {
  logUserAction(`${value ? 'Enabled' : 'Disabled'} sending camera and gimbal commands without detection`)
  miniWidget.value.options.sendWithoutDetection = Boolean(value)
}

const setDisplayMode = (mode: 'collapsed' | 'full'): void => {
  logUserAction(`Set the camera and gimbal controls to the '${mode}' display`)
  miniWidget.value.options.displayMode = mode
}
</script>
