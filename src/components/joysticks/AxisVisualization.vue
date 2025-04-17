<template>
  <div class="flex justify-between h-[20px]">
    <div class="w-[50px]">
      <div
        v-if="rawValue < 0"
        class="w-full h-full bg-[#2c99ce] origin-right"
        :style="`transform: scaleX(${rawValue * -1})`"
      />
    </div>
    <div class="flex flex-col w-[50px] -mt-2">
      <p>{{ rawValue.toFixed(2) }}</p>
      <p class="text-[10px]">{{ processedValue.toFixed(2) }}</p>
    </div>
    <div class="w-[50px]">
      <div
        v-if="rawValue > 0"
        class="w-full h-full bg-[#2c99ce] origin-left"
        :style="`transform: scaleX(${rawValue})`"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The raw axis value from the joystick (-1 to 1)
 */
defineProps<{
  /**
   * The raw value for the axis
   */
  rawValue: number
  /**
   * The processed value for that same axis
   */
  processedValue: number
}>()
</script>
