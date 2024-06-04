<template>
  <div
    class="flex flex-col items-center 2xl:gap-y-1 xl: gap-y-1 cursor-pointer"
    :class="isUncontained ? 'mark-on-hover py-2 ' : undefined"
  >
    <button
      :disabled="disabled"
      class="flex items-center justify-center"
      :class="[
        isUncontained ? 'no-glass' : 'frosted-button',
        selected ? 'frosted-button-selected' : '',
        { 'frosted-button-disabled': disabled, 'rounded-full': isRound },
        buttonClass,
      ]"
      :style="{ width: buttonStyle.width!.toString() + 'px', height: buttonStyle.height!.toString() + 'px' }"
    >
      <template v-if="tooltip">
        <v-tooltip open-delay="600" activator="parent" location="top">
          {{ tooltip }}
        </v-tooltip>
      </template>
      <v-icon v-if="isRound || isUncontained" :size="iconSize" :class="iconClass" class="ml-[4%] mt-[2%]">
        {{ icon }}
      </v-icon>
      <div v-else class="flex items-center justify-center w-full h-full">
        <v-icon :size="iconSize" class="mr-2" :class="iconClass">
          {{ icon }}
        </v-icon>
        <div class="text-white ml-2" :class="labelClass">
          {{ label }}
        </div>
      </div>
    </button>
    <div
      v-if="isRound || isUncontained"
      class="flex justify-center align-center text-center text-white px-4 font-semibold 2xl:mt-2 xl:mt-1 lg:mt-0 md:mt-0 sm:-mt-1 mt-1"
      :class="labelClass"
    >
      {{ label }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  /**
   * The text label displayed on the button (rectangular variant) or under the button (round).
   */
  label?: string
  /**
   * Additional Tailwind classes for the label.
   */
  labelClass?: string
  /**
   * The icon to display in the button (prepend on rectangular, centered on round).
   */
  icon?: string
  /**
   * Additional Tailwind classes for the icon.
   */
  iconClass?: string
  /**
   * The size of the icon.
   */
  iconSize?: number
  /**
   * Additional Tailwind classes for the button.
   */
  buttonClass?: string
  /**
   * Whether the button is disabled.
   */
  disabled?: boolean
  /**
   * The tooltip text displayed on hover.
   */
  tooltip?: string
  /**
   * Visual feedback for the button when toggled selected.
   */
  selected?: boolean
  /**
   * The shape of the button.
   */
  variant?: 'round' | 'rectangular' | 'uncontained'
  /**
   * The width of the button (when round, this is the only size nedded).
   */
  width?: number
  /**
   * The height of the button.
   */
  height?: number
}>()

const label = computed(() => props.label)
const icon = computed(() => props.icon)
const disabled = computed(() => props.disabled)
const tooltip = computed(() => props.tooltip)
const selected = computed(() => props.selected)
const isRound = computed(() => props.variant === 'round')
const isUncontained = computed(() => props.variant === 'uncontained')
const iconSize = computed(() => (isRound.value ? (props.width || 26) * 0.6 : props.iconSize))

const buttonStyle = computed(() => ({
  width: props.width || 40,
  height: isRound.value ? props.width : props.height || 40,
}))
</script>

<style scoped>
.frosted-button {
  background-color: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  color: white;
  transition: all 0.3s;
}
.frosted-button:hover {
  background-color: rgba(255, 255, 255, 0.35);
}
.frosted-button-selected {
  background-color: rgba(255, 255, 255, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.25);
}
.frosted-button-disabled {
  background-color: rgba(255, 255, 255, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: none;
  color: rgba(255, 255, 255, 0.5);
}
.no-glass {
  background-color: transparent;
  border: none;
  box-shadow: none;
  color: white;
}
.mark-on-hover:hover {
  background-color: rgba(255, 255, 255, 0.1);
}
.icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}
.divider {
  width: 1px;
  height: 75%;
  background-color: rgba(255, 255, 255, 0.2);
}
</style>
