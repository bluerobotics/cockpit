<template>
  <div class="flex flex-col rounded-lg bg-[#FFFFFF11] p-4 elevation-1">
    <span class="text-center text-body-2 font-weight-bold">{{ vehicle?.name ?? 'Vehicle motion' }}</span>
    <div class="relative min-h-[260px] flex-1">
      <div ref="host" class="absolute inset-0" />
      <p v-if="message" class="absolute inset-0 flex items-center justify-center text-center text-caption">
        {{ message }}
      </p>
    </div>
    <p class="text-center text-caption">Move a stick, or click an axis name or arrow, to see the motion it commands.</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import blueBoatModelUrl from '@/assets/vehicles/models/blueboat.glb?url'
import blueRovModelUrl from '@/assets/vehicles/models/bluerov2.glb?url'
import quadcopterModelUrl from '@/assets/vehicles/models/quadcopter.glb?url'
import { type VehicleMotion, vehicleMotionsOf } from '@/libs/joystick/stick-modes'
import type { VehicleMotionPreview } from '@/libs/joystick/vehicle-motion-preview'
import { Type as VehicleType } from '@/libs/vehicle/vehicle'

const props = defineProps<{
  /**
   * Vehicle to show, or undefined when there is no model for it.
   */
  vehicleType?: VehicleType
}>()

/**
 * A vehicle the preview can draw.
 */
interface PreviewVehicle {
  /**
   * Name shown above the preview.
   */
  name: string
  /**
   * URL of the vehicle's glTF model.
   */
  model: string
}

const previewVehicles: Partial<Record<VehicleType, PreviewVehicle>> = {
  [VehicleType.Sub]: { name: 'BlueROV2', model: blueRovModelUrl },
  [VehicleType.Rover]: { name: 'BlueBoat', model: blueBoatModelUrl },
  [VehicleType.Copter]: { name: 'UAV', model: quadcopterModelUrl },
}

const host = ref<HTMLElement>()
const status = ref<'loading' | 'ready' | 'failed'>('loading')
let preview: VehicleMotionPreview | undefined
let loadCount = 0

const vehicle = computed(() => (props.vehicleType === undefined ? undefined : previewVehicles[props.vehicleType]))

const message = computed(() => {
  if (vehicle.value === undefined) return 'The motion preview is available for submarines, boats and copters.'
  if (status.value === 'loading') return 'Loading the vehicle...'
  if (status.value === 'failed') return 'The vehicle could not be drawn on this device.'
  return undefined
})

const load = async (): Promise<void> => {
  preview?.dispose()
  preview = undefined
  const attempt = ++loadCount
  const target = vehicle.value
  if (target === undefined || host.value === undefined) return

  status.value = 'loading'
  try {
    const { createVehicleMotionPreview } = await import('@/libs/joystick/vehicle-motion-preview')
    const created = await createVehicleMotionPreview(host.value, target.model, vehicleMotionsOf(props.vehicleType))
    if (attempt !== loadCount) return created.dispose()
    preview = created
    status.value = 'ready'
  } catch (error) {
    if (attempt !== loadCount) return
    console.error('Could not draw the vehicle motion preview.', error)
    status.value = 'failed'
  }
}

watch(vehicle, load)
onMounted(load)

onBeforeUnmount(() => {
  loadCount++
  preview?.dispose()
})

defineExpose({
  /**
   * Plays a motion on the vehicle shown, if it has finished loading.
   * @param {VehicleMotion} motion - Motion to play.
   * @param {number} direction - 1 for its positive direction, -1 for the opposite one.
   */
  play: (motion: VehicleMotion, direction: number): void => {
    preview?.play(motion, direction)
  },
})
</script>
