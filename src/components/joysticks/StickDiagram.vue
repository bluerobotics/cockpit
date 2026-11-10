<template>
  <div class="grid grid-cols-[1fr_auto_1fr] items-center py-1">
    <button
      type="button"
      class="col-start-2 row-start-1 text-center text-caption leading-tight"
      :class="{ 'hover:underline': canPreview(vertical) }"
      :disabled="!canPreview(vertical)"
      @click.stop="preview(vertical, -1)"
    >
      {{ axisLabel(vertical) }}
    </button>
    <div class="col-start-2 row-start-2 flex items-center justify-self-center text-[#FFFFFF77]">
      <v-btn
        icon
        variant="text"
        :size="21"
        class="-mr-1"
        aria-label="Preview pushing the stick left"
        :disabled="!canPreview(horizontal)"
        @click.stop="preview(horizontal, -1)"
      >
        <v-icon size="21" icon="mdi-menu-left" />
      </v-btn>
      <div class="flex flex-col items-center">
        <v-btn
          icon
          variant="text"
          :size="21"
          aria-label="Preview pushing the stick up"
          :disabled="!canPreview(vertical)"
          @click.stop="preview(vertical, -1)"
        >
          <v-icon size="21" icon="mdi-menu-up" />
        </v-btn>
        <div class="h-3 w-3 rounded-full bg-white" :style="{ transform: knobTransform }" />
        <v-btn
          icon
          variant="text"
          :size="21"
          aria-label="Preview pushing the stick down"
          :disabled="!canPreview(vertical)"
          @click.stop="preview(vertical, 1)"
        >
          <v-icon size="21" icon="mdi-menu-down" />
        </v-btn>
      </div>
      <v-btn
        icon
        variant="text"
        :size="21"
        class="-ml-1"
        aria-label="Preview pushing the stick right"
        :disabled="!canPreview(horizontal)"
        @click.stop="preview(horizontal, 1)"
      >
        <v-icon size="21" icon="mdi-menu-right" />
      </v-btn>
    </div>
    <button
      type="button"
      class="col-start-3 row-start-2 pl-2 text-left text-caption leading-tight"
      :class="{ 'hover:underline': canPreview(horizontal) }"
      :disabled="!canPreview(horizontal)"
      @click.stop="preview(horizontal, 1)"
    >
      {{ axisLabel(horizontal) }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { rcFunctionName, vehicleMotion, vehicleMotionName } from '@/libs/joystick/stick-modes'
import { type Type as VehicleType } from '@/libs/vehicle/vehicle'
import { type JoystickAxisActionCorrespondency } from '@/types/joystick'

type AxisCorrespondency = JoystickAxisActionCorrespondency[number]

const props = defineProps<{
  /**
   * Correspondency assigned to the stick's horizontal axis.
   */
  horizontal?: AxisCorrespondency
  /**
   * Correspondency assigned to the stick's vertical axis.
   */
  vertical?: AxisCorrespondency
  /**
   * Reading of the horizontal axis, from -1 fully left to +1 fully right, or 0 to rest the knob centered.
   */
  horizontalValue: number
  /**
   * Reading of the vertical axis, from -1 fully up to +1 fully down, or 0 to rest the knob centered.
   */
  verticalValue: number
  /**
   * Vehicle whose motions should name the axes, or undefined to name them after their RC functions.
   */
  vehicleType?: VehicleType
  /**
   * Vehicle the motion preview shows, whose motions make an axis clickable, or undefined to leave them all inert.
   */
  previewVehicleType?: VehicleType
}>()

const emit = defineEmits<{
  (e: 'preview', axis: AxisCorrespondency, deflection: number): void
}>()

// Far enough that a fully deflected knob reaches into the arrow it is pushed against.
const knobTravel = 8

const axisLabel = (axis?: AxisCorrespondency): string =>
  vehicleMotionName(axis?.action, props.vehicleType) ??
  rcFunctionName(axis?.action) ??
  axis?.action.name ??
  'No function'

const canPreview = (axis?: AxisCorrespondency): boolean =>
  vehicleMotion(axis?.action, props.previewVehicleType) !== undefined

const preview = (axis: AxisCorrespondency | undefined, deflection: number): void => {
  if (axis !== undefined) emit('preview', axis, deflection)
}

const knobTransform = computed(
  () => `translate(${props.horizontalValue * knobTravel}px, ${props.verticalValue * knobTravel}px)`
)
</script>
