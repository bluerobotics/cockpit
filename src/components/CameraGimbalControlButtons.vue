<template>
  <div class="flex items-center h-9 px-1 gap-x-1 text-white">
    <template v-for="button in buttons" :key="button.key">
      <v-tooltip location="top" :text="tooltipFor(button)">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-bind="tooltipProps"
            icon
            variant="text"
            size="small"
            class="relative"
            :class="{ 'opacity-40': unavailableReason(button) }"
            :aria-label="button.label"
            :loading="pendingKeys.has(button.key)"
            @click="button.zoom === undefined && runAction(button)"
            @pointerdown="button.zoom !== undefined && startZoom(button)"
            @pointerup="button.zoom !== undefined && stopZoom(button)"
            @pointerleave="button.zoom !== undefined && stopZoom(button)"
            @pointercancel="button.zoom !== undefined && stopZoom(button)"
            @keydown.enter.space="button.zoom !== undefined && !$event.repeat && startZoom(button)"
            @keyup.enter.space="button.zoom !== undefined && stopZoom(button)"
            @blur="button.zoom !== undefined && stopZoom(button)"
          >
            <v-icon :icon="button.icon" size="22" :class="button.iconClass" />
            <v-icon
              v-if="unacknowledgedKeys.has(button.key)"
              icon="mdi-alert"
              size="12"
              class="absolute top-0 right-0 text-yellow-400"
            />
          </v-btn>
        </template>
      </v-tooltip>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive } from 'vue'

import { openSnackbar } from '@/composables/snackbar'
import { useDataLakeVariable } from '@/composables/useDataLakeVariable'
import {
  type CameraGimbalActionId,
  type CameraGimbalCommandOutcome,
  gimbalFlagsVariableId,
  hasGimbalYawLock,
  runCameraGimbalAction,
  stopZoomingVehicleCamera,
  vehicleCameraDetectedVariableId,
  vehicleCameraRecordingVariableId,
  zoomVehicleCamera,
} from '@/libs/vehicle/mavlink/camera-gimbal-actions'
import { useMainVehicleStore } from '@/stores/mainVehicle'

const props = defineProps<{
  /**
   * The gimbal and camera these buttons act on, 1-based
   */
  deviceId: number
  /**
   * Send commands even to a gimbal or camera the vehicle has not reported
   */
  sendWithoutDetection: boolean
}>()

const vehicleStore = useMainVehicleStore()

const { value: systemId } = useDataLakeVariable('autopilotSystemId')
const { value: gimbalFlags } = useDataLakeVariable(() =>
  gimbalFlagsVariableId(Number(systemId.value ?? 1), props.deviceId)
)
const { value: cameraDetected } = useDataLakeVariable(vehicleCameraDetectedVariableId)
const { value: isRecording } = useDataLakeVariable(vehicleCameraRecordingVariableId)

const isGimbalDetected = computed(() => gimbalFlags.value !== undefined)
const isYawLocked = computed(() => hasGimbalYawLock(Number(gimbalFlags.value ?? 0)))

/**
 * A control button, running a predefined action or, while held, zooming
 */
interface ControlButton {
  /**
   * Unique key, also tracking its pending and unacknowledged state
   */
  key: string
  /**
   * What the button acts on
   */
  device: 'camera' | 'gimbal'
  /**
   * The action it runs on click, for every button but the zoom ones
   */
  action?: CameraGimbalActionId
  /**
   * Zoom direction while held, for the zoom buttons
   */
  zoom?: -1 | 1
  /**
   * What it does, for its tooltip and accessible name
   */
  label: string
  /**
   * Its icon
   */
  icon: string
  /**
   * Extra classes for its icon
   */
  iconClass?: string
}

const buttons = computed((): ControlButton[] => [
  { key: 'zoom-out', device: 'camera', zoom: -1, label: 'Zoom out', icon: 'mdi-magnify-minus-outline' },
  { key: 'zoom-in', device: 'camera', zoom: 1, label: 'Zoom in', icon: 'mdi-magnify-plus-outline' },
  {
    key: 'focus',
    device: 'camera',
    action: 'vehicle_camera_auto_focus',
    label: 'Autofocus',
    icon: 'mdi-image-filter-center-focus',
  },
  {
    key: 'picture',
    device: 'camera',
    action: 'vehicle_camera_take_picture',
    label: 'Take picture',
    icon: 'mdi-camera',
  },
  {
    key: 'recording',
    device: 'camera',
    action: 'vehicle_camera_toggle_recording',
    label: isRecording.value === true ? 'Stop recording' : 'Start recording',
    icon: isRecording.value === true ? 'mdi-stop' : 'mdi-record-rec',
    iconClass: isRecording.value === true ? 'text-red-500' : undefined,
  },
  { key: 'center', device: 'gimbal', action: 'gimbal_center', label: 'Center gimbal', icon: 'mdi-crosshairs' },
  {
    key: 'down',
    device: 'gimbal',
    action: 'gimbal_point_down',
    label: 'Point gimbal down',
    icon: 'mdi-arrow-collapse-down',
  },
  {
    key: 'home',
    device: 'gimbal',
    action: 'gimbal_point_home',
    label: 'Point gimbal at home',
    icon: 'mdi-home-import-outline',
  },
  {
    key: 'yaw-lock',
    device: 'gimbal',
    action: 'gimbal_toggle_yaw_lock',
    label: isYawLocked.value ? 'Unlock gimbal yaw (follow vehicle)' : 'Lock gimbal yaw to North',
    icon: isYawLocked.value ? 'mdi-lock' : 'mdi-lock-open-variant-outline',
  },
  {
    key: 'retract',
    device: 'gimbal',
    action: 'gimbal_retract',
    label: 'Retract gimbal',
    icon: 'mdi-arrow-collapse-up',
  },
])

const pendingKeys = reactive(new Set<string>())
const unacknowledgedKeys = reactive(new Set<string>())

const unavailableReason = (button: ControlButton): string | undefined => {
  if (button.action === 'gimbal_point_home' && props.deviceId !== 1) {
    return 'ArduPilot only points its primary gimbal (gimbal 1) at home'
  }
  if (props.sendWithoutDetection) return undefined
  if (button.device === 'gimbal' && !isGimbalDetected.value) return `Gimbal ${props.deviceId} was not detected`
  if (button.device === 'camera' && cameraDetected.value !== true) return 'No vehicle camera was detected'
  return undefined
}

const tooltipFor = (button: ControlButton): string => {
  const reason = unavailableReason(button)
  if (reason) return `${button.label} — ${reason}`
  if (!unacknowledgedKeys.has(button.key)) return button.label
  return `${button.label} — the vehicle did not confirm the last request, so it may not have run`
}

const canSend = (button: ControlButton): boolean => {
  if (!vehicleStore.isVehicleOnline) {
    openSnackbar({ message: 'Vehicle is disconnected.', variant: 'error', duration: 3000 })
    return false
  }
  const reason = unavailableReason(button)
  if (reason) {
    const hint =
      button.action === 'gimbal_point_home'
        ? ''
        : " Turn on 'Send without detection' in the widget settings to try anyway."
    openSnackbar({ message: `${reason}.${hint}`, variant: 'error', duration: 4000 })
    return false
  }
  return true
}

const track = async (button: ControlButton, send: () => Promise<CameraGimbalCommandOutcome>): Promise<void> => {
  pendingKeys.add(button.key)
  try {
    const outcome = await send()
    if (outcome === 'unacknowledged') unacknowledgedKeys.add(button.key)
    else unacknowledgedKeys.delete(button.key)
    if (button.action === 'vehicle_camera_take_picture') {
      openSnackbar({ message: 'Asked the vehicle camera to take a picture.', variant: 'success', duration: 2000 })
    }
  } catch (error) {
    unacknowledgedKeys.delete(button.key)
    openSnackbar({ message: `${button.label} failed: ${(error as Error).message}`, variant: 'error', duration: 3000 })
  } finally {
    pendingKeys.delete(button.key)
  }
}

const runAction = (button: ControlButton): void => {
  logUserAction(`Clicked the '${button.label}' control of camera and gimbal ${props.deviceId}`)
  if (!button.action || !canSend(button)) return
  const action = button.action
  void track(button, () => runCameraGimbalAction(action, props.deviceId))
}

const zoomingKeys = new Set<string>()

const startZoom = (button: ControlButton): void => {
  logUserAction(`Started holding the '${button.label}' control of camera ${props.deviceId}`)
  if (!button.zoom || !canSend(button)) return
  const direction = button.zoom
  zoomingKeys.add(button.key)
  void track(button, () => zoomVehicleCamera(direction, props.deviceId))
}

const stopZoom = (button: ControlButton): void => {
  // Leaving the button without having pressed it must not stop a zoom another control started
  if (zoomingKeys.delete(button.key)) stopZoomingVehicleCamera(props.deviceId)
}

onBeforeUnmount(() => {
  if (zoomingKeys.size > 0) stopZoomingVehicleCamera(props.deviceId)
})
</script>
