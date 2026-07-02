<template>
  <v-tooltip location="top" text="Place mission here">
    <template #activator="{ props: tooltipProps }">
      <button
        v-bind="tooltipProps"
        type="button"
        aria-label="Place mission here"
        :style="positionStyle"
        class="absolute text-[22px] -ml-[10px] -mt-[10px] bg-transparent rounded-full cursor-pointer elevation-4 z-[650]"
        @click="emit('confirm')"
      >
        <v-icon color="green" class="border-2 rounded-full bg-white">mdi-check-circle</v-icon>
      </button>
    </template>
  </v-tooltip>
  <v-tooltip location="top" text="Width scale (%) — drag corners to resize, hold Shift for uniform">
    <template #activator="{ props: tooltipProps }">
      <div
        v-bind="tooltipProps"
        :style="positionStyle"
        class="absolute mt-[46px] ml-[10px] rounded-lg elevation-4 z-[650] flex items-center bg-[#333333EE] pr-1"
      >
        <v-icon color="white" size="14" class="ml-1">mdi-arrow-expand-horizontal</v-icon>
        <input
          v-model.number="scaleXModel"
          class="rounded-lg bg-transparent text-white w-12 pl-1 pa-0"
          type="number"
          aria-label="Width scale percent"
          :min="limits.scaleMinPercent"
          :max="limits.scaleMaxPercent"
          step="5"
          @blur="emit('clamp-scale-x')"
          @change="emit('clamp-scale-x')"
        />
      </div>
    </template>
  </v-tooltip>
  <v-tooltip location="top" text="Height scale (%) — drag corners to resize, hold Shift for uniform">
    <template #activator="{ props: tooltipProps }">
      <div
        v-bind="tooltipProps"
        :style="positionStyle"
        class="absolute mt-[76px] ml-[10px] rounded-lg elevation-4 z-[650] flex items-center bg-[#333333EE] pr-1"
      >
        <v-icon color="white" size="14" class="ml-1">mdi-arrow-expand-vertical</v-icon>
        <input
          v-model.number="scaleYModel"
          class="rounded-lg bg-transparent text-white w-12 pl-1 pa-0"
          type="number"
          aria-label="Height scale percent"
          :min="limits.scaleMinPercent"
          :max="limits.scaleMaxPercent"
          step="5"
          @blur="emit('clamp-scale-y')"
          @change="emit('clamp-scale-y')"
        />
      </div>
    </template>
  </v-tooltip>
  <v-tooltip location="top" text="Rotation (°)">
    <template #activator="{ props: tooltipProps }">
      <div
        v-bind="tooltipProps"
        :style="positionStyle"
        class="absolute mt-[106px] ml-[10px] rounded-lg elevation-4 z-[650] flex items-center bg-[#333333EE] pr-1"
      >
        <v-icon color="white" size="14" class="ml-1">mdi-rotate-right</v-icon>
        <input
          v-model.number="rotationModel"
          class="rounded-lg bg-transparent text-white w-12 pl-1 pa-0"
          type="number"
          aria-label="Rotation degrees"
          :min="limits.rotationMinDeg"
          :max="limits.rotationMaxDeg"
          step="5"
          @blur="emit('clamp-rotation')"
          @change="emit('clamp-rotation')"
        />
      </div>
    </template>
  </v-tooltip>
  <v-tooltip location="top" text="Reset scale & rotation">
    <template #activator="{ props: tooltipProps }">
      <button
        v-bind="tooltipProps"
        type="button"
        aria-label="Reset scale and rotation"
        :style="positionStyle"
        class="absolute mt-[136px] ml-[56px] flex items-center justify-center w-6 h-6 rounded-full cursor-pointer elevation-4 z-[650] bg-[#333333EE]"
        @click="emit('reset')"
      >
        <v-icon color="white" size="16">mdi-restore</v-icon>
      </button>
    </template>
  </v-tooltip>
  <v-tooltip location="top" text="Cancel placement">
    <template #activator="{ props: tooltipProps }">
      <button
        v-bind="tooltipProps"
        type="button"
        aria-label="Cancel placement"
        :style="positionStyle"
        class="absolute text-[14px] -mt-[5px] ml-[52px] bg-transparent rounded-full cursor-pointer elevation-4 z-[650]"
        @click="emit('cancel')"
      >
        <div color="white" class="border-2 rounded-full bg-red text-[18px] flex items-center justify-center w-7 h-7">
          <v-icon size="16" color="white">mdi-delete</v-icon>
        </div>
      </button>
    </template>
  </v-tooltip>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { PLACEMENT_LIMITS } from '@/libs/mission/library'

const props = defineProps<{
  /**
   * Absolute-position style (left/top or display:none) applied to every toolbar control.
   */
  positionStyle: Record<string, string>
  /**
   * Current width-scale percentage bound to the width input.
   */
  scaleXPercent: number
  /**
   * Current height-scale percentage bound to the height input.
   */
  scaleYPercent: number
  /**
   * Current rotation in degrees bound to the rotation input.
   */
  rotationDeg: number
  /**
   * Min/max bounds for the scale and rotation inputs.
   */
  limits: typeof PLACEMENT_LIMITS
}>()

const emit = defineEmits<{
  (e: 'update:scaleXPercent', value: number): void
  (e: 'update:scaleYPercent', value: number): void
  (e: 'update:rotationDeg', value: number): void
  (e: 'clamp-scale-x'): void
  (e: 'clamp-scale-y'): void
  (e: 'clamp-rotation'): void
  (e: 'confirm'): void
  (e: 'reset'): void
  (e: 'cancel'): void
}>()

const scaleXModel = computed({
  get: () => props.scaleXPercent,
  set: (value: number) => emit('update:scaleXPercent', value),
})
const scaleYModel = computed({
  get: () => props.scaleYPercent,
  set: (value: number) => emit('update:scaleYPercent', value),
})
const rotationModel = computed({
  get: () => props.rotationDeg,
  set: (value: number) => emit('update:rotationDeg', value),
})
</script>
