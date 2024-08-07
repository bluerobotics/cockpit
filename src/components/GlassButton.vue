<template>
  <div
    class="flex flex-col items-center 2xl:gap-y-1 xl: gap-y-1 py-2"
    :class="[
      isUncontained && !isSelected ? (isNoEffects ? '' : 'mark-on-hover') : '',
      isSelected === true ? 'frosted-button-selected' : '',
      isDisabled ? 'opacity-[0.4] cursor-default' : 'opacity-100 cursor-pointer',
    ]"
  >
    <button
      :disabled="isDisabled"
      class="flex flex-col items-center justify-center"
      :class="[
        isUncontained ? 'no-glass' : 'frosted-button',
        { 'frosted-button-disabled': isDisabled, 'rounded-full': isRound },
        buttonClass,
      ]"
      :style="{ width: buttonStyle.width.toString() + 'px', height: buttonStyle.height.toString() + 'px' }"
    >
      <template v-if="tooltip">
        <v-tooltip open-delay="600" activator="parent" location="top">
          {{ tooltip }}
        </v-tooltip>
      </template>
      <v-icon
        v-if="isRound || isUncontained"
        :size="props.iconSize || calculatedIconSize"
        :class="iconClass"
        class="opacity-90"
      >
        {{ icon }}
      </v-icon>
      <div v-else class="flex items-center align-center justify-center w-full h-full">
        <v-icon :size="props.iconSize || calculatedIconSize" :class="iconClass">{{ icon }}</v-icon>
        <div class="text-white select-none" :class="labelClass">
          {{ label }}
        </div>
      </div>
    </button>
    <div
      v-if="isRound || isUncontained"
      class="flex justify-center align-center text-center select-none text-white px-4 font-semibold 2xl:mt-2 xl:mt-1 lg:mt-0 md:mt-0 sm:-mt-1 mt-1"
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
  labelClass?: string | string[]
  /**
   * The icon to display in the button (prepend on rectangular, centered on round).
   */
  icon?: string
  /**
   * Additional Tailwind classes for the icon.
   */
  iconClass?: string | string[]
  /**
   * The size of the icon.
   */
  iconSize?: number
  /**
   * Additional Tailwind classes for the button.
   */
  buttonClass?: string | string[]
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
  /**
   * No effects on hover.
   */
  noEffects?: boolean
}>()

const label = computed(() => props.label)
const icon = computed(() => props.icon)
const isDisabled = computed(() => props.disabled)
const tooltip = computed(() => props.tooltip)
const isSelected = computed(() => props.selected)
const isRound = computed(() => props.variant === 'round')
const isUncontained = computed(() => props.variant === 'uncontained')
const calculatedIconSize = computed(() => (isRound.value ? (props.width || 26) * 0.7 : props.iconSize))
const iconClass = computed(() => props.iconClass)
const isNoEffects = computed(() => props.noEffects)

const buttonStyle = computed(() => ({
  width: props.width || (props.iconSize || 24) * 1.1,
  height: (isRound.value ? props.width : props.height) || (props.iconSize || 24) * 1.1,
}))
</script>

<style scoped>
.frosted-button {
  background-color: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 1px 1px 1px rgba(255, 255, 255, 0.3), -1px -1px 2px rgba(0, 0, 0, 0.15);
  color: white;
  transition: all 0.3s;
}
.frosted-button:hover {
  background-color: rgba(255, 255, 255, 0.35);
}
.frosted-button-selected {
  background-color: rgba(255, 255, 255, 0.1);
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
  background-color: rgba(255, 255, 255, 0.05);
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
