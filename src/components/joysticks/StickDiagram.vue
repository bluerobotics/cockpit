<template>
  <div class="grid grid-cols-[1fr_auto_1fr] items-center py-1">
    <span class="col-start-2 row-start-1 text-center text-caption leading-tight">{{ axisLabel(vertical) }}</span>
    <div class="col-start-2 row-start-2 flex items-center justify-self-center text-[#FFFFFF77]">
      <v-icon size="21" icon="mdi-menu-left" class="-mr-1" />
      <div class="flex flex-col items-center">
        <v-icon size="21" icon="mdi-menu-up" />
        <div class="h-3 w-3 rounded-full bg-white" :style="{ transform: knobTransform }" />
        <v-icon size="21" icon="mdi-menu-down" />
      </div>
      <v-icon size="21" icon="mdi-menu-right" class="-ml-1" />
    </div>
    <span class="col-start-3 row-start-2 pl-2 text-caption leading-tight">{{ axisLabel(horizontal) }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { rcFunctionName, vehicleMotionName } from '@/libs/joystick/stick-modes'
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
}>()

// Far enough that a fully deflected knob reaches into the arrow it is pushed against.
const knobTravel = 8

const axisLabel = (axis?: AxisCorrespondency): string =>
  vehicleMotionName(axis?.action, props.vehicleType) ??
  rcFunctionName(axis?.action) ??
  axis?.action.name ??
  'No function'

const knobTransform = computed(
  () => `translate(${props.horizontalValue * knobTravel}px, ${props.verticalValue * knobTravel}px)`
)
</script>
